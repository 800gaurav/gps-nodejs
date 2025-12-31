const net = require('net');

// Test GT06 Device Simulator
class GT06TestClient {
  constructor(imei, host = 'localhost', port = 5027) {
    this.imei = imei;
    this.host = host;
    this.port = port;
    this.socket = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.host);
      
      this.socket.on('connect', () => {
        console.log(`GT06 Test Client connected to ${this.host}:${this.port}`);
        this.connected = true;
        this.sendLogin();
        resolve();
      });

      this.socket.on('data', (data) => {
        console.log('GT06 Received:', data.toString('hex'));
      });

      this.socket.on('error', (error) => {
        console.error('GT06 Connection error:', error);
        reject(error);
      });

      this.socket.on('close', () => {
        console.log('GT06 Connection closed');
        this.connected = false;
      });
    });
  }

  sendLogin() {
    // Create login packet
    const imeiBuffer = Buffer.from(this.imei.padStart(15, '0'));
    const packet = Buffer.alloc(18);
    
    packet.writeUInt16BE(0x7878, 0);  // Header
    packet.writeUInt8(0x0D, 2);       // Length
    packet.writeUInt8(0x01, 3);       // Login message
    
    // IMEI (8 bytes)
    for (let i = 0; i < 8; i++) {
      packet.writeUInt8(parseInt(imeiBuffer.slice(i * 2, i * 2 + 2).toString(), 16), 4 + i);
    }
    
    packet.writeUInt16BE(0x0001, 12); // Type info
    packet.writeUInt16BE(0x0001, 14); // Serial number
    packet.writeUInt16BE(0x0000, 16); // CRC (simplified)
    
    this.socket.write(packet);
    console.log('GT06 Login sent:', packet.toString('hex'));
  }

  sendGPSData(lat = 28.6139, lng = 77.2090, speed = 60) {
    if (!this.connected) return;

    const packet = Buffer.alloc(30);
    let pos = 0;

    // Header
    packet.writeUInt16BE(0x7878, pos); pos += 2;
    packet.writeUInt8(0x16, pos++); // Length
    packet.writeUInt8(0x12, pos++); // GPS LBS message

    // Date time (current)
    const now = new Date();
    packet.writeUInt8(now.getFullYear() - 2000, pos++);
    packet.writeUInt8(now.getMonth() + 1, pos++);
    packet.writeUInt8(now.getDate(), pos++);
    packet.writeUInt8(now.getHours(), pos++);
    packet.writeUInt8(now.getMinutes(), pos++);
    packet.writeUInt8(now.getSeconds(), pos++);

    // GPS length
    packet.writeUInt8(0x0C, pos++);

    // Satellites
    packet.writeUInt8(0x08, pos++);

    // Latitude (convert to protocol format)
    const latValue = Math.round(Math.abs(lat) * 60 * 30000);
    packet.writeUInt32BE(latValue, pos); pos += 4;

    // Longitude (convert to protocol format)  
    const lngValue = Math.round(Math.abs(lng) * 60 * 30000);
    packet.writeUInt32BE(lngValue, pos); pos += 4;

    // Speed
    packet.writeUInt8(speed, pos++);

    // Course and flags
    let flags = 0x1000; // GPS valid
    if (lat >= 0) flags |= 0x0000; else flags |= 0x0400; // North/South
    if (lng >= 0) flags |= 0x0800; else flags |= 0x0000; // East/West
    flags |= 0x8000; // Ignition on
    
    packet.writeUInt16BE(flags, pos); pos += 2;

    // Serial number and CRC
    packet.writeUInt16BE(0x0002, pos); pos += 2;
    packet.writeUInt16BE(0x0000, pos); pos += 2; // CRC

    this.socket.write(packet.slice(0, pos));
    console.log(`GT06 GPS data sent: Lat=${lat}, Lng=${lng}, Speed=${speed}`);
  }

  sendHeartbeat() {
    if (!this.connected) return;

    const packet = Buffer.alloc(10);
    packet.writeUInt16BE(0x7878, 0);  // Header
    packet.writeUInt8(0x05, 2);       // Length
    packet.writeUInt8(0x23, 3);       // Heartbeat
    packet.writeUInt8(0x02, 4);       // Status (ignition on)
    packet.writeUInt16BE(0x0003, 5);  // Serial
    packet.writeUInt16BE(0x0000, 7);  // CRC
    packet.writeUInt8(0x0D, 9);       // End

    this.socket.write(packet);
    console.log('GT06 Heartbeat sent');
  }

  disconnect() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

