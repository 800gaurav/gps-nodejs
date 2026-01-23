const GPSDeviceSimulator = require('./gps-device-simulator');

console.log('🎮 GPS Device Simulator Test Runner');
console.log('==================================');

const scenarios = {
  single: () => {
    console.log('📱 Testing single device...');
    const device = new GPSDeviceSimulator('357803372674636');
    device.connect();
    
    setTimeout(() => {
      console.log('🎭 Simulating engine start...');
      device.simulateEngineStart();
    }, 15000);
    
    setTimeout(() => {
      console.log('🚨 Simulating alarm...');
      device.simulateAlarm();
    }, 25000);
    
    return device;
  },

  multiple: () => {
    console.log('📱 Testing multiple devices...');
    const devices = [
      new GPSDeviceSimulator('357803372674636'),
      new GPSDeviceSimulator('357803372674637'),
      new GPSDeviceSimulator('357803372674638')
    ];
    
    devices.forEach((device, index) => {
      setTimeout(() => {
        device.connect();
      }, index * 3000);
    });
    
    return devices;
  },

  stress: () => {
    console.log('🔥 Stress testing with 10 devices...');
    const devices = [];
    
    for (let i = 0; i < 10; i++) {
      const imei = `35780337267463${i.toString().padStart(1, '0')}`;
      const device = new GPSDeviceSimulator(imei);
      devices.push(device);
      
      setTimeout(() => {
        device.connect();
      }, i * 1000);
    }
    
    return devices;
  },

  realtime: () => {
    console.log('⚡ Real-time GPS tracking simulation...');
    const device = new GPSDeviceSimulator('357803372674636');
    device.connect();
    
    // Override update interval for faster updates
    const originalStart = device.startPeriodicMessages;
    device.startPeriodicMessages = function() {
      this.intervals.heartbeat = setInterval(() => {
        if (this.connected && this.authenticated) {
          const heartbeat = this.createHeartbeatMessage();
          console.log(`💓 HEARTBEAT: ${heartbeat.toString('hex')}`);
          this.socket.write(heartbeat);
        }
      }, 60000); // 1 minute
      
      this.intervals.gps = setInterval(() => {
        if (this.connected && this.authenticated) {
          this.updateLocation();
          const gpsMsg = this.createGPSMessage();
          console.log(`📍 GPS: ${gpsMsg.toString('hex')}`);
          this.socket.write(gpsMsg);
        }
      }, 5000); // 5 seconds for real-time feel
    };
    
    return device;
  }
};

// Get scenario from command line
const scenario = process.argv[2] || 'single';

if (!scenarios[scenario]) {
  console.log('❌ Invalid scenario. Available options:');
  console.log('  single   - Test single device');
  console.log('  multiple - Test 3 devices');
  console.log('  stress   - Test 10 devices');
  console.log('  realtime - Real-time GPS updates');
  console.log('');
  console.log('Usage: node run-simulator.js [scenario]');
  process.exit(1);
}

console.log(`🚀 Running scenario: ${scenario}`);
console.log('Press Ctrl+C to stop\n');

const devices = scenarios[scenario]();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  
  if (Array.isArray(devices)) {
    devices.forEach(device => device.disconnect());
  } else if (devices && devices.disconnect) {
    devices.disconnect();
  }
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});