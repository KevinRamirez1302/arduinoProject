/**
 * ============================================================
 *   Dashboard Client — Joystick Edition
 *   Recibe x, y, btn del Arduino y actualiza la UI en tiempo real
 * ============================================================
 */

// ── Elementos del DOM ────────────────────────────────────────
const $statusDot   = document.getElementById('status-dot');
const $statusText  = document.getElementById('status-text');
const $portSelect  = document.getElementById('port-select');
const $baudSelect  = document.getElementById('baud-select');
const $btnConnect  = document.getElementById('btn-connect');
const $btnDisconn  = document.getElementById('btn-disconnect');
const $btnRefresh  = document.getElementById('btn-refresh');
const $btnSend     = document.getElementById('btn-send');
const $btnClear    = document.getElementById('btn-clear');
const $cmdInput    = document.getElementById('cmd-input');
const $console     = document.getElementById('console-log');
const $jsonDisplay = document.getElementById('json-display');
const $motionAlertCard = document.getElementById('motion-alert-card');
const $motionIcon      = document.getElementById('motion-icon');
const $motionStatus    = document.getElementById('motion-status-text');
const $motionLogTable  = document.getElementById('motion-log-table');

let motionEventCount = 0;
let alertTimeout;

// ── Console helpers ──────────────────────────────────────────
function logToConsole(message, type = 'data') {
  const now = new Date().toLocaleTimeString('es', { hour12: false });
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">[${now}]</span> <span class="log-${type}">${message}</span>`;
  $console.appendChild(entry);
  $console.scrollTop = $console.scrollHeight;

  // Keep console manageable
  while ($console.children.length > 300) {
    $console.removeChild($console.firstChild);
  }
}

function addMotionToLog(timestamp) {
  if (motionEventCount === 0) {
    $motionLogTable.innerHTML = ''; // clear placeholder
  }
  motionEventCount++;
  
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
  
  const tdId = document.createElement('td');
  tdId.style.padding = '0.5rem';
  tdId.textContent = motionEventCount;
  
  const tdTime = document.createElement('td');
  tdTime.style.padding = '0.5rem';
  const d = new Date(timestamp);
  tdTime.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();

  const tdStatus = document.createElement('td');
  tdStatus.style.padding = '0.5rem';
  tdStatus.innerHTML = '<span style="color: #ed8936; font-weight: bold;">Detectado</span>';

  tr.appendChild(tdId);
  tr.appendChild(tdTime);
  tr.appendChild(tdStatus);
  
  $motionLogTable.insertBefore(tr, $motionLogTable.firstChild);
}

// ── Socket.io ────────────────────────────────────────────────
const socket = io();

// Connection status
socket.on('serial:status', ({ connected, port, baud, error }) => {
  if (connected) {
    $statusDot.className = 'status-dot connected';
    $statusText.textContent = `Conectado · ${port} @ ${baud}`;
    $btnConnect.disabled = true;
    $btnDisconn.disabled = false;
    logToConsole(`✅ Puerto ${port} abierto @ ${baud} baudios`, 'info');
  } else {
    $statusDot.className = 'status-dot disconnected';
    $statusText.textContent = 'Desconectado';
    $btnConnect.disabled = false;
    $btnDisconn.disabled = true;
    if (error) {
      logToConsole(`❌ Error: ${error}`, 'error');
    } else {
      logToConsole(`🔴 Puerto cerrado`, 'warn');
    }
  }
});

