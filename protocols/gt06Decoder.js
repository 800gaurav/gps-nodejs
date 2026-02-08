const logger = require('../utils/logger');
const redisManager = require('../config/redis');

class GT06ProtocolDecoder {
  constructor() {
    // Message type constants (aligned with Traccar Java reference)
    this.MSG_LOGIN = 0x01;
    this.MSG_GPS = 0x10;
    this.MSG_GPS_LBS_6 = 0x11;
    this.MSG_GPS_LBS_1 = 0x12;
    this.MSG_STATUS = 0x13;
    this.MSG_SATELLITE = 0x14;
    this.MSG_STRING = 0x15;
    this.MSG_GPS_LBS_STATUS_1 = 0x16;
    this.MSG_WIFI = 0x17;
    this.MSG_GPS_LBS_RFID = 0x17;
    this.MSG_LBS_EXTEND = 0x18;
    this.MSG_LBS_STATUS = 0x19;
    this.MSG_GPS_PHONE = 0x1A;
    this.MSG_GPS_LBS_EXTEND = 0x1E;     // JI09
    this.MSG_STRING_INFO = 0x21;
    this.MSG_GPS_LBS_2 = 0x22;
    this.MSG_HEARTBEAT = 0x23;          // GK310
    this.MSG_LBS_MULTIPLE_3 = 0x24;
    this.MSG_GPS_LBS_STATUS_2 = 0x26;
    this.MSG_GPS_LBS_STATUS_3 = 0x27;
    this.MSG_LBS_MULTIPLE_1 = 0x28;
    this.MSG_ADDRESS_REQUEST = 0x2A;    // GK310
    this.MSG_LBS_WIFI = 0x2C;
    this.MSG_GPS_LBS_4 = 0x2D;
    this.MSG_LBS_MULTIPLE_2 = 0x2E;
    this.MSG_GPS_LBS_5 = 0x31;          // AZ735 & SL4X
    this.MSG_GPS_LBS_STATUS_4 = 0x32;   // AZ735 & SL4X (basic)
    this.MSG_WIFI_5 = 0x33;             // AZ735 & SL4X (basic)
    this.MSG_LBS_3 = 0x34;              // SL4X
    this.MSG_X1_GPS = 0x34;
    this.MSG_X1_PHOTO_INFO = 0x35;
    this.MSG_X1_PHOTO_DATA = 0x36;
    this.MSG_STATUS_2 = 0x36;           // Jimi IoT 4G
    this.MSG_GPS_LBS_3 = 0x37;
    this.MSG_GPS_LBS_8 = 0x38;
    this.MSG_BMS = 0x40;                // WD-209
    this.MSG_MULTIMEDIA = 0x41;         // WD-209
    this.MSG_DTC = 0x65;                // FM08ABC
    this.MSG_PID = 0x66;                // FM08ABC
    this.MSG_WIFI_2 = 0x69;
    this.MSG_GPS_MODULAR = 0x70;
    this.MSG_COMMAND_0 = 0x80;
    this.MSG_COMMAND_1 = 0x81;
    this.MSG_COMMAND_2 = 0x82;
    this.MSG_TIME_REQUEST = 0x8A;       // GK310
    this.MSG_OBD = 0x8C;                // FM08ABC
    this.MSG_INFO = 0x94;
    this.MSG_ALARM = 0x95;              // JC100
    this.MSG_ADDRESS_RESPONSE = 0x97;   // GK310
    this.MSG_SERIAL = 0x9B;
    this.MSG_GPS_LBS_7 = 0xA0;          // GK310 & JM-VL03
    this.MSG_LBS_2 = 0xA1;              // GK310
    this.MSG_WIFI_3 = 0xA2;             // GK310
    this.MSG_GPS_LBS_STATUS_5 = 0xA2;   // LWxG
    this.MSG_FENCE_SINGLE = 0xA3;       // GK310
    this.MSG_STATUS_3 = 0xA3;           // GL21L
    this.MSG_FENCE_MULTI = 0xA4;        // GK310 & JM-LL301
    this.MSG_LBS_ALARM = 0xA5;          // GK310 & JM-LL301
    this.MSG_LBS_ADDRESS = 0xA7;        // GK310
    this.MSG_WIFI_4 = 0xF3;
    this.MSG_PERIPHERAL = 0xF2;         // VL842
    this.MSG_AZ735_GPS = 0x32;          // AZ735 (extended)
    this.MSG_AZ735_ALARM = 0x33;        // AZ735 (only extended)

    // Alarm type constants
    this.ALARM_SOS = 'sos';
    this.ALARM_POWER_CUT = 'powerCut';
    this.ALARM_VIBRATION = 'vibration';
    this.ALARM_GENERAL = 'general';
    this.ALARM_LOW_POWER = 'lowPower';
    this.ALARM_TEMPERATURE = 'temperature';
    this.ALARM_GEOFENCE = 'geofence';
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

    this.photos = new Map();
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

    // Variant detection logic based on message type and length (matching Java implementation)
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
    } else if (header === 0x7878 && type === this.MSG_LBS_3 && length === 0x37) {
      return this.variants.SL4X;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_5 && length === 0x2a) {
      return this.variants.SL4X;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_STATUS_4 && length === 0x27) {
      return this.variants.SL4X;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_STATUS_4 && length === 0x29) {
      return this.variants.SL4X;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_2 && length === 0x2f) {
      return this.variants.SEEWORLD;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_STATUS_1 && length === 0x26) {
      return this.variants.SEEWORLD;
    } else if (header === 0x7878 && type === this.MSG_STATUS_3 && length === 0x0c) {
      return this.variants.SEEWORLD;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_RFID && length === 0x28) {
      return this.variants.RFID;
    } else if (header === 0x7878 && type === this.MSG_GPS_LBS_STATUS_5 && length === 0x40) {
      return this.variants.LW4G;
    }

