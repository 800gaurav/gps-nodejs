const net = require('net');

class RawGT06Sender {
  constructor(host = 'localhost', port = 5023) {
    this.host = host;
    this.port = port;
    this.socket = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      this.socket.connect(this.port, this.host, () => {
        console.log(`🔗 Connected to ${this.host}:${this.port}`);
        resolve();
      });
      
      this.socket.on('data', (data) => {
        console.log(`📨 Server response: ${data.toString('hex')}`);
      });
      
      this.socket.on('error', reject);
    });
  }

  sendRawHex(hexString) {
    const buffer = Buffer.from(hexString.replace(/\s/g, ''), 'hex');
    console.log(`📤 Sending: ${buffer.toString('hex')}`);
    analyzePacket(hexString);
    this.socket.write(buffer);
  }

  disconnect() {
    if (this.socket) {
      this.socket.destroy();
    }
  }
}

// Pre-defined GT06 packets for testing (Real hex data from test cases)
const GT06_PACKETS = {
  // Login packet for IMEI 123456789012345 (from test)
  login: '78780d01012345678901234500018cdd0d0a',
  
  // Real location packet with GPS coordinates (Germany)
  location: '78781f1211071403362aca0543ec4f00ff976e021549010603e6b500e7590074763d0d0a',
  
  // Status/Heartbeat packet (from test)
  heartbeat: '78780a13400504000000153dc20d0a',
  
  // Another location packet with different timestamp
  location2: '78781f12130c14080723ca055cb28600e77082003400010603b7ac00b9b0002f6b020d0a',
  
  // Location with different time (from test)
  location3: '78781f1213051d0d2506c8055dae3900ec0a9584355f010603b7fc0095fe0030bfb30d0a',
  
  // Multiple locations in one packet
  multipleLocations: '78781f1211071403362aca0543ec4f00ff976e021549010603e6b500e7590074763d0d0a78781f1211072403362aca0543ec4f00ff976e021549010603e6b500e7590074763d0d0a',
  
  // Alarm packet (0x16 protocol)
  alarm: '787826160c0a0d0e2d3200000000000000000000000000000000000000000000000000000000120001040d0a'
};

// Packet analysis function
function analyzePacket(hexString) {
  const buffer = Buffer.from(hexString, 'hex');
  const protocol = buffer[3];
  
  let type = 'unknown';
  switch (protocol) {
    case 0x01: type = 'login'; break;
    case 0x12: type = 'location'; break;
    case 0x13: type = 'status/heartbeat'; break;
    case 0x16: type = 'alarm'; break;
  }
  
  console.log(`   📋 Packet Analysis:`);
  console.log(`      Type: ${type} (0x${protocol.toString(16).padStart(2, '0')})`);
  console.log(`      Length: ${buffer[2]} bytes`);
  console.log(`      Serial: ${buffer.readUInt16BE(buffer.length - 6)}`);
  
  if (protocol === 0x01) {
    const imei = parseInt(buffer.slice(4, 12).toString('hex'), 10);
    console.log(`      IMEI: ${imei}`);
  }
  
  if (protocol === 0x12) {
    // Parse location data
    const year = 2000 + buffer[4];
    const month = buffer[5];
    const day = buffer[6];
    const hour = buffer[7];
    const minute = buffer[8];
    const second = buffer[9];
    console.log(`      DateTime: ${year}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')} ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}:${second.toString().padStart(2,'0')}`);
    
    const quantity = buffer[10];
    const satCount = (quantity & 0xF0) >> 4;
    const satUsed = quantity & 0x0F;
    console.log(`      Satellites: ${satCount} visible, ${satUsed} used`);
  }
}

async function testRawPackets() {
  const sender = new RawGT06Sender();
  
  try {
    await sender.connect();
    
    console.log('\n🧪 Testing Raw GT06 Packets...\n');
    
    // Send login
    console.log('1. Sending Login Packet...');
    sender.sendRawHex(GT06_PACKETS.login);
    await sleep(2000);
    
    // Send location
    console.log('2. Sending Location Packet (Germany coordinates)...');
    sender.sendRawHex(GT06_PACKETS.location);
    await sleep(2000);
    
    // Send heartbeat
    console.log('3. Sending Heartbeat/Status...');
    sender.sendRawHex(GT06_PACKETS.heartbeat);
    await sleep(2000);
    
    // Send another location
    console.log('4. Sending Another Location...');
    sender.sendRawHex(GT06_PACKETS.location2);
    await sleep(2000);
    
    // Send multiple locations
    console.log('5. Sending Multiple Locations in One Packet...');
    sender.sendRawHex(GT06_PACKETS.multipleLocations);
    await sleep(2000);
    
    console.log('\n✅ Raw packet test completed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    sender.disconnect();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Interactive mode for custom hex packets
function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const sender = new RawGT06Sender();
  
  sender.connect().then(() => {
    console.log('\n📡 Interactive Raw Packet Sender');
    console.log('Enter hex packets (without spaces) or commands:');
    console.log('Commands: login, location, location2, location3, heartbeat, multipleLocations, alarm, quit\n');
    
    rl.on('line', (input) => {
      const cmd = input.trim().toLowerCase();
      
      if (cmd === 'quit') {
        sender.disconnect();
        rl.close();
        process.exit(0);
      } else if (GT06_PACKETS[cmd]) {
        sender.sendRawHex(GT06_PACKETS[cmd]);
      } else if (/^[0-9a-fA-F]+$/.test(cmd)) {
        sender.sendRawHex(cmd);
      } else {
        console.log('Invalid input. Enter hex string or command (login, location, heartbeat, quit)');
      }
    });
  }).catch(console.error);
}

// Main execution
if (require.main === module) {
  const mode = process.argv[2] || 'test';
  
  if (mode === 'interactive') {
    interactiveMode();
  } else {
    testRawPackets();
  }
}