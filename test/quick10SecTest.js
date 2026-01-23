const MockGT06Device = require('./mockGpsDevice');

// Quick 10-second GPS data test
async function test10SecondGPS() {
  console.log('🚀 Starting 10-second GPS data test...\n');
  
  const device = new MockGT06Device('123456789012345');
  device.connect();
  
  setTimeout(() => {
    console.log('🔥 Starting engine...');
    device.startEngine();
    
    console.log('🚗 Setting speed to 60 km/h...');
    device.setSpeed(60);
    
    console.log('🚗 Starting movement...');
    device.startMoving();
    
    console.log('📡 Starting auto reporting every 10 seconds...');
    device.startAutoReporting(10000); // 10 seconds
    
    console.log('\n✅ Mock device will now send GPS data every 10 seconds');
    console.log('📍 Watch the location coordinates change!');
    console.log('🛑 Press Ctrl+C to stop\n');
    
  }, 2000);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping GPS simulator...');
    device.disconnect();
    process.exit(0);
  });
}

if (require.main === module) {
  test10SecondGPS();
}