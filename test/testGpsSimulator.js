const MockGT06Device = require('./mockGpsDevice');

// Test scenarios
async function testBasicDevice() {
  console.log('\n🚀 Testing Basic Device Connection...\n');
  
  const device = new MockGT06Device('123456789012345');
  device.connect();
  
  // Wait for connection
  setTimeout(() => {
    device.startAutoReporting(10000); // Send location every 10 seconds
  }, 2000);
  
  return device;
}

async function testMovingVehicle() {
  console.log('\n🚗 Testing Moving Vehicle...\n');
  
  const device = new MockGT06Device('123456789012346');
  device.connect();
  
  setTimeout(() => {
    device.startEngine();
    device.setSpeed(60);
    device.startMoving();
    device.startAutoReporting(5000); // Send location every 5 seconds
  }, 2000);
  
  return device;
}

async function testEngineControl() {
  console.log('\n🔧 Testing Engine Control...\n');
  
  const device = new MockGT06Device('123456789012347');
  device.connect();
  
  setTimeout(() => {
    device.startAutoReporting(8000);
    
    // Simulate engine start/stop cycle
    setTimeout(() => device.startEngine(), 5000);
    setTimeout(() => device.setSpeed(40), 10000);
    setTimeout(() => device.stopEngine(), 20000);
    setTimeout(() => device.startEngine(), 30000);
    
  }, 2000);
  
  return device;
}

async function testMultipleDevices() {
  console.log('\n🚛 Testing Multiple Devices...\n');
  
  const devices = [];
  
  // Create 3 different devices
  for (let i = 1; i <= 3; i++) {
    const imei = `12345678901234${i}`;
    const device = new MockGT06Device(imei);
    
    device.lat = 28.6139 + (i * 0.01); // Different locations
    device.lng = 77.2090 + (i * 0.01);
    
    device.connect();
    
    setTimeout(() => {
      if (i % 2 === 0) {
        device.startEngine();
        device.setSpeed(30 + (i * 10));
        device.startMoving();
      }
      device.startAutoReporting(15000);
    }, i * 1000);
    
    devices.push(device);
  }
  
  return devices;
}

// Interactive CLI
function startInteractiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const device = new MockGT06Device('999999999999999');
  device.connect();
  
  setTimeout(() => {
    device.startAutoReporting(20000);
    showMenu();
  }, 2000);
  
  function showMenu() {
    console.log('\n📱 Interactive GPS Device Control:');
    console.log('1. Start Engine');
    console.log('2. Stop Engine');
    console.log('3. Set Speed (km/h)');
    console.log('4. Send Location Now');
    console.log('5. Start Moving');
    console.log('6. Stop Moving');
    console.log('7. Exit');
    console.log('Enter choice: ');
  }
  
  rl.on('line', (input) => {
    const choice = input.trim();
    
    switch(choice) {
      case '1':
        device.startEngine();
        break;
      case '2':
        device.stopEngine();
        break;
      case '3':
        rl.question('Enter speed (0-200): ', (speed) => {
          device.setSpeed(parseInt(speed) || 0);
          showMenu();
        });
        return;
      case '4':
        device.sendLocationMessage();
        break;
      case '5':
        device.startMoving();
        break;
      case '6':
        device.stopMoving();
        break;
      case '7':
        device.disconnect();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid choice');
    }
    
    setTimeout(showMenu, 1000);
  });
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'basic';
  
  console.log('🧪 GPS Device Simulator Started');
  console.log('Make sure your GPS server is running on port 5023\n');
  
  switch(mode) {
    case 'basic':
      testBasicDevice();
      break;
    case 'moving':
      testMovingVehicle();
      break;
    case 'engine':
      testEngineControl();
      break;
    case 'multiple':
      testMultipleDevices();
      break;
    case 'interactive':
      startInteractiveMode();
      break;
    default:
      console.log('Usage: node testGpsSimulator.js [basic|moving|engine|multiple|interactive]');
      process.exit(1);
  }
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down GPS simulator...');
    process.exit(0);
  });
}