// Serial data received
socket.on('serial:data', (packet) => {
  const { data, raw, timestamp } = packet;
  logToConsole(raw, 'data');

  // Update JSON display
  $jsonDisplay.textContent = JSON.stringify(packet, null, 2);

  const distance = data.value;
  const motion = data.motion;
  const $mainDisplay = document.getElementById('distance-display-main');
  const $statusText  = document.getElementById('motion-status-text');

  if ($mainDisplay) {
    if (motion !== undefined) {
      if (motion === 1) {
        // En alerta
        $mainDisplay.innerHTML = `MOVIMIENTO<small style="font-size: 1rem; font-weight: 400; margin-left: 0.5rem; color: white;">DETECTADO</small>`;
        $motionAlertCard.style.backgroundColor = 'rgba(237, 137, 54, 0.8)';
        $motionAlertCard.style.boxShadow = '0 0 40px rgba(237, 137, 54, 0.4)';
        $mainDisplay.style.color = '#ffffff';
        $mainDisplay.style.transform = 'scale(1.1)';
        $statusText.textContent = '¡MOVIMIENTO DETECTADO!';
        $statusText.style.color = '#ffffff';
        
        // Registrar alerta en la tabla, evitamos flood
        if (!alertTimeout) {
          addMotionToLog(timestamp);
          alertTimeout = setTimeout(() => { alertTimeout = null; }, 3000); 
        }
      } else {
        // Seguro (motion === 0)
        $mainDisplay.innerHTML = `Seguro<small style="font-size: 1rem; font-weight: 400; margin-left: 0.5rem; color: #4a5568;">Sin mov.</small>`;
        resetUI();
      }
    } 
    // Fallback por si vuelve a usar el otro sensor
    else if (distance !== undefined && distance > 0) {
      const isClose = distance < 30;
      $mainDisplay.innerHTML = `${distance}<small style="font-size: 2rem; font-weight: 400; margin-left: 0.5rem; color: ${isClose ? 'white' : '#4a5568'};">cm</small>`;
      if (isClose) {
        $motionAlertCard.style.backgroundColor = 'rgba(237, 137, 54, 0.8)';
        $motionAlertCard.style.boxShadow = '0 0 40px rgba(237, 137, 54, 0.4)';
        $mainDisplay.style.color = '#ffffff';
        $mainDisplay.style.transform = 'scale(1.1)';
        $statusText.textContent = '¡ALTO! OBJETO CERCA';
        $statusText.style.color = '#ffffff';
        
        if (!alertTimeout) {
          addMotionToLog(timestamp);
        }
        clearTimeout(alertTimeout);
        alertTimeout = setTimeout(() => { resetUI(); }, 1000);
      } else {
        resetUI();
      }
    }
  }

  function resetUI() {
    $motionAlertCard.style.backgroundColor = '';
    $motionAlertCard.style.boxShadow = '';
    $mainDisplay.style.color = '#63b3ed';
    $mainDisplay.style.transform = 'scale(1)';
    $statusText.textContent = 'Sensor Activo';
    $statusText.style.color = '#718096';
    alertTimeout = null;
  }
});

// Serial errors
socket.on('serial:error', ({ message }) => {
  logToConsole(`⚠️  ${message}`, 'error');
});

// ── Load available ports ─────────────────────────────────────
async function loadPorts() {
  try {
    const res   = await fetch('/api/ports');
    const ports = await res.json();
    $portSelect.innerHTML = '<option value="">Seleccionar puerto...</option>';
    if (ports.length === 0) {
      $portSelect.innerHTML = '<option value="">No se encontraron puertos</option>';
      logToConsole('ℹ️  No se detectaron puertos seriales.', 'warn');
    } else {
      ports.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.path;
        opt.textContent = `${p.path}${p.friendlyName ? ' — ' + p.friendlyName : ''}`;
        $portSelect.appendChild(opt);
      });
      logToConsole(`ℹ️  ${ports.length} puerto(s) encontrado(s).`, 'info');
    }
  } catch (e) {
    logToConsole('❌ Error al cargar puertos: ' + e.message, 'error');
  }
}
loadPorts();

// ── Button Events ────────────────────────────────────────────
$btnRefresh.addEventListener('click', loadPorts);

$btnConnect.addEventListener('click', () => {
  const port = $portSelect.value;
  if (!port) { logToConsole('⚠️  Selecciona un puerto primero.', 'warn'); return; }
  $statusDot.className = 'status-dot connecting';
  $statusText.textContent = 'Conectando...';
  logToConsole(`🔌 Conectando a ${port}...`, 'info');
  socket.emit('serial:connect', { port, baud: parseInt($baudSelect.value) });
});

$btnDisconn.addEventListener('click', () => {
  socket.emit('serial:disconnect');
});

$btnSend.addEventListener('click', sendCommand);
$cmdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendCommand(); });

function sendCommand() {
  const cmd = $cmdInput.value.trim();
  if (!cmd) return;
  socket.emit('serial:send', cmd);
  logToConsole(`📤 Enviado: ${cmd}`, 'sent');
  $cmdInput.value = '';
}

$btnClear.addEventListener('click', () => {
  $console.innerHTML = '';
  logToConsole('Consola limpiada.', 'info');
});
