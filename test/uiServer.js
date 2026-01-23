const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const MockGT06Device = require('./mockGpsDevice');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3001; // Different port to avoid conflict with main GPS server

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// Store active mock devices
const mockDevices = new Map();

// Serve the UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'gps-tester-ui.html'));
});

// API endpoints for UI
app.post('/api/mock-device/connect', (req, res) => {
  const { imei, serverHost, serverPort } = req.body;
  
  if (mockDevices.has(imei)) {
    return res.json({ success: false, message: 'Device already connected' });
  }
  
  const device = new MockGT06Device(imei, serverHost || 'localhost', serverPort || 5023);
  
  // Override console.log to send to UI
  const originalLog = console.log;
  device.log = (message) => {
    io.emit('deviceLog', { imei, message, timestamp: new Date() });
    originalLog(message);
  };
  
  // Override device methods to emit events
  const originalConnect = device.connect.bind(device);
  device.connect = () => {
    originalConnect();
    device.socket.on('connect', () => {
      io.emit('deviceConnected', { imei });
    });
    device.socket.on('close', () => {
      io.emit('deviceDisconnected', { imei });
      mockDevices.delete(imei);
    });
  };
  
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
      default:
        return res.json({ success: false, message: 'Unknown action' });
    }
    
    // Emit device status update
    io.emit('deviceStatusUpdate', {
      imei,
      lat: device.lat,
      lng: device.lng,
      speed: device.speed,
      ignition: device.ignition,
      acc: device.acc,
      moving: device.isMoving
    });
    
    res.json({ success: true, message: `Action ${action} executed` });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

app.get('/api/mock-device/status/:imei', (req, res) => {
  const { imei } = req.params;
  const device = mockDevices.get(imei);
  
  if (!device) {
    return res.json({ success: false, message: 'Device not found' });
  }
  
  res.json({
    success: true,
    status: {
      imei,
      connected: device.isConnected,
      lat: device.lat,
      lng: device.lng,
      speed: device.speed,
      ignition: device.ignition,
      acc: device.acc,
      moving: device.isMoving
    }
  });
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log('UI client connected');
  
  socket.on('disconnect', () => {
    console.log('UI client disconnected');
  });
  
  // Send current device list
  socket.emit('deviceList', Array.from(mockDevices.keys()));
});

// Proxy API calls to main GPS server
app.use('/api/gps', async (req, res) => {
  try {
    const fetch = require('node-fetch');
    const url = `http://localhost:3000${req.path}`;
    const options = {
      method: req.method,
      headers: req.headers,
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    };
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`🖥️  GPS Tester UI running on http://localhost:${PORT}`);
  console.log(`📱 Open browser and go to: http://localhost:${PORT}`);
  console.log(`🔧 Make sure your GPS server is running on port 3000`);
});

module.exports = { app, server, io };