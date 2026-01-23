const os = require('os');

function getNetworkIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  console.log('🌐 Available Network IPs:\n');
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({
          interface: name,
          ip: iface.address,
          type: iface.address.startsWith('192.168') ? 'Local Network' : 
                iface.address.startsWith('10.') ? 'Local Network' :
                iface.address.startsWith('172.') ? 'Local Network' : 'Public'
        });
        
        console.log(`📡 ${name}: ${iface.address} (${iface.address.startsWith('192.168') ? 'Local Network' : 'Other'})`);
      }
    }
  }
  
  console.log('\n💡 Usage Examples:');
  console.log('Same computer: localhost or 127.0.0.1');
  
  if (ips.length > 0) {
    const localIP = ips.find(ip => ip.type === 'Local Network');
    if (localIP) {
      console.log(`Different computer: ${localIP.ip}`);
      console.log(`\nExample:`);
      console.log(`const device = new MockGT06Device('123456789012345', '${localIP.ip}', 5023);`);
    }
  }
  
  return ips;
}

if (require.main === module) {
  getNetworkIPs();
}