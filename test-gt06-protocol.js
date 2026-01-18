const GT06Decoder = require('./protocols/gt06Decoder');
const GT06Encoder = require('./protocols/gt06Encoder');

console.log('🧪 GT06 Protocol Test Suite\n');

const decoder = new GT06Decoder();
const encoder = new GT06Encoder();

// Test 1: Login Message
console.log('=== TEST 1: LOGIN MESSAGE ===');
const loginMessage = Buffer.from('787811010123456789012345000287d20d0a', 'hex');
console.log('Input HEX:', loginMessage.toString('hex'));

decoder.decode(loginMessage, null).then(result => {
  if (result) {
    console.log('✅ Login decoded successfully');
    console.log('IMEI:', result.imei);
    console.log('Response HEX:', result.response?.toString('hex'));
    console.log('Response length:', result.response?.length);
  } else {
    console.log('❌ Login decode failed');
  }
}).catch(err => {
  console.log('❌ Login decode error:', err.message);
});

// Test 2: Heartbeat Message
console.log('\n=== TEST 2: HEARTBEAT MESSAGE ===');
const heartbeatMessage = Buffer.from('787808234c000218000f0d0a', 'hex');
console.log('Input HEX:', heartbeatMessage.toString('hex'));

const deviceSession = {
  deviceId: '123456789012345',
  imei: '123456789012345'
};

decoder.decode(heartbeatMessage, deviceSession).then(result => {
  if (result) {
    console.log('✅ Heartbeat decoded successfully');
    console.log('Type:', result.type);
    console.log('Response HEX:', result.response?.toString('hex'));
    console.log('Response length:', result.response?.length);
  } else {
    console.log('❌ Heartbeat decode failed');
  }
}).catch(err => {
  console.log('❌ Heartbeat decode error:', err.message);
});

// Test 3: GPS Message
console.log('\n=== TEST 3: GPS MESSAGE ===');
const gpsMessage = Buffer.from('787825120b081d112e10cc026b3f3e0c46584301cc00287d001fb8000380810001000f0d0a', 'hex');
console.log('Input HEX:', gpsMessage.toString('hex'));

decoder.decode(gpsMessage, deviceSession).then(result => {
  if (result) {
    console.log('✅ GPS decoded successfully');
    console.log('Type:', result.type);
    console.log('Position:', {
      lat: result.position?.latitude,
      lng: result.position?.longitude,
      valid: result.position?.valid,
      speed: result.position?.speed,
      course: result.position?.course
    });
    console.log('Response HEX:', result.response?.toString('hex'));
    console.log('Response length:', result.response?.length);
  } else {
    console.log('❌ GPS decode failed');
  }
}).catch(err => {
  console.log('❌ GPS decode error:', err.message);
});

// Test 4: CRC16 Calculation
console.log('\n=== TEST 4: CRC16 CALCULATION ===');
const testData = Buffer.from('11010123456789012345000287d2', 'hex');
const calculatedCRC = decoder.calculateCRC16X25(testData);
console.log('Test data HEX:', testData.toString('hex'));
console.log('Calculated CRC16:', calculatedCRC.toString(16).padStart(4, '0'));
console.log('Expected CRC16: 87d2');
console.log('CRC Match:', calculatedCRC.toString(16).padStart(4, '0') === '87d2' ? '✅' : '❌');

// Test 5: Command Encoding
console.log('\n=== TEST 5: COMMAND ENCODING ===');
const engineStopCommand = {
  type: 'engineStop',
  parameters: { password: '123456' }
};

const encodedCommand = encoder.encodeCommand('123456789012345', engineStopCommand);
if (encodedCommand) {
  console.log('✅ Engine stop command encoded');
  console.log('Command HEX:', encodedCommand.toString('hex'));
  console.log('Command length:', encodedCommand.length);
} else {
  console.log('❌ Command encoding failed');
}

// Test 6: Response Creation
console.log('\n=== TEST 6: RESPONSE CREATION ===');
const testResponse = decoder.createResponse(false, 0x01, 0x0002);
console.log('✅ Response created');
console.log('Response HEX:', testResponse.toString('hex'));
console.log('Response length:', testResponse.length);

// Expected format: 7878 05 01 0002 CRC 0d0a
const expectedPattern = /^7878050100020[0-9a-f]{4}0d0a$/i;
console.log('Format check:', expectedPattern.test(testResponse.toString('hex')) ? '✅' : '❌');

console.log('\n🏁 GT06 Protocol Test Complete');