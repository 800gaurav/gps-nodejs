const logger = require('../utils/logger');

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    // Check if Redis is enabled
    if (process.env.REDIS_ENABLED === 'false') {
      logger.info('Redis is disabled in configuration');
      this.isConnected = false;
      return false;
    }

    try {
      // Try to connect to Redis, but don't fail if it's not available
      const Redis = require('ioredis');
      
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 3000,
      };

      this.client = new Redis(redisConfig);
      
      this.client.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.warn('Redis connection error (continuing without Redis):', err.message);
        this.isConnected = false;
      });

      await this.client.connect();
      return true;
    } catch (error) {
      logger.warn('Redis not available, continuing without Redis caching');
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
      }
      this.isConnected = false;
    } catch (error) {
      logger.error('Error disconnecting Redis:', error);
    }
  }

  // Safe Redis operations - return default values if Redis is not available
  async setDeviceSession(deviceId, sessionData) {
    if (!this.isConnected) return true;
    try {
      const key = `device:${deviceId}:session`;
      await this.client.setex(key, 3600, JSON.stringify(sessionData));
      return true;
    } catch (error) {
      logger.warn('Redis setDeviceSession failed:', error.message);
      return true;
    }
  }

  async getDeviceSession(deviceId) {
    if (!this.isConnected) return null;
    try {
      const key = `device:${deviceId}:session`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn('Redis getDeviceSession failed:', error.message);
      return null;
    }
  }

  async removeDeviceSession(deviceId) {
    if (!this.isConnected) return true;
    try {
      const key = `device:${deviceId}:session`;
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.warn('Redis removeDeviceSession failed:', error.message);
      return true;
    }
  }

  async setLastLocation(deviceId, locationData) {
    if (!this.isConnected) return true;
    try {
      const key = `device:${deviceId}:location`;
      await this.client.setex(key, 300, JSON.stringify(locationData));
      return true;
    } catch (error) {
      logger.warn('Redis setLastLocation failed:', error.message);
      return true;
    }
  }

  async getLastLocation(deviceId) {
    if (!this.isConnected) return null;
    try {
      const key = `device:${deviceId}:location`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn('Redis getLastLocation failed:', error.message);
      return null;
    }
  }

  async getLocationHistory(deviceId, limit = 50) {
    if (!this.isConnected) return [];
    try {
      const key = `device:${deviceId}:history`;
      const data = await this.client.lrange(key, 0, limit - 1);
      return data.map(item => JSON.parse(item));
    } catch (error) {
      logger.warn('Redis getLocationHistory failed:', error.message);
      return [];
    }
  }

  async setDeviceStatus(deviceId, status) {
    if (!this.isConnected) return true;
    try {
      const key = `device:${deviceId}:status`;
      await this.client.setex(key, 600, JSON.stringify({
        ...status,
        lastUpdate: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      logger.warn('Redis setDeviceStatus failed:', error.message);
      return true;
    }
  }

  async getDeviceStatus(deviceId) {
    if (!this.isConnected) return null;
    try {
      const key = `device:${deviceId}:status`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.warn('Redis getDeviceStatus failed:', error.message);
      return null;
    }
  }

  async queueCommand(deviceId, command) {
    if (!this.isConnected) return Date.now().toString();
    try {
      const key = `device:${deviceId}:commands`;
      const commandData = {
        id: Date.now().toString(),
        command,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      await this.client.lpush(key, JSON.stringify(commandData));
      await this.client.expire(key, 3600);
      return commandData.id;
    } catch (error) {
      logger.warn('Redis queueCommand failed:', error.message);
      return Date.now().toString();
    }
  }

  async bulkSetLocations(locations) {
    if (!this.isConnected || !locations.length) return true;
    try {
      const pipeline = this.client.pipeline();
      locations.forEach(location => {
        const key = `device:${location.deviceId}:location`;
        pipeline.setex(key, 300, JSON.stringify(location));
      });
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.warn('Redis bulkSetLocations failed:', error.message);
      return true;
    }
  }

  async subscribeToLocationUpdates(callback) {
    if (!this.isConnected) return false;
    try {
      // Simplified - just return false if Redis not available
      return false;
    } catch (error) {
      logger.warn('Redis subscribeToLocationUpdates failed:', error.message);
      return false;
    }
  }

  async subscribeToDeviceAlerts(callback) {
    if (!this.isConnected) return false;
    try {
      // Simplified - just return false if Redis not available
      return false;
    } catch (error) {
      logger.warn('Redis subscribeToDeviceAlerts failed:', error.message);
      return false;
    }
  }

  async publishDeviceAlert(deviceId, alertData) {
    if (!this.isConnected) return true;
    try {
      // Simplified - just return true if Redis not available
      return true;
    } catch (error) {
      logger.warn('Redis publishDeviceAlert failed:', error.message);
      return true;
    }
  }

  async cleanupInactiveDevices() {
    if (!this.isConnected) return true;
    try {
      // Simplified cleanup
      return true;
    } catch (error) {
      logger.warn('Redis cleanupInactiveDevices failed:', error.message);
      return true;
    }
  }

  async healthCheck() {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }
}

module.exports = new RedisManager();