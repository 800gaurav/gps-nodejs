const MockGT06Device = require('./mockGpsDevice');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function interactiveSetup() {
  console.log('🚗 GPS Device Tester - Interactive Setup\n');
  
  // Get IMEI
  const imei = await askQuestion('Enter IMEI (default: 123456789012345): ') || '123456789012345';
  
  // Get Server IP
  console.log('\n🌐 Server IP Options:');
  console.log('1. localhost (same computer)');
  console.log('2. 192.168.x.x (different computer on same network)');
  console.log('3. Custom IP address');
  
  const ipChoice = await askQuestion('\nChoose option (1-3): ');
  
  let serverIP;
  switch(ipChoice) {
    case '1':
      serverIP = 'localhost';
      break;
    case '2':
      serverIP = await askQuestion('Enter local network IP (e.g., 192.168.1.100): ');
      break;
    case '3':
      serverIP = await askQuestion('Enter custom IP address: ');
      break;
    default:
      serverIP = 'localhost';
  }
  
  // Get Port
  const port = await askQuestion('Enter GPS port (default: 5023): ') || '5023';
  
  console.log('\n📋 Configuration Summary:');
  console.log(`IMEI: ${imei}`);
  console.log(`Server: ${serverIP}:${port}`);
  
  const confirm = await askQuestion('\nStart mock device? (y/n): ');
  
  if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
    console.log('\n🚀 Starting mock GPS device...\n');
    
    const device = new MockGT06Device(imei, serverIP, parseInt(port));
    device.connect();
    
    setTimeout(() => {
      console.log('\n🎮 Device Controls:');
      console.log('1. Start Engine');
      console.log('2. Stop Engine');
      console.log('3. Set Speed');
      console.log('4. Send Location');
      console.log('5. Start Auto Report (10s)');
      console.log('6. Exit');
      
      deviceControl(device);
    }, 3000);
    
  } else {
    console.log('Setup cancelled.');
    rl.close();
  }
}

async function deviceControl(device) {
  while (true) {
    const choice = await askQuestion('\nEnter choice (1-6): ');
    
    switch(choice) {
      case '1':
        device.startEngine();
        break;
      case '2':
        device.stopEngine();
        break;
      case '3':
        const speed = await askQuestion('Enter speed (0-200): ');
        device.setSpeed(parseInt(speed) || 0);
        break;
      case '4':
        device.sendLocationMessage();
        break;
      case '5':
        device.startAutoReporting(10000); // 10 seconds
        device.startMoving();
        console.log('✅ Auto reporting started (every 10 seconds)');
        break;
      case '6':
        device.disconnect();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('Invalid choice');
    }
  }
}

// Start interactive setup
interactiveSetup().catch(console.error);