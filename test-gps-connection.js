// Test GPS Connection
const net = require('net');

const TEST_PORT = 5023;
const TEST_HOST = 'localhost'; // Change to your server IP for remote test

console.log(`Testing GPS connection on ${TEST_HOST}:${TEST_PORT}...`);

const client = net.createConnection({ port: TEST_PORT, host: TEST_HOST }, () => {
  console.log('✅ Connected to GPS server!');
  
  // Send a test GT06 login packet (example IMEI: 123456789012345)
  // This is a basic login message
  const loginPacket = Buffer.from([
    0x78, 0x78,           // Header
    0x0D,                 // Length
    0x01,                 // Login message
    0x01, 0x23, 0x45, 0x67, 0x89, 0x01, 0x23, 0x45, // IMEI
    0x00, 0x01,           // Serial number
    0xD9, 0xDC,           // CRC
    0x0D, 0x0A            // Footer
  ]);
  
  console.log('Sending test login packet...');
  client.write(loginPacket);
});

client.on('data', (data) => {
  console.log('✅ Received response from server:');
  console.log('Hex:', data.toString('hex'));
  console.log('Length:', data.length);
  client.end();
});

client.on('end', () => {
  console.log('Connection closed');
  process.exit(0);
});

client.on('error', (err) => {
  console.error('❌ Connection error:', err.message);
  process.exit(1);
});

client.on('timeout', () => {
  console.error('❌ Connection timeout');
  client.end();
  process.exit(1);
});

client.setTimeout(5000);
