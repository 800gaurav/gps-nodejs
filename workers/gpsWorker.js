const { parentPort } = require('worker_threads');
const GT06Decoder = require('../protocols/gt06Decoder');
const redisManager = require('../config/redis');
const logger = require('../utils/logger');

class GPSWorker {
  constructor() {
    this.decoder = new GT06Decoder();
    this.locationBatch = [];
    this.batchSize = 100;
    this.batchTimeout = 1000;
    
    this.startBatchProcessor();
  }

  async processGPSData(data) {
    try {
      const result = await this.decoder.decode(data.buffer, data.deviceSession);
      
      if (result && result.position) {
        this.locationBatch.push(result.position);
        
        // Send real-time update
        parentPort.postMessage({
          type: 'location_update',
          deviceId: data.deviceId,
          position: result.position
        });
        
        // Cache in Redis
        await redisManager.setLastLocation(data.deviceId, result.position);
      }
      
      return result;
    } catch (error) {
      logger.error('GPS processing error:', error);
      return null;
    }
  }

  startBatchProcessor() {
    setInterval(async () => {
      if (this.locationBatch.length > 0) {
        try {
          const batch = this.locationBatch.splice(0, this.batchSize);
          
          // Bulk insert to database
          parentPort.postMessage({
            type: 'bulk_insert',
            locations: batch
          });
          
        } catch (error) {
          logger.error('Batch processing error:', error);
        }
      }
    }, this.batchTimeout);
  }
}

const worker = new GPSWorker();

parentPort.on('message', async (data) => {
  if (data.type === 'gps_data') {
    const result = await worker.processGPSData(data);
    if (result && result.response) {
      parentPort.postMessage({
        type: 'gps_response',
        deviceId: data.deviceId,
        response: result.response
      });
    }
  }
});