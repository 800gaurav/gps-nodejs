const { Pool } = require('pg');
const copyFrom = require('pg-copy-streams').from;
const logger = require('../utils/logger');

class PostgreSQLManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.pool = new Pool({
        host: process.env.PG_HOST || 'localhost',
        port: process.env.PG_PORT || 5432,
        database: process.env.PG_DATABASE || 'gps_tracker',
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      await this.createTables();
      
      this.isConnected = true;
      logger.info('PostgreSQL connected successfully');
      return true;
    } catch (error) {
      logger.error('PostgreSQL connection failed:', error);
      return false;
    }
  }

  async createTables() {
    const client = await this.pool.connect();
    
    try {
      // Locations table with PostGIS support
      await client.query(`
        CREATE TABLE IF NOT EXISTS locations (
          id BIGSERIAL PRIMARY KEY,
          device_id VARCHAR(50) NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL,
          location POINT NOT NULL,
          altitude REAL DEFAULT 0,
          speed REAL DEFAULT 0,
          course SMALLINT DEFAULT 0,
          valid BOOLEAN DEFAULT true,
          satellites SMALLINT DEFAULT 0,
          ignition BOOLEAN DEFAULT false,
          engine_on BOOLEAN DEFAULT false,
          battery SMALLINT,
          power REAL,
          rssi SMALLINT,
          protocol VARCHAR(20) NOT NULL,
          alarms TEXT[],
          attributes JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_locations_device_timestamp 
        ON locations (device_id, timestamp DESC);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_locations_timestamp 
        ON locations (timestamp DESC);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_locations_spatial 
        ON locations USING GIST (location);
      `);

      // Partition by month for better performance
      await client.query(`
        CREATE TABLE IF NOT EXISTS locations_archive (
          LIKE locations INCLUDING ALL
        );
      `);

      logger.info('PostgreSQL tables created/verified');
    } finally {
      client.release();
    }
  }

  async insertLocation(locationData) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        INSERT INTO locations (
          device_id, timestamp, location, altitude, speed, course,
          valid, satellites, ignition, engine_on, battery, power,
          rssi, protocol, alarms, attributes
        ) VALUES ($1, $2, POINT($3, $4), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id;
      `;
      
      const values = [
        locationData.deviceId,
        locationData.timestamp,
        locationData.longitude,
        locationData.latitude,
        locationData.altitude || 0,
        locationData.speed || 0,
        locationData.course || 0,
        locationData.valid !== false,
        locationData.satellites || 0,
        locationData.ignition || false,
        locationData.engineOn || false,
        locationData.battery,
        locationData.power,
        locationData.rssi,
        locationData.protocol,
        locationData.alarms || [],
        locationData.attributes || {}
      ];
      
      const result = await client.query(query, values);
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async bulkInsertLocations(locations) {
    const client = await this.pool.connect();
    
    try {
      const stream = client.query(copyFrom(`
        COPY locations (
          device_id, timestamp, location, altitude, speed, course,
          valid, satellites, ignition, engine_on, battery, power,
          rssi, protocol, alarms, attributes
        ) FROM STDIN WITH CSV
      `));

      for (const loc of locations) {
        const row = [
          loc.deviceId,
          loc.timestamp.toISOString(),
          `"(${loc.longitude},${loc.latitude})"`,
          loc.altitude || 0,
          loc.speed || 0,
          loc.course || 0,
          loc.valid !== false,
          loc.satellites || 0,
          loc.ignition || false,
          loc.engineOn || false,
          loc.battery || null,
          loc.power || null,
          loc.rssi || null,
          loc.protocol,
          `"{${(loc.alarms || []).join(',')}}"`,
          JSON.stringify(loc.attributes || {})
        ].join(',') + '\n';
        
        stream.write(row);
      }
      
      stream.end();
      return new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });
    } finally {
      client.release();
    }
  }

  async getLocations(deviceId, startDate, endDate, limit = 1000) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          device_id,
          timestamp,
          location[0] as longitude,
          location[1] as latitude,
          altitude,
          speed,
          course,
          valid,
          satellites,
          ignition,
          engine_on,
          battery,
          power,
          rssi,
          protocol,
          alarms,
          attributes
        FROM locations 
        WHERE device_id = $1 
          AND timestamp BETWEEN $2 AND $3
        ORDER BY timestamp DESC 
        LIMIT $4;
      `;
      
      const result = await client.query(query, [deviceId, startDate, endDate, limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getRoute(deviceId, startTime, endTime, simplify = false) {
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT 
          timestamp,
          location[0] as longitude,
          location[1] as latitude,
          speed,
          course,
          ignition
        FROM locations 
        WHERE device_id = $1 
          AND timestamp BETWEEN $2 AND $3
          AND valid = true
        ORDER BY timestamp ASC;
      `;
      
      if (simplify) {
        query = `
          SELECT DISTINCT ON (date_trunc('minute', timestamp))
            timestamp,
            location[0] as longitude,
            location[1] as latitude,
            speed,
            course,
            ignition
          FROM locations 
          WHERE device_id = $1 
            AND timestamp BETWEEN $2 AND $3
            AND valid = true
          ORDER BY date_trunc('minute', timestamp), timestamp ASC;
        `;
      }
      
      const result = await client.query(query, [deviceId, startTime, endTime]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getLocationStats(deviceId, timeRange) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT 
          COUNT(*) as total_points,
          MAX(speed) as max_speed,
          AVG(speed) as avg_speed,
          SUM(CASE WHEN engine_on THEN 1 ELSE 0 END) as engine_on_count,
          SUM(CASE WHEN ignition THEN 1 ELSE 0 END) as ignition_on_count,
          MIN(timestamp) as first_timestamp,
          MAX(timestamp) as last_timestamp
        FROM locations 
        WHERE device_id = $1 
          AND timestamp BETWEEN $2 AND $3
          AND valid = true;
      `;
      
      const result = await client.query(query, [deviceId, timeRange.start, timeRange.end]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async findNearbyDevices(latitude, longitude, radiusKm = 10) {
    const client = await this.pool.connect();
    
    try {
      const query = `
        SELECT DISTINCT ON (device_id)
          device_id,
          location[0] as longitude,
          location[1] as latitude,
          timestamp,
          speed
        FROM locations 
        WHERE location <-> POINT($1, $2) < $3
          AND timestamp > NOW() - INTERVAL '1 hour'
        ORDER BY device_id, timestamp DESC;
      `;
      
      const result = await client.query(query, [longitude, latitude, radiusKm / 111.0]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async archiveOldData(daysToKeep = 90) {
    const client = await this.pool.connect();
    
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      // Move old data to archive
      await client.query(`
        INSERT INTO locations_archive 
        SELECT * FROM locations 
        WHERE timestamp < $1;
      `, [cutoffDate]);
      
      // Delete from main table
      const result = await client.query(`
        DELETE FROM locations 
        WHERE timestamp < $1;
      `, [cutoffDate]);
      
      logger.info(`Archived ${result.rowCount} location records`);
      return result.rowCount;
    } finally {
      client.release();
    }
  }

  async cleanup(daysToKeep = 365) {
    const client = await this.pool.connect();
    
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const result = await client.query(`
        DELETE FROM locations_archive 
        WHERE timestamp < $1;
      `, [cutoffDate]);
      
      logger.info(`Cleaned up ${result.rowCount} archived records`);
      return result.rowCount;
    } finally {
      client.release();
    }
  }

  async healthCheck() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      logger.error('PostgreSQL health check failed:', error);
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.pool) {
        await this.pool.end();
        this.isConnected = false;
        logger.info('PostgreSQL disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting PostgreSQL:', error);
    }
  }
}

module.exports = new PostgreSQLManager();