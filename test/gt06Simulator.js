const net = require('net');

class GT06Simulator {
  constructor(host = 'localhost', port = 5023, imei = '123456789012345') {
    this.host = host;
    this.port = port;
    this.socket = null;
    this.imei = imei;
    this.serialNumber = 1;
    this.isLoggedIn = false;
    this.intervalId = null;
    
    // Current position (starting from Delhi)
    this.currentLat = 28.6139;
    this.currentLon = 77.2090;
    this.currentSpeed = 0;
    this.currentCourse = 0;
    this.ignition = false;
    this.charging = true;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      this.socket.connect(this.port, this.host, () => {
        console.log(`🔗 GT06 Device Connected: ${this.imei}`);
        resolve();
      });
      
      this.socket.on('data', (data) => {
        console.log(`📨 Server response: ${data.toString('hex')}`);
        this.handleServerResponse(data);
      });
      
      this.socket.on('error', reject);
      this.socket.on('close', () => {
        console.log('🔌 Connection closed');
        this.stopSimulation();
      });
    });
  }

  handleServerResponse(data) {
    // Server responses are usually acknowledgments
    const hex = data.toString('hex');
    if (hex.startsWith('787805')) {
      console.log('✅ Server acknowledged message');
    }
  }

  // Create login packet
  createLoginPacket() {
    const imeiHex = this.imei.padStart(15, '0');
    const imeiBuffer = Buffer.alloc(8);
    
    // Convert IMEI to BCD format
    for (let i = 0; i < 8; i++) {
      const digit1 = parseInt(imeiHex[i * 2] || '0');
      const digit2 = parseInt(imeiHex[i * 2 + 1] || '0');
      imeiBuffer[i] = (digit1 << 4) | digit2;
    }

    const packet = Buffer.alloc(18);
    packet.writeUInt16BE(0x7878, 0);  // Start
    packet.writeUInt8(0x0D, 2);       // Length
    packet.writeUInt8(0x01, 3);       // Protocol (login)
    imeiBuffer.copy(packet, 4);       // IMEI
    packet.writeUInt16BE(this.serialNumber++, 12); // Serial
    
    // Calculate and append CRC
    const crc = this.calculateCRC(packet.slice(2, 14));
    packet.writeUInt16BE(crc, 14);
    packet.writeUInt16BE(0x0D0A, 16); // Stop
    
    return packet;
  }

  // Create location packet
  createLocationPacket() {
    const packet = Buffer.alloc(35);
    const now = new Date();
    
    packet.writeUInt16BE(0x7878, 0);  // Start
    packet.writeUInt8(0x1F, 2);       // Length
    packet.writeUInt8(0x12, 3);       // Protocol (location)
    
    // Date/Time (6 bytes)
    packet.writeUInt8(now.getFullYear() - 2000, 4);
    packet.writeUInt8(now.getMonth() + 1, 5);
    packet.writeUInt8(now.getDate(), 6);
    packet.writeUInt8(now.getHours(), 7);
    packet.writeUInt8(now.getMinutes(), 8);
    packet.writeUInt8(now.getSeconds(), 9);
    
    // GPS info
    const satCount = 12; // Active satellites
    const satUsed = 10;  // Used satellites
    packet.writeUInt8((satCount << 4) | satUsed, 10);
    
    // Encode coordinates
    const encodedLat = Math.round(Math.abs(this.currentLat) * 60 * 30000);
    const encodedLon = Math.round(Math.abs(this.currentLon) * 60 * 30000);
    
    packet.writeUInt32BE(encodedLat, 11);
    packet.writeUInt32BE(encodedLon, 15);
    
    packet.writeUInt8(this.currentSpeed, 19);
    
    // Course with flags
    let courseFlags = this.currentCourse & 0x3FF;
    courseFlags |= 0x1000; // GPS positioned
    courseFlags |= 0x2000; // Real-time GPS
    if (this.currentLat >= 0) courseFlags |= 0x0400; // North
    if (this.currentLon < 0) courseFlags |= 0x0800;  // West
    
    packet.writeUInt16BE(courseFlags, 20);
    
    // Cell info (dummy data)
    packet.writeUInt16BE(404, 22);    // MCC (India)
    packet.writeUInt8(10, 24);        // MNC
    packet.writeUInt16BE(12345, 25);  // LAC
    packet.writeUInt8(0x12, 27);      // Cell ID (3 bytes)
    packet.writeUInt8(0x34, 28);
    packet.writeUInt8(0x56, 29);
    
    packet.writeUInt16BE(this.serialNumber++, 30);
    
    // Calculate and append CRC
    const crc = this.calculateCRC(packet.slice(2, 32));
    packet.writeUInt16BE(crc, 32);
    packet.writeUInt16BE(0x0D0A, 33); // Stop
    
    return packet;
  }

  // Create status/heartbeat packet
  createStatusPacket() {
    const packet = Buffer.alloc(15);
    
    packet.writeUInt16BE(0x7878, 0);  // Start
    packet.writeUInt8(0x0A, 2);       // Length
    packet.writeUInt8(0x13, 3);       // Protocol (status)
    
    // Terminal info byte
    let terminalInfo = 0;
    if (this.ignition) terminalInfo |= 0x02;
    if (this.charging) terminalInfo |= 0x04;
    terminalInfo |= 0x40; // GPS tracking on
    
    packet.writeUInt8(terminalInfo, 4);
    packet.writeUInt8(0x05, 5);       // Voltage level (high)
    packet.writeUInt8(0x04, 6);       // GSM signal (strong)
    packet.writeUInt16BE(0x0000, 7);  // Reserved
    packet.writeUInt8(0x15, 9);       // Language
    
    // Calculate and append CRC
    const crc = this.calculateCRC(packet.slice(2, 10));
    packet.writeUInt16BE(crc, 10);
    packet.writeUInt16BE(0x0D0A, 12); // Stop
    
    return packet;
  }

  // Simple CRC16 calculation (you can replace with your getCrc16 function)
  calculateCRC(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }

  // Send login and wait for response
  async login() {
    const loginPacket = this.createLoginPacket();
    console.log(`📤 Sending login: ${loginPacket.toString('hex')}`);
    this.socket.write(loginPacket);
    
    // Wait a bit for server response
    await this.sleep(1000);
    this.isLoggedIn = true;
  }

  // Start continuous simulation
  startSimulation(intervalMs = 10000) {
    if (!this.isLoggedIn) {
      console.log('❌ Please login first!');
      return;
    }

    console.log(`🚀 Starting GPS simulation (${intervalMs}ms interval)`);
    
    this.intervalId = setInterval(() => {
      // Simulate movement
      this.simulateMovement();
      
      // Send location update
      const locationPacket = this.createLocationPacket();
      console.log(`📍 Sending location: ${locationPacket.toString('hex')}`);
      this.socket.write(locationPacket);
      
      // Occasionally send status
      if (Math.random() < 0.3) {
        setTimeout(() => {
          const statusPacket = this.createStatusPacket();
          console.log(`💓 Sending heartbeat: ${statusPacket.toString('hex')}`);
          this.socket.write(statusPacket);
        }, 2000);
      }
    }, intervalMs);
  }

  // Simulate realistic movement
  simulateMovement() {
    // Random movement within small area
    const deltaLat = (Math.random() - 0.5) * 0.001; // ~100m
    const deltaLon = (Math.random() - 0.5) * 0.001;
    
    this.currentLat += deltaLat;
    this.currentLon += deltaLon;
    
    // Random speed (0-60 km/h)
    this.currentSpeed = Math.floor(Math.random() * 60);
    
    // Random course (0-359 degrees)
    this.currentCourse = Math.floor(Math.random() * 360);
    
    // Occasionally toggle ignition
    if (Math.random() < 0.1) {
      this.ignition = !this.ignition;
      console.log(`🔑 Ignition: ${this.ignition ? 'ON' : 'OFF'}`);
    }
  }

  stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ Simulation stopped');
    }
  }

  disconnect() {
    this.stopSimulation();
    if (this.socket) {
      this.socket.destroy();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Set custom position
  setPosition(lat, lon) {
    this.currentLat = lat;
    this.currentLon = lon;
    console.log(`📍 Position set to: ${lat}, ${lon}`);
  }

  // Toggle ignition
  toggleIgnition() {
    this.ignition = !this.ignition;
    console.log(`🔑 Ignition: ${this.ignition ? 'ON' : 'OFF'}`);
  }
}

// Usage examples
async function runSimulation() {
  const simulator = new GT06Simulator('localhost', 5023, '123456789012345');
  
  try {
    await simulator.connect();
    await simulator.login();
    
    // Set starting position (Delhi)
    simulator.setPosition(28.6139, 77.2090);
    
    // Start simulation
    simulator.startSimulation(5000); // Every 5 seconds
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down simulator...');
      simulator.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Interactive mode
function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const simulator = new GT06Simulator();
  let connected = false;
  
  console.log('\n🎮 GT06 Interactive Simulator');
  console.log('Commands: connect, login, location, status, start, stop, pos <lat> <lon>, ignition, quit\n');
  
  rl.on('line', async (input) => {
    const [cmd, ...args] = input.trim().split(' ');
    
    try {
      switch (cmd.toLowerCase()) {
        case 'connect':
          await simulator.connect();
          connected = true;
          break;
        case 'login':
          if (!connected) return console.log('❌ Connect first!');
          await simulator.login();
          break;
        case 'location':
          if (!connected) return console.log('❌ Connect first!');
          const locPacket = simulator.createLocationPacket();
          simulator.socket.write(locPacket);
          console.log(`📍 Sent: ${locPacket.toString('hex')}`);
          break;
        case 'status':
          if (!connected) return console.log('❌ Connect first!');
          const statusPacket = simulator.createStatusPacket();
          simulator.socket.write(statusPacket);
          console.log(`💓 Sent: ${statusPacket.toString('hex')}`);
          break;
        case 'start':
          simulator.startSimulation(parseInt(args[0]) || 10000);
          break;
        case 'stop':
          simulator.stopSimulation();
          break;
        case 'pos':
          if (args.length >= 2) {
            simulator.setPosition(parseFloat(args[0]), parseFloat(args[1]));
          }
          break;
        case 'ignition':
          simulator.toggleIgnition();
          break;
        case 'quit':
          simulator.disconnect();
          rl.close();
          process.exit(0);
          break;
        default:
          console.log('Unknown command');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  });
}

// Main execution
if (require.main === module) {
  const mode = process.argv[2] || 'auto';
  
  if (mode === 'interactive') {
    interactiveMode();
  } else {
    runSimulation();
  }
}

module.exports = GT06Simulator;