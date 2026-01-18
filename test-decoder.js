// Test GPS Decoder - Manual Test
const GT06Decoder = require('./protocols/gt06Decoder');

const decoder = new GT06Decoder();

// Sample GPS data packets (common GT06 messages)
const testPackets = [
  {
    name: 'Login Message',
    hex: '787811010123456789012345000100010d0a'
  },
  {
    name: 'GPS Location (India - Delhi area)',
    hex: '787822120f0c1d0b1e2c0a0c1b3c4d5e0064000c1b3c4d5e00640001d9dc0d0a'
  },
  {
    name: 'Heartbeat',
    hex: '78780a2301000100010d0a'
  }
];

console.log('🧪 TESTING GT06 DECODER\n');
console.log('═'.repeat(60));

testPackets.forEach(async (packet, i) => {
  console.log(`\n${i + 1}. ${packet.name}`);
  console.log('HEX:', packet.hex);
  
  try {
    const buffer = Buffer.from(packet.hex, 'hex');
    console.log('Buffer length:', buffer.length);
    
    const result = await decoder.decode(buffer, { deviceId: 'TEST_DEVICE' });
    
    if (result) {
      console.log('✅ Decoded successfully');
      console.log('Type:', result.type);
      
      if (result.position) {
        console.log('Position:');
        console.log('  Latitude:', result.position.latitude);
        console.log('  Longitude:', result.position.longitude);
        console.log('  Valid:', result.position.valid);
        console.log('  Speed:', result.position.speed);
        console.log('  Satellites:', result.position.satellites);
      }
      
      if (result.imei) {
        console.log('IMEI:', result.imei);
      }
    } else {
      console.log('❌ Decode failed - returned null');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
  
  console.log('─'.repeat(60));
});

console.log('\n💡 NEXT STEPS:');
console.log('1. Run: node diagnose-gps.js (check database)');
console.log('2. Check your server console for RAW GPS DATA');
console.log('3. Share the HEX data from console here');
console.log('\n📝 If you see "Latitude: 0, Longitude: 0" in console,');
console.log('   it means device has NO GPS FIX yet.');
console.log('   Solution: Keep device near window for 2-5 minutes.\n');
