const logger = require('../utils/logger');
const redisManager = require('../config/redis');

class GT06ProtocolDecoder {
  constructor() {
    // Message type constants
    this.MSG_LOGIN = 0x01;
    this.MSG_GPS = 0x10;
    this.MSG_GPS_LBS_1 = 0x12;
    this.MSG_GPS_LBS_2 = 0x22;
    this.MSG_GPS_LBS_3 = 0x37;
    this.MSG_GPS_LBS_4 = 0x2D;
    this.MSG_GPS_LBS_6 = 0x11;
    this.MSG_STATUS = 0x13;
    this.MSG_HEARTBEAT = 0x23;
    this.MSG_GPS_LBS_STATUS_1 = 0x16;
    this.MSG_GPS_LBS_STATUS_2 = 0x26;
    this.MSG_GPS_LBS_STATUS_3 = 0x27;
    this.MSG_GPS_LBS_STATUS_4 = 0x32;
    this.MSG_GPS_LBS_STATUS_5 = 0xA2;
    this.MSG_WIFI = 0x17;
    this.MSG_WIFI_2 = 0x69;
    this.MSG_WIFI_3 = 0xA2;
    this.MSG_WIFI_4 = 0xF3;
    this.MSG_LBS_MULTIPLE_1 = 0x28;
    this.MSG_LBS_MULTIPLE_2 = 0x2E;
    this.MSG_LBS_MULTIPLE_3 = 0x24;
    this.MSG_LBS_WIFI = 0x2C;
    this.MSG_LBS_EXTEND = 0x18;
    this.MSG_LBS_STATUS = 0x19;
    this.MSG_ADDRESS_REQUEST = 0x2A;
    this.MSG_ADDRESS_RESPONSE = 0x97;
    this.MSG_TIME_REQUEST = 0x8A;
    this.MSG_INFO = 0x94;
    this.MSG_STRING = 0x15;
    this.MSG_ALARM = 0x95;
    this.MSG_COMMAND_0 = 0x80;
    this.MSG_COMMAND_1 = 0x81;
    this.MSG_COMMAND_2 = 0x82;

    // Alarm type constants
    this.ALARM_SOS = 'sos';
    this.ALARM_POWER_CUT = 'powerCut';
    this.ALARM_VIBRATION = 'vibration';
    this.ALARM_GEOFENCE_ENTER = 'geofenceEnter';
    this.ALARM_GEOFENCE_EXIT = 'geofenceExit';
    this.ALARM_OVERSPEED = 'overspeed';
    this.ALARM_LOW_BATTERY = 'lowBattery';
    this.ALARM_POWER_OFF = 'powerOff';
    this.ALARM_TAMPERING = 'tampering';
    this.ALARM_DOOR = 'door';
    this.ALARM_ACCIDENT = 'accident';
    this.ALARM_BRAKING = 'braking';
    this.ALARM_CORNERING = 'cornering';
    this.ALARM_ACCELERATION = 'acceleration';
    this.ALARM_FALL_DOWN = 'fallDown';
    this.ALARM_JAMMING = 'jamming';
    this.ALARM_TOW = 'tow';
    this.ALARM_REMOVING = 'removing';

    // Device variants for different behavior
    this.variants = {
      STANDARD: 'standard',
      VXT01: 'vxt01',
      WANWAY_S20: 'wanway_s20',
      SR411_MINI: 'sr411_mini',
      GT06E_CARD: 'gt06e_card',
      BENWAY: 'benway',
      S5: 's5',
      SPACE10X: 'space10x',
      OBD6: 'obd6',
      WETRUST: 'wetrust',
      JC400: 'jc400',
      SL4X: 'sl4x',
      SEEWORLD: 'seeworld',
      RFID: 'rfid',
      LW4G: 'lw4g'
    };
  }

