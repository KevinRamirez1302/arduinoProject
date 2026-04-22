# 🔌 Arduino Serial Bridge

Puente en tiempo real entre **Arduino** y el **navegador** usando Node.js, SerialPort y Socket.io.

```
Arduino (USB) ──► Node.js (SerialPort) ──► Socket.io ──► Dashboard Web
```

## 📁 Estructura del Proyecto

```
serialport/
├── server.js              ← Servidor Node.js (el "puente")
├── .env                   ← Configuración del puerto serial
├── package.json
├── public/
│   ├── index.html         ← Dashboard web
│   ├── css/style.css
│   └── js/app.js          ← Cliente Socket.io + gráfica
└── arduino/
    └── sensor_sketch.ino  ← Sketch de ejemplo para Arduino
```

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar el puerto serial

Edita el archivo `.env`:

```env
SERIAL_PORT=COM3      # Cambia a tu puerto (ej: COM4, /dev/ttyUSB0)
BAUD_RATE=9600        # Debe coincidir con Serial.begin() del Arduino
SERVER_PORT=3000
```

> **¿Cómo saber tu puerto?** Ve a Administrador de Dispositivos → Puertos (COM & LPT)

### 3. Cargar el sketch al Arduino

Abre `arduino/sensor_sketch.ino` en el Arduino IDE y cárgalo a tu placa.

### 4. Ejecutar el servidor

```bash
npm start
```

Abre tu navegador en **http://localhost:3000**

## 🌐 Dashboard

El dashboard incluye:
- 📡 **Conexión / Desconexión** desde el navegador
- 📊 **Gráfica en tiempo real** (Sensor + Temperatura)
- 🔢 **KPIs**: valor del sensor, temperatura, paquetes recibidos, frecuencia
- 💬 **Consola serial** con log de todos los datos
- 📤 **Enviar comandos** al Arduino desde el navegador

## 📡 Formato de datos del Arduino

El servidor acepta **dos formatos**:

**JSON (múltiples valores):**
```cpp
Serial.println("{\"sensor\":512,\"temp\":25.3}");
```

**Valor plano (un número):**
```cpp
Serial.println(sensorValue);
```

## 🔧 API REST

| Endpoint     | Descripción                       |
|--------------|-----------------------------------|
| `GET /`      | Dashboard web                     |
| `GET /api/ports` | Lista de puertos disponibles  |

## 📡 Eventos Socket.io

| Evento (servidor→cliente) | Descripción               |
|--------------------------|---------------------------|
| `serial:data`            | Nuevo dato del Arduino    |
| `serial:status`          | Estado de la conexión     |
| `serial:error`           | Error en el puerto serial |

| Evento (cliente→servidor) | Descripción                    |
|--------------------------|--------------------------------|
| `serial:connect`         | Conectar a un puerto           |
| `serial:disconnect`      | Cerrar la conexión             |
| `serial:send`            | Enviar comando al Arduino      |
