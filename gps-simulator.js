// GPS Data Simulator - Sends Real Location Data
const net = require('net');

const SERVER_HOST = 'node.genzteck.com';
const SERVER_PORT = 5027;
const DEVICE_IMEI = '123456789012345'; // Test IMEI

console.log(`🚀 Starting GPS Simulator...`);
console.log(`📡 Connecting to: ${SERVER_HOST}:${SERVER_PORT}`);
console.log(`📱 Device IMEI: ${DEVICE_IMEI}`);

class GPSSimulator {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.serialNumber = 1;
    
    // Delhi coordinates (will move around)
    this.currentLat = 28.6139;
    this.currentLng = 77.2090;
    this.speed = 0;
    this.course = 0;
    this.ignition = false;
  }

  connect() {
    this.socket = net.createConnection({ 
      port: SERVER_PORT, 
      host: SERVER_HOST 
    }, () => {
      console.log('✅ Connected to GPS server!');
      this.connected = true;
      this.sendLogin();
    });

    this.socket.on('data', (data) => {
      console.log('📨 Server response:', data.toString('hex'));
    });

    this.socket.on('error', (err) => {
      console.error('❌ Connection error:', err.message);
      this.reconnect();
    });

    this.socket.on('close', () => {
      console.log('🔌 Connection closed');
      this.connected = false;
      this.reconnect();
    });
  }

  reconnect() {
    if (!this.connected) {
      console.log('🔄 Reconnecting in 5 seconds...');
      setTimeout(() => this.connect(), 5000);
    }
  }

  // Send login packet
  sendLogin() {
    const imeiBytes = this.imeiToBytes(DEVICE_IMEI);
    const packet = Buffer.from([
      0x78, 0x78,           // Header
      0x0D,                 // Length
      0x01,                 // Login message
      ...imeiBytes,         // IMEI (8 bytes)
      0x00, 0x01,           // Serial number
      0x00, 0x00,           // CRC (will calculate)
      0x0D, 0x0A            // Footer
    ]);

    // Calculate CRC
    const crc = this.calculateCRC(packet.slice(2, packet.length - 4));
    packet.writeUInt16BE(crc, packet.length - 4);

    console.log('📤 Sending login packet:', packet.toString('hex'));
    this.socket.write(packet);

    // Start sending GPS data after login
    setTimeout(() => this.startGPSData(), 2000);
  }

  // Start sending GPS location data
  startGPSData() {
    console.log('🛰️ Starting GPS data transmission...');
    
    // Send GPS data every 10 seconds
    setInterval(() => {
      if (this.connected) {
        this.updateLocation();
        this.sendGPSData();
      }
    }, 10000);

    // Send heartbeat every 5 minutes
    setInterval(() => {
      if (this.connected) {
        this.sendHeartbeat();
      }
    }, 300000);
  }

  // Update location (simulate movement)
  updateLocation() {
    // Simulate movement around Delhi
    this.currentLat += (Math.random() - 0.5) * 0.001; // Small random movement
    this.currentLng += (Math.random() - 0.5) * 0.001;
    this.speed = Math.floor(Math.random() * 80); // 0-80 km/h
    this.course = Math.floor(Math.random() * 360); // 0-359 degrees
    this.ignition = Math.random() > 0.5; // Random ignition state
  }

  // Send GPS location packet
  sendGPSData() {
    const now = new Date();
    
    // Convert coordinates to GT06 format
    const latRaw = Math.round(Math.abs(this.currentLat) * 60 * 30000);
    const lngRaw = Math.round(Math.abs(this.currentLng) * 60 * 30000);
    
    // Flags
    let flags = this.course & 0x03FF; // Course (10 bits)
    flags |= 0x1000; // GPS valid
    if (this.currentLat >= 0) flags |= 0x0400; // North
    if (this.currentLng < 0) flags |= 0x0800; // West
    if (this.ignition) flags |= 0x8000; // Ignition

    const packet = Buffer.alloc(39); // GPS+LBS packet
    let pos = 0;

    // Header
    packet.writeUInt16BE(0x7878, pos); pos += 2;
    packet.writeUInt8(0x22, pos); pos += 1; // Length (34 bytes)
    packet.writeUInt8(0x12, pos); pos += 1; // GPS+LBS message

    // Date/Time (6 bytes)
    packet.writeUInt8(now.getFullYear() - 2000, pos++);
    packet.writeUInt8(now.getMonth() + 1, pos++);
    packet.writeUInt8(now.getDate(), pos++);
    packet.writeUInt8(now.getHours(), pos++);
    packet.writeUInt8(now.getMinutes(), pos++);
    packet.writeUInt8(now.getSeconds(), pos++);

    // GPS data length
    packet.writeUInt8(0x0C, pos++); // 12 bytes GPS data

    // Satellites
    packet.writeUInt8(0x08, pos++); // 8 satellites

    // Latitude (4 bytes)
    packet.writeUInt32BE(latRaw, pos); pos += 4;

    // Longitude (4 bytes)
    packet.writeUInt32BE(lngRaw, pos); pos += 4;

    // Speed
    packet.writeUInt8(this.speed, pos++);

    // Course and flags
    packet.writeUInt16BE(flags, pos); pos += 2;

    // LBS data (9 bytes) - dummy data
    packet.writeUInt8(0x00, pos++); // LBS length
    packet.writeUInt16BE(0x01CC, pos); pos += 2; // MCC (India)
    packet.writeUInt8(0x01, pos++); // MNC
    packet.writeUInt16BE(0x0001, pos); pos += 2; // LAC
    packet.writeUInt8(0x00, pos++); // Cell ID (3 bytes)
    packet.writeUInt8(0x00, pos++);
    packet.writeUInt8(0x01, pos++);

    // Serial number
    packet.writeUInt16BE(this.serialNumber++, pos); pos += 2;

    // CRC
    const crc = this.calculateCRC(packet.slice(2, pos));
    packet.writeUInt16BE(crc, pos); pos += 2;

    // Footer
    packet.writeUInt8(0x0D, pos++);
    packet.writeUInt8(0x0A, pos++);

    const finalPacket = packet.slice(0, pos);
    
    console.log('📍 Sending GPS data:');
    console.log(`   Lat: ${this.currentLat.toFixed(6)}`);
    console.log(`   Lng: ${this.currentLng.toFixed(6)}`);
    console.log(`   Speed: ${this.speed} km/h`);
    console.log(`   Course: ${this.course}°`);
    console.log(`   Ignition: ${this.ignition ? 'ON' : 'OFF'}`);
    console.log(`   HEX: ${finalPacket.toString('hex')}`);
    
    this.socket.write(finalPacket);
  }

  // Send heartbeat
  sendHeartbeat() {
    const packet = Buffer.from([
      0x78, 0x78,           // Header
      0x05,                 // Length
      0x13,                 // Heartbeat message
      0x04,                 // Status (charging)
      0x00, 0x01,           // Serial number
      0x00, 0x00,           // CRC
      0x0D, 0x0A            // Footer
    ]);

    const crc = this.calculateCRC(packet.slice(2, packet.length - 4));
    packet.writeUInt16BE(crc, packet.length - 4);

    console.log('💓 Sending heartbeat');
    this.socket.write(packet);
  }

  // Convert IMEI to bytes
  imeiToBytes(imei) {
    const bytes = [];
    for (let i = 0; i < 8; i++) {
      const byte = parseInt(imei.substr(i * 2, 2) || '0', 10);
      bytes.push(byte);
    }
    return bytes;
  }

  // Calculate CRC16
  calculateCRC(data) {
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
  }
}

// Start simulator
const simulator = new GPSSimulator();
simulator.connect();

// Handle exit
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping GPS simulator...');
  process.exit(0);
});