  /**
   * Main decode method
   */
  async decode(buffer, deviceSession) {
    try {
      if (!buffer || buffer.length < 5) {
        logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'Buffer too short', { length: buffer?.length });
        return null;
      }

      // Detect variant based on message structure
      const variant = this.detectVariant(buffer);
      
      const header = buffer.readUInt16BE(0);
      
      if (header === 0x7878) {
        return await this.decodeBasic(buffer, deviceSession, variant);
      } else if (header === 0x7979) {
        return await this.decodeExtended(buffer, deviceSession, variant);
      } else {
        logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'Invalid header', { header: header.toString(16) });
        return null;
      }
    } catch (error) {
      logger.error('GT06 decode error:', error);
      return null;
    }
  }

  /**
   * Detect device variant based on message structure
   */
  detectVariant(buffer) {
    if (buffer.length < 5) return this.variants.STANDARD;

    const header = buffer.readUInt16BE(0);
    let length, type;

    if (header === 0x7878) {
      length = buffer.readUInt8(2);
      type = buffer.readUInt8(3);
    } else if (header === 0x7979) {
      length = buffer.readUInt16BE(2);
      type = buffer.readUInt8(4);
    } else {
      return this.variants.STANDARD;
    }

    // Variant detection logic based on message type and length
    if (header === 0x7878 && type === this.MSG_GPS_LBS_1 && length === 0x24) {
      return this.variants.VXT01;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_STATUS_1 && length === 0x24) {
      return this.variants.VXT01;
    } else if (header === 0x7878 && type === this.MSG_LBS_MULTIPLE_3 && length === 0x31) {
      return this.variants.WANWAY_S20;
    } else if (header === 0x7878 && type === this.MSG_LBS_MULTIPLE_3 && length === 0x2e) {
      return this.variants.SR411_MINI;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_1 && length >= 0x71) {
      return this.variants.GT06E_CARD;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_1 && length === 0x21) {
      return this.variants.BENWAY;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_1 && length === 0x2b) {
      return this.variants.S5;
    } else if (header === 0x7878 && type === this.MSG_LBS_STATUS && length >= 0x17) {
      return this.variants.SPACE10X;
    } else if (header === 0x7878 && type === this.MSG_STATUS && length === 0x13) {
      return this.variants.OBD6;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_1 && length === 0x29) {
      return this.variants.WETRUST;
    } else if (header === 0x7878 && type === this.MSG_ALARM && buffer.length >= 6 && buffer.readUInt16BE(4) === 0xffff) {
      return this.variants.JC400;
    } else if (header === 0x7878 && type === 0x34 && length === 0x37) {
      return this.variants.SL4X;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_2 && length === 0x2f) {
      return this.variants.SEEWORLD;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_STATUS_1 && length === 0x26) {
      return this.variants.SEEWORLD;
    } else if (header === 0x7878 && type === this.MSG_WIFI && length === 0x28) {
      return this.variants.RFID;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_STATUS_5 && length === 0x40) {
      return this.variants.LW4G;
    }

    return this.variants.STANDARD;
  }

  /**
   * Decode basic (0x7878) messages
   */
  async decodeBasic(buffer, deviceSession, variant) {
    if (buffer.length < 5) return null;

    const length = buffer.readUInt8(2);
    const type = buffer.readUInt8(3);
    const dataLength = length - 5;

    logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'Decoding basic message', { 
      type: type.toString(16), 
      length, 
      variant 
    });

    let position = {
      deviceId: deviceSession?.deviceId,
      protocol: 'GT06',
      timestamp: new Date(),
      valid: false,
      latitude: 0,
      longitude: 0,
      altitude: 0,
      speed: 0,
      course: 0,
      satellites: 0,
      ignition: false,
      engineOn: false,
      battery: null,
      power: null,
      rssi: null,
      alarms: [],
      attributes: {}
    };

    const index = buffer.readUInt16BE(buffer.length - 4);

    try {
      switch (type) {
        case this.MSG_LOGIN:
          return await this.handleLogin(buffer, 4, index);

        case this.MSG_HEARTBEAT:
          return await this.handleHeartbeat(buffer, 4, index, deviceSession, position);

        case this.MSG_GPS:
        case this.MSG_GPS_LBS_1:
        case this.MSG_GPS_LBS_2:
        case this.MSG_GPS_LBS_3:
        case this.MSG_GPS_LBS_4:
        case this.MSG_GPS_LBS_6:
        case this.MSG_GPS_LBS_STATUS_1:
        case this.MSG_GPS_LBS_STATUS_2:
        case this.MSG_GPS_LBS_STATUS_3:
        case this.MSG_GPS_LBS_STATUS_4:
        case this.MSG_GPS_LBS_STATUS_5:
          return await this.handleGPSMessage(buffer, 4, type, index, deviceSession, position, variant);

        case this.MSG_STATUS:
          return await this.handleStatusMessage(buffer, 4, index, deviceSession, position, variant);

        case this.MSG_WIFI:
        case this.MSG_WIFI_2:
        case this.MSG_WIFI_3:
        case this.MSG_WIFI_4:
          return await this.handleWifiMessage(buffer, 4, type, index, deviceSession, position);

        case this.MSG_LBS_MULTIPLE_1:
        case this.MSG_LBS_MULTIPLE_2:
        case this.MSG_LBS_MULTIPLE_3:
        case this.MSG_LBS_EXTEND:
        case this.MSG_LBS_WIFI:
          return await this.handleLBSMessage(buffer, 4, type, index, deviceSession, position, variant);

        case this.MSG_STRING:
          return await this.handleStringMessage(buffer, 4, index, deviceSession, position);

        case this.MSG_ALARM:
          return await this.handleAlarmMessage(buffer, 4, type, index, deviceSession, position, variant);

        case this.MSG_ADDRESS_REQUEST:
          return this.createResponse(false, this.MSG_ADDRESS_RESPONSE, 0, Buffer.from('NA&&NA&&0##'));

        case this.MSG_TIME_REQUEST:
          return this.handleTimeRequest(index);

        default:
          logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'Unsupported message type', { type: type.toString(16) });
          return this.createResponse(false, type, index);
      }
    } catch (error) {
      logger.error('Error decoding GT06 basic message:', error);
      return this.createResponse(false, type, index);
    }
  }

  /**
   * Handle login message
   */
  async handleLogin(buffer, start, index) {
    if (buffer.length < start + 8) return null;

    const imeiHex = buffer.slice(start, start + 8).toString('hex');
    const imei = imeiHex.substring(1); // Remove first digit

    logger.gpsProtocol(imei, 'GT06', 'Login request received');

    return {
      type: 'login',
      imei,
      response: this.createResponse(false, this.MSG_LOGIN, index)
    };
  }

  /**
   * Handle heartbeat message
   */
  async handleHeartbeat(buffer, start, index, deviceSession, position) {
    if (!deviceSession) return null;

    let pos = start;
    
    if (buffer.length > pos) {
      const status = buffer.readUInt8(pos++);
      position.ignition = (status & 0x02) !== 0;
      position.engineOn = (status & 0x02) !== 0;
      position.attributes.armed = (status & 0x01) !== 0;
      position.attributes.charge = (status & 0x04) !== 0;
    }

    if (buffer.length >= pos + 2) {
      position.battery = buffer.readUInt16BE(pos) * 0.01;
      pos += 2;
    }

    if (buffer.length >= pos + 1) {
      position.rssi = buffer.readUInt8(pos);
    }

    // Get last known location
    const lastLocation = await redisManager.getLastLocation(deviceSession.deviceId);
    if (lastLocation) {
      position.latitude = lastLocation.latitude;
      position.longitude = lastLocation.longitude;
      position.valid = lastLocation.valid;
    }

    logger.gpsProtocol(deviceSession.deviceId, 'GT06', 'Heartbeat processed', {
      ignition: position.ignition,
      battery: position.battery,
      rssi: position.rssi
    });

    return {
      type: 'heartbeat',
      position,
      response: this.createResponse(false, this.MSG_HEARTBEAT, index)
    };
  }

  /**
   * Handle GPS message with complete protocol support
   */
  async handleGPSMessage(buffer, start, type, index, deviceSession, position, variant) {
    if (!deviceSession) return null;

    let pos = start;

    // Handle special cases for different variants
    if (type === this.MSG_GPS_LBS_2 && variant === this.variants.SEEWORLD) {
      const gpsResult = this.decodeGPS(buffer, pos, type, variant);
      if (gpsResult) {
        Object.assign(position, gpsResult.position);
        pos = gpsResult.nextPos;
      }
      
      // SEEWORLD specific data
      if (pos < buffer.length - 6) {
        position.ignition = buffer.readUInt8(pos++) > 0;
        pos++; // reporting mode
        pos++; // supplementary transmission
        position.attributes.odometer = buffer.readUInt32BE(pos);
        pos += 4;
        pos += 4; // travel time
        
        let temperature = buffer.readUInt16BE(pos);
        pos += 2;
        if (temperature & 0x8000) {
          temperature = -(temperature & 0x7FFF);
        }
        position.attributes.temperature = temperature * 0.01;
        
        position.attributes.humidity = buffer.readUInt16BE(pos) * 0.01;
        pos += 2;
      }
    } else {
      // Standard GPS decoding
      const gpsResult = this.decodeGPS(buffer, pos, type, variant);
      if (!gpsResult) {
        logger.gpsProtocol(deviceSession.deviceId, 'GT06', 'Failed to decode GPS data');
        return this.createResponse(false, type, index);
      }

      Object.assign(position, gpsResult.position);
      pos = gpsResult.nextPos;
    }

    // Decode LBS data if present
    if (this.hasLBS(type) && pos < buffer.length - 6) {
      const lbsResult = this.decodeLBS(buffer, pos, type, variant);
      if (lbsResult) {
        position.cellTowers = lbsResult.cellTowers;
        pos = lbsResult.nextPos;
      }
    }

    // Decode status if present
    if (this.hasStatus(type) && pos < buffer.length - 6) {
      const statusResult = this.decodeStatus(buffer, pos, variant);
      if (statusResult) {
        Object.assign(position, statusResult.status);
        pos = statusResult.nextPos;
      }
    }

    // Handle additional data based on message type
    if (type === this.MSG_GPS_LBS_1 && variant === this.variants.S5 && pos < buffer.length - 6) {
      const statusResult = this.decodeStatus(buffer, pos, variant);
      if (statusResult) {
        Object.assign(position, statusResult.status);
        pos = statusResult.nextPos;
      }
      
      if (pos + 8 <= buffer.length - 6) {
        position.power = buffer.readUInt16BE(pos) * 0.01;
        pos += 2;
        position.rssi = buffer.readUInt8(pos++);
        
        const alarm = buffer.readUInt8(pos++);
        if (alarm > 0) {
          const alarmType = this.decodeAlarmCode(alarm);
          if (alarmType) position.alarms.push(alarmType);
        }
        
        position.attributes.oil = buffer.readUInt16BE(pos);
        pos += 2;
        
        let temperature = buffer.readUInt8(pos++);
        if (temperature & 0x80) {
          temperature = -(temperature & 0x7F);
        }
        position.attributes.temperature = temperature;
        
        position.attributes.odometer = buffer.readUInt32BE(pos) * 10;
        pos += 4;
      }
    }

    // Handle ignition, event, and archive flags for GPS_LBS_2/3/4/5
    if ([this.MSG_GPS_LBS_2, this.MSG_GPS_LBS_3, this.MSG_GPS_LBS_4, this.MSG_GPS_LBS_5].includes(type) && 
        pos + 3 <= buffer.length - 6 && variant !== this.variants.SEEWORLD) {
      position.ignition = buffer.readUInt8(pos++) > 0;
      position.attributes.event = buffer.readUInt8(pos++);
      position.attributes.archive = buffer.readUInt8(pos++) > 0;
      
      if (variant === this.variants.SL4X && pos + 2 <= buffer.length - 6) {
        if (pos + 4 <= buffer.length - 6) {
          position.attributes.odometer = buffer.readUInt32BE(pos);
          pos += 4;
        }
        position.altitude = buffer.readInt16BE(pos);
        pos += 2;
      }
    }

    logger.locationUpdate(deviceSession.deviceId, position);

    return {
      type: 'gps',
      position,
      response: this.createResponse(false, type, index)
    };
  }

  /**
   * Enhanced GPS decoding with altitude and accuracy support
   */
  decodeGPS(buffer, start, type, variant) {
    try {
      if (buffer.length < start + 20) return null;

      let pos = start;

      // Date and time (6 bytes)
      const year = 2000 + buffer.readUInt8(pos++);
      const month = buffer.readUInt8(pos++) - 1;
      const day = buffer.readUInt8(pos++);
      const hour = buffer.readUInt8(pos++);
      const minute = buffer.readUInt8(pos++);
      const second = buffer.readUInt8(pos++);

      const timestamp = new Date(year, month, day, hour, minute, second);

      // GPS length check for some message types
      if ([this.MSG_GPS_LBS_1, this.MSG_GPS_LBS_2].includes(type)) {
        if (pos >= buffer.length) return null;
        const gpsLength = buffer.readUInt8(pos++);
        if (gpsLength === 0) return null;
      }

      // Satellites (4 bits) - some variants use full byte
      let satellites;
      if (variant === this.variants.OBD6) {
        satellites = buffer.readUInt8(pos++);
      } else {
        satellites = buffer.readUInt8(pos++) & 0x0F;
      }

      // Latitude (4 bytes)
      const latRaw = buffer.readUInt32BE(pos);
      pos += 4;
      let latitude = latRaw / 60.0 / 30000.0;

      // Longitude (4 bytes)
      const lngRaw = buffer.readUInt32BE(pos);
      pos += 4;
      let longitude = lngRaw / 60.0 / 30000.0;

      // Speed (1 or 2 bytes depending on variant)
      let speed;
      if (variant === this.variants.JC400) {
        speed = buffer.readUInt16BE(pos);
        pos += 2;
      } else {
        speed = buffer.readUInt8(pos++);
      }

      // Course and flags (2 bytes)
      const flags = buffer.readUInt16BE(pos);
      pos += 2;

      const course = flags & 0x03FF;
      const valid = (flags & 0x1000) !== 0;
      const latNorth = (flags & 0x0400) === 0;
      const lngEast = (flags & 0x0800) !== 0;
      const ignition = (flags & 0x8000) !== 0;

      // Apply hemisphere corrections
      if (!latNorth) latitude = -latitude;
      if (lngEast) longitude = -longitude;

      const position = {
        timestamp,
        latitude,
        longitude,
        speed,
        course,
        valid,
        satellites,
        ignition,
        engineOn: ignition
      };

      // Add altitude for supported variants
      if (variant === this.variants.SL4X && pos + 2 <= buffer.length - 6) {
        position.altitude = buffer.readInt16BE(pos);
        pos += 2;
      }

      return {
        position,
        nextPos: pos
      };
    } catch (error) {
      logger.error('Error decoding GPS data:', error);
      return null;
    }
  }

  /**
   * Decode LBS (cell tower) data
   */
  decodeLBS(buffer, start, type, variant) {
    try {
      if (buffer.length < start + 9) return null;

      let pos = start;
      let length = 0;

      // Some message types have length prefix
      if (this.hasLBSLength(type)) {
        length = buffer.readUInt8(pos++);
        if (length === 0) return null;
      }

      const mcc = buffer.readUInt16BE(pos) & 0x7FFF; // Remove the flag bit
      pos += 2;

      let mnc;
      if (type === this.MSG_GPS_LBS_6 || variant === this.variants.SL4X) {
        mnc = buffer.readUInt16BE(pos);
        pos += 2;
      } else {
        mnc = buffer.readUInt8(pos++);
      }

      let lac;
      if (type === this.MSG_GPS_LBS_STATUS_5) {
        lac = buffer.readUInt32BE(pos);
        pos += 4;
      } else {
        lac = buffer.readUInt16BE(pos);
        pos += 2;
      }

      let cid;
      if (type === this.MSG_GPS_LBS_STATUS_5 || variant === this.variants.SL4X) {
        cid = buffer.readUInt32BE(pos);
        pos += 4;
      } else if (type === this.MSG_GPS_LBS_6) {
        cid = buffer.readUInt32BE(pos);
        pos += 4;
      } else {
        cid = buffer.readUIntBE(pos, 3); // 3 bytes
        pos += 3;
      }

      const cellTowers = [{
        mcc,
        mnc,
        lac,
        cid,
        rssi: null
      }];

      return {
        cellTowers,
        nextPos: pos
      };
    } catch (error) {
      logger.error('Error decoding LBS data:', error);
      return null;
    }
  }

  /**
   * Decode status information
   */
  decodeStatus(buffer, start, variant) {
    try {
      if (buffer.length < start + 1) return null;

      let pos = start;
      const status = buffer.readUInt8(pos++);

      const result = {
        ignition: (status & 0x02) !== 0,
        engineOn: (status & 0x02) !== 0,
        attributes: {
          charge: (status & 0x04) !== 0,
          blocked: (status & 0x80) !== 0,
          status: status
        },
        alarms: []
      };

      // Decode alarm from status bits
      const alarmBits = (status >> 3) & 0x07;
      switch (alarmBits) {
        case 1:
          result.alarms.push(this.ALARM_VIBRATION);
          break;
        case 2:
          result.alarms.push(this.ALARM_POWER_CUT);
          break;
        case 3:
          result.alarms.push(this.ALARM_LOW_BATTERY);
          break;
        case 4:
          result.alarms.push(this.ALARM_SOS);
          break;
        case 6:
          result.alarms.push(this.ALARM_GEOFENCE_ENTER);
          break;
        case 7:
          if (variant === this.variants.VXT01) {
            result.alarms.push(this.ALARM_OVERSPEED);
          } else {
            result.alarms.push(this.ALARM_REMOVING);
          }
          break;
      }

      // Additional status fields for some variants
      if (variant === this.variants.OBD6 && buffer.length >= pos + 6) {
        const signal = buffer.readUInt16BE(pos);
        pos += 2;
        result.satellites = ((signal >> 10) & 0x1F) + ((signal >> 5) & 0x1F);
        result.rssi = signal & 0x1F;
        
        const alarm = buffer.readUInt8(pos++);
        if (alarm > 0) {
          result.alarms.push(this.decodeAlarmCode(alarm));
        }
        
        pos++; // language
        result.attributes.batteryLevel = buffer.readUInt8(pos++);
        pos++; // mode
        result.power = buffer.readUInt16BE(pos) / 100.0;
        pos += 2;
      } else if (buffer.length >= pos + 3) {
        result.attributes.batteryLevel = buffer.readUInt8(pos++);
        result.rssi = buffer.readUInt8(pos++);
        
        if (buffer.length > pos) {
          const extension = buffer.readUInt8(pos++);
          if (extension > 0) {
            result.alarms.push(this.decodeAlarmCode(extension));
          }
        }
      }

      return {
        status: result,
        nextPos: pos
      };
    } catch (error) {
      logger.error('Error decoding status data:', error);
      return null;
    }
  }

  /**
   * Handle WiFi message
   */
  async handleWifiMessage(buffer, start, type, index, deviceSession, position) {
    // Implementation for WiFi positioning
    // This would decode WiFi access points for location triangulation
    logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'WiFi message received', { type: type.toString(16) });
    
    return {
      type: 'wifi',
      position,
      response: this.createResponse(false, type, index)
    };
  }

  /**
   * Handle LBS message
   */
  async handleLBSMessage(buffer, start, type, index, deviceSession, position, variant) {
    // Implementation for LBS (Location Based Service) messages
    logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'LBS message received', { type: type.toString(16) });
    
    return {
      type: 'lbs',
      position,
      response: this.createResponse(false, type, index)
    };
  }

  /**
   * Handle string message
   */
  async handleStringMessage(buffer, start, index, deviceSession, position) {
    if (buffer.length < start + 1) return null;

    const commandLength = buffer.readUInt8(start);
    if (commandLength > 0 && buffer.length >= start + 1 + commandLength) {
      const data = buffer.slice(start + 5, start + 1 + commandLength).toString('ascii');
      
      if (data.startsWith('<ICCID:')) {
        position.attributes.iccid = data.substring(7, 27);
      } else {
        position.attributes.result = data;
      }
      
      logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'String message received', { data });
    }

    return {
      type: 'string',
      position,
      response: this.createResponse(false, this.MSG_STRING, index)
    };
  }

  /**
   * Handle alarm message
   */
  async handleAlarmMessage(buffer, start, type, index, deviceSession, position, variant) {
    if (buffer.length < start + 3) return null;

    let pos = start;
    
    // For extended alarm messages, decode GPS first
    if (buffer.length > start + 7) {
      const gpsResult = this.decodeGPS(buffer, pos, type, variant);
      if (gpsResult) {
        Object.assign(position, gpsResult.position);
        pos = gpsResult.nextPos;
      }
    }

    if (pos < buffer.length - 6) {
      const event = buffer.readUInt8(pos++);
      const eventData = buffer.readUInt16BE(pos);
      pos += 2;

      position.attributes.event = event;
      position.attributes.eventData = eventData;

      // Decode alarm type
      const alarm = this.decodeAlarmCode(event);
      if (alarm) {
        position.alarms.push(alarm);
      }

      logger.alert(deviceSession?.deviceId, alarm || 'unknown', `Alarm event: ${event}`, { eventData });
    }

    return {
      type: 'alarm',
      position,
      response: this.createResponse(false, type, index)
    };
  }

  /**
   * Handle status message
   */
  async handleStatusMessage(buffer, start, index, deviceSession, position, variant) {
    if (buffer.length < start + 1) return null;

    const statusResult = this.decodeStatus(buffer, start, variant);
    if (statusResult) {
      Object.assign(position, statusResult.status);
    }

    // Get last known location
    const lastLocation = await redisManager.getLastLocation(deviceSession.deviceId);
    if (lastLocation) {
      position.latitude = lastLocation.latitude;
      position.longitude = lastLocation.longitude;
      position.valid = lastLocation.valid;
    }

    logger.gpsProtocol(deviceSession.deviceId, 'GT06', 'Status message processed', {
      ignition: position.ignition,
      alarms: position.alarms
    });

    return {
      type: 'status',
      position,
      response: this.createResponse(false, type, index)
    };
  }

  /**
   * Handle time request
   */
  handleTimeRequest(index) {
    const now = new Date();
    const content = Buffer.alloc(6);
    content.writeUInt8(now.getFullYear() - 2000, 0);
    content.writeUInt8(now.getMonth() + 1, 1);
    content.writeUInt8(now.getDate(), 2);
    content.writeUInt8(now.getHours(), 3);
    content.writeUInt8(now.getMinutes(), 4);
    content.writeUInt8(now.getSeconds(), 5);

    return {
      type: 'timeRequest',
      response: this.createResponse(false, this.MSG_TIME_REQUEST, index, content)
    };
  }

  /**
   * Decode extended (0x7979) messages
   */
  async decodeExtended(buffer, deviceSession, variant) {
    // Implementation for extended messages
    logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'Extended message received');
    return null;
  }

  /**
   * Check if message type has GPS data
   */
  hasGPS(type) {
    return [
      this.MSG_GPS,
      this.MSG_GPS_LBS_1,
      this.MSG_GPS_LBS_2,
      this.MSG_GPS_LBS_3,
      this.MSG_GPS_LBS_4,
      this.MSG_GPS_LBS_6,
      this.MSG_GPS_LBS_STATUS_1,
      this.MSG_GPS_LBS_STATUS_2,
      this.MSG_GPS_LBS_STATUS_3,
      this.MSG_GPS_LBS_STATUS_4,
      this.MSG_GPS_LBS_STATUS_5
    ].includes(type);
  }

  /**
   * Check if message type has LBS data
   */
  hasLBS(type) {
    return [
      this.MSG_GPS_LBS_1,
      this.MSG_GPS_LBS_2,
      this.MSG_GPS_LBS_3,
      this.MSG_GPS_LBS_4,
      this.MSG_GPS_LBS_6,
      this.MSG_GPS_LBS_STATUS_1,
      this.MSG_GPS_LBS_STATUS_2,
      this.MSG_GPS_LBS_STATUS_3,
      this.MSG_GPS_LBS_STATUS_4,
      this.MSG_GPS_LBS_STATUS_5,
      this.MSG_LBS_STATUS,
      this.MSG_LBS_MULTIPLE_1,
      this.MSG_LBS_MULTIPLE_2,
      this.MSG_LBS_MULTIPLE_3
    ].includes(type);
  }

  /**
   * Check if message type has status data
   */
  hasStatus(type) {
    return [
      this.MSG_STATUS,
      this.MSG_GPS_LBS_STATUS_1,
      this.MSG_GPS_LBS_STATUS_2,
      this.MSG_GPS_LBS_STATUS_3,
      this.MSG_GPS_LBS_STATUS_4,
      this.MSG_GPS_LBS_STATUS_5,
      this.MSG_LBS_STATUS
    ].includes(type);
  }

  /**
   * Check if LBS data has length prefix
   */
  hasLBSLength(type) {
    return [
      this.MSG_GPS_LBS_STATUS_1,
      this.MSG_GPS_LBS_STATUS_2,
      this.MSG_GPS_LBS_STATUS_3
    ].includes(type);
  }

  /**
   * Decode alarm code to alarm type
   */
  decodeAlarmCode(code) {
    switch (code) {
      case 0x01: return this.ALARM_SOS;
      case 0x02: return this.ALARM_POWER_CUT;
      case 0x03: return this.ALARM_VIBRATION;
      case 0x04: return this.ALARM_GEOFENCE_ENTER;
      case 0x05: return this.ALARM_GEOFENCE_EXIT;
      case 0x06: return this.ALARM_OVERSPEED;
      case 0x09: return this.ALARM_VIBRATION;
      case 0x0E:
      case 0x0F: return this.ALARM_LOW_BATTERY;
      case 0x11: return this.ALARM_POWER_OFF;
      case 0x0C:
      case 0x13:
      case 0x25: return this.ALARM_TAMPERING;
      case 0x14: return this.ALARM_DOOR;
      case 0x18: return this.ALARM_ACCIDENT;
      case 0x19: return this.ALARM_ACCELERATION;
      case 0x1A:
      case 0x27: return this.ALARM_BRAKING;
      case 0x1B:
      case 0x2A:
      case 0x2B:
      case 0x2E: return this.ALARM_CORNERING;
      case 0x23: return this.ALARM_FALL_DOWN;
      case 0x26: return this.ALARM_ACCELERATION;
      case 0x2C: return this.ALARM_ACCIDENT;
      case 0x30: return this.ALARM_JAMMING;
      default: return null;
    }
  }

  /**
   * Create response message
   */
  createResponse(extended, type, index, content = null) {
    const headerSize = extended ? 4 : 3;
    const contentSize = content ? content.length : 0;
    const totalSize = headerSize + 1 + contentSize + 2 + 2 + 2; // header + type + content + index + crc + footer

    const response = Buffer.alloc(totalSize);
    let pos = 0;

    // Header
    if (extended) {
      response.writeUInt16BE(0x7979, pos);
      pos += 2;
      response.writeUInt16BE(5 + contentSize, pos);
      pos += 2;
    } else {
      response.writeUInt16BE(0x7878, pos);
      pos += 2;
      response.writeUInt8(5 + contentSize, pos);
      pos += 1;
    }

    // Message type
    response.writeUInt8(type, pos++);

    // Content
    if (content) {
      content.copy(response, pos);
      pos += content.length;
    }

    // Index
    response.writeUInt16BE(index, pos);
    pos += 2;

    // CRC16
    const crc = this.calculateCRC16(response.slice(2, pos));
    response.writeUInt16BE(crc, pos);
    pos += 2;

    // Footer
    response.writeUInt8(0x0D, pos++);
    response.writeUInt8(0x0A, pos++);

    return response.slice(0, pos);
  }

  /**
   * Calculate CRC16 checksum
   */
  calculateCRC16(data) {
    try {
      if (!data || data.length === 0) {
        return 0;
      }
      
      let crc = 0xFFFF;
      
      for (let i = 0; i < data.length; i++) {
        crc ^= data[i];
        for (let j = 0; j < 8; j++) {
          if (crc & 1) {
            crc = (crc >> 1) ^ 0x8408;
          } else {
            crc >>= 1;
          }
        }
      }
      
      return (~crc) & 0xFFFF;
    } catch (error) {
      logger.error('Error calculating CRC16:', error);
      return 0;
    }
  }
}

module.exports = GT06ProtocolDecoder;