const express = require('express');
const http = require('http');
const path = require('path');
const MockGT06Device = require('./mockGpsDevice');

const app = express();
const server = http.createServer(app);
const PORT = 3001;

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// Store active mock devices
const mockDevices = new Map();

// Serve the enhanced UI
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>GPS Device Tester Pro</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 1000px; margin: 0 auto; }
        .card { background: rgba(255,255,255,0.95); padding: 20px; margin: 20px 0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
        .btn { padding: 10px 20px; margin: 5px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s; }
        .btn-primary { background: linear-gradient(45deg, #007bff, #0056b3); color: white; }
        .btn-success { background: linear-gradient(45deg, #28a745, #1e7e34); color: white; }
        .btn-danger { background: linear-gradient(45deg, #dc3545, #c82333); color: white; }
        .btn-warning { background: linear-gradient(45deg, #ffc107, #e0a800); color: black; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        input, select { padding: 10px; margin: 5px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; }
        input:focus { border-color: #007bff; outline: none; }
        .status { padding: 15px; margin: 15px 0; border-radius: 8px; font-weight: bold; }
        .connected { background: linear-gradient(45deg, #d4edda, #c3e6cb); color: #155724; border-left: 4px solid #28a745; }
        .disconnected { background: linear-gradient(45deg, #f8d7da, #f5c6cb); color: #721c24; border-left: 4px solid #dc3545; }
        .log { background: #1a1a1a; color: #00ff00; padding: 20px; height: 250px; overflow-y: auto; font-family: 'Courier New', monospace; border-radius: 8px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .info-panel { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .info-item { display: inline-block; margin: 5px 10px; padding: 5px 10px; background: #007bff; color: white; border-radius: 15px; font-size: 12px; }
        h1 { color: white; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); margin-bottom: 30px; }
        .location-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚗 GPS Device Tester Pro</h1>
        
        <div class="grid">
            <div class="card">
                <h3>📱 Device Configuration</h3>
                <input type="text" id="imei" placeholder="IMEI (15 digits)" value="123456789012345">
                <input type="text" id="serverHost" placeholder="Server IP" value="localhost">
                <input type="number" id="serverPort" placeholder="GPS Port" value="5023">
                <br><br>
                <button class="btn btn-primary" onclick="connectDevice()">🔌 Connect Device</button>
                <button class="btn btn-danger" onclick="disconnectDevice()">❌ Disconnect</button>
                <div id="status" class="status disconnected">❌ Device Disconnected</div>
            </div>
            
            <div class="card">
                <h3>📊 Live Status</h3>
                <div class="info-panel">
                    <div class="info-item">Speed: <span id="currentSpeed">0</span> km/h</div>
                    <div class="info-item">Lat: <span id="currentLat">28.6139</span></div>
                    <div class="info-item">Lng: <span id="currentLng">77.2090</span></div>
                    <div class="info-item">Engine: <span id="currentEngine">OFF</span></div>
                    <div class="info-item">ACC: <span id="currentACC">OFF</span></div>
                    <div class="info-item">Interval: <span id="currentInterval">10</span>s</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h3>🚗 Vehicle Controls</h3>
            <button class="btn btn-success" onclick="startEngine()">🔥 Start Engine</button>
            <button class="btn btn-danger" onclick="stopEngine()">🛑 Stop Engine</button>
            <button class="btn btn-primary" onclick="sendLocation()">📍 Send Location Now</button>
            <br><br>
            <label><strong>Speed Control:</strong></label><br>
            <input type="range" id="speed" min="0" max="200" value="0" onchange="setSpeed(this.value)" style="width: 300px;">
            <span id="speedValue" style="font-weight: bold; color: #007bff;">0 km/h</span>
            <br><br>
            <label><strong>GPS Location:</strong></label>
            <div class="location-inputs">
                <input type="number" id="latitude" placeholder="Latitude" value="28.6139" step="0.000001">
                <input type="number" id="longitude" placeholder="Longitude" value="77.2090" step="0.000001">
            </div>
            <button class="btn btn-warning" onclick="setLocation()">📍 Set Custom Location</button>
            <br><br>
            <label><strong>Auto Report Interval:</strong></label><br>
            <select id="interval" onchange="updateInterval()">
                <option value="5">5 seconds</option>
                <option value="10" selected>10 seconds</option>
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
            </select>
            <br><br>
            <button class="btn btn-primary" onclick="startMoving()">🚗 Start Moving</button>
            <button class="btn btn-success" onclick="startAutoReporting()">📡 Start Auto Report</button>
            <button class="btn btn-warning" onclick="stopAutoReporting()">⏹️ Stop Auto Report</button>
        </div>
        
        <div class="card">
            <h3>API Testing</h3>
            <button class="btn btn-primary" onclick="addDevice()">➕ Add Device to Server</button>
            <button class="btn btn-success" onclick="getLiveLocation()">📍 Get Live Location</button>
            <button class="btn btn-danger" onclick="sendEngineStop()">🛑 Engine Stop Command</button>
        </div>
        
        <div class="card">
            <h3>Console Log</h3>
            <div id="log" class="log">GPS Device Tester Ready...<br></div>
            <button class="btn btn-primary" onclick="clearLog()">Clear Log</button>
        </div>
    </div>

    <script>
        let currentIMEI = '123456789012345';
        
        function log(message) {
            const logDiv = document.getElementById('log');
            const time = new Date().toLocaleTimeString();
            logDiv.innerHTML += '[' + time + '] ' + message + '<br>';
            logDiv.scrollTop = logDiv.scrollHeight;
        }
        
        async function connectDevice() {
            const imei = document.getElementById('imei').value;
            const serverHost = document.getElementById('serverHost').value;
            const serverPort = document.getElementById('serverPort').value;
            
            currentIMEI = imei;
            
            try {
                const response = await fetch('/api/mock-device/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imei, serverHost, serverPort: parseInt(serverPort) })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('status').className = 'status connected';
                    document.getElementById('status').innerHTML = '✅ Connected: ' + imei;
                    log('📱 Device ' + imei + ' connecting to ' + serverHost + ':' + serverPort);
                } else {
                    log('❌ Connection failed: ' + result.message);
                }
            } catch (error) {
                log('❌ Error: ' + error.message);
            }
        }
        
        async function disconnectDevice() {
            try {
                const response = await fetch('/api/mock-device/disconnect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imei: currentIMEI })
                });
                
                document.getElementById('status').className = 'status disconnected';
                document.getElementById('status').innerHTML = '❌ Disconnected';
                log('📱 Device disconnected');
            } catch (error) {
                log('❌ Error: ' + error.message);
            }
        }
        
        async function deviceAction(action, value = null) {
            try {
                const response = await fetch('/api/mock-device/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imei: currentIMEI, action, value })
                });
                
                const result = await response.json();
                log(result.success ? '✅ ' + action + ' executed' : '❌ ' + result.message);
            } catch (error) {
                log('❌ Error: ' + error.message);
            }
        }
        
        function startEngine() { deviceAction('startEngine'); }
        function stopEngine() { deviceAction('stopEngine'); }
        function sendLocation() { deviceAction('sendLocation'); }
        function startMoving() { deviceAction('startMoving'); }
        function startAutoReporting() { deviceAction('startAutoReporting', currentStatus.interval * 1000); }
        
        function setSpeed(speed) {
            document.getElementById('speedValue').textContent = speed + ' km/h';
            deviceAction('setSpeed', speed);
        }
        
        async function addDevice() {
            try {
                const response = await fetch('http://localhost:3000/api/devices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        deviceId: 'GT06_001',
                        imei: currentIMEI,
                        vehicleName: 'Test Vehicle'
                    })
                });
                const result = await response.json();
                log('✅ Device added to server: ' + JSON.stringify(result));
            } catch (e) {
                log('❌ API Error: ' + e.message);
            }
        }
        
        async function getLiveLocation() {
            try {
                const response = await fetch('http://localhost:3000/api/locations/live');
                const result = await response.json();
                log('📍 Live locations: ' + JSON.stringify(result, null, 2));
            } catch (e) {
                log('❌ API Error: ' + e.message);
            }
        }
        
        async function sendEngineStop() {
            try {
                const response = await fetch('http://localhost:3000/api/commands/GT06_001', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: 'engineStop' })
                });
                const result = await response.json();
                log('🛑 Engine stop command: ' + JSON.stringify(result));
            } catch (e) {
                log('❌ API Error: ' + e.message);
            }
        }
        
        function clearLog() {
            document.getElementById('log').innerHTML = 'Log cleared...<br>';
        }
        
        let autoReportInterval = null;
        let currentStatus = {
            speed: 0,
            lat: 28.6139,
            lng: 77.2090,
            engine: false,
            acc: false,
            interval: 10
        };
        
        function updateStatus() {
            document.getElementById('currentSpeed').textContent = currentStatus.speed;
            document.getElementById('currentLat').textContent = currentStatus.lat.toFixed(6);
            document.getElementById('currentLng').textContent = currentStatus.lng.toFixed(6);
            document.getElementById('currentEngine').textContent = currentStatus.engine ? 'ON' : 'OFF';
            document.getElementById('currentACC').textContent = currentStatus.acc ? 'ON' : 'OFF';
            document.getElementById('currentInterval').textContent = currentStatus.interval;
        }
        
        function setLocation() {
            const lat = parseFloat(document.getElementById('latitude').value);
            const lng = parseFloat(document.getElementById('longitude').value);
            
            if (isNaN(lat) || isNaN(lng)) {
                log('❌ Invalid coordinates');
                return;
            }
            
            currentStatus.lat = lat;
            currentStatus.lng = lng;
            deviceAction('setLocation', { lat, lng });
            updateStatus();
            log('📍 Location set to: ' + lat.toFixed(6) + ', ' + lng.toFixed(6));
        }
        
        function updateInterval() {
            const interval = parseInt(document.getElementById('interval').value);
            currentStatus.interval = interval;
            updateStatus();
            log('⏰ Interval set to: ' + interval + ' seconds');
        }
        
        function startAutoReporting() {
            if (autoReportInterval) {
                clearInterval(autoReportInterval);
            }
            
            const interval = currentStatus.interval * 1000;
            deviceAction('startAutoReporting', interval);
            
            autoReportInterval = setInterval(() => {
                log('📡 Auto sending GPS data...');
            }, interval);
            
            log('📡 Auto reporting started (every ' + currentStatus.interval + ' seconds)');
        }
        
        function stopAutoReporting() {
            if (autoReportInterval) {
                clearInterval(autoReportInterval);
                autoReportInterval = null;
            }
            deviceAction('stopAutoReporting');
            log('⏹️ Auto reporting stopped');
        }
        
        // Override existing functions to update status
        const originalSetSpeed = setSpeed;
        setSpeed = function(speed) {
            currentStatus.speed = parseInt(speed);
            updateStatus();
            originalSetSpeed(speed);
        };
        
        const originalStartEngine = startEngine;
        startEngine = function() {
            currentStatus.engine = true;
            currentStatus.acc = true;
            updateStatus();
            originalStartEngine();
        };
        
        const originalStopEngine = stopEngine;
        stopEngine = function() {
            currentStatus.engine = false;
            currentStatus.acc = false;
            currentStatus.speed = 0;
            document.getElementById('speed').value = 0;
            document.getElementById('speedValue').textContent = '0 km/h';
            updateStatus();
            originalStopEngine();
        };
        
        updateStatus();
        log('🚀 GPS Device Tester Pro loaded');
        log('📋 New Features:');
        log('• Custom GPS coordinates');
        log('• Adjustable time intervals');
        log('• Real-time status display');
        log('• Enhanced controls');
        log('📋 Instructions:');
        log('1. Enter IMEI and server details');
        log('2. Click "Connect Device"');
        log('3. Use "Add Device to Server" to register');
        log('4. Test vehicle controls');
    </script>
</body>
</html>
  `);
});

// API endpoints for mock device control
app.post('/api/mock-device/connect', (req, res) => {
  const { imei, serverHost, serverPort } = req.body;
  
  if (mockDevices.has(imei)) {
    return res.json({ success: false, message: 'Device already connected' });
  }
  
  const device = new MockGT06Device(imei, serverHost || 'localhost', serverPort || 5023);
  mockDevices.set(imei, device);
  device.connect();
  
  res.json({ success: true, message: 'Device connecting...' });
});

app.post('/api/mock-device/disconnect', (req, res) => {
  const { imei } = req.body;
  const device = mockDevices.get(imei);
  
  if (!device) {
    return res.json({ success: false, message: 'Device not found' });
  }
  
  device.disconnect();
  mockDevices.delete(imei);
  
  res.json({ success: true, message: 'Device disconnected' });
});

app.post('/api/mock-device/control', (req, res) => {
  const { imei, action, value } = req.body;
  const device = mockDevices.get(imei);
  
  if (!device) {
    return res.json({ success: false, message: 'Device not found' });
  }
  
  try {
    switch (action) {
      case 'startEngine':
        device.startEngine();
        break;
      case 'stopEngine':
        device.stopEngine();
        break;
      case 'setSpeed':
        device.setSpeed(parseInt(value));
        break;
      case 'sendLocation':
        device.sendLocationMessage();
        break;
      case 'startMoving':
        device.startMoving();
        break;
      case 'stopMoving':
        device.stopMoving();
        break;
      case 'startAutoReporting':
        device.startAutoReporting(parseInt(value) || 30000);
        break;
      case 'setLocation':
        device.lat = value.lat;
        device.lng = value.lng;
        break;
      case 'stopAutoReporting':
        if (device.reportInterval) {
          clearInterval(device.reportInterval);
          device.reportInterval = null;
        }
        if (device.heartbeatInterval) {
          clearInterval(device.heartbeatInterval);
          device.heartbeatInterval = null;
        }
        break;
      default:
        return res.json({ success: false, message: 'Unknown action' });
    }
    
    res.json({ success: true, message: `Action ${action} executed` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`🖥️  GPS Tester UI running on http://localhost:${PORT}`);
  console.log(`📱 Open browser and go to: http://localhost:${PORT}`);
  console.log(`🔧 Make sure your GPS server is running on port 3000`);
});

module.exports = { app, server };