const logger = require('../utils/logger');

class GT06ProtocolEncoder {
  constructor() {
    // Command types
    this.MSG_COMMAND_0 = 0x80;
    this.MSG_COMMAND_1 = 0x81;
    this.MSG_COMMAND_2 = 0x82;
    
    // Message index counter (incremental)
    this.messageIndex = 1;
    
    // Standard commands
    this.COMMANDS = {
      ENGINE_STOP: 'engineStop',
      ENGINE_RESUME: 'engineResume',
      REBOOT: 'reboot',
      RESET: 'reset',
      SET_TIMEZONE: 'setTimezone',
      SET_APN: 'setAPN',
      SET_SERVER: 'setServer',
      SET_INTERVAL: 'setInterval',
      GET_VERSION: 'getVersion',
      GET_STATUS: 'getStatus',
      CUSTOM: 'custom'
    };
  }

  /**
   * Encode command for GT06 device
   */
  encodeCommand(deviceId, command, parameters = {}) {
    try {
      logger.commandSent(deviceId, command.type, parameters);

      switch (command.type) {
        case this.COMMANDS.ENGINE_STOP:
          return this.encodeEngineCommand(deviceId, true, parameters);
        
        case this.COMMANDS.ENGINE_RESUME:
          return this.encodeEngineCommand(deviceId, false, parameters);
        
        case this.COMMANDS.REBOOT:
          return this.encodeRebootCommand(deviceId, parameters);
        
        case this.COMMANDS.RESET:
          return this.encodeResetCommand(deviceId, parameters);
        
        case this.COMMANDS.SET_TIMEZONE:
          return this.encodeTimezoneCommand(deviceId, parameters);
        
        case this.COMMANDS.SET_APN:
          return this.encodeAPNCommand(deviceId, parameters);
        
        case this.COMMANDS.SET_SERVER:
          return this.encodeServerCommand(deviceId, parameters);
        
        case this.COMMANDS.SET_INTERVAL:
          return this.encodeIntervalCommand(deviceId, parameters);
        
        case this.COMMANDS.GET_VERSION:
          return this.encodeVersionCommand(deviceId, parameters);
        
        case this.COMMANDS.GET_STATUS:
          return this.encodeStatusCommand(deviceId, parameters);
        
        case this.COMMANDS.CUSTOM:
          return this.encodeCustomCommand(deviceId, parameters);
        
        default:
          logger.error('Unknown command type:', command.type);
          return null;
      }
    } catch (error) {
      logger.error('Error encoding GT06 command:', error);
      return null;
    }
  }

