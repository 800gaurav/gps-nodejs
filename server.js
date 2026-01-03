const cluster = require('cluster');
const os = require('os');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const net = require('net');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');
const dayjs = require('dayjs');
const { Worker } = require('worker_threads');

require('dotenv').config();

const connectDB = require('./config/database');
const redisManager = require('./config/redis');
const postgresManager = require('./config/postgresql');
const logger = require('./utils/logger');
const GPSProtocol = require('./protocols/gpsProtocol');

// Import routes
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const adminDevicesRoutes = require('./routes/adminDevices');
const simpleDeviceRoutes = require('./routes/simpleDevice');
const realTimeDeviceRoutes = require('./routes/realTimeDevice');
const deviceDataRoutes = require('./routes/deviceData');
const testDeviceRoutes = require('./routes/testDevice');
const userManagementRoutes = require('./routes/userManagement');
const locationRoutes = require('./routes/locations');
const userRoutes = require('./routes/users');
const alertRoutes = require('./routes/alerts');
const reportRoutes = require('./routes/reports');
const commandRoutes = require('./routes/commands');
const notificationRoutes = require('./routes/notifications');

// Enhanced clustering for high-load GPS tracking
if (cluster.isMaster && (process.env.CLUSTER_MODE === 'true' || process.env.NODE_ENV === 'production')) {
  const numCPUs = Math.min(os.cpus().length, 8); // Limit to 8 workers max
  const gpsWorkers = [];
  
  logger.info(`Master ${process.pid} starting with ${numCPUs} HTTP workers`);
  
  // Fork HTTP workers
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork({ WORKER_TYPE: 'http', WORKER_ID: i });
    worker.on('message', (msg) => {
      if (msg.type === 'gps_data') {
        // Distribute GPS processing to dedicated workers
        const workerIndex = msg.deviceId.charCodeAt(msg.deviceId.length - 1) % gpsWorkers.length;
        if (gpsWorkers[workerIndex]) {
          gpsWorkers[workerIndex].postMessage(msg);
        }
      }
    });
  }
  
  // Create dedicated GPS processing workers
  for (let i = 0; i < Math.min(4, numCPUs); i++) {
    const gpsWorker = new Worker('./workers/gpsWorker.js');
    gpsWorkers.push(gpsWorker);
    
    gpsWorker.on('message', (result) => {
      // Broadcast processed GPS data to all HTTP workers
      for (const id in cluster.workers) {
        cluster.workers[id].send({ type: 'broadcast_gps', data: result });
      }
    });
  }
  
  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died`);
    setTimeout(() => cluster.fork({ WORKER_TYPE: 'http' }), 1000);
  });
  
  process.on('SIGTERM', () => {
    logger.info('Shutting down cluster');
    gpsWorkers.forEach(w => w.terminate());
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });
} else {
  startServer();
}

async function startServer() {
  try {
    // Connect to databases
    await connectDB();
    
    // Try to connect to Redis (optional)
    try {
      await redisManager.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.warn('Redis connection failed, continuing without Redis:', error.message);
    }
    
    // Try to connect to PostgreSQL (optional)
    try {
      await postgresManager.connect();
      logger.info('PostgreSQL connected successfully');
    } catch (error) {
      logger.warn('PostgreSQL connection failed, continuing without PostgreSQL:', error.message);
    }

    const app = express();
    const server = http.createServer(app);
    
    // Socket.IO setup with Redis adapter for clustering
    const io = socketIo(server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      }
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    });

    app.use('/api/', limiter);

    // General middleware
    app.use(compression());
    app.use(cors({
      origin: process.env.CORS_ORIGIN || "*",
      credentials: true
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(express.static(path.join(__dirname, 'public')));

    // Request logging middleware
    app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/devices', deviceRoutes);
    app.use('/api/admin/devices', adminDevicesRoutes);
    app.use('/api/device', simpleDeviceRoutes);
    app.use('/api/live', realTimeDeviceRoutes);
    app.use('/api/device-data', deviceDataRoutes);
    app.use('/api/test-device', testDeviceRoutes);
    app.use('/api/admin/users', userManagementRoutes);
    app.use('/api/locations', locationRoutes);
    app.use('/api/alerts', alertRoutes);
    app.use('/api/reports', reportRoutes);
    app.use('/api/commands', commandRoutes);
    app.use('/api/notifications', notificationRoutes);

    // Health check endpoint
    app.get('/health', async (req, res) => {
      try {
        const redisHealth = await redisManager.healthCheck();
        const pgHealth = await postgresManager.healthCheck();
        const stats = gpsProtocol.getStats();
        
        res.json({
          status: 'healthy',
          timestamp: dayjs().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          databases: {
            redis: redisHealth ? 'connected' : 'disconnected',
            postgresql: pgHealth ? 'connected' : 'disconnected'
          },
          gps: {
            activeSessions: stats.activeSessions,
            messagesProcessed: stats.messagesProcessed
          }
        });
      } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    });

    // API documentation endpoint
    app.get('/api/docs', (req, res) => {
      res.json({
        title: 'GPS Tracking API',
        version: '2.0.0',
        description: 'Comprehensive GPS tracking system with GT06 protocol support',
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          devices: '/api/devices',
          locations: '/api/locations',
          alerts: '/api/alerts',
          reports: '/api/reports',
          commands: '/api/commands'
        },
        protocols: {
          gt06: parseInt(process.env.GPS_PORT_GT06) || 5027,
          teltonika: parseInt(process.env.GPS_PORT_TELTONIKA) || 2023
        }
      });
    });

    // Serve dashboard
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Error handling middleware
    app.use((error, req, res, next) => {
      logger.error('Express error:', error);
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: 'Validation Error',
          details: error.message
        });
      }
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          error: 'Invalid ID format',
          details: error.message
        });
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });

    // Initialize GPS Protocol handler
    const gpsProtocol = new GPSProtocol();

    // GPS Protocol Servers
    const gpsServerGT06 = net.createServer((socket) => {
      gpsProtocol.handleConnection(socket, io, parseInt(process.env.GPS_PORT_GT06) || 5027);
    });

    const gpsServerTeltonika = net.createServer((socket) => {
      gpsProtocol.handleConnection(socket, io, parseInt(process.env.GPS_PORT_TELTONIKA) || 2023);
    });

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      logger.info('Client connected to WebSocket', { socketId: socket.id });
      
      // Join user-specific room for targeted updates
      socket.on('join', (data) => {
        if (data.userId) {
          socket.join(`user_${data.userId}`);
          logger.info('User joined room', { userId: data.userId, socketId: socket.id });
        }
      });

      // Handle device control commands
      socket.on('deviceCommand', async (data) => {
        try {
          const { deviceId, command, parameters } = data;
          
          if (command === 'engineStop' || command === 'engineResume') {
            const success = await gpsProtocol.sendEngineCommand(
              deviceId, 
              command === 'engineStop',
              parameters?.password
            );
            
            socket.emit('commandResult', {
              deviceId,
              command,
              success,
              timestamp: new Date()
            });
          } else {
            const success = await gpsProtocol.sendCustomCommand(deviceId, {
              type: command,
              parameters
            });
            
            socket.emit('commandResult', {
              deviceId,
              command,
              success,
              timestamp: new Date()
            });
          }
        } catch (error) {
          logger.error('Socket command error:', error);
          socket.emit('commandError', {
            error: error.message,
            timestamp: new Date()
          });
        }
      });

      socket.on('disconnect', () => {
        logger.info('Client disconnected from WebSocket', { socketId: socket.id });
      });
    });

    // Subscribe to Redis events for real-time updates
    await redisManager.subscribeToLocationUpdates((data) => {
      io.emit('locationUpdate', data);
      
      // Send to specific user room if device belongs to user
      // This would require looking up device ownership
    });

    await redisManager.subscribeToDeviceAlerts((data) => {
      io.emit('deviceAlert', data);
    });

    // GPS Protocol event handlers
    gpsProtocol.on('deviceStatusUpdate', (data) => {
      io.emit('deviceStatusUpdate', data);
    });

    // Start servers
    const PORT = process.env.PORT || 3000;
    const GPS_PORT_GT06 = parseInt(process.env.GPS_PORT_GT06) || 5027;
    const GPS_PORT_TELTONIKA = parseInt(process.env.GPS_PORT_TELTONIKA) || 2023;

    server.listen(PORT, () => {
      logger.info(`HTTP Server running on port ${PORT}`, { 
        pid: process.pid,
        env: process.env.NODE_ENV 
      });
      logger.info(`Dashboard: http://localhost:${PORT}`);
    });

    gpsServerGT06.listen(GPS_PORT_GT06, () => {
      logger.info(`GPS Server (GT06 Protocol) listening on port ${GPS_PORT_GT06}`);
    });

    gpsServerTeltonika.listen(GPS_PORT_TELTONIKA, () => {
      logger.info(`GPS Server (Teltonika Protocol) listening on port ${GPS_PORT_TELTONIKA}`);
    });

    // Scheduled tasks
    setupScheduledTasks(gpsProtocol);

    // Graceful shutdown
    setupGracefulShutdown(server, gpsServerGT06, gpsServerTeltonika, gpsProtocol);

    logger.info('GPS Tracking Server started successfully', {
      pid: process.pid,
      ports: { http: PORT, gt06: GPS_PORT_GT06, teltonika: GPS_PORT_TELTONIKA }
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function setupScheduledTasks(gpsProtocol) {
  // Cleanup task - runs every hour
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Running scheduled cleanup task');
      await gpsProtocol.cleanup();
      
      // Archive old PostgreSQL data
      await postgresManager.archiveOldData(90);
      await postgresManager.cleanup(365);
      
      logger.info('Scheduled cleanup completed');
    } catch (error) {
      logger.error('Scheduled cleanup failed:', error);
    }
  });

  // Device status check - runs every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const Device = require('./models/Device');
      await Device.cleanupOfflineDevices(1); // Mark as offline after 1 day
    } catch (error) {
      logger.error('Device status check failed:', error);
    }
  });

  // Performance monitoring - runs every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    try {
      const stats = gpsProtocol.getStats();
      logger.performance('gps_sessions', stats.activeSessions);
      logger.performance('messages_processed', stats.messagesProcessed);
      logger.performance('memory_usage', process.memoryUsage().heapUsed / 1024 / 1024, 'MB');
      logger.performance('uptime', process.uptime(), 'seconds');
    } catch (error) {
      logger.error('Performance monitoring failed:', error);
    }
  });
}

function setupGracefulShutdown(server, gpsServerGT06, gpsServerTeltonika, gpsProtocol) {
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    try {
      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });
      
      gpsServerGT06.close(() => {
        logger.info('GT06 GPS server closed');
      });
      
      gpsServerTeltonika.close(() => {
        logger.info('Teltonika GPS server closed');
      });

      // Cleanup GPS protocol
      await gpsProtocol.cleanup();
      
      // Close Redis connections
      await redisManager.disconnect();
      
      // Close PostgreSQL connections
      await postgresManager.disconnect();
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

module.exports = { app: null, io: null }; // Export for testing