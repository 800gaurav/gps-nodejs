const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const GPSProtocol = require('./protocols/gpsProtocol');

// Import routes
const deviceRoutes = require('./routes/devices');
const locationRoutes = require('./routes/locations');
const commandRoutes = require('./routes/commands');
const deviceInfoRoutes = require('./routes/deviceInfo');

startServer();

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('MongoDB connected successfully');

    const app = express();
    const server = http.createServer(app);
    
    // Socket.IO setup
    const io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));

    // Request logging
    app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });

    // API Routes
    app.use('/api/devices', deviceRoutes);
    app.use('/api/locations', locationRoutes);
    app.use('/api/commands', commandRoutes);
    app.use('/api/device-info', deviceInfoRoutes);

    // Initialize GPS Protocol FIRST (before routes that use it)
    const gpsProtocol = new GPSProtocol();
    global.gpsProtocol = gpsProtocol; // Make it globally accessible

    // Health check
    app.get('/health', (req, res) => {
      const stats = gpsProtocol.getStats();
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        gps: {
          activeSessions: stats.activeSessions,
          messagesProcessed: stats.messagesProcessed,
          activeConnections: stats.activeConnections,
          authenticatedDevices: stats.authenticatedDevices
        }
      });
    });

    // GPS Debug endpoint
    app.get('/api/gps/debug', async (req, res) => {
      const Device = require('./models/Device');
      const Location = require('./models/Location');
      
      const stats = gpsProtocol.getStats();
      const devices = await Device.find({}).lean();
      const recentLocations = await Location.find({}).sort({ timestamp: -1 }).limit(10).lean();
      
      res.json({
        gpsServer: {
          port: process.env.GPS_PORT_GT06 || 5023,
          stats: stats
        },
        database: {
          totalDevices: devices.length,
          onlineDevices: devices.filter(d => d.online).length,
          devicesWithLocation: devices.filter(d => d.lastLatitude && d.lastLongitude).length,
          devices: devices.map(d => ({
            imei: d.imei,
            online: d.online,
            hasLocation: !!(d.lastLatitude && d.lastLongitude),
            lastSeen: d.lastSeen
          }))
        },
        recentLocations: recentLocations.map(l => ({
          deviceId: l.deviceId,
          lat: l.latitude,
          lng: l.longitude,
          timestamp: l.timestamp
        }))
      });
    });

    // API docs
    app.get('/api', (req, res) => {
      res.json({
        title: 'Simple GPS Tracker API',
        version: '1.0.0',
        endpoints: {
          devices: {
            'GET /api/devices': 'Get all devices',
            'POST /api/devices': 'Add new device (deviceId, imei, vehicleName)',
            'DELETE /api/devices/:id': 'Delete device'
          },
          locations: {
            'GET /api/locations/live': 'Get all live locations',
            'GET /api/locations/live/:deviceId': 'Get device live location',
            'GET /api/locations/history/:deviceId': 'Get location history'
          },
          commands: {
            'POST /api/commands/:deviceId': 'Send command (engineStop/engineResume)',
            'GET /api/commands/:deviceId/status': 'Get device status'
          }
        }
      });
    });

    // Serve dashboard
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler
    app.use((error, req, res, next) => {
      logger.error('Error:', error);
      res.status(500).json({ error: error.message });
    });

    // GPS Server (GT06 Protocol)
    const gpsServer = net.createServer((socket) => {
      gpsProtocol.handleConnection(socket, io, parseInt(process.env.GPS_PORT_GT06) || 5023);
    });

    // Socket.IO connection
    io.on('connection', (socket) => {
      logger.info('Client connected:', socket.id);
      
      socket.on('disconnect', () => {
        logger.info('Client disconnected:', socket.id);
      });
    });

    // GPS Protocol events
    gpsProtocol.on('deviceStatusUpdate', (data) => {
      io.emit('deviceStatusUpdate', data);
    });

    // Start servers
    const PORT = process.env.PORT || 3000;
    const GPS_PORT = parseInt(process.env.GPS_PORT_GT06) || 5023;

    server.listen(PORT, () => {
      logger.info(`✅ HTTP Server: http://localhost:${PORT}`);
      logger.info(`✅ API Docs: http://localhost:${PORT}/api`);
    });

    gpsServer.listen(GPS_PORT, () => {
      logger.info(`✅ GPS Server (GT06): Port ${GPS_PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => shutdown(server, gpsServer));
    process.on('SIGINT', () => shutdown(server, gpsServer));

    logger.info('🚀 GPS Tracking Server started successfully!');

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function shutdown(server, gpsServer) {
  logger.info('Shutting down gracefully...');
  server.close();
  gpsServer.close();
  process.exit(0);
}
