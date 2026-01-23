const net = require('net');

class MockGT06Device {
  constructor(imei, serverHost = 'localhost', serverPort = 5023) {
    this.imei = imei;
    this.serverHost = serverHost;
    this.serverPort = serverPort;
    this.socket = null;
    this.serialNumber = 1;
    this.isConnected = false;
    
    // Mock GPS data
    this.lat = 28.6139; // Delhi
    this.lng = 77.2090;
    this.speed = 0;
    this.course = 0;
    this.ignition = false;
    this.acc = false;
    
    // Movement simulation
    this.isMoving = false;
    this.moveDirection = 1;
  }

  connect() {
    this.socket = new net.Socket();
    
    this.socket.connect(this.serverPort, this.serverHost, () => {
      console.log(`📱 Mock device ${this.imei} connected to ${this.serverHost}:${this.serverPort}`);
      this.isConnected = true;
      this.sendLoginMessage();
    });

    this.socket.on('data', (data) => {
      console.log(`📨 Received response:`, data.toString('hex'));
      this.handleServerResponse(data);
    });

    this.socket.on('close', () => {
      console.log(`📱 Device ${this.imei} disconnected`);
      this.isConnected = false;
    });

    this.socket.on('error', (err) => {
      console.error(`❌ Socket error:`, err.message);
    });
  }

  // GT06 Login Message
  sendLoginMessage() {
    const imeiBytes = Buffer.from(this.imei.padStart(15, '0'));
    const serialBytes = Buffer.allocUnsafe(2);
    serialBytes.writeUInt16BE(this.serialNumber++);
    
    const data = Buffer.concat([
      Buffer.from([0x01]), // Protocol number
      imeiBytes,
      serialBytes
    ]);
    
    const message = this.buildGT06Message(data);
    console.log(`🔐 Sending login message:`, message.toString('hex'));
    this.socket.write(message);
  }

  // GT06 Location Message
  sendLocationMessage() {
    if (!this.isConnected) return;

    const dateTime = new Date();
    const year = dateTime.getFullYear() - 2000;
    const month = dateTime.getMonth() + 1;
    const day = dateTime.getDate();
    const hour = dateTime.getHours();
    const minute = dateTime.getMinutes();
    const second = dateTime.getSeconds();

    // Convert lat/lng to GT06 format
    const latDegrees = Math.floor(Math.abs(this.lat));
    const latMinutes = (Math.abs(this.lat) - latDegrees) * 60;
    const latValue = (latDegrees * 60 + latMinutes) * 30000;
    
    const lngDegrees = Math.floor(Math.abs(this.lng));
    const lngMinutes = (Math.abs(this.lng) - lngDegrees) * 60;
    const lngValue = (lngDegrees * 60 + lngMinutes) * 30000;

    // Status byte (GPS valid, ignition, ACC, etc.)
    let statusByte = 0x12; // GPS valid
    if (this.ignition) statusByte |= 0x20;
    if (this.acc) statusByte |= 0x80;

    const data = Buffer.from([
      year, month, day, hour, minute, second, // DateTime
      0x00, // GPS info length
      0x00, 0x00, 0x00, 0x00, // Satellites
      Math.floor(latValue / 0x1000000), Math.floor(latValue / 0x10000) & 0xFF, 
      Math.floor(latValue / 0x100) & 0xFF, latValue & 0xFF, // Latitude
      Math.floor(lngValue / 0x1000000), Math.floor(lngValue / 0x10000) & 0xFF,
      Math.floor(lngValue / 0x100) & 0xFF, lngValue & 0xFF, // Longitude
      this.speed, // Speed
      Math.floor(this.course / 256), this.course % 256, // Course
      0x00, 0x00, 0x00, // MCC, MNC, LAC
      0x00, 0x00, 0x00, // Cell ID
      statusByte, // Status
      0x00, 0x00 // Serial number
    ]);

    data.writeUInt16BE(this.serialNumber++, data.length - 2);
    
    const message = this.buildGT06Message(data, 0x22); // Location message type
    console.log(`📍 Sending location: Lat=${this.lat.toFixed(6)}, Lng=${this.lng.toFixed(6)}, Speed=${this.speed}, IGN=${this.ignition}, ACC=${this.acc}`);
    this.socket.write(message);
  }

  // GT06 Heartbeat
  sendHeartbeat() {
    if (!this.isConnected) return;
    
    const data = Buffer.from([
      0x01, // Terminal info
      0x00, 0x00, 0x00, 0x00, // Voltage
      0x00, // GSM signal
      0x00, 0x00 // Serial number
    ]);
    
    data.writeUInt16BE(this.serialNumber++, data.length - 2);
    
    const message = this.buildGT06Message(data, 0x13); // Heartbeat type
    console.log(`💓 Sending heartbeat`);
    this.socket.write(message);
  }

  buildGT06Message(data, protocolType = 0x01) {
    const length = data.length + 1; // +1 for protocol type
    const header = Buffer.from([0x78, 0x78, length, protocolType]);
    const payload = Buffer.concat([header, data]);
    
    // Calculate CRC
    let crc = 0;
    for (let i = 2; i < payload.length; i++) {
      crc += payload[i];
    }
    crc = crc & 0xFFFF;
    
    const crcBytes = Buffer.allocUnsafe(2);
    crcBytes.writeUInt16BE(crc);
    
    const footer = Buffer.from([0x0D, 0x0A]);
    
    return Buffer.concat([payload, crcBytes, footer]);
  }

  handleServerResponse(data) {
    // Handle server acknowledgments
    if (data.length >= 10) {
      const header = data.readUInt16BE(0);
      if (header === 0x7878) {
        const protocolType = data[3];
        console.log(`✅ Server ACK for protocol type: 0x${protocolType.toString(16)}`);
      }
    }
  }

  // Control methods
  startEngine() {
    this.ignition = true;
    this.acc = true;
    console.log(`🔥 Engine started`);
  }

  stopEngine() {
    this.ignition = false;
    this.speed = 0;
    console.log(`🛑 Engine stopped`);
  }

  setSpeed(speed) {
    if (this.ignition) {
      this.speed = Math.min(speed, 200);
      console.log(`🚗 Speed set to ${this.speed} km/h`);
    }
  }

  startMoving() {
    this.isMoving = true;
    this.moveInterval = setInterval(() => {
      if (this.ignition && this.speed > 0) {
        // Simulate movement
        const moveDistance = (this.speed / 3600) * 0.001; // km to degrees roughly
        this.lat += (Math.random() - 0.5) * moveDistance * this.moveDirection;
        this.lng += (Math.random() - 0.5) * moveDistance * this.moveDirection;
        this.course = Math.floor(Math.random() * 360);
      }
    }, 5000);
  }

  stopMoving() {
    this.isMoving = false;
    if (this.moveInterval) {
      clearInterval(this.moveInterval);
    }
  }

  startAutoReporting(intervalMs = 30000) {
    this.reportInterval = setInterval(() => {
      this.sendLocationMessage();
    }, intervalMs);
    
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 60000);
  }

  disconnect() {
    if (this.reportInterval) clearInterval(this.reportInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.moveInterval) clearInterval(this.moveInterval);
    
    if (this.socket) {
      this.socket.destroy();
    }
  }
}

module.exports = MockGT06Device;