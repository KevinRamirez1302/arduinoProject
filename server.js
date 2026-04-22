/**
 * ============================================================
 *   PUENTE SERIAL - Arduino <-> Node.js <-> Navegador
 *   Arquitectura: Express + SerialPort + Socket.io
 * ============================================================
 */

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path       = require('path');

// ── Configuración ────────────────────────────────────────────
const PORT_SERIAL  = process.env.SERIAL_PORT  || 'COM3';
const BAUD_RATE    = parseInt(process.env.BAUD_RATE)   || 9600;
const SERVER_PORT  = parseInt(process.env.SERVER_PORT) || 3000;

// ── Express + HTTP + Socket.io ───────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' }
});

// ── MySQL Connection ──────────────────────────────────────────
const mysql = require('mysql2/promise');
let dbPool;
async function initDB() {
  try {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'sensores',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    // Create database and table if not exists
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || ''
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'sensores'}\`;`);
    await connection.end();

    const table = process.env.DB_TABLE || 'movimientos';
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS \`${table}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        detectado BOOLEAN NOT NULL
      );
    `);
    console.log('✅  Base de datos MySQL inicializada.');
  } catch (error) {
    console.error('❌  Error al conectar MySQL:', error.message);
  }
}
initDB();

// Sirve los archivos estáticos del dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint para listar los puertos disponibles
app.get('/api/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json(ports);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SerialPort ───────────────────────────────────────────────
let serialPort = null;
let parser     = null;
let serialConnected = false;

function connectSerial(portPath = PORT_SERIAL, baud = BAUD_RATE) {
  if (serialPort && serialPort.isOpen) {
    serialPort.close();
  }

  console.log(`\n🔌  Conectando a ${portPath} @ ${baud} baudios...`);

  serialPort = new SerialPort({ path: portPath, baudRate: baud, autoOpen: false });
  parser     = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

  serialPort.open((err) => {
    if (err) {
      serialConnected = false;
      console.error('❌  Error al abrir el puerto:', err.message);
      io.emit('serial:status', { connected: false, port: portPath, error: err.message });
      return;
    }
    serialConnected = true;
    console.log('✅  Puerto serial abierto correctamente.\n');
    io.emit('serial:status', { connected: true, port: portPath, baud });
  });

  // Recibe cada línea del Arduino y la emite a TODOS los clientes web
  parser.on('data', (line) => {
    const raw = line.trim();
    if (!raw) return;

    const timestamp = new Date().toISOString();

    // Intenta parsear como JSON, luego como número, luego como texto con número
    let payload;
    try {
      payload = JSON.parse(raw);
      if (typeof payload !== 'object' || payload === null) {
        payload = { value: payload };
      }
    } catch {
      // Primero intentamos número directo (ej: "15")
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        payload = { value: num };
      } else {
        // Fallback: extraer número de texto como "Distancia: 15cm"
        const match = raw.match(/[\d.]+/);
        payload = match ? { value: parseFloat(match[0]) } : { text: raw };
      }
    }

    const packet = { timestamp, raw, data: payload };

    console.log('📡  Dato recibido:', packet);
    io.emit('serial:data', packet);

    // Guardar en MySQL si la distancia es menor a 30cm (alguien se acerca)
    if (payload && payload.value !== undefined && payload.value < 30 && payload.value > 0 && dbPool) {
      const table = process.env.DB_TABLE || 'movimientos';
      dbPool.query(`INSERT INTO \`${table}\` (detectado) VALUES (1)`)
      
        .then(() => console.log('💾  Guardado en base de datos local (Proximidad detectada)'))
        .catch(err => console.error('❌  Error al insertar en DB:', err.message));
    }
  });

  serialPort.on('error', (err) => {
    console.error('⚠️   Error serial:', err.message);
    io.emit('serial:error', { message: err.message });
  });

  serialPort.on('close', () => {
    serialConnected = false;
    console.log('🔴  Puerto serial cerrado.');
    io.emit('serial:status', { connected: false, port: portPath });
  });
}

// ── Socket.io — Eventos del cliente ─────────────────────────
io.on('connection', (socket) => {
  console.log(`🌐  Cliente conectado: ${socket.id}`);

  // Envía el estado actual al nuevo cliente
  socket.emit('serial:status', {
    connected: serialConnected,
    port: PORT_SERIAL,
    baud: BAUD_RATE
  });

  // El cliente puede pedir conectar a un puerto específico
  socket.on('serial:connect', ({ port, baud }) => {
    connectSerial(port || PORT_SERIAL, baud || BAUD_RATE);
  });

  // El cliente puede pedir desconectar
  socket.on('serial:disconnect', () => {
    if (serialPort && serialPort.isOpen) {
      serialPort.close();
    }
  });

  // El cliente puede enviar un comando al Arduino
  socket.on('serial:send', (cmd) => {
    if (serialPort && serialPort.isOpen) {
      serialPort.write(cmd + '\n', (err) => {
        if (err) console.error('Error al escribir:', err.message);
        else console.log('📤  Enviado al Arduino:', cmd);
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`⬛  Cliente desconectado: ${socket.id}`);
  });
});

// ── Arranca el servidor ──────────────────────────────────────
server.listen(SERVER_PORT, () => {
  console.log('╔════════════════════════════════════════════╗');
  console.log(`║  🚀  Servidor en http://localhost:${SERVER_PORT}        ║`);
  console.log(`║  📡  Puerto Serial configurado: ${PORT_SERIAL}        ║`);
  console.log('╚════════════════════════════════════════════╝\n');

  // Intenta conectar al puerto serial al arrancar
  connectSerial();
});