  /**
   * Encode engine control command (stop/resume)
   */
  encodeEngineCommand(deviceId, stop, parameters = {}) {
    const password = parameters.password || '123456';
    const model = parameters.model || 'STANDARD';
    const alternative = parameters.alternative || false;

    let commandText;

    if (model === 'G109') {
      commandText = stop ? 'DYD#' : 'HFYD#';
    } else if (alternative) {
      commandText = stop ? `DYD,${password}#` : `HFYD,${password}#`;
    } else {
      // Standard GT06 compatible commands
      commandText = stop ? `Relay,1#` : `Relay,0#`;
    }

    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode reboot command
   */
  encodeRebootCommand(deviceId, parameters = {}) {
    const password = parameters.password || '123456';
    const commandText = `RESET,${password}#`;
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode factory reset command
   */
  encodeResetCommand(deviceId, parameters = {}) {
    const password = parameters.password || '123456';
    const commandText = `FACTORY,${password}#`;
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode timezone setting command
   */
  encodeTimezoneCommand(deviceId, parameters = {}) {
    const password = parameters.password || '123456';
    const timezone = parameters.timezone || 0; // UTC offset in hours
    const commandText = `TIMEZONE,${password},${timezone}#`;
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode APN setting command
   */
  encodeAPNCommand(deviceId, parameters = {}) {
    const password = parameters.password || '123456';
    const apn = parameters.apn || 'internet';
    const username = parameters.username || '';
    const apnPassword = parameters.apnPassword || '';
    
    let commandText = `APN,${password},${apn}`;
    if (username) {
      commandText += `,${username}`;
      if (apnPassword) {
        commandText += `,${apnPassword}`;
      }
    }
    commandText += '#';
    
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode server setting command
   */
  encodeServerCommand(deviceId, parameters = {}) {
    const password = parameters.password || '123456';
    const server = parameters.server || 'localhost';
    const port = parameters.port || 5027;
    const commandText = `SERVER,${password},${server},${port}#`;
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode reporting interval command
   */
  encodeIntervalCommand(deviceId, parameters = {}) {
    const password = parameters.password || '123456';
    const interval = parameters.interval || 30; // seconds
    const commandText = `TIMER,${password},${interval}#`;
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode version request command
   */
  encodeVersionCommand(deviceId, parameters = {}) {
    const password = parameters.password || '123456';
    const commandText = `VERSION,${password}#`;
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode status request command
   */
  encodeStatusCommand(deviceId, parameters = {}) {
    const password = parameters.password || '123456';
    const commandText = `STATUS,${password}#`;
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode custom command
   */
  encodeCustomCommand(deviceId, parameters = {}) {
    const commandText = parameters.command || '';
    if (!commandText) {
      logger.error('Custom command text is required');
      return null;
    }
    return this.encodeTextCommand(commandText, parameters.language);
  }

  /**
   * Encode text command into GT06 protocol format
   */
  encodeTextCommand(commandText, language = false) {
    try {
      const commandBuffer = Buffer.from(commandText, 'ascii');
      const languageSize = language ? 2 : 0;
      const totalLength = 1 + 1 + 4 + commandBuffer.length + languageSize + 2 + 2 + 2;
      
      const buffer = Buffer.alloc(totalLength);
      let pos = 0;

      // Header (0x7878)
      buffer.writeUInt16BE(0x7878, pos);
      pos += 2;

      // Length: type(1) + commandLength(1) + reserved(4) + content + language + index(2) + crc(2)
      const messageLength = 1 + 1 + 4 + commandBuffer.length + languageSize + 2 + 2;
      buffer.writeUInt8(messageLength, pos++);

      // Message type (MSG_COMMAND_0)
      buffer.writeUInt8(this.MSG_COMMAND_0, pos++);

      // Command length: reserved(4) + content.length
      buffer.writeUInt8(4 + commandBuffer.length, pos++);

      // Server flag (reserved)
      buffer.writeUInt32BE(0, pos);
      pos += 4;

      // Command text
      commandBuffer.copy(buffer, pos);
      pos += commandBuffer.length;

      // Language (optional)
      if (language) {
        buffer.writeUInt16BE(2, pos); // English language code
        pos += 2;
      }

      // Message index (sequence number)
      const currentIndex = this.messageIndex++;
      if (this.messageIndex > 0xFFFF) this.messageIndex = 1; // Reset after max
      buffer.writeUInt16BE(currentIndex, pos);
      pos += 2;

      // CRC16 checksum (always basic format 0x7878 for commands)
      const crc = this.calculateCRC16(buffer.slice(2, pos));
      buffer.writeUInt16BE(crc, pos);
      pos += 2;

      // Footer
      buffer.writeUInt8(0x0D, pos++);
      buffer.writeUInt8(0x0A, pos++);

      return buffer.slice(0, pos);
    } catch (error) {
      logger.error('Error encoding text command:', error);
      return null;
    }
  }

  /**
   * Encode binary command
   */
  encodeBinaryCommand(commandType, data = Buffer.alloc(0)) {
    try {
      const totalLength = 3 + 1 + data.length + 2 + 2 + 2;
      const buffer = Buffer.alloc(totalLength);
      let pos = 0;

      // Header
      buffer.writeUInt16BE(0x7878, pos);
      pos += 2;

      // Length
      const messageLength = 1 + data.length + 2 + 2; // type + data + index + crc
      buffer.writeUInt8(messageLength, pos++);

      // Command type
      buffer.writeUInt8(commandType, pos++);

      // Data
      if (data.length > 0) {
        data.copy(buffer, pos);
        pos += data.length;
      }

      // Message index
      const currentIndex = this.messageIndex++;
      if (this.messageIndex > 0xFFFF) this.messageIndex = 1;
      buffer.writeUInt16BE(currentIndex, pos);
      pos += 2;

      // CRC16
      const crc = this.calculateCRC16(buffer.slice(2, pos));
      buffer.writeUInt16BE(crc, pos);
      pos += 2;

      // Footer
      buffer.writeUInt8(0x0D, pos++);
      buffer.writeUInt8(0x0A, pos++);

      return buffer.slice(0, pos);
    } catch (error) {
      logger.error('Error encoding binary command:', error);
      return null;
    }
  }

  /**
   * Create acknowledgment response
   */
  createAcknowledgment(messageType, index) {
    return this.encodeBinaryCommand(messageType, Buffer.alloc(0));
  }

  /**
   * Create login response
   */
  createLoginResponse(index) {
    return this.encodeBinaryCommand(0x01, Buffer.alloc(0));
  }

  /**
   * Create heartbeat response
   */
  createHeartbeatResponse(index) {
    return this.encodeBinaryCommand(0x23, Buffer.alloc(0));
  }

  /**
   * Create time response
   */
  createTimeResponse(index) {
    const now = new Date();
    const timeData = Buffer.alloc(6);
    
    timeData.writeUInt8(now.getFullYear() - 2000, 0);
    timeData.writeUInt8(now.getMonth() + 1, 1);
    timeData.writeUInt8(now.getDate(), 2);
    timeData.writeUInt8(now.getHours(), 3);
    timeData.writeUInt8(now.getMinutes(), 4);
    timeData.writeUInt8(now.getSeconds(), 5);

    return this.encodeBinaryCommand(0x8A, timeData);
  }

  /**
   * Create address response
   */
  createAddressResponse(address = 'Unknown Location') {
    const response = `${address}##`;
    const responseBuffer = Buffer.from(response, 'ascii');
    
    const totalLength = 4 + 1 + 4 + responseBuffer.length + 2 + 2 + 2;
    const buffer = Buffer.alloc(totalLength);
    let pos = 0;

    // Extended header
    buffer.writeUInt16BE(0x7979, pos);
    pos += 2;
    buffer.writeUInt16BE(5 + responseBuffer.length, pos);
    pos += 2;

    // Message type
    buffer.writeUInt8(0x97, pos++);

    // Response length
    buffer.writeUInt8(responseBuffer.length, pos++);

    // Reserved
    buffer.writeUInt32BE(0, pos);
    pos += 4;

    // Response text
    responseBuffer.copy(buffer, pos);
    pos += responseBuffer.length;

    // Index
    const currentIndex = this.messageIndex++;
    if (this.messageIndex > 0xFFFF) this.messageIndex = 1;
    buffer.writeUInt16BE(currentIndex, pos);
    pos += 2;

    // CRC (extended format uses offset 4)
    const crc = this.calculateCRC16(buffer.slice(4, pos));
    buffer.writeUInt16BE(crc, pos);
    pos += 2;

    // Footer
    buffer.writeUInt8(0x0D, pos++);
    buffer.writeUInt8(0x0A, pos++);

    return buffer.slice(0, pos);
  }

  /**
   * Calculate CRC16 checksum using X.25 polynomial (matches Java implementation)
   */
  calculateCRC16(data) {
    let crc = 0xFFFF;
    
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i] & 0xFF;
      for (let j = 0; j < 8; j++) {
        if ((crc & 1) !== 0) {
          crc = (crc >>> 1) ^ 0x8408;
        } else {
          crc = crc >>> 1;
        }
      }
    }
    
    return (~crc) & 0xFFFF;
  }

  /**
   * Validate command parameters
   */
  validateCommand(command) {
    if (!command || typeof command !== 'object') {
      return { valid: false, error: 'Command must be an object' };
    }

    if (!command.type) {
      return { valid: false, error: 'Command type is required' };
    }

    if (!Object.values(this.COMMANDS).includes(command.type)) {
      return { valid: false, error: 'Invalid command type' };
    }

    // Validate specific command parameters
    switch (command.type) {
      case this.COMMANDS.SET_TIMEZONE:
        if (command.parameters && command.parameters.timezone !== undefined) {
          const tz = command.parameters.timezone;
          if (typeof tz !== 'number' || tz < -12 || tz > 12) {
            return { valid: false, error: 'Timezone must be a number between -12 and 12' };
          }
        }
        break;

      case this.COMMANDS.SET_SERVER:
        if (command.parameters) {
          if (command.parameters.port && (command.parameters.port < 1 || command.parameters.port > 65535)) {
            return { valid: false, error: 'Port must be between 1 and 65535' };
          }
        }
        break;

      case this.COMMANDS.SET_INTERVAL:
        if (command.parameters && command.parameters.interval !== undefined) {
          const interval = command.parameters.interval;
          if (typeof interval !== 'number' || interval < 10 || interval > 3600) {
            return { valid: false, error: 'Interval must be between 10 and 3600 seconds' };
          }
        }
        break;

      case this.COMMANDS.CUSTOM:
        if (!command.parameters || !command.parameters.command) {
          return { valid: false, error: 'Custom command text is required' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Get command info
   */
  getCommandInfo(commandType) {
    const info = {
      [this.COMMANDS.ENGINE_STOP]: {
        description: 'Stop vehicle engine',
        parameters: ['password', 'model', 'alternative'],
        example: { type: 'engineStop', parameters: { password: '123456' } }
      },
      [this.COMMANDS.ENGINE_RESUME]: {
        description: 'Resume vehicle engine',
        parameters: ['password', 'model', 'alternative'],
        example: { type: 'engineResume', parameters: { password: '123456' } }
      },
      [this.COMMANDS.REBOOT]: {
        description: 'Reboot device',
        parameters: ['password'],
        example: { type: 'reboot', parameters: { password: '123456' } }
      },
      [this.COMMANDS.RESET]: {
        description: 'Factory reset device',
        parameters: ['password'],
        example: { type: 'reset', parameters: { password: '123456' } }
      },
      [this.COMMANDS.SET_TIMEZONE]: {
        description: 'Set device timezone',
        parameters: ['password', 'timezone'],
        example: { type: 'setTimezone', parameters: { password: '123456', timezone: 5.5 } }
      },
      [this.COMMANDS.SET_APN]: {
        description: 'Set APN settings',
        parameters: ['password', 'apn', 'username', 'apnPassword'],
        example: { type: 'setAPN', parameters: { password: '123456', apn: 'internet' } }
      },
      [this.COMMANDS.SET_SERVER]: {
        description: 'Set server settings',
        parameters: ['password', 'server', 'port'],
        example: { type: 'setServer', parameters: { password: '123456', server: 'gps.example.com', port: 5027 } }
      },
      [this.COMMANDS.SET_INTERVAL]: {
        description: 'Set reporting interval',
        parameters: ['password', 'interval'],
        example: { type: 'setInterval', parameters: { password: '123456', interval: 60 } }
      },
      [this.COMMANDS.GET_VERSION]: {
        description: 'Get device version',
        parameters: ['password'],
        example: { type: 'getVersion', parameters: { password: '123456' } }
      },
      [this.COMMANDS.GET_STATUS]: {
        description: 'Get device status',
        parameters: ['password'],
        example: { type: 'getStatus', parameters: { password: '123456' } }
      },
      [this.COMMANDS.CUSTOM]: {
        description: 'Send custom command',
        parameters: ['command'],
        example: { type: 'custom', parameters: { command: 'CUSTOM,123456,param1,param2#' } }
      }
    };

    return info[commandType] || null;
  }

  /**
   * Get all available commands
   */
  getAllCommands() {
    return Object.keys(this.COMMANDS).map(key => ({
      type: this.COMMANDS[key],
      info: this.getCommandInfo(this.COMMANDS[key])
    }));
  }
}

module.exports = GT06ProtocolEncoder;