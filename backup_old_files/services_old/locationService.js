const postgresManager = require('../config/postgresql');
const redisManager = require('../config/redis');
const logger = require('../utils/logger');
const dayjs = require('dayjs');
const crc = require('crc');

class LocationService {
  constructor() {
    this.batchSize = 100;
    this.batchTimeout = 5000;
    this.locationBatch = [];
    this.batchTimer = null;
  }

  async saveLocation(locationData) {
    try {
      if (!this.isValidLocation(locationData)) {
        logger.warn('Invalid location data', { deviceId: locationData.deviceId });
        return null;
      }

      this.locationBatch.push({
        ...locationData,
        timestamp: dayjs(locationData.timestamp).toDate(),
        checksum: this.calculateChecksum(locationData)
      });

      if (this.locationBatch.length >= this.batchSize) {
        await this.processBatch();
      } else if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, this.batchTimeout);
      }

      await redisManager.cacheLocation(locationData.deviceId, locationData);
      return true;
    } catch (error) {
      logger.error('Error saving location:', error);
      return false;
    }
  }

  async processBatch() {
    if (this.locationBatch.length === 0) return;

    try {
      const batch = [...this.locationBatch];
      this.locationBatch = [];
      
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      await postgresManager.bulkInsertLocations(batch);
      logger.info(`Processed location batch: ${batch.length} records`);
    } catch (error) {
      logger.error('Error processing location batch:', error);
    }
  }

  async getLocations(deviceId, startDate, endDate, options = {}) {
    try {
      const start = dayjs(startDate).toDate();
      const end = dayjs(endDate).toDate();
      const limit = options.limit || 1000;

      if (dayjs().diff(dayjs(endDate), 'minutes') < 60) {
        const cachedLocations = await redisManager.getLocationHistory(deviceId, limit);
        if (cachedLocations.length > 0) {
          return cachedLocations.filter(loc => {
            const timestamp = dayjs(loc.timestamp);
            return timestamp.isAfter(start) && timestamp.isBefore(end);
          });
        }
      }

      const locations = await postgresManager.getLocations(deviceId, start, end, limit);
      return locations;
    } catch (error) {
      logger.error('Error fetching locations:', error);
      return [];
    }
  }

  async getRoute(deviceId, startTime, endTime, options = {}) {
    try {
      const route = await postgresManager.getRoute(
        deviceId, 
        dayjs(startTime).toDate(), 
        dayjs(endTime).toDate(), 
        options.simplify
      );

      const stats = this.calculateRouteStats(route);
      
      return { route, statistics: stats };
    } catch (error) {
      logger.error('Error fetching route:', error);
      return { route: [], statistics: {} };
    }
  }

  calculateRouteStats(route) {
    if (route.length < 2) {
      return {
        totalDistance: 0,
        maxSpeed: 0,
        avgSpeed: 0,
        totalTime: 0,
        pointCount: route.length
      };
    }

    let totalDistance = 0;
    let maxSpeed = 0;
    let totalSpeed = 0;
    let totalTime = 0;

    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const curr = route[i];
      
      const distance = this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
      totalDistance += distance;
      
      if (curr.speed > maxSpeed) maxSpeed = curr.speed;
      totalSpeed += curr.speed;
      
      const timeDiff = dayjs(curr.timestamp).diff(dayjs(prev.timestamp), 'milliseconds');
      totalTime += timeDiff;
    }

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      maxSpeed: Math.round(maxSpeed * 100) / 100,
      avgSpeed: Math.round((totalSpeed / route.length) * 100) / 100,
      totalTime: Math.round(totalTime / 1000 / 60),
      pointCount: route.length
    };
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  isValidLocation(location) {
    return (
      location &&
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      location.latitude >= -90 && location.latitude <= 90 &&
      location.longitude >= -180 && location.longitude <= 180 &&
      location.deviceId &&
      location.timestamp
    );
  }

  calculateChecksum(locationData) {
    const data = `${locationData.deviceId}${locationData.latitude}${locationData.longitude}${locationData.timestamp}`;
    return crc.crc32(data).toString(16);
  }

  async cleanup() {
    try {
      if (this.locationBatch.length > 0) {
        await this.processBatch();
      }
      logger.info('Location service cleanup completed');
    } catch (error) {
      logger.error('Error during location service cleanup:', error);
    }
  }
}

module.exports = new LocationService();