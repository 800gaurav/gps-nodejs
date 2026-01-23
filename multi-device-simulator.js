// Multi-Device GPS Simulator
const net = require('net');

const SERVER_HOST = 'node.genzteck.com';
const SERVER_PORT = 5027;

// Test devices with different locations
const TEST_DEVICES = [
  { imei: '111111111111111', name: 'Delhi Car', lat: 28.6139, lng: 77.2090 },
  { imei: '222222222222222', name: 'Mumbai Car', lat: 19.0760, lng: 72.8777 },
  { imei: '333333333333333', name: 'Bangalore Car', lat: 12.9716, lng: 77.5946 }
];

class MultiDeviceSimulator {
  constructor() {
    this.devices = [];
  }

  start() {
    console.log(`🚀 Starting Multi-Device GPS Simulator...`);
    console.log(`📡 Server: ${SERVER_HOST}:${SERVER_PORT}`);
    console.log(`📱 Devices: ${TEST_DEVICES.length}`);

    TEST_DEVICES.forEach((deviceConfig, index) => {
      setTimeout(() => {
        const device = new GPSDevice(deviceConfig);
        device.connect();
        this.devices.push(device);
      }, index * 2000); // Stagger connections
    });
  }
}

class GPSDevice {
  constructor(config) {
    this.imei = config.imei;
    this.name = config.name;
    this.currentLat = config.lat;
    this.currentLng = config.lng;
    this.socket = null;
    this.connected = false;
    this.serialNumber = 1;
    this.speed = 0;
    this.course = 0;
    this.ignition = false;
  }

  connect() {
    console.log(`🔌 Connecting ${this.name} (${this.imei})...`);
    
    this.socket = net.createConnection({ 
      port: SERVER_PORT, 
      host: SERVER_HOST 
    }, () => {
      console.log(`✅ ${this.name} connected!`);
      this.connected = true;
      this.sendLogin();
    });

    this.socket.on('data', (data) => {
      console.log(`📨 ${this.name} response:`, data.toString('hex'));
    });

    this.socket.on('error', (err) => {
      console.error(`❌ ${this.name} error:`, err.message);
    });

    this.socket.on('close', () => {
      console.log(`🔌 ${this.name} disconnected`);
      this.connected = false;
    });
  }

  sendLogin() {
    const imeiBytes = this.imeiToBytes(this.imei);
    const packet = Buffer.from([
      0x78, 0x78, 0x0D, 0x01,
      ...imeiBytes,
      0x00, 0x01, 0x00, 0x00, 0x0D, 0x0A
    ]);

    const crc = this.calculateCRC(packet.slice(2, packet.length - 4));
    packet.writeUInt16BE(crc, packet.length - 4);

    this.socket.write(packet);
    
    // Start GPS data after login
    setTimeout(() => this.startGPSData(), 3000);
  }

  startGPSData() {
    console.log(`🛰️ ${this.name} starting GPS transmission...`);
    
    // Send GPS data every 15 seconds (staggered)
    setInterval(() => {
      if (this.connected) {
        this.updateLocation();
        this.sendGPSData();
      }
    }, 15000 + Math.random() * 5000); // Random interval
  }

  updateLocation() {
    // Simulate realistic movement
    this.currentLat += (Math.random() - 0.5) * 0.002;
    this.currentLng += (Math.random() - 0.5) * 0.002;
    this.speed = Math.floor(Math.random() * 100);
    this.course = Math.floor(Math.random() * 360);
    this.ignition = Math.random() > 0.3; // 70% chance ON
  }

  sendGPSData() {
    const now = new Date();
    const latRaw = Math.round(Math.abs(this.currentLat) * 60 * 30000);
    const lngRaw = Math.round(Math.abs(this.currentLng) * 60 * 30000);
    
    let flags = this.course & 0x03FF;
    flags |= 0x1000; // GPS valid
    if (this.currentLat >= 0) flags |= 0x0400;
    if (this.currentLng < 0) flags |= 0x0800;
    if (this.ignition) flags |= 0x8000;

    const packet = Buffer.alloc(39);
    let pos = 0;

    packet.writeUInt16BE(0x7878, pos); pos += 2;
    packet.writeUInt8(0x22, pos); pos += 1;
    packet.writeUInt8(0x12, pos); pos += 1;

    packet.writeUInt8(now.getFullYear() - 2000, pos++);
    packet.writeUInt8(now.getMonth() + 1, pos++);
    packet.writeUInt8(now.getDate(), pos++);
    packet.writeUInt8(now.getHours(), pos++);
    packet.writeUInt8(now.getMinutes(), pos++);
    packet.writeUInt8(now.getSeconds(), pos++);

    packet.writeUInt8(0x0C, pos++);
    packet.writeUInt8(0x08, pos++);
    packet.writeUInt32BE(latRaw, pos); pos += 4;
    packet.writeUInt32BE(lngRaw, pos); pos += 4;
    packet.writeUInt8(this.speed, pos++);
    packet.writeUInt16BE(flags, pos); pos += 2;

    // LBS dummy data
    packet.writeUInt8(0x00, pos++);
    packet.writeUInt16BE(0x01CC, pos); pos += 2;
    packet.writeUInt8(0x01, pos++);
    packet.writeUInt16BE(0x0001, pos); pos += 2;
    packet.writeUInt8(0x00, pos++);
    packet.writeUInt8(0x00, pos++);
    packet.writeUInt8(0x01, pos++);

    packet.writeUInt16BE(this.serialNumber++, pos); pos += 2;

    const crc = this.calculateCRC(packet.slice(2, pos));
    packet.writeUInt16BE(crc, pos); pos += 2;

    packet.writeUInt8(0x0D, pos++);
    packet.writeUInt8(0x0A, pos++);

    const finalPacket = packet.slice(0, pos);
    
    console.log(`📍 ${this.name}: ${this.currentLat.toFixed(4)}, ${this.currentLng.toFixed(4)} | ${this.speed}km/h | ${this.ignition ? 'ON' : 'OFF'}`);
    
    this.socket.write(finalPacket);
  }

  imeiToBytes(imei) {
    const bytes = [];
    for (let i = 0; i < 8; i++) {
      const byte = parseInt(imei.substr(i * 2, 2) || '0', 10);
      bytes.push(byte);
    }
    return bytes;
  }

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

// Start multi-device simulator
const simulator = new MultiDeviceSimulator();
simulator.start();

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping all simulators...');
  process.exit(0);
});