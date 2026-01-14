const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'gps-tracker' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: parseInt(process.env.LOG_MAX_SIZE) || 10485760, // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
      tailable: true
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true
    }),
    
    // GPS protocol specific logs
    new winston.transports.File({
      filename: path.join(logsDir, 'gps-protocol.log'),
      level: 'debug',
      maxsize: 10485760,
      maxFiles: 3,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, deviceId, protocol, ...meta }) => {
          let log = `${timestamp} [${level.toUpperCase()}]`;
          if (deviceId) log += ` [${deviceId}]`;
          if (protocol) log += ` [${protocol}]`;
          log += `: ${message}`;
          
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
          }
          
          return log;
        })
      )
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} ${level}: ${message}`;
        
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta, null, 2)}`;
        }
        
        return log;
      })
    )
  }));
}

// Custom logging methods for GPS tracking
logger.gpsProtocol = (deviceId, protocol, message, data = {}) => {
  logger.debug(message, { deviceId, protocol, ...data });
};

logger.deviceActivity = (deviceId, activity, data = {}) => {
  logger.info(`Device activity: ${activity}`, { deviceId, ...data });
};

logger.deviceConnected = (deviceId, ip) => {
  logger.info(`Device connected: ${deviceId}`, { ip });
};

logger.deviceDisconnected = (deviceId) => {
  logger.info(`Device disconnected: ${deviceId}`, { deviceId });
};

logger.locationUpdate = (deviceId, location) => {
  logger.debug('Location update received', {
    deviceId,
    lat: location.latitude,
    lng: location.longitude,
    speed: location.speed,
    timestamp: location.timestamp
  });
};

logger.commandSent = (deviceId, command, data = {}) => {
  logger.info(`Command sent to device: ${command}`, { deviceId, ...data });
};

logger.alert = (deviceId, alertType, message, data = {}) => {
  logger.warn(`Alert [${alertType}]: ${message}`, { deviceId, ...data });
};

logger.performance = (metric, value, unit = '') => {
  logger.info(`Performance metric: ${metric} = ${value}${unit}`, { metric, value, unit });
};

logger.security = (event, details = {}) => {
  logger.warn(`Security event: ${event}`, details);
};

// Error handling for logger itself
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down logger...');
  setTimeout(() => logger.end(), 100);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down logger...');
  setTimeout(() => logger.end(), 100);
});

module.exports = logger;