// Test Teltonika Device Simulator
class TeltonikaTestClient {
  constructor(imei, host = 'localhost', port = 2023) {
    this.imei = imei;
    this.host = host;
    this.port = port;
    this.socket = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.port, this.host);
      
      this.socket.on('connect', () => {
        console.log(`Teltonika Test Client connected to ${this.host}:${this.port}`);
        this.connected = true;
        this.sendLogin();
        resolve();
      });

      this.socket.on('data', (data) => {
        console.log('Teltonika Received:', data.toString('hex'));
      });

      this.socket.on('error', (error) => {
        console.error('Teltonika Connection error:', error);
        reject(error);
      });

      this.socket.on('close', () => {
        console.log('Teltonika Connection closed');
        this.connected = false;
      });
    });
  }

  sendLogin() {
    const imeiBuffer = Buffer.from(this.imei);
    const packet = Buffer.alloc(2 + imeiBuffer.length);
    
    packet.writeUInt16BE(imeiBuffer.length, 0);
    imeiBuffer.copy(packet, 2);
    
    this.socket.write(packet);
    console.log('Teltonika Login sent:', packet.toString('hex'));
  }

  sendGPSData(lat = 28.6139, lng = 77.2090, speed = 60) {
    if (!this.connected) return;

    // Simplified Teltonika AVL packet
    const packet = Buffer.alloc(45);
    let pos = 0;

    // Preamble
    packet.writeUInt32BE(0x00000000, pos); pos += 4;
    
    // Data length
    packet.writeUInt32BE(0x00000025, pos); pos += 4;
    
    // Codec ID
    packet.writeUInt8(0x08, pos++);
    
    // Number of records
    packet.writeUInt8(0x01, pos++);
    
    // Timestamp (current time in milliseconds)
    const timestamp = BigInt(Date.now());
    packet.writeBigUInt64BE(timestamp, pos); pos += 8;
    
    // Priority
    packet.writeUInt8(0x00, pos++);
    
    // Longitude (convert to protocol format)
    const lngValue = Math.round(lng * 10000000);
    packet.writeInt32BE(lngValue, pos); pos += 4;
    
    // Latitude (convert to protocol format)
    const latValue = Math.round(lat * 10000000);
    packet.writeInt32BE(latValue, pos); pos += 4;
    
    // Altitude
    packet.writeUInt16BE(100, pos); pos += 2;
    
    // Angle
    packet.writeUInt16BE(0, pos); pos += 2;
    
    // Satellites
    packet.writeUInt8(8, pos++);
    
    // Speed
    packet.writeUInt16BE(speed, pos); pos += 2;
    
    // IO Event ID
    packet.writeUInt8(0x00, pos++);
    
    // IO Elements count
    packet.writeUInt8(0x00, pos++);
    
    // Number of records (repeat)
    packet.writeUInt8(0x01, pos++);
    
    // CRC
    packet.writeUInt32BE(0x00000000, pos); pos += 4;

    this.socket.write(packet.slice(0, pos));
    console.log(`Teltonika GPS data sent: Lat=${lat}, Lng=${lng}, Speed=${speed}`);
  }

  disconnect() {
    if (this.socket) {
      this.socket.end();
    }
  }
}

// Test both protocols
async function testDevices() {
  console.log('Starting GPS device simulation...');
  
  // Test GT06 device
  const gt06Device = new GT06TestClient('123456789012345');
  await gt06Device.connect();
  
  // Test Teltonika device
  const teltonikaDevice = new TeltonikaTestClient('987654321098765');
  await teltonikaDevice.connect();
  
  // Send test data every 10 seconds
  setInterval(() => {
    const lat = 28.6139 + (Math.random() - 0.5) * 0.01;
    const lng = 77.2090 + (Math.random() - 0.5) * 0.01;
    const speed = Math.floor(Math.random() * 100);
    
    gt06Device.sendGPSData(lat, lng, speed);
    teltonikaDevice.sendGPSData(lat, lng, speed);
  }, 10000);
  
  // Send heartbeat every 30 seconds for GT06
  setInterval(() => {
    gt06Device.sendHeartbeat();
  }, 30000);
  
  console.log('Test devices are running. Press Ctrl+C to stop.');
}

if (require.main === module) {
  testDevices().catch(console.error);
}

module.exports = { GT06TestClient, TeltonikaTestClient };