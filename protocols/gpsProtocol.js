const net = require('net');
const EventEmitter = require('events');
const GT06Decoder = require('./gt06Decoder');
const GT06Encoder = require('./gt06Encoder');
const redisManager = require('../config/redis');
const logger = require('../utils/logger');
const { Worker } = require('worker_threads');

class GPSProtocol extends EventEmitter {
  constructor() {
    super();
    this.decoder = new GT06Decoder();
    this.encoder = new GT06Encoder();
    this.deviceSessions = new Map();
    this.connectionPool = new Map();
    this.stats = {
      activeSessions: 0,
      messagesProcessed: 0,
      errorsCount: 0,
      startTime: Date.now()
    };
    
    // Connection limits for stability
    this.maxConnections = parseInt(process.env.MAX_GPS_CONNECTIONS) || 2000;
    this.connectionTimeout = parseInt(process.env.GPS_CONNECTION_TIMEOUT) || 300000; // 5 minutes
    
    // Batch processing
    this.locationBatch = [];
    this.batchSize = parseInt(process.env.GPS_BATCH_SIZE) || 50;
    this.batchTimeout = parseInt(process.env.GPS_BATCH_TIMEOUT) || 2000;
    
    this.startBatchProcessor();
    this.startCleanupTimer();
  }

  handleConnection(socket, io, port) {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`;
    
    // Check connection limits
    if (this.connectionPool.size >= this.maxConnections) {
      logger.warn('Max connections reached, rejecting new connection', { connectionId });
      socket.destroy();
      return;
    }

    const connection = {
      socket,
      deviceId: null,
      lastActivity: Date.now(),
      protocol: 'GT06',
      buffer: Buffer.alloc(0),
      authenticated: false
    };

    this.connectionPool.set(connectionId, connection);
    this.stats.activeSessions++;

    logger.info('GPS connection established', { 
      connectionId, 
      protocol: connection.protocol,
      totalConnections: this.connectionPool.size 
    });

    // Set socket options for better performance
    socket.setKeepAlive(true, 30000);
    socket.setNoDelay(true);
    socket.setTimeout(this.connectionTimeout);

    socket.on('data', async (data) => {
      try {
        connection.lastActivity = Date.now();
        connection.buffer = Buffer.concat([connection.buffer, data]);

        // Prevent buffer overflow
        if (connection.buffer.length > 8192) {
          logger.warn('Buffer overflow, clearing', { connectionId, size: connection.buffer.length });
          connection.buffer = Buffer.alloc(0);
          return;
        }

        // Process complete messages with loop protection
        let iterations = 0;
        const maxIterations = 50;
        
        while (connection.buffer.length > 0 && iterations < maxIterations) {
          iterations++;
          const result = await this.processMessage(connection, io);
          
          if (!result || result.consumed === 0) {
            if (result && result.consumed === 0) {
              logger.warn('No data consumed, clearing buffer', { connectionId });
              connection.buffer = Buffer.alloc(0);
            }
            break;
          }
          
          connection.buffer = connection.buffer.slice(result.consumed);
        }
        
        if (iterations >= maxIterations) {
          logger.error('Max iterations reached, clearing buffer', { connectionId });
          connection.buffer = Buffer.alloc(0);
        }
      } catch (error) {
        logger.error('Error processing GPS data:', error);
        this.stats.errorsCount++;
        connection.buffer = Buffer.alloc(0);
      }
    });

    socket.on('error', (error) => {
      logger.error('GPS socket error:', error);
      this.cleanupConnection(connectionId);
    });

    socket.on('close', () => {
      logger.info('GPS connection closed', { connectionId });
      this.cleanupConnection(connectionId);
    });

    socket.on('timeout', () => {
      logger.warn('GPS connection timeout', { connectionId });
      socket.destroy();
    });
  }

  async processMessage(connection, io) {
    try {
      return await this.processGT06Message(connection, io);
    } catch (error) {
      logger.error('Error in processMessage:', error);
      return { consumed: connection.buffer.length };
    }
  }

  async processGT06Message(connection, io) {
    const buffer = connection.buffer;
    
    if (buffer.length < 5) {
      return null; // Need more data
    }

    // Find message boundaries
    let messageStart = -1;
    for (let i = 0; i <= buffer.length - 2; i++) {
      const header = buffer.readUInt16BE(i);
      if (header === 0x7878 || header === 0x7979) {
        messageStart = i;
        break;
      }
    }

    if (messageStart === -1) {
      return { consumed: buffer.length }; // No valid header found
    }

    if (messageStart > 0) {
      return { consumed: messageStart }; // Skip invalid data
    }

    // Determine message length
    let messageLength;
    const header = buffer.readUInt16BE(0);
    
    if (header === 0x7878) {
      if (buffer.length < 3) return null;
      messageLength = buffer.readUInt8(2) + 5; // length + header + length + crc + footer
    } else if (header === 0x7979) {
      if (buffer.length < 4) return null;
      messageLength = buffer.readUInt16BE(2) + 6; // length + header + length + crc + footer
    } else {
      return { consumed: 2 }; // Invalid header
    }

    if (buffer.length < messageLength) {
      return null; // Need more data
    }

    // Extract complete message
    const messageBuffer = buffer.slice(0, messageLength);
    
    // Get or create device session
    let deviceSession = null;
    if (connection.deviceId) {
      deviceSession = this.deviceSessions.get(connection.deviceId);
    }

    // Decode message
    const result = await this.decoder.decode(messageBuffer, deviceSession);
    this.stats.messagesProcessed++;

    if (result) {
      await this.handleDecodedMessage(result, connection, io);
    }

    return { consumed: messageLength };
  }

  async handleDecodedMessage(result, connection, io) {
    try {
      // Handle login
      if (result.type === 'login') {
        connection.deviceId = result.imei;
        connection.authenticated = true;
        
        const sessionData = {
          deviceId: result.imei,
          connectionId: `${connection.socket.remoteAddress}:${connection.socket.remotePort}`,
          connectedAt: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        };
        
        this.deviceSessions.set(result.imei, sessionData);
        await redisManager.setDeviceSession(result.imei, sessionData);
        
        logger.deviceConnected(result.imei, connection.socket.remoteAddress);
      }

      // Handle position data
      if (result.position && connection.deviceId) {
        result.position.deviceId = connection.deviceId;
        
        // Save to database
        const Device = require('../models/Device');
        const Location = require('../models/Location');
        
        try {
          // Find device by IMEI (connection.deviceId contains IMEI after login)
          const device = await Device.findOneAndUpdate(
            { imei: connection.deviceId },
            {
              $set: {
                online: true,
                lastSeen: new Date(),
                lastLatitude: result.position.latitude,
                lastLongitude: result.position.longitude,
                speed: result.position.speed,
                ignition: result.position.ignition,
                course: result.position.course,
                altitude: result.position.altitude,
                satellites: result.position.satellites
              }
            },
            { new: true, upsert: false }
          );
          
          if (device) {
            // Save location history
            await Location.create({
              deviceId: device.deviceId || connection.deviceId,
              latitude: result.position.latitude,
              longitude: result.position.longitude,
              speed: result.position.speed,
              course: result.position.course,
              altitude: result.position.altitude,
              satellites: result.position.satellites,
              ignition: result.position.ignition,
              engineOn: result.position.engineOn,
              gpsValid: result.position.valid,
              timestamp: result.position.timestamp || new Date()
            });
            
            logger.info('Location saved', { 
              deviceId: device.deviceId, 
              imei: connection.deviceId,
              lat: result.position.latitude,
              lng: result.position.longitude
            });
          } else {
            logger.warn('Device not found in database', { 
              imei: connection.deviceId,
              message: 'Add device with this IMEI to database'
            });
          }
        } catch (dbError) {
          logger.error('Database save error:', dbError);
        }
        
        // Cache in Redis for real-time access
        await redisManager.setLastLocation(connection.deviceId, result.position);
        
        // Emit real-time update
        io.emit('locationUpdate', {
          deviceId: connection.deviceId,
          position: result.position,
          timestamp: new Date()
        });

        // Check for alarms
        if (result.position.alarms && result.position.alarms.length > 0) {
          const alertData = {
            deviceId: connection.deviceId,
            alarms: result.position.alarms,
            position: result.position,
            timestamp: new Date()
          };
          
          io.emit('deviceAlert', alertData);
          await redisManager.publishDeviceAlert(connection.deviceId, alertData);
          
          logger.alert(connection.deviceId, result.position.alarms.join(','), 'Device alarm triggered');
        }
      }

      // Send response if needed
      if (result.response) {
        connection.socket.write(result.response);
      }

    } catch (error) {
      logger.error('Error handling decoded message:', error);
    }
  }

  async sendEngineCommand(deviceId, stop, password = '123456') {
    try {
      const session = this.deviceSessions.get(deviceId);
      if (!session) {
        logger.warn('Device session not found for command', { deviceId });
        return false;
      }

      const command = {
        type: stop ? 'engineStop' : 'engineResume',
        parameters: { password }
      };

      const encodedCommand = this.encoder.encodeCommand(deviceId, command);
      if (!encodedCommand) {
        logger.error('Failed to encode command', { deviceId, command: command.type });
        return false;
      }

      // Find active connection
      const connection = Array.from(this.connectionPool.values())
        .find(conn => conn.deviceId === deviceId);

      if (connection && connection.socket.writable) {
        connection.socket.write(encodedCommand);
        logger.commandSent(deviceId, command.type, command.parameters);
        return true;
      } else {
        // Queue command for when device reconnects
        await redisManager.queueCommand(deviceId, command);
        logger.info('Command queued for offline device', { deviceId, command: command.type });
        return true;
      }
    } catch (error) {
      logger.error('Error sending engine command:', error);
      return false;
    }
  }

  async sendCustomCommand(deviceId, command) {
    try {
      const encodedCommand = this.encoder.encodeCommand(deviceId, command);
      if (!encodedCommand) return false;

      const connection = Array.from(this.connectionPool.values())
        .find(conn => conn.deviceId === deviceId);

      if (connection && connection.socket.writable) {
        connection.socket.write(encodedCommand);
        logger.commandSent(deviceId, command.type, command.parameters);
        return true;
      } else {
        await redisManager.queueCommand(deviceId, command);
        return true;
      }
    } catch (error) {
      logger.error('Error sending custom command:', error);
      return false;
    }
  }

  startBatchProcessor() {
    // Batch processing disabled - using direct save
    // Location data is saved immediately in handleDecodedMessage
  }

  startCleanupTimer() {
    // Cleanup inactive connections every 5 minutes
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 300000);

    // Cleanup Redis cache every hour
    setInterval(async () => {
      await redisManager.cleanupInactiveDevices();
    }, 3600000);
  }

  cleanupInactiveConnections() {
    const now = Date.now();
    const timeout = this.connectionTimeout;
    
    for (const [connectionId, connection] of this.connectionPool.entries()) {
      if (now - connection.lastActivity > timeout) {
        logger.info('Cleaning up inactive connection', { connectionId, deviceId: connection.deviceId });
        this.cleanupConnection(connectionId);
      }
    }
  }

  cleanupConnection(connectionId) {
    const connection = this.connectionPool.get(connectionId);
    if (connection) {
      if (connection.deviceId) {
        this.deviceSessions.delete(connection.deviceId);
        logger.deviceDisconnected(connection.deviceId);
      }
      
      if (connection.socket && !connection.socket.destroyed) {
        connection.socket.destroy();
      }
      
      this.connectionPool.delete(connectionId);
      this.stats.activeSessions = Math.max(0, this.stats.activeSessions - 1);
    }
  }

  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      activeConnections: this.connectionPool.size,
      authenticatedDevices: this.deviceSessions.size,
      locationBatchSize: this.locationBatch.length
    };
  }

  async cleanup() {
    try {
      // Close all connections
      for (const [connectionId, connection] of this.connectionPool.entries()) {
        this.cleanupConnection(connectionId);
      }
      
      // Clear batches
      this.locationBatch.length = 0;
      
      logger.info('GPS Protocol cleanup completed');
    } catch (error) {
      logger.error('Error during GPS Protocol cleanup:', error);
    }
  }
}

module.exports = GPSProtocol;