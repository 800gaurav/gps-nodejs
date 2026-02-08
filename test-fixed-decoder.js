const GT06Decoder = require('./protocols/gt06Decoder');

// Test messages from your logs
const testMessages = [
  {
    name: 'Status Message',
    hex: '78780a130406030b020033988a0d0a'
  },
  {
    name: 'Login Message', 
    hex: '78780d01035780337267463600368bed0d0a'
  },
  {
    name: 'GPS Message',
    hex: '787825120b081d112e10cc026b3f3e0c46584301cc00287d001fb8000380810001000f0d0a'
  }
];

async function testFixedDecoder() {
  const decoder = new GT06Decoder();
  
  console.log('🔧 Testing FIXED GT06 Decoder');
  console.log('='.repeat(50));
  
  for (let i = 0; i < testMessages.length; i++) {
    const testMsg = testMessages[i];
    console.log(`\n📋 ${testMsg.name}`);
    console.log('HEX:', testMsg.hex);
    
    const buffer = Buffer.from(testMsg.hex, 'hex');
    
    try {
      const result = await decoder.decode(buffer, { deviceId: 'TEST_DEVICE' });
      
      if (result) {
        console.log('✅ Decode SUCCESS');
        console.log('   Type:', result.type);
        
        if (result.imei) {
          console.log('   IMEI:', result.imei);
        }
        
        if (result.position) {
          console.log('   Position:');
          console.log('     Lat:', result.position.latitude);
          console.log('     Lng:', result.position.longitude);
          console.log('     Speed:', result.position.speed, 'km/h');
          console.log('     Valid:', result.position.valid);
          console.log('     Satellites:', result.position.satellites);
          console.log('     Ignition:', result.position.ignition);
        }
        
        if (result.response) {
          console.log('   Response: ✅', result.response.length, 'bytes');
          console.log('   Response HEX:', result.response.toString('hex'));
        }
      } else {
        console.log('❌ Decode FAILED - returned null');
      }
    } catch (error) {
      console.log('❌ Decode ERROR:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test completed');
}

testFixedDecoder().catch(console.error);