    return this.variants.STANDARD;
  }

  getDeviceModel(deviceSession) {
    if (!deviceSession) return null;
    return deviceSession.model
      || deviceSession.deviceModel
      || deviceSession.device?.model
      || deviceSession.device?.modelName
      || null;
  }

  getModelFlags(model) {
    const upper = model ? String(model).toUpperCase() : '';
    return {
      model,
      modelLW: upper.startsWith('LW'),
      modelSW: upper === 'SEEWORLD',
      modelNT20: upper === 'NT20',
      modelVL: ['VL103', 'LL303', 'VL512'].includes(upper),
      modelR11: upper === 'R11'
    };
  }

  getTimezoneOffsetMinutes(deviceSession) {
    if (!deviceSession) return null;
    const offset = deviceSession.timezoneOffsetMinutes
      ?? deviceSession.timezoneOffset
      ?? deviceSession.tzOffset;
    return typeof offset === 'number' && Number.isFinite(offset) ? offset : null;
  }

  decodeDate(buffer, start, timezoneOffsetMinutes = null) {
    if (buffer.length < start + 6) {
      return null;
    }
    const year = 2000 + buffer.readUInt8(start);
    const month = buffer.readUInt8(start + 1) - 1;
    const day = buffer.readUInt8(start + 2);
    const hour = buffer.readUInt8(start + 3);
    const minute = buffer.readUInt8(start + 4);
    const second = buffer.readUInt8(start + 5);
    let date = new Date(Date.UTC(year, month, day, hour, minute, second));
    if (timezoneOffsetMinutes !== null) {
      date = new Date(date.getTime() - timezoneOffsetMinutes * 60 * 1000);
    }
    return { date, nextPos: start + 6 };
  }

  bcdToInt(value) {
    return ((value >> 4) & 0x0F) * 10 + (value & 0x0F);
  }

  decodeBcdDate(buffer, start, timezoneOffsetMinutes = null) {
    if (buffer.length < start + 6) return null;
    const year = 2000 + this.bcdToInt(buffer.readUInt8(start));
    const month = this.bcdToInt(buffer.readUInt8(start + 1)) - 1;
    const day = this.bcdToInt(buffer.readUInt8(start + 2));
    const hour = this.bcdToInt(buffer.readUInt8(start + 3));
    const minute = this.bcdToInt(buffer.readUInt8(start + 4));
    const second = this.bcdToInt(buffer.readUInt8(start + 5));
    let date = new Date(Date.UTC(year, month, day, hour, minute, second));
    if (timezoneOffsetMinutes !== null) {
      date = new Date(date.getTime() - timezoneOffsetMinutes * 60 * 1000);
    }
    return { date, nextPos: start + 6 };
  }

  bitBetween(value, from, to) {
    const width = Math.max(0, to - from);
    if (width >= 32) return value >>> from;
    return (value >>> from) & ((1 << width) - 1);
  }

  async applyLastLocation(deviceSession, position, timestamp = null) {
    if (!deviceSession) return;
    const lastLocation = await redisManager.getLastLocation(deviceSession.deviceId);
    if (lastLocation) {
      position.latitude = lastLocation.latitude;
      position.longitude = lastLocation.longitude;
      position.valid = lastLocation.valid;
      if (timestamp) {
        position.timestamp = timestamp;
      } else if (!position.timestamp) {
        position.timestamp = lastLocation.timestamp || position.timestamp;
      }
    }
  }

  /**
   * Decode basic (0x7878) messages
   */
  async decodeBasic(buffer, deviceSession, variant) {
    if (buffer.length < 10) return null; // Minimum GT06 message size

    const length = buffer.readUInt8(2);
    const type = buffer.readUInt8(3);

    console.log('=== GT06 MESSAGE DECODE ===');
    console.log('Buffer HEX:', buffer.toString('hex'));
    console.log('Length field:', length);
    console.log('Message type:', type.toString(16));
    console.log('Buffer length:', buffer.length);

    // Correct index calculation: it's at position (buffer.length - 6)
    // Structure: ...data... + index(2) + crc(2) + footer(2)
    const indexPos = buffer.length - 6;
    const index = buffer.readUInt16BE(indexPos);
    
    console.log('Index position:', indexPos);
    console.log('Index value:', index);
    console.log('CRC position:', buffer.length - 4);
    console.log('Footer position:', buffer.length - 2);

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

    try {
      switch (type) {
        case this.MSG_LOGIN:
          const loginResult = await this.handleLogin(buffer, 4, index);
          if (loginResult) {
            loginResult.response = this.createResponse(false, this.MSG_LOGIN, index);
          }
          return loginResult;

        case this.MSG_HEARTBEAT:
          const heartbeatResult = await this.handleHeartbeat(buffer, 4, index, deviceSession, position);
          if (heartbeatResult) {
            heartbeatResult.response = this.createResponse(false, type, index);
          }
          return heartbeatResult;

        case this.MSG_GPS:
        case this.MSG_GPS_LBS_1:
        case this.MSG_GPS_LBS_2:
        case this.MSG_GPS_LBS_3:
        case this.MSG_GPS_LBS_4:
        case this.MSG_GPS_LBS_5:
        case this.MSG_GPS_LBS_6:
        case this.MSG_GPS_LBS_7:
        case this.MSG_GPS_LBS_8:
        case this.MSG_GPS_LBS_EXTEND:
        case this.MSG_GPS_PHONE:
        case this.MSG_GPS_LBS_STATUS_1:
        case this.MSG_GPS_LBS_STATUS_2:
        case this.MSG_GPS_LBS_STATUS_3:
        case this.MSG_GPS_LBS_STATUS_4:
        case this.MSG_GPS_LBS_STATUS_5:
        case this.MSG_GPS_LBS_RFID:
        case this.MSG_FENCE_MULTI:
        case this.MSG_LBS_STATUS:
        case this.MSG_LBS_ALARM:
        case this.MSG_LBS_ADDRESS:
          return await this.handleGPSMessage(buffer, 4, type, index, deviceSession, position, variant);

        case this.MSG_STATUS:
        case this.MSG_STATUS_2:
        case this.MSG_STATUS_3:
          return await this.handleStatusMessage(buffer, 4, type, index, deviceSession, position, variant);

        case this.MSG_WIFI:
        case this.MSG_WIFI_2:
        case this.MSG_WIFI_4:
          return await this.handleWifiMessage(buffer, 4, type, index, deviceSession, position);

        case this.MSG_LBS_MULTIPLE_1:
        case this.MSG_LBS_MULTIPLE_2:
        case this.MSG_LBS_MULTIPLE_3:
        case this.MSG_LBS_EXTEND:
        case this.MSG_LBS_WIFI:
        case this.MSG_LBS_2:
        case this.MSG_LBS_3:
        case this.MSG_WIFI_5:
          return await this.handleLBSMessage(buffer, 4, type, index, deviceSession, position, variant);

        case this.MSG_WIFI_3:
          if (variant !== this.variants.LW4G) {
            return await this.handleLBSMessage(buffer, 4, type, index, deviceSession, position, variant);
          }
          return await this.handleWifiMessage(buffer, 4, type, index, deviceSession, position);

        case this.MSG_STRING:
          return await this.handleStringMessage(buffer, 4, index, deviceSession, position);

        case this.MSG_ALARM:
          return await this.handleAlarmMessage(buffer, 4, type, index, deviceSession, position, variant);

        case this.MSG_X1_GPS:
          if (variant !== this.variants.SL4X) {
            return await this.handleX1GpsMessage(buffer, 4, type, index, deviceSession, position);
          }
          return await this.handleGPSMessage(buffer, 4, type, index, deviceSession, position, variant);

        case this.MSG_X1_PHOTO_INFO:
          return await this.handleX1PhotoInfo(buffer, 4, index, deviceSession);

        case this.MSG_X1_PHOTO_DATA:
          return await this.handleX1PhotoData(buffer, 4, index, deviceSession, position);

        case this.MSG_BMS:
          return await this.handleBmsMessage(buffer, 4, index, deviceSession, position);

        case this.MSG_GPS_MODULAR:
          return await this.handleModularGPS(buffer, 4, index, deviceSession, position, false);

        case this.MSG_MULTIMEDIA:
          return await this.handleMultimedia(buffer, 4, index, deviceSession, position, false);

        case this.MSG_SERIAL:
          return await this.handleSerialMessage(buffer, 4, index, deviceSession, position, false);

        case this.MSG_PERIPHERAL:
          return await this.handlePeripheralMessage(buffer, 4, index, deviceSession, position, false);

        case this.MSG_INFO:
          await this.applyLastLocation(deviceSession, position);
          if (buffer.length >= 6) {
            position.power = buffer.readInt16BE(4) * 0.01;
          }
          return {
            type: 'info',
            position,
            response: this.createResponse(false, type, index)
          };

        case this.MSG_ADDRESS_REQUEST:
          const addressResponse = Buffer.from('NA&&NA&&0##');
          const addressContent = Buffer.alloc(1 + 4 + addressResponse.length);
          addressContent.writeUInt8(addressResponse.length, 0);
          addressContent.writeUInt32BE(0, 1);
          addressResponse.copy(addressContent, 5);
          return {
            type: 'address_request',
            response: this.createResponse(true, this.MSG_ADDRESS_RESPONSE, 0, addressContent)
          };

        case this.MSG_TIME_REQUEST:
          return this.handleTimeRequest(index);

        default:
          console.log('Unsupported message type:', type.toString(16));
          return {
            type: 'unsupported',
            response: this.createResponse(false, type, index)
          };
      }
    } catch (error) {
      console.error('Error decoding GT06 message:', error);
      return {
        type: 'error',
        response: this.createResponse(false, type, index)
      };
    }
  }

  /**
   * Handle login message
   */
  async handleLogin(buffer, start, index) {
    if (buffer.length < start + 8) {
      return {
        type: 'login_invalid',
        response: this.createResponse(false, this.MSG_LOGIN, index)
      };
    }

    let imei;
    const imeiData = buffer.slice(start, start + 8);
    const imeiHex = imeiData.toString('hex');
    imei = imeiHex.replace(/^0/, '');

    console.log('\n🔐 LOGIN MESSAGE RECEIVED');
    console.log('IMEI Data (hex):', imeiData.toString('hex'));
    console.log('Decoded IMEI:', imei);
    console.log('Message Index:', index);

    logger.gpsProtocol(imei, 'GT06', 'Login request received');

    return {
      type: 'login',
      imei,
    };
  }

  /**
   * Handle heartbeat message
   */
  async handleHeartbeat(buffer, start, index, deviceSession, position) {
    if (!deviceSession) {
      return {
        type: 'heartbeat_no_session',
        response: this.createResponse(false, this.MSG_HEARTBEAT, index)
      };
    }

    console.log('\n💓 HEARTBEAT MESSAGE RECEIVED');
    console.log('Device:', deviceSession.deviceId);
    console.log('Buffer length:', buffer.length);
    console.log('Start position:', start);
    console.log('Message Index:', index);

    let pos = start;
    
    if (buffer.length > pos) {
      const status = buffer.readUInt8(pos++);
      position.ignition = (status & 0x02) !== 0;
      position.engineOn = position.ignition;
      position.attributes.armed = (status & 0x01) !== 0;
      position.attributes.charge = (status & 0x04) !== 0;
      position.attributes.status = status;
    }

    if (buffer.length >= pos + 2) {
      position.battery = buffer.readUInt16BE(pos) * 0.01;
      pos += 2;
      console.log('Battery:', position.battery, 'V');
    }

    if (buffer.length >= pos + 1) {
      position.rssi = buffer.readUInt8(pos);
      console.log('RSSI:', position.rssi);
    }

    // Get last known location
    await this.applyLastLocation(deviceSession, position);

    logger.gpsProtocol(deviceSession.deviceId, 'GT06', 'Heartbeat processed', {
      ignition: position.ignition,
      battery: position.battery,
      rssi: position.rssi
    });

    return {
      type: 'heartbeat',
      position,
    };
  }

  /**
   * Handle GPS message with protocol support aligned to Java reference
   */
  async handleGPSMessage(buffer, start, type, index, deviceSession, position, variant) {
    if (!deviceSession) {
      logger.warn('No device session for GPS message');
      return {
        type: 'gps_no_session',
        response: this.createResponse(false, type, index)
      };
    }

    const model = this.getDeviceModel(deviceSession);
    const { modelLW, modelSW, modelNT20, modelVL, modelR11 } = this.getModelFlags(model);
    const timezoneOffsetMinutes = this.getTimezoneOffsetMinutes(deviceSession);

    let pos = start;
    const limit = buffer.length - 6; // exclude index + crc + footer

    if (type === this.MSG_GPS_LBS_8) {
      const gpsResult = this.decodeGPS(buffer, pos, { timezoneOffsetMinutes });
      if (gpsResult) {
        Object.assign(position, gpsResult.position);
        pos = gpsResult.nextPos;
      } else {
        await this.applyLastLocation(deviceSession, position);
      }
      if (pos + 2 <= limit) {
        pos += 2; // data upload mode + re-upload
      }
      const lbsResult = this.decodeLBS(buffer, pos, type, variant, false);
      if (lbsResult) {
        position.cellTowers = lbsResult.cellTowers;
        pos = lbsResult.nextPos;
      }
      return {
        type: 'gps',
        position,
        response: this.createResponse(false, type, index)
      };
    }

    if (type == this.MSG_LBS_STATUS && variant === this.variants.SPACE10X) {
      return null; // multi-lbs message
    }

    if (type === this.MSG_GPS_LBS_2 && modelNT20) {
      if (pos + 1 + 8 + 6 <= limit) {
        pos += 1; // location source type
        pos += 8; // imei
        const dateResult = this.decodeDate(buffer, pos, timezoneOffsetMinutes);
        if (dateResult) {
          position.timestamp = dateResult.date;
          pos = dateResult.nextPos;
        }
      }
    }

    if (this.hasGPS(type, variant)) {
      const gpsResult = this.decodeGPS(buffer, pos, { timezoneOffsetMinutes });
      if (gpsResult) {
        Object.assign(position, gpsResult.position);
        pos = gpsResult.nextPos;
      } else {
        await this.applyLastLocation(deviceSession, position);
      }
    } else {
      await this.applyLastLocation(deviceSession, position);
    }

    if (this.hasLBS(type, variant) && pos < limit) {
      const hasLength = this.hasStatus(type, model, variant)
        && type !== this.MSG_LBS_STATUS
        && type !== this.MSG_LBS_ALARM
        && (type !== this.MSG_GPS_LBS_STATUS_1 || variant !== this.variants.VXT01)
        && type !== this.MSG_GPS_LBS_STATUS_5;
      const lbsResult = this.decodeLBS(buffer, pos, type, variant, hasLength);
      if (lbsResult) {
        position.cellTowers = lbsResult.cellTowers;
        pos = lbsResult.nextPos;
      }
    }

    if (this.hasStatus(type, model, variant) && pos < limit) {
      if (type === this.MSG_GPS_LBS_STATUS_5 && pos < limit) {
        pos += 1; // network indicator
      }

      const statusResult = this.decodeStatus(buffer, pos, variant);
      if (statusResult) {
        Object.assign(position, statusResult.status);
        pos = statusResult.nextPos;
      }

      if (variant === this.variants.OBD6) {
        if (pos + 2 + 1 + 1 + 1 + 2 <= limit) {
          const signal = buffer.readUInt16BE(pos);
          pos += 2;
          position.satellites = ((signal >> 10) & 0x1F) + ((signal >> 5) & 0x1F);
          position.rssi = signal & 0x1F;

          const alarm = buffer.readUInt8(pos++);
          const alarmType = this.decodeAlarmCode(alarm, modelLW, modelSW, modelVL);
          if (alarmType) {
            position.alarms.push(alarmType);
          }

          pos += 1; // language
          position.attributes.batteryLevel = buffer.readUInt8(pos++);
          const mode = buffer.readUInt8(pos++);
          position.power = buffer.readUInt16BE(pos) / 100.0;
          pos += 2;
          pos += 1; // reserved
          pos += 2; // working time

          if (mode == 4 && pos + 2 <= limit) {
            position.attributes.temperature = buffer.readInt16BE(pos) / 10.0;
            pos += 2;
          }
        }
      } else {
        if (type === this.MSG_GPS_LBS_STATUS_5 || (modelNT20 && type === this.MSG_GPS_LBS_2)) {
          if (pos + 2 <= limit) {
            position.power = buffer.readUInt16BE(pos) * 0.01;
            pos += 2;
          }
        }

        if (type === this.MSG_STATUS && modelR11) {
          if (pos + 2 <= limit) {
            position.power = buffer.readUInt16BE(pos) * 0.01;
            pos += 2;
          }
        } else {
          if (pos + 1 <= limit) {
            let battery = buffer.readUInt8(pos++);
            if (modelNT20 && type === this.MSG_GPS_LBS_2) {
              battery = Math.floor(battery / 10);
            }
            if (battery <= 6) {
              position.attributes.batteryLevel = Math.round(battery * 100 / 6);
            } else if (battery <= 100) {
              position.attributes.batteryLevel = battery;
            }
          }
        }

        if (pos + 1 <= limit) {
          position.rssi = buffer.readUInt8(pos++);
        }

        if (type === this.MSG_STATUS && modelLW) {
          if (pos + 2 <= limit) {
            position.power = (buffer.readUInt16BE(pos) & 0x0FFF) / 10.0;
            pos += 2;
          }
        } else {
          if (pos + 1 <= limit) {
            const extension = buffer.readUInt8(pos++);
            if (type === this.MSG_STATUS && modelSW) {
              position.power = extension;
            } else if (variant !== this.variants.VXT01) {
              const alarmType = this.decodeAlarmCode(extension, modelLW, modelSW, modelVL);
              if (alarmType) {
                position.alarms.push(alarmType);
              }
            }
          }
        }
      }
    }

    if (type === this.MSG_GPS_LBS_STATUS_5 && pos + 1 + 4 + 4 + 8 + 2 <= limit) {
      pos += 1; // language
      position.attributes.odometer = buffer.readUInt32BE(pos);
      pos += 4;
      position.attributes.hours = buffer.readUInt32BE(pos) * 1000;
      pos += 4;
      pos += 8; // terminal id
      position.attributes.input = buffer.readUInt16BE(pos);
      pos += 2;
    }

    if (type === this.MSG_GPS_LBS_1 && pos < limit) {
      if (variant === this.variants.GT06E_CARD) {
        if (pos + 5 <= limit) {
          position.attributes.odometer = buffer.readUInt32BE(pos);
          pos += 4;
          const dataLength = buffer.readUInt8(pos++);
          if (pos + dataLength <= limit) {
            position.attributes.card = buffer.slice(pos, pos + dataLength).toString('ascii').trim();
            pos += dataLength;
          }
          pos += 2; // alarm + swiped
        }
      } else if (variant === this.variants.BENWAY) {
        if (pos + 2 <= limit) {
          const mask = buffer.readUInt16BE(pos);
          pos += 2;
          position.ignition = (mask & (1 << (8 + 7))) !== 0;
          position.attributes.input2 = (mask & (1 << (8 + 6))) !== 0;
          if ((mask & (1 << (8 + 4))) !== 0) {
            let value = mask & ((1 << (8 + 1)) - 1);
            if ((mask & (1 << (8 + 1))) !== 0) {
              value = -value;
            }
            position.attributes.temperature = value;
          } else {
            let value = (mask >> (8 + 2)) & ((1 << 4) - 1);
            if ((mask & (1 << (8 + 5))) !== 0) {
              position.attributes.adc1 = value;
            } else {
              position.attributes.adc1 = value * 0.1;
            }
          }
        }
      } else if (variant === this.variants.VXT01) {
        const statusResult = this.decodeStatus(buffer, pos, variant);
        if (statusResult) {
          Object.assign(position, statusResult.status);
          pos = statusResult.nextPos;
        }
        if (pos + 3 <= limit) {
          position.power = buffer.readUInt16BE(pos) * 0.01;
          pos += 2;
          position.rssi = buffer.readUInt8(pos++);
          pos += 1; // alarm extension
        }
      } else if (variant === this.variants.S5) {
        const statusResult = this.decodeStatus(buffer, pos, variant);
        if (statusResult) {
          Object.assign(position, statusResult.status);
          pos = statusResult.nextPos;
        }

        if (pos + 10 <= limit) {
          position.power = buffer.readUInt16BE(pos) * 0.01;
          pos += 2;
          position.rssi = buffer.readUInt8(pos++);

          const alarm = buffer.readUInt8(pos++);
          const alarmType = this.decodeAlarmCode(alarm, modelLW, modelSW, modelVL);
          if (alarmType) {
            position.alarms.push(alarmType);
          }

          position.attributes.oil = buffer.readUInt16BE(pos);
          pos += 2;

          let temperature = buffer.readUInt8(pos++);
          if ((temperature & 0x80) !== 0) {
            temperature = -(temperature & 0x7F);
          }
          position.attributes.temperature = temperature;

          if (pos + 4 <= limit) {
            position.attributes.odometer = buffer.readUInt32BE(pos) * 10;
            pos += 4;
          }
        }
      } else if (variant === this.variants.WETRUST) {
        if (pos + 4 <= limit) {
          position.attributes.odometer = buffer.readUInt32BE(pos);
          pos += 4;
        }
        if (pos + 1 <= limit) {
          const cardLength = buffer.readUInt8(pos++);
          if (pos + cardLength <= limit) {
            position.attributes.card = buffer.slice(pos, pos + cardLength).toString('ascii');
            pos += cardLength;
          }
        }
        if (pos + 1 <= limit) {
          const alarm = buffer.readUInt8(pos++);
          if (alarm > 0) {
            position.alarms.push(this.ALARM_GENERAL);
          }
        }
        if (pos + 3 <= limit) {
          position.attributes.cardStatus = buffer.readUInt8(pos++);
          position.attributes.drivingTime = buffer.readUInt16BE(pos);
          pos += 2;
        }
      }
    }

    if (type === this.MSG_GPS_LBS_2 && variant === this.variants.SEEWORLD && pos + 12 <= limit) {
      position.ignition = buffer.readUInt8(pos++) > 0;
      pos += 1; // reporting mode
      pos += 1; // supplementary transmission
      position.attributes.odometer = buffer.readUInt32BE(pos);
      pos += 4;
      pos += 4; // travel time
      let temperature = buffer.readUInt16BE(pos);
      pos += 2;
      if ((temperature & 0x8000) !== 0) {
        temperature = -(temperature & 0x7FFF);
      }
      position.attributes.temperature = temperature * 0.01;
      if (pos + 2 <= limit) {
        position.attributes.humidity = buffer.readUInt16BE(pos) * 0.01;
        pos += 2;
      }
    }

    if (type === this.MSG_GPS_LBS_STATUS_4 && variant === this.variants.SL4X && pos + 2 <= limit) {
      position.altitude = buffer.readInt16BE(pos);
      pos += 2;
    }

    if ([this.MSG_GPS_LBS_2, this.MSG_GPS_LBS_3, this.MSG_GPS_LBS_4, this.MSG_GPS_LBS_5].includes(type)
        && pos + 3 <= limit && !modelNT20) {
      position.ignition = buffer.readUInt8(pos++) > 0;
      position.attributes.event = buffer.readUInt8(pos++);
      position.attributes.archive = buffer.readUInt8(pos++) > 0;

      if (variant === this.variants.SL4X) {
        if (pos + 4 <= limit) {
          position.attributes.odometer = buffer.readUInt32BE(pos);
          pos += 4;
        }
        if (pos + 2 <= limit) {
          position.altitude = buffer.readInt16BE(pos);
          pos += 2;
        }
      }
    }

    if (type === this.MSG_GPS_LBS_3 && pos + 3 <= limit) {
      const module = buffer.readUInt16BE(pos);
      pos += 2;
      const subLength = buffer.readUInt8(pos++);
      if (pos + subLength <= limit) {
        switch (module) {
          case 0x0027:
            position.power = buffer.readUInt16BE(pos) * 0.01;
            pos += 2;
            break;
          case 0x002E:
            position.attributes.odometer = buffer.readUInt32BE(pos);
            pos += 4;
            break;
          case 0x003B:
            position.attributes.accuracy = buffer.readUInt16BE(pos) * 0.01;
            pos += 2;
            break;
          default:
            pos += subLength;
            break;
        }
      }
    }

    if (type === this.MSG_GPS_LBS_RFID && pos + 9 <= limit) {
      position.attributes.driverUniqueId = buffer.slice(pos, pos + 8).toString('hex');
      pos += 8;
      pos += 1; // validity
    }

    if (modelNT20 && type === this.MSG_GPS_LBS_2 && pos + 1 + 3 + 3 <= limit) {
      pos += 1; // language
      position.attributes.odometer = buffer.readUIntBE(pos, 3);
      pos += 3;
      position.attributes.hours = buffer.readUIntBE(pos, 3) * 60 * 1000;
      pos += 3;
    }

    const remaining = limit - pos;
    if (remaining === 3 + 6 || remaining === 3 + 4 + 6) {
      position.ignition = buffer.readUInt8(pos++) > 0;
      pos += 1; // upload mode
      position.attributes.archive = buffer.readUInt8(pos++) > 0;
    }

    if (remaining === 4 + 6) {
      position.attributes.odometer = buffer.readUInt32BE(pos);
      pos += 4;
    }

    if ((type === this.MSG_GPS_LBS_STATUS_3 || type === this.MSG_FENCE_MULTI) && pos + 1 <= limit) {
      position.attributes.geofence = buffer.readUInt8(pos++);
    }

    logger.locationUpdate(deviceSession.deviceId, position);

    return {
      type: 'gps',
      position,
      response: this.createResponse(false, type, index)
    };
  }

  /**
   * Decode GPS data (aligned with Traccar Java reference)
   */
  decodeGPS(buffer, start, options = {}) {
    try {
      const {
        hasLength = false,
        hasSatellites = true,
        hasSpeed = true,
        longSpeed = false,
        swapFlags = false,
        timezoneOffsetMinutes = null
      } = options;

      let pos = start;

      if (buffer.length < pos + 6) {
        return null;
      }

      const year = 2000 + buffer.readUInt8(pos++);
      const month = buffer.readUInt8(pos++) - 1;
      const day = buffer.readUInt8(pos++);
      const hour = buffer.readUInt8(pos++);
      const minute = buffer.readUInt8(pos++);
      const second = buffer.readUInt8(pos++);

      let timestamp = new Date(Date.UTC(year, month, day, hour, minute, second));
      if (timezoneOffsetMinutes !== null) {
        timestamp = new Date(timestamp.getTime() - timezoneOffsetMinutes * 60 * 1000);
      }

      if (hasLength) {
        if (buffer.length <= pos) {
          return null;
        }
        const gpsLength = buffer.readUInt8(pos++);
        if (gpsLength === 0) {
          return {
            position: {
              timestamp,
              latitude: 0,
              longitude: 0,
              speed: 0,
              course: 0,
              valid: false,
              satellites: 0,
              ignition: null,
              engineOn: null,
              altitude: 0
            },
            nextPos: pos
          };
        }
      }

      let satellites = 0;
      if (hasSatellites) {
        const satByte = buffer.readUInt8(pos++);
        satellites = satByte & 0x0F;
      }

      if (buffer.length < pos + 8) {
        return null;
      }

      const latRaw = buffer.readUInt32BE(pos);
      pos += 4;
      const lonRaw = buffer.readUInt32BE(pos);
      pos += 4;

      let latitude = latRaw / 60.0 / 30000.0;
      let longitude = lonRaw / 60.0 / 30000.0;

      let flags = 0;
      if (swapFlags) {
        if (buffer.length < pos + 2) {
          return null;
        }
        flags = buffer.readUInt16BE(pos);
        pos += 2;
      }

      let speed = 0;
      if (hasSpeed) {
        if (longSpeed) {
          if (buffer.length < pos + 2) {
            return null;
          }
          speed = buffer.readUInt16BE(pos);
          pos += 2;
        } else {
          if (buffer.length < pos + 1) {
            return null;
          }
          speed = buffer.readUInt8(pos++);
        }
      }

      if (!swapFlags) {
        if (buffer.length < pos + 2) {
          return null;
        }
        flags = buffer.readUInt16BE(pos);
        pos += 2;
      }

      const course = flags & 0x03FF;
      const valid = (flags & 0x1000) !== 0;

      if ((flags & 0x0400) === 0) {
        latitude = -latitude;
      }
      if ((flags & 0x0800) !== 0) {
        longitude = -longitude;
      }

      let ignition = null;
      if ((flags & 0x4000) !== 0) {
        ignition = (flags & 0x8000) !== 0;
      }

      const position = {
        timestamp,
        latitude,
        longitude,
        speed,
        course,
        valid,
        satellites,
        ignition,
        engineOn: ignition,
        altitude: 0
      };

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
   * Decode LBS (cell tower) data with full variant support
   */
  decodeLBS(buffer, start, type, variant, hasLength = false) {
    try {
      if (buffer.length < start + 9) return null;

      let pos = start;
      let length = 0;
      let cellType = 0;

      // Some message types have length prefix
      if (hasLength) {
        length = buffer.readUInt8(pos++);
        if (length === 0) {
          // Check for zeroed data - skip if all zeros
          let zeroedData = true;
          for (let i = pos + 9; i < Math.min(pos + 45, buffer.length); i++) {
            if (buffer.readUInt8(i) !== 0) {
              zeroedData = false;
              break;
            }
          }
          if (zeroedData) {
            pos += Math.min(buffer.length - pos, 45);
            return null;
          }
        }
      }

      // MSG_GPS_LBS_8 has cell type prefix
      if (type === this.MSG_GPS_LBS_8) {
        cellType = buffer.readUInt8(pos++);
      }

      let mccRaw = buffer.readUInt16BE(pos);
      const mcc = mccRaw & 0x7FFF; // Remove the flag bit (bit 15)
      pos += 2;

      let mnc;
      // Check if bit 15 is set or type/variant requires 16-bit MNC
      if ((mccRaw & 0x8000) !== 0 || type === this.MSG_GPS_LBS_6 || variant === this.variants.SL4X) {
        mnc = buffer.readUInt16BE(pos);
        pos += 2;
      } else {
        mnc = buffer.readUInt8(pos++);
      }

      let lac;
      // LAC can be 16-bit or 32-bit depending on cell type and message type
      if (cellType >= 3 || type === this.MSG_LBS_ALARM || type === this.MSG_GPS_LBS_7 || type === this.MSG_GPS_LBS_STATUS_5) {
        lac = buffer.readUInt32BE(pos);
        pos += 4;
      } else {
        lac = buffer.readUInt16BE(pos);
        pos += 2;
      }

      let cid;
      // CID can be 3-byte, 4-byte, or 8-byte depending on cell type and message type
      if (cellType >= 3 || type === this.MSG_LBS_ALARM || type === this.MSG_GPS_LBS_7 || variant === this.variants.SL4X || type === this.MSG_GPS_LBS_STATUS_5) {
        // 8-byte CID for 5G/LTE-A
        const cidHigh = buffer.readUInt32BE(pos);
        const cidLow = buffer.readUInt32BE(pos + 4);
        cid = cidHigh * 0x100000000 + cidLow;
        pos += 8;
      } else if (type === this.MSG_GPS_LBS_6 || variant === this.variants.SEEWORLD) {
        // 4-byte CID
        cid = buffer.readUInt32BE(pos);
        pos += 4;
      } else {
        // 3-byte CID (standard)
        cid = buffer.readUIntBE(pos, 3);
        pos += 3;
      }

      // RSSI if present
      let rssi = null;
      if (cellType >= 3) {
        rssi = buffer.readUInt16BE(pos);
        pos += 2;
      } else if (type === this.MSG_GPS_LBS_8) {
        rssi = buffer.readUInt8(pos++);
      }

      // Skip remaining bytes if length was specified
      if (length > 9) {
        pos += (length - 9);
      }

      const cellTowers = [{
        mcc,
        mnc,
        lac,
        cid,
        rssi
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
          result.alarms.push(this.ALARM_GEOFENCE);
          break;
        case 7:
          if (variant === this.variants.VXT01) {
            result.alarms.push(this.ALARM_OVERSPEED);
          } else {
            result.alarms.push(this.ALARM_REMOVING);
          }
          break;
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
    logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'WiFi message received', { type: type.toString(16) });
    const limit = buffer.length - 6;
    const timezoneOffsetMinutes = this.getTimezoneOffsetMinutes(deviceSession);
    let pos = start;

    const timeResult = this.decodeBcdDate(buffer, pos, timezoneOffsetMinutes);
    if (timeResult) {
      pos = timeResult.nextPos;
      await this.applyLastLocation(deviceSession, position, timeResult.date);
    } else {
      await this.applyLastLocation(deviceSession, position);
    }

    const wifiAccessPoints = [];
    let wifiCount;
    if (type === this.MSG_WIFI_4) {
      if (pos >= limit) {
        return { type: 'wifi', position };
      }
      wifiCount = buffer.readUInt8(pos++);
    } else {
      wifiCount = buffer.readUInt8(2);
    }

    for (let i = 0; i < wifiCount; i++) {
      if (type === this.MSG_WIFI_4 && pos + 2 <= limit) {
        pos += 2;
      }
      if (pos + 6 > limit) break;
      const mac = buffer.slice(pos, pos + 6).toString('hex').match(/.{1,2}/g).join(':');
      pos += 6;
      let rssi = null;
      if (type !== this.MSG_WIFI_4 && pos < limit) {
        rssi = buffer.readUInt8(pos++);
      }
      wifiAccessPoints.push({ mac, rssi });
    }

    if (wifiAccessPoints.length > 0) {
      position.attributes.wifiAccessPoints = wifiAccessPoints;
    }

    let response = null;
    if (type !== this.MSG_WIFI_4) {
      const cellTowers = [];
      if (pos + 1 + 2 + 1 <= limit) {
        const cellCount = buffer.readUInt8(pos++);
        const mcc = buffer.readUInt16BE(pos);
        pos += 2;
        const mnc = buffer.readUInt8(pos++);
        for (let i = 0; i < cellCount; i++) {
          if (pos + 5 > limit) break;
          const lac = buffer.readUInt16BE(pos);
          pos += 2;
          const cid = buffer.readUInt16BE(pos);
          pos += 2;
          const rssi = buffer.readUInt8(pos++);
          cellTowers.push({ mcc, mnc, lac, cid, rssi });
        }
      }
      if (cellTowers.length > 0) {
        position.cellTowers = cellTowers;
      }

      if (timeResult) {
        const timeBytes = buffer.slice(start, start + 6);
        response = Buffer.alloc(2 + 1 + 1 + 6 + 2);
        let rpos = 0;
        response.writeUInt16BE(0x7878, rpos);
        rpos += 2;
        response.writeUInt8(0x00, rpos++);
        response.writeUInt8(type, rpos++);
        timeBytes.copy(response, rpos);
        rpos += 6;
        response.writeUInt8(0x0D, rpos++);
        response.writeUInt8(0x0A, rpos++);
      }
    }

    return {
      type: 'wifi',
      position,
      response
    };
  }

  /**
   * Handle LBS message
   */
  async handleLBSMessage(buffer, start, type, index, deviceSession, position, variant) {
    if (!deviceSession) {
      return {
        type: 'lbs_no_session',
        response: this.createResponse(false, type, index)
      };
    }

    const limit = buffer.length - 6;
    const timezoneOffsetMinutes = this.getTimezoneOffsetMinutes(deviceSession);

    if (type === this.MSG_LBS_MULTIPLE_3 && variant === this.variants.SR411_MINI) {
      let pos = start;
      const gpsResult = this.decodeGPS(buffer, pos, { timezoneOffsetMinutes });
      if (gpsResult) {
        Object.assign(position, gpsResult.position);
        pos = gpsResult.nextPos;
      }

      const lbsResult = this.decodeLBS(buffer, pos, type, variant, false);
      if (lbsResult) {
        position.cellTowers = lbsResult.cellTowers;
        pos = lbsResult.nextPos;
      }

      if (pos + 5 <= limit) {
        position.ignition = buffer.readUInt8(pos++) > 0;
        position.power = buffer.readUInt16BE(pos) * 0.01;
        pos += 2;
        position.battery = buffer.readUInt16BE(pos) * 0.01;
        pos += 2;
      }

      return {
        type: 'lbs',
        position,
        response: this.createResponse(false, type, index)
      };
    }

    // LBS / WiFi multi-cell messages
    let pos = start;
    const dateResult = this.decodeDate(buffer, pos, timezoneOffsetMinutes);
    if (dateResult) {
      pos = dateResult.nextPos;
      await this.applyLastLocation(deviceSession, position, dateResult.date);
    } else {
      await this.applyLastLocation(deviceSession, position);
    }

    if (variant === this.variants.WANWAY_S20 || variant === this.variants.SL4X) {
      if (pos + 1 <= limit) {
        pos += 1; // ta
      }
    }

    if (pos + 2 > limit) {
      return {
        type: 'lbs',
        position,
        response: this.createResponse(false, type, index)
      };
    }

    const mccRaw = buffer.readUInt16BE(pos);
    pos += 2;
    const mcc = mccRaw & 0x7FFF;

    let mnc;
    if ((mccRaw & 0x8000) !== 0 || variant === this.variants.SL4X) {
      if (pos + 2 > limit) return { type: 'lbs', position, response: this.createResponse(false, type, index) };
      mnc = buffer.readUInt16BE(pos);
      pos += 2;
    } else {
      if (pos + 1 > limit) return { type: 'lbs', position, response: this.createResponse(false, type, index) };
      mnc = buffer.readUInt8(pos++);
    }

    const cellCount = variant === this.variants.WANWAY_S20 ? (pos < limit ? buffer.readUInt8(pos++) : 0)
      : (type === this.MSG_WIFI_5 ? 6 : 7);

    const cellTowers = [];
    for (let i = 0; i < cellCount; i++) {
      let lac = 0;
      let cid = 0;
      if (type === this.MSG_LBS_2 || type === this.MSG_WIFI_3) {
        if (pos + 12 > limit) break;
        lac = buffer.readInt32BE(pos);
        pos += 4;
        // Java casts long to int (low 32 bits)
        cid = buffer.readUInt32BE(pos + 4);
        pos += 8;
      } else if (type === this.MSG_WIFI_5 || type === this.MSG_LBS_3) {
        if (pos + 6 > limit) break;
        lac = buffer.readUInt16BE(pos);
        pos += 2;
        cid = buffer.readUInt32BE(pos);
        pos += 4;
      } else {
        if (pos + 5 > limit) break;
        lac = buffer.readUInt16BE(pos);
        pos += 2;
        cid = buffer.readUIntBE(pos, 3);
        pos += 3;
      }

      if (pos + 1 > limit) break;
      const rssi = -buffer.readUInt8(pos++);
      if (lac > 0) {
        cellTowers.push({ mcc, mnc, lac, cid, rssi });
      }
    }

    if (variant !== this.variants.WANWAY_S20 && variant !== this.variants.SL4X) {
      if (pos + 1 <= limit) {
        pos += 1; // ta
      }
    }

    if (type !== this.MSG_LBS_MULTIPLE_1 && type !== this.MSG_LBS_MULTIPLE_2
        && type !== this.MSG_LBS_MULTIPLE_3 && type !== this.MSG_LBS_2 && type !== this.MSG_LBS_3) {
      if (pos + 1 <= limit) {
        const wifiCount = buffer.readUInt8(pos++);
        const wifiAccessPoints = [];
        for (let i = 0; i < wifiCount; i++) {
          if (pos + 7 > limit) break;
          const mac = buffer.slice(pos, pos + 6).toString('hex').match(/.{1,2}/g).join(':');
          pos += 6;
          const rssi = buffer.readUInt8(pos++);
          wifiAccessPoints.push({ mac, rssi });
        }
        if (wifiAccessPoints.length > 0) {
          position.attributes.wifiAccessPoints = wifiAccessPoints;
        }
      }
    }

    if (cellTowers.length > 0) {
      position.cellTowers = cellTowers;
    }

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

    await this.applyLastLocation(deviceSession, position);

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
   * Handle X1 GPS message
   */
  async handleX1GpsMessage(buffer, start, type, index, deviceSession, position) {
    const limit = buffer.length - 6;
    const timezoneOffsetMinutes = this.getTimezoneOffsetMinutes(deviceSession);
    let pos = start;

    if (pos + 4 > limit) {
      return { type: 'x1_gps', position };
    }

    pos += 4; // data and alarm

    const gpsResult = this.decodeGPS(buffer, pos, { timezoneOffsetMinutes });
    if (gpsResult) {
      Object.assign(position, gpsResult.position);
      pos = gpsResult.nextPos;
    } else {
      await this.applyLastLocation(deviceSession, position);
    }

    if (pos + 2 <= limit) {
      pos += 2; // terminal info
    }

    if (pos + 4 <= limit) {
      position.attributes.odometer = buffer.readUInt32BE(pos);
      pos += 4;
    }

    if (pos + 2 + 1 + 2 + 4 <= limit) {
      const mcc = buffer.readUInt16BE(pos);
      pos += 2;
      const mnc = buffer.readUInt8(pos++);
      const lac = buffer.readUInt16BE(pos);
      pos += 2;
      const cid = buffer.readUInt32BE(pos);
      pos += 4;
      position.cellTowers = [{ mcc, mnc, lac, cid }];
    }

    if (pos + 4 <= limit) {
      const driverId = buffer.readUInt32BE(pos);
      pos += 4;
      if (driverId > 0) {
        position.attributes.driverUniqueId = String(driverId);
      }
    }

    if (pos + 2 <= limit) {
      position.battery = buffer.readUInt16BE(pos) * 0.01;
      pos += 2;
    }

    if (pos + 2 <= limit) {
      position.power = buffer.readUInt16BE(pos) * 0.01;
      pos += 2;
    }

    let portInfo = 0;
    if (pos + 4 <= limit) {
      portInfo = buffer.readUInt32BE(pos);
      pos += 4;
    }

    if (pos + 2 <= limit) {
      position.attributes.input = buffer.readUInt8(pos++);
      position.attributes.output = buffer.readUInt8(pos++);
    }

    const adcCount = this.bitBetween(portInfo, 20, 24);
    for (let i = 1; i <= adcCount; i++) {
      if (pos + 2 > limit) break;
      position.attributes[`adc${i}`] = buffer.readUInt16BE(pos) * 0.01;
      pos += 2;
    }

    return {
      type: 'x1_gps',
      position
    };
  }

  /**
   * Handle X1 photo info message
   */
  async handleX1PhotoInfo(buffer, start, index, deviceSession) {
    const limit = buffer.length - 6;
    let pos = start;

    if (pos + 6 + 1 + 4 + 4 + 1 + 1 + 1 + 4 + 4 > limit) {
      return null;
    }

    pos += 6; // time
    pos += 1; // fix status
    pos += 4; // latitude
    pos += 4; // longitude
    pos += 1; // camera id
    pos += 1; // photo source
    pos += 1; // picture format

    const photoLength = buffer.readUInt32BE(pos);
    pos += 4;
    const pictureId = buffer.readUInt32BE(pos);
    pos += 4;

    if (photoLength > 0) {
      const photoBuffer = Buffer.alloc(photoLength);
      this.photos.set(pictureId, { buffer: photoBuffer, length: photoLength, received: 0 });

      const chunkSize = Math.min(photoLength, 1024);
      const content = Buffer.alloc(4 + 4 + 2);
      content.writeUInt32BE(pictureId, 0);
      content.writeUInt32BE(photoLength, 4);
      content.writeUInt16BE(chunkSize, 8);

      return {
        type: 'photo_info',
        response: this.createResponse(false, this.MSG_X1_PHOTO_DATA, 0, content)
      };
    }

    return null;
  }

  /**
   * Handle X1 photo data message
   */
  async handleX1PhotoData(buffer, start, index, deviceSession, position) {
    const limit = buffer.length - 6;
    let pos = start;

    if (pos + 4 + 4 + 2 > limit) {
      return null;
    }

    const pictureId = buffer.readUInt32BE(pos);
    pos += 4;
    const offset = buffer.readUInt32BE(pos);
    pos += 4;
    const length = buffer.readUInt16BE(pos);
    pos += 2;

    const entry = this.photos.get(pictureId);
    if (!entry) {
      return null;
    }

    const available = Math.min(length, Math.max(0, limit - pos));
    if (available > 0) {
      buffer.copy(entry.buffer, offset, pos, pos + available);
      entry.received = Math.max(entry.received, offset + available);
    }

    let response = null;
    if (entry.received < entry.length) {
      const remaining = entry.length - entry.received;
      const chunkSize = Math.min(remaining, 1024);
      const content = Buffer.alloc(4 + 4 + 2);
      content.writeUInt32BE(pictureId, 0);
      content.writeUInt32BE(entry.length, 4);
      content.writeUInt16BE(chunkSize, 8);
      response = this.createResponse(false, this.MSG_X1_PHOTO_DATA, 0, content);
    } else {
      await this.applyLastLocation(deviceSession, position);
      position.attributes.image = entry.buffer.toString('base64');
      this.photos.delete(pictureId);
    }

    return {
      type: 'photo_data',
      position,
      response
    };
  }

  /**
   * Handle BMS message
   */
  async handleBmsMessage(buffer, start, index, deviceSession, position) {
    const limit = buffer.length - 6;
    let pos = start;

    if (pos + 8 + 4 > limit) {
      return null;
    }

    pos += 8; // serial number
    const timestamp = buffer.readUInt32BE(pos) * 1000;
    pos += 4;
    await this.applyLastLocation(deviceSession, position, new Date(timestamp));

    if (pos + 1 <= limit) position.attributes.relativeCapacity = buffer.readUInt8(pos++);
    if (pos + 2 <= limit) { position.attributes.remainingCapacity = buffer.readUInt16BE(pos); pos += 2; }
    if (pos + 1 <= limit) position.attributes.absoluteCapacity = buffer.readUInt8(pos++);
    if (pos + 2 <= limit) { position.attributes.fullCapacity = buffer.readUInt16BE(pos); pos += 2; }
    if (pos + 1 <= limit) position.attributes.batteryHealth = buffer.readUInt8(pos++);
    if (pos + 2 <= limit) { position.attributes.batteryTemp = buffer.readUInt16BE(pos) * 0.1 - 273.1; pos += 2; }
    if (pos + 2 <= limit) { position.attributes.current = buffer.readUInt16BE(pos); pos += 2; }
    if (pos + 2 <= limit) { position.battery = buffer.readUInt16BE(pos) * 0.001; pos += 2; }
    if (pos + 2 <= limit) { position.attributes.cycleIndex = buffer.readUInt16BE(pos); pos += 2; }

    for (let i = 1; i <= 14; i++) {
      if (pos + 2 > limit) break;
      position.attributes[`batteryCell${i}`] = buffer.readUInt16BE(pos) * 0.001;
      pos += 2;
    }

    if (pos + 2 <= limit) { position.attributes.currentChargeInterval = buffer.readUInt16BE(pos); pos += 2; }
    if (pos + 2 <= limit) { position.attributes.maxChargeInterval = buffer.readUInt16BE(pos); pos += 2; }
    if (pos + 16 <= limit) { position.attributes.barcode = buffer.slice(pos, pos + 16).toString('ascii').trim(); pos += 16; }
    if (pos + 2 <= limit) { position.attributes.batteryVersion = buffer.readUInt16BE(pos); pos += 2; }
    if (pos + 16 <= limit) { position.attributes.manufacturer = buffer.slice(pos, pos + 16).toString('ascii').trim(); pos += 16; }
    if (pos + 4 <= limit) { position.attributes.batteryStatus = buffer.readUInt32BE(pos); pos += 4; }
    if (pos + 4 <= limit) { position.attributes.controllerStatus = buffer.readUInt32BE(pos); pos += 4; }
    if (pos + 4 <= limit) { position.attributes.controllerFault = buffer.readUInt32BE(pos); pos += 4; }

    return {
      type: 'bms',
      position,
      response: this.createResponse(false, this.MSG_BMS, index)
    };
  }

  /**
   * Handle OBD message
   */
  async handleObdMessage(buffer, start, index, deviceSession, position) {
    const limit = buffer.length - 6;
    const timezoneOffsetMinutes = this.getTimezoneOffsetMinutes(deviceSession);
    let pos = start;

    const dateResult = this.decodeDate(buffer, pos, timezoneOffsetMinutes);
    if (dateResult) {
      pos = dateResult.nextPos;
      await this.applyLastLocation(deviceSession, position, dateResult.date);
    } else {
      await this.applyLastLocation(deviceSession, position);
    }

    if (pos < limit) {
      position.ignition = buffer.readUInt8(pos++) > 0;
    }

    if (pos < limit) {
      const data = buffer.slice(pos, limit).toString('ascii');
      for (const pair of data.split(',')) {
        const values = pair.split('=');
        if (values.length >= 2 && values[0].length >= 2) {
          const key = parseInt(values[0].substring(0, 2), 16);
          const raw = values[1];
          switch (key) {
            case 0x40:
              position.attributes.odometer = parseInt(raw, 16) * 0.01;
              break;
            case 0x43:
              position.attributes.fuel = parseInt(raw, 16) * 0.01;
              break;
            case 0x45:
              position.attributes.coolantTemp = parseInt(raw, 16) * 0.01;
              break;
            case 0x53:
              position.attributes.obdSpeed = parseInt(raw, 16) * 0.01;
              break;
            case 0x54:
              position.attributes.rpm = parseInt(raw, 16) * 0.01;
              break;
            case 0x71:
              position.attributes.fuelUsed = parseInt(raw, 16) * 0.01;
              break;
            case 0x73:
              position.attributes.hours = parseInt(raw, 16) * 0.01;
              break;
            case 0x74:
              position.attributes.vin = raw;
              break;
            default:
              break;
          }
        }
      }
    }

    return {
      type: 'obd',
      position,
      response: this.createResponse(true, this.MSG_OBD, index)
    };
  }

  /**
   * Handle alarm message
   */
  async handleAlarmMessage(buffer, start, type, index, deviceSession, position, variant) {
    if (buffer.length < start + 3) return null;

    const lengthField = buffer.readUInt8(2);
    const dataLength = lengthField - 5;
    const extendedAlarm = dataLength > 7;
    const jc400 = variant === this.variants.JC400;
    const timezoneOffsetMinutes = this.getTimezoneOffsetMinutes(deviceSession);

    let pos = start;
    const limit = buffer.length - 6;

    if (extendedAlarm) {
      if (jc400 && pos + 3 <= limit) {
        pos += 2; // marker
        pos += 1; // version
      }

      const gpsResult = this.decodeGPS(buffer, pos, {
        hasLength: false,
        hasSatellites: jc400,
        hasSpeed: jc400,
        longSpeed: jc400,
        swapFlags: jc400,
        timezoneOffsetMinutes
      });

      if (gpsResult) {
        Object.assign(position, gpsResult.position);
        pos = gpsResult.nextPos;
      } else {
        await this.applyLastLocation(deviceSession, position);
      }
    } else {
      const dateResult = this.decodeDate(buffer, pos, timezoneOffsetMinutes);
      if (dateResult) {
        pos = dateResult.nextPos;
        await this.applyLastLocation(deviceSession, position, dateResult.date);
      } else {
        await this.applyLastLocation(deviceSession, position);
      }
    }

    if (jc400 && pos + 2 <= limit) {
      position.power = buffer.readUInt16BE(pos) * 0.1;
      pos += 2;
    }

    if (pos + 3 <= limit) {
      const event = buffer.readUInt8(pos++);
      const eventData = buffer.readUInt16BE(pos);
      pos += 2;

      position.attributes.event = event;
      position.attributes.eventData = eventData;

      const alarm = this.decodeAlarmEvent(event, extendedAlarm);
      if (alarm) {
        position.alarms.push(alarm);
      }
    }

    const filesLength = limit - pos;
    if (filesLength > 0) {
      position.attributes.eventFiles = buffer.slice(pos, pos + filesLength).toString('ascii');
      pos += filesLength;
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
  async handleStatusMessage(buffer, start, type, index, deviceSession, position, variant) {
    if (buffer.length < start + 1) return null;
    if (!deviceSession) {
      return {
        type: 'status_no_session',
        response: this.createResponse(false, type, index)
      };
    }

    const model = this.getDeviceModel(deviceSession);
    const { modelLW, modelSW, modelNT20, modelVL, modelR11 } = this.getModelFlags(model);
    const limit = buffer.length - 6;

    let pos = start;

    const remaining = buffer.length - start;
    if (type === this.MSG_STATUS && remaining === 22) {
      await this.applyLastLocation(deviceSession, position);

      pos += 1; // information content
      if (pos + 2 <= limit) {
        position.satellites = buffer.readUInt16BE(pos);
        pos += 2;
      }
      pos += 1; // alarm
      pos += 1; // language
      if (pos + 1 <= limit) {
        position.attributes.batteryLevel = buffer.readUInt8(pos++);
      }
      pos += 1; // working mode
      pos += 2; // working voltage
      pos += 1; // reserved
      pos += 2; // working times
      pos += 2; // working time
      if (pos + 2 <= limit) {
        const value = buffer.readUInt16BE(pos);
        const temperature = (value & 0x7FFF) * 0.1;
        position.attributes.temperature = (value & 0x8000) !== 0 ? temperature : -temperature;
        pos += 2;
      }

      return {
        type: 'status',
        position,
        response: this.createResponse(false, type, index)
      };
    }

    if (type === this.MSG_GPS_LBS_STATUS_5 && pos < limit) {
      pos += 1; // network indicator
    }

    const statusResult = this.decodeStatus(buffer, pos, variant);
    if (statusResult) {
      Object.assign(position, statusResult.status);
      pos = statusResult.nextPos;
    }

    if (variant === this.variants.OBD6) {
      if (pos + 2 + 1 + 1 + 1 + 2 <= limit) {
        const signal = buffer.readUInt16BE(pos);
        pos += 2;
        position.satellites = ((signal >> 10) & 0x1F) + ((signal >> 5) & 0x1F);
        position.rssi = signal & 0x1F;

        const alarm = buffer.readUInt8(pos++);
        const alarmType = this.decodeAlarmCode(alarm, modelLW, modelSW, modelVL);
        if (alarmType) {
          position.alarms.push(alarmType);
        }

        pos += 1; // language
        position.attributes.batteryLevel = buffer.readUInt8(pos++);
        const mode = buffer.readUInt8(pos++);
        position.power = buffer.readUInt16BE(pos) / 100.0;
        pos += 2;
        pos += 1; // reserved
        pos += 2; // working time

        if (mode == 4 && pos + 2 <= limit) {
          position.attributes.temperature = buffer.readInt16BE(pos) / 10.0;
          pos += 2;
        }
      }
    } else {
      if (type === this.MSG_GPS_LBS_STATUS_5 || (modelNT20 && type === this.MSG_GPS_LBS_2)) {
        if (pos + 2 <= limit) {
          position.power = buffer.readUInt16BE(pos) * 0.01;
          pos += 2;
        }
      }

      if (type === this.MSG_STATUS && modelR11) {
        if (pos + 2 <= limit) {
          position.power = buffer.readUInt16BE(pos) * 0.01;
          pos += 2;
        }
      } else {
        if (pos + 1 <= limit) {
          let battery = buffer.readUInt8(pos++);
          if (modelNT20 && type === this.MSG_GPS_LBS_2) {
            battery = Math.floor(battery / 10);
          }
          if (battery <= 6) {
            position.attributes.batteryLevel = Math.round(battery * 100 / 6);
          } else if (battery <= 100) {
            position.attributes.batteryLevel = battery;
          }
        }
      }

      if (pos + 1 <= limit) {
        position.rssi = buffer.readUInt8(pos++);
      }

      if (type === this.MSG_STATUS && modelLW) {
        if (pos + 2 <= limit) {
          position.power = (buffer.readUInt16BE(pos) & 0x0FFF) / 10.0;
          pos += 2;
        }
      } else {
        if (pos + 1 <= limit) {
          const extension = buffer.readUInt8(pos++);
          if (type === this.MSG_STATUS && modelSW) {
            position.power = extension;
          } else if (variant !== this.variants.VXT01) {
            const alarmType = this.decodeAlarmCode(extension, modelLW, modelSW, modelVL);
            if (alarmType) {
              position.alarms.push(alarmType);
            }
          }
        }
      }
    }

    if (type === this.MSG_STATUS_2) {
      if (pos + 1 <= limit) {
        pos += 1; // language
        while (pos < limit) {
          if (pos + 3 > limit) break;
          const moduleType = buffer.readUInt16BE(pos);
          pos += 2;
          const moduleLength = buffer.readUInt8(pos++);
          if (pos + moduleLength > limit) break;
          switch (moduleType) {
            case 0x0018:
              if (moduleLength >= 2) {
                position.battery = buffer.readUInt16BE(pos) / 100.0;
              }
              break;
            case 0x0032:
              if (moduleLength >= 1) {
                position.attributes.startupStatus = buffer.readUInt8(pos);
              }
              break;
            case 0x006A:
              if (moduleLength >= 1) {
                position.attributes.batteryLevel = buffer.readUInt8(pos);
              }
              break;
            default:
              break;
          }
          pos += moduleLength;
        }
      }
    }

    if (type === this.MSG_GPS_LBS_STATUS_5 && pos + 1 + 4 + 4 + 8 + 2 <= limit) {
      pos += 1; // language
      position.attributes.odometer = buffer.readUInt32BE(pos);
      pos += 4;
      position.attributes.hours = buffer.readUInt32BE(pos) * 1000;
      pos += 4;
      pos += 8; // terminal id
      position.attributes.input = buffer.readUInt16BE(pos);
      pos += 2;
    }

    await this.applyLastLocation(deviceSession, position);

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
    content.writeUInt8(now.getUTCFullYear() - 2000, 0);
    content.writeUInt8(now.getUTCMonth() + 1, 1);
    content.writeUInt8(now.getUTCDate(), 2);
    content.writeUInt8(now.getUTCHours(), 3);
    content.writeUInt8(now.getUTCMinutes(), 4);
    content.writeUInt8(now.getUTCSeconds(), 5);

    return {
      type: 'timeRequest',
      response: this.createResponse(false, this.MSG_TIME_REQUEST, index, content)
    };
  }

  /**
   * Decode extended (0x7979) messages
   */
  async decodeExtended(buffer, deviceSession, variant) {
    if (buffer.length < 6) return null;

    // Validate CRC (do not drop packet to match Java tolerance)
    if (!this.validateCRC(buffer)) {
      logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'CRC validation failed for extended message');
    }

    const length = buffer.readUInt16BE(2);
    const type = buffer.readUInt8(4);
    const index = buffer.readUInt16BE(buffer.length - 6);

    logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'Extended message received', { 
      type: type.toString(16), 
      length 
    });

    let position = {
      deviceId: deviceSession?.deviceId,
      protocol: 'GT06',
      timestamp: new Date(),
      valid: false,
      latitude: 0,
      longitude: 0,
      attributes: {}
    };

    switch (type) {
      case this.MSG_STRING_INFO:
        return await this.handleExtendedStringInfo(buffer, 5, index, deviceSession, position);
      
      case this.MSG_INFO:
        return await this.handleExtendedInfo(buffer, 5, index, deviceSession, position);
      
      case this.MSG_AZ735_GPS:
      case this.MSG_AZ735_ALARM:
        return await this.handleAZ735Message(buffer, 5, type, index, deviceSession, position, variant);
      
      case this.MSG_GPS_MODULAR:
        return await this.handleModularGPS(buffer, 5, index, deviceSession, position);

      case this.MSG_OBD:
        return await this.handleObdMessage(buffer, 5, index, deviceSession, position);

      case this.MSG_MULTIMEDIA:
        return await this.handleMultimedia(buffer, 5, index, deviceSession, position);
      
      case this.MSG_SERIAL:
        return await this.handleSerialMessage(buffer, 5, index, deviceSession, position);
      
      case this.MSG_PERIPHERAL:
        return await this.handlePeripheralMessage(buffer, 5, index, deviceSession, position);

      case this.MSG_X1_PHOTO_DATA:
        return await this.handleX1PhotoData(buffer, 5, index, deviceSession, position);
      
      default:
        logger.gpsProtocol(deviceSession?.deviceId, 'GT06', 'Unsupported extended message', { type: type.toString(16) });
        return {
          type: 'extended_unsupported',
          response: this.createResponse(true, type, index)
        };
    }
  }

  /**
   * Handle extended string info message
   */
  async handleExtendedStringInfo(buffer, start, index, deviceSession, position) {
    let pos = start;
    pos += 4; // server flag
    const encoding = buffer.readUInt8(pos++);
    const data = buffer.slice(pos, buffer.length - 6).toString(encoding === 1 ? 'ascii' : 'utf16be');
    position.attributes.result = data;
    
    return {
      type: 'extended_string_info',
      position,
      response: this.createResponse(true, this.MSG_STRING_INFO, index)
    };
  }

  /**
   * Handle extended info message
   */
  async handleExtendedInfo(buffer, start, index, deviceSession, position) {
    const subType = buffer.readUInt8(start);
    const dataLength = buffer.length - 6 - start;
    
    switch (subType) {
      case 0x00:
        position.attributes.adc1 = buffer.readUInt16BE(start + 1) * 0.01;
        break;
      case 0x0a:
        position.attributes.iccid = buffer.slice(start + 17, start + 27).toString('hex');
        break;
      case 0x0b:
        if (dataLength === 2) {
          position.power = buffer.readUInt16BE(start + 1) / 100.0;
        } else {
          position.attributes.networkTechnology = buffer.readUInt8(start + 1) > 0 ? '4G' : '2G';
        }
        break;
    }
    
    return {
      type: 'extended_info',
      position,
      response: this.createResponse(true, this.MSG_INFO, index)
    };
  }

  /**
   * Handle AZ735 GPS/Alarm messages
   */
  async handleAZ735Message(buffer, start, type, index, deviceSession, position, variant) {
    let pos = start;
    const limit = buffer.length - 6;
    const timezoneOffsetMinutes = this.getTimezoneOffsetMinutes(deviceSession);

    // Decode GPS (length-prefixed)
    const gpsResult = this.decodeGPS(buffer, pos, { hasLength: true, timezoneOffsetMinutes });
    if (gpsResult) {
      Object.assign(position, gpsResult.position);
      pos = gpsResult.nextPos;
    } else {
      await this.applyLastLocation(deviceSession, position);
    }

    // Decode LBS if present (length-prefixed)
    if (pos < limit) {
      const lbsResult = this.decodeLBS(buffer, pos, type, variant, true);
      if (lbsResult) {
        position.cellTowers = lbsResult.cellTowers;
        pos = lbsResult.nextPos;
        if (pos < limit) {
          position.rssi = buffer.readUInt8(pos++);
        }
      }
    }

    if (pos < limit) {
      const extraCellsLength = buffer.readUInt8(pos++);
      pos += Math.min(extraCellsLength, limit - pos);
    }
    if (pos < limit) {
      const wifiLength = buffer.readUInt8(pos++);
      pos += Math.min(wifiLength, limit - pos);
    }

    if (pos < limit) {
      const status = buffer.readUInt8(pos++);
      position.attributes.status = status;
      if (type === this.MSG_AZ735_ALARM) {
        switch (status) {
          case 0xA0:
            position.attributes.armed = true;
            break;
          case 0xA1:
            position.attributes.armed = false;
            break;
          case 0xA2:
          case 0xA3:
            position.alarms.push(this.ALARM_LOW_BATTERY);
            break;
          case 0xA4:
            position.alarms.push(this.ALARM_GENERAL);
            break;
          case 0xA5:
            position.alarms.push(this.ALARM_DOOR);
            break;
        }
      }
    }

    if (pos < limit) {
      const reservedLength = buffer.readUInt8(pos++);
      pos += Math.min(reservedLength, limit - pos);
    }

    return {
      type: type === this.MSG_AZ735_GPS ? 'az735_gps' : 'az735_alarm',
      position,
      response: this.createResponse(true, type, index)
    };
  }

  /**
   * Handle modular GPS message
   */
  async handleModularGPS(buffer, start, index, deviceSession, position, extended = true) {
    let pos = start;
    const limit = buffer.length - 6;

    while (pos + 4 <= limit) {
      const moduleType = buffer.readUInt16BE(pos);
      const moduleLength = buffer.readUInt16BE(pos + 2);
      pos += 4;

      const moduleStart = pos;
      const moduleEnd = Math.min(moduleStart + moduleLength, limit);

      switch (moduleType) {
        case 0x03:
          if (pos + 10 <= moduleEnd) {
            position.attributes.iccid = buffer.slice(pos, pos + 10).toString('hex');
          }
          break;
        case 0x09:
          if (pos + 1 <= moduleEnd) {
            position.satellites = buffer.readUInt8(pos);
          }
          break;
        case 0x0a:
          if (pos + 1 <= moduleEnd) {
            position.attributes.satellitesVisible = buffer.readUInt8(pos);
          }
          break;
        case 0x11:
          if (pos + 10 <= moduleEnd) {
            const mcc = buffer.readUInt16BE(pos);
            const mnc = buffer.readUInt16BE(pos + 2);
            const lac = buffer.readUInt16BE(pos + 4);
            const cid = buffer.readUIntBE(pos + 6, 3);
            const rssi = buffer.readUInt8(pos + 9);
            if (cid > 0) {
              position.cellTowers = [{ mcc, mnc, lac, cid, rssi }];
            }
          }
          break;
        case 0x18:
          if (pos + 2 <= moduleEnd) {
            position.battery = buffer.readUInt16BE(pos) * 0.01;
          }
          break;
        case 0x28:
          if (pos + 1 <= moduleEnd) {
            position.attributes.hdop = buffer.readUInt8(pos) * 0.1;
          }
          break;
        case 0x29:
          if (pos + 4 <= moduleEnd) {
            position.attributes.index = buffer.readUInt32BE(pos);
          }
          break;
        case 0x2a:
          if (pos + 1 <= moduleEnd) {
            const input = buffer.readUInt8(pos);
            position.attributes.door = (input & 0x0F) > 0;
            position.attributes.tamper = ((input >> 4) & 0x0F) > 0;
          }
          break;
        case 0x2b:
          if (pos + 1 <= moduleEnd) {
            const event = buffer.readUInt8(pos);
            position.attributes.event = event;
            switch (event) {
              case 0x11:
                position.alarms.push(this.ALARM_LOW_BATTERY);
                break;
              case 0x12:
                position.alarms.push(this.ALARM_LOW_POWER);
                break;
              case 0x13:
                position.alarms.push(this.ALARM_POWER_CUT);
                break;
              case 0x14:
                position.alarms.push(this.ALARM_REMOVING);
                break;
            }
          }
          break;
        case 0x2e:
          if (pos + 4 <= moduleEnd) {
            position.attributes.odometer = buffer.readUInt32LE(pos);
          }
          break;
        case 0x33:
          if (pos + 4 + 1 + 2 + 4 + 4 + 1 + 2 <= moduleEnd) {
            const timestamp = new Date(buffer.readUInt32BE(pos) * 1000);
            pos += 4;
            position.timestamp = timestamp;
            position.satellites = buffer.readUInt8(pos++);
            position.altitude = buffer.readInt16BE(pos);
            pos += 2;
            let latitude = buffer.readUInt32BE(pos) / 60.0 / 30000.0;
            pos += 4;
            let longitude = buffer.readUInt32BE(pos) / 60.0 / 30000.0;
            pos += 4;
            position.speed = buffer.readUInt8(pos++);
            const flags = buffer.readUInt16BE(pos);
            pos += 2;
            position.course = flags & 0x03FF;
            position.valid = (flags & 0x1000) !== 0;
            if ((flags & 0x0400) === 0) {
              latitude = -latitude;
            }
            if ((flags & 0x0800) !== 0) {
              longitude = -longitude;
            }
            position.latitude = latitude;
            position.longitude = longitude;
          }
          break;
        case 0x34:
          if (pos + 6 <= moduleEnd) {
            position.attributes.event = buffer.readUInt8(pos++);
            pos += 4; // time (LE)
            const contentLength = buffer.readUInt8(pos++);
            pos += Math.min(contentLength, moduleEnd - pos);
          }
          break;
        default:
          break;
      }

      pos = moduleEnd;
    }

    if (!position.timestamp) {
      await this.applyLastLocation(deviceSession, position);
    }

    return {
      type: 'modular_gps',
      position,
      response: this.createResponse(extended, this.MSG_GPS_MODULAR, index)
    };
  }

  /**
   * Handle multimedia message
   */
  async handleMultimedia(buffer, start, index, deviceSession, position, extended = true) {
    position.attributes.multimedia = 'received';
    
    return {
      type: 'multimedia',
      position,
      response: this.createResponse(extended, this.MSG_MULTIMEDIA, index)
    };
  }

  /**
   * Handle serial message
   */
  async handleSerialMessage(buffer, start, index, deviceSession, position, extended = true) {
    const data = buffer.slice(start + 1, buffer.length - 6);
    position.attributes.serial = data.toString('ascii').trim();
    
    return {
      type: 'serial',
      position,
      response: this.createResponse(extended, this.MSG_SERIAL, index)
    };
  }

  /**
   * Handle peripheral message
   */
  async handlePeripheralMessage(buffer, start, index, deviceSession, position, extended = true) {
    position.attributes.peripheral = 'data_received';
    
    return {
      type: 'peripheral',
      position,
      response: this.createResponse(extended, this.MSG_PERIPHERAL, index)
    };
  }
  hasGPS(type, variant) {
    switch (type) {
      case this.MSG_GPS:
      case this.MSG_GPS_LBS_1:
      case this.MSG_GPS_LBS_2:
      case this.MSG_GPS_LBS_3:
      case this.MSG_GPS_LBS_4:
      case this.MSG_GPS_LBS_5:
      case this.MSG_GPS_LBS_6:
      case this.MSG_GPS_LBS_STATUS_1:
      case this.MSG_GPS_LBS_STATUS_2:
      case this.MSG_GPS_LBS_STATUS_3:
      case this.MSG_GPS_LBS_STATUS_4:
      case this.MSG_GPS_LBS_STATUS_5:
      case this.MSG_GPS_PHONE:
      case this.MSG_GPS_LBS_EXTEND:
      case this.MSG_GPS_LBS_7:
      case this.MSG_GPS_LBS_RFID:
      case this.MSG_FENCE_MULTI:
        return true;
      case this.MSG_STATUS_3: // 0xA3 also used for fence single
        return variant !== this.variants.SEEWORLD;
      default:
        return false;
    }
  }

  /**
   * Check if message type has LBS data
   */
  hasLBS(type, variant) {
    switch (type) {
      case this.MSG_LBS_STATUS:
      case this.MSG_GPS_LBS_1:
      case this.MSG_GPS_LBS_2:
      case this.MSG_GPS_LBS_3:
      case this.MSG_GPS_LBS_4:
      case this.MSG_GPS_LBS_5:
      case this.MSG_GPS_LBS_6:
      case this.MSG_GPS_LBS_STATUS_1:
      case this.MSG_GPS_LBS_STATUS_2:
      case this.MSG_GPS_LBS_STATUS_3:
      case this.MSG_GPS_LBS_STATUS_4:
      case this.MSG_GPS_LBS_STATUS_5:
      case this.MSG_GPS_LBS_7:
      case this.MSG_GPS_LBS_RFID:
      case this.MSG_FENCE_MULTI:
      case this.MSG_LBS_ALARM:
      case this.MSG_LBS_ADDRESS:
        return true;
      case this.MSG_STATUS_3: // 0xA3 also used for fence single
        return variant !== this.variants.SEEWORLD;
      default:
        return false;
    }
  }

  /**
   * Check if message type has status data
   */
  hasStatus(type, model, variant) {
    const modelUpper = model ? String(model).toUpperCase() : '';
    switch (type) {
      case this.MSG_STATUS:
      case this.MSG_STATUS_2:
      case this.MSG_LBS_STATUS:
      case this.MSG_GPS_LBS_STATUS_1:
      case this.MSG_GPS_LBS_STATUS_2:
      case this.MSG_GPS_LBS_STATUS_3:
      case this.MSG_GPS_LBS_STATUS_4:
      case this.MSG_GPS_LBS_STATUS_5:
      case this.MSG_FENCE_MULTI:
      case this.MSG_LBS_ALARM:
        return true;
      case this.MSG_GPS_LBS_2:
        return modelUpper === 'NT20';
      case this.MSG_STATUS_3: // 0xA3 also used for fence single
        return variant === this.variants.SEEWORLD;
      default:
        return false;
    }
  }

  /**
   * Decode alarm code to alarm type
   */
  decodeAlarmCode(code, modelLW = false, modelSW = false, modelVL = false) {
    switch (code) {
      case 0x01: return this.ALARM_SOS;
      case 0x02: return this.ALARM_POWER_CUT;
      case 0x03: return this.ALARM_VIBRATION;
      case 0x04: return this.ALARM_GEOFENCE_ENTER;
      case 0x05: return this.ALARM_GEOFENCE_EXIT;
      case 0x06: return this.ALARM_OVERSPEED;
      case 0x09: return modelVL ? this.ALARM_TOW : this.ALARM_VIBRATION;
      case 0x0E:
      case 0x0F: return this.ALARM_LOW_BATTERY;
      case 0x11: return this.ALARM_POWER_OFF;
      case 0x0C:
      case 0x13:
      case 0x25: return this.ALARM_TAMPERING;
      case 0x14: return this.ALARM_DOOR;
      case 0x18: return modelLW ? this.ALARM_ACCIDENT : this.ALARM_REMOVING;
      case 0x19: return modelLW ? this.ALARM_ACCELERATION : this.ALARM_LOW_BATTERY;
      case 0x1A:
      case 0x27: return this.ALARM_BRAKING;
      case 0x1B:
      case 0x2A:
      case 0x2B:
      case 0x2E: return this.ALARM_CORNERING;
      case 0x23: return this.ALARM_FALL_DOWN;
      case 0x26: return this.ALARM_ACCELERATION;
      case 0x28: return modelSW ? this.ALARM_CORNERING : this.ALARM_BRAKING;
      case 0x29: return modelSW ? this.ALARM_ACCIDENT : this.ALARM_ACCELERATION;
      case 0x2C: return this.ALARM_ACCIDENT;
      case 0x30: return modelVL ? this.ALARM_BRAKING : this.ALARM_JAMMING;
      default: return null;
    }
  }

  decodeAlarmEvent(event, extendedAlarm) {
    switch (event) {
      case 0x01: return extendedAlarm ? this.ALARM_SOS : this.ALARM_GENERAL;
      case 0x0E: return this.ALARM_LOW_POWER;
      case 0x76: return this.ALARM_TEMPERATURE;
      case 0x80: return this.ALARM_VIBRATION;
      case 0x87: return this.ALARM_OVERSPEED;
      case 0x88: return this.ALARM_POWER_CUT;
      case 0x90: return this.ALARM_ACCELERATION;
      case 0x91: return this.ALARM_BRAKING;
      case 0x92: return this.ALARM_CORNERING;
      case 0x93: return this.ALARM_ACCIDENT;
      default: return null;
    }
  }

  /**
   * Create response message (ACK) - FIXED to match Java implementation exactly
   */
  createResponse(extended, type, index, content = null) {
    console.log('\n=== CREATING ACK RESPONSE ===');
    console.log('Extended:', extended);
    console.log('Type:', type.toString(16));
    console.log('Index (input):', index);
    console.log('Content length:', content ? content.length : 0);
    
    const contentSize = content ? content.length : 0;
    let totalSize;
    
    if (extended) {
      // Extended: Header(2) + Length(2) + Type(1) + Content + Index(2) + CRC(2) + Footer(2)
      totalSize = 2 + 2 + 1 + contentSize + 2 + 2 + 2;
    } else {
      // Basic: Header(2) + Length(1) + Type(1) + Content + Index(2) + CRC(2) + Footer(2)
      totalSize = 2 + 1 + 1 + contentSize + 2 + 2 + 2;
    }
    
    const response = Buffer.alloc(totalSize);
    let pos = 0;

    // Header
    if (extended) {
      response.writeUInt16BE(0x7979, pos);
      pos += 2;
      // Length = Type(1) + Content + Index(2) + CRC(2)
      const lengthField = 1 + contentSize + 2 + 2;
      response.writeUInt16BE(lengthField, pos);
      pos += 2;
    } else {
      response.writeUInt16BE(0x7878, pos);
      pos += 2;
      // Length = Type(1) + Content + Index(2) + CRC(2)
      const lengthField = 1 + contentSize + 2 + 2;
      response.writeUInt8(lengthField, pos);
      pos += 1;
    }

    // Message type (echo the received type)
    response.writeUInt8(type, pos++);

    // Content (if any)
    if (content && content.length > 0) {
      content.copy(response, pos);
      pos += content.length;
    }

    // Index (echo the received index) - CRITICAL: Must match exactly
    response.writeUInt16BE(index, pos);
    pos += 2;

    // Calculate CRC for the data portion (from length field to index)
    const crcStart = 2;
    const dataForCRC = response.slice(crcStart, pos);
    const crc = this.calculateCRC16X25(dataForCRC);
    response.writeUInt16BE(crc, pos);
    pos += 2;

    // Footer - MUST be 0x0D 0x0A
    response.writeUInt8(0x0D, pos++);
    response.writeUInt8(0x0A, pos++);

    console.log('Response HEX:', response.toString('hex'));
    console.log('Response length:', response.length);
    console.log('CRC calculated:', crc.toString(16));
    console.log('Index echoed:', index);
    console.log('Data for CRC:', dataForCRC.toString('hex'));
    console.log('=============================\n');

    return response;
  }

  /**
   * Validate CRC16 checksum for incoming messages
   */
  validateCRC(buffer) {
    try {
      if (!buffer || buffer.length < 7) return false;

      const header = buffer.readUInt16BE(0);
      let start = 2;
      let end = buffer.length - 4;
      const crcData = buffer.slice(start, end);

      // Extract received CRC
      const receivedCRC = buffer.readUInt16BE(end);

      // Calculate CRC for data portion
      const calculatedCRC = this.calculateCRC16X25(crcData);

      const isValid = receivedCRC === calculatedCRC;
      
      if (!isValid) {
        console.log('CRC validation failed:', {
          received: receivedCRC.toString(16),
          calculated: calculatedCRC.toString(16),
          dataHex: crcData.toString('hex')
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error validating CRC:', error);
      return false;
    }
  }

  /**
   * Calculate CRC16 checksum using X.25 polynomial (matches Java Checksum.crc16)
   */
  calculateCRC16X25(data) {
    try {
      if (!data || data.length === 0) {
        return 0;
      }
      
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
    } catch (error) {
      logger.error('Error calculating CRC16 X.25:', error);
      return 0;
    }
  }

  /**
   * Legacy CRC16 method for backward compatibility
   */
  calculateCRC16(data) {
    return this.calculateCRC16X25(data);
  }
}

module.exports = GT06ProtocolDecoder;
