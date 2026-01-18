const GT06Decoder = require('./protocols/gt06Decoder');

// Test the problematic messages from the logs
const testMessages = [
  {
    name: 'Status Message 1',
    hex: '78780a130406030b020033988a0d0a',
    expected: { type: 0x13, index: 0x0200 }
  },
  {
    name: 'Login Message',
    hex: '78780d01035780337267463600368bed0d0a', 
    expected: { type: 0x01, index: 0x0036 }
  },
  {
    name: 'Status Message 2',
    hex: '78780a130406030b020034ec350d0a',
    expected: { type: 0x13, index: 0x0200 }
  },
  {
    name: 'Status Message 3', 
    hex: '78780a130406030b020037deae0d0a',
    expected: { type: 0x13, index: 0x0200 }
  }
];

function analyzeMessage(hexString) {
  const buffer = Buffer.from(hexString, 'hex');
  console.log('\n--- Message Analysis ---');
  console.log('HEX:', hexString);
  console.log('Length:', buffer.length);
  
  if (buffer.length < 10) {
    console.log('❌ Too short');
    return;
  }
  
  const header = buffer.readUInt16BE(0);
  const lengthField = buffer.readUInt8(2);
  const type = buffer.readUInt8(3);
  const expectedLength = 2 + 1 + lengthField + 2; // header + length + data + footer
  
  console.log('Header:', header.toString(16));
  console.log('Length field:', lengthField);
  console.log('Message type:', type.toString(16));
  console.log('Expected total length:', expectedLength);
  console.log('Actual length:', buffer.length);
  
  // Check footer
  const footerPos = buffer.length - 2;
  const footer1 = buffer[footerPos];
  const footer2 = buffer[footerPos + 1];
  console.log('Footer:', footer1.toString(16), footer2.toString(16), footer1 === 0x0D && footer2 === 0x0A ? '✅' : '❌');
  
  // Check index
  const indexPos = buffer.length - 6;
  const index = buffer.readUInt16BE(indexPos);
  console.log('Index position:', indexPos);
  console.log('Index value:', index.toString(16));
  
  // Check CRC
  const crcPos = buffer.length - 4;
  const receivedCRC = buffer.readUInt16BE(crcPos);
  console.log('CRC position:', crcPos);
  console.log('Received CRC:', receivedCRC.toString(16));
  
  return {
    valid: expectedLength === buffer.length && footer1 === 0x0D && footer2 === 0x0A,
    type,
    index,
    lengthField
  };
}

async function testDecoder() {
  const decoder = new GT06Decoder();
  
  console.log('🔧 Testing GT06 Decoder Fixes...');
  console.log('='.repeat(50));
  
  for (let i = 0; i < testMessages.length; i++) {
    const testMsg = testMessages[i];
    console.log(`\n📋 ${testMsg.name}`);
    
    // Analyze message structure first
    const analysis = analyzeMessage(testMsg.hex);
    
    if (!analysis || !analysis.valid) {
      console.log('❌ Message structure invalid');
      continue;
    }
    
    const buffer = Buffer.from(testMsg.hex, 'hex');
    
    try {
      const result = await decoder.decode(buffer, null);
      
      if (result) {
        console.log('✅ Decode successful');
        console.log('   Type:', result.type);
        
        if (result.response) {
          console.log('   Response generated: ✅');
          console.log('   Response HEX:', result.response.toString('hex'));
          console.log('   Response length:', result.response.length);
          
          // Verify response structure
          const respHeader = result.response.readUInt16BE(0);
          const respLength = result.response.readUInt8(2);
          const respType = result.response.readUInt8(3);
          const respIndex = result.response.readUInt16BE(result.response.length - 6);
          
          console.log('   Response type:', respType.toString(16), respType === analysis.type ? '✅' : '❌');
          console.log('   Response index:', respIndex.toString(16), respIndex === analysis.index ? '✅' : '❌');
        } else {
          console.log('   Response generated: ❌');
        }
        
        if (result.imei) {
          console.log('   IMEI:', result.imei);
        }
        
        if (result.position) {
          console.log('   Position data: ✅');
        }
      } else {
        console.log('❌ Decode failed - returned null');
      }
    } catch (error) {
      console.log('❌ Decode error:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test completed');
}

testDecoder().catch(console.error);