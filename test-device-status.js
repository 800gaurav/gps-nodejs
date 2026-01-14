const axios = require('axios');

async function checkDeviceStatus() {
  try {
    // Login first
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful\n');
    
    // Check all devices
    console.log('📋 All Devices:');
    const listResponse = await axios.get('http://localhost:3000/api/device/list', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log(`Found ${listResponse.data.count} devices:`);
    listResponse.data.devices.forEach(device => {
      console.log(`- ${device.imei} (${device.vehicleName}) - ${device.deviceType}`);
    });
    
    // Check specific device status
    const imei = '357803372674636';
    console.log(`\n🔍 Checking device status for IMEI: ${imei}`);
    
    const statusResponse = await axios.get(`http://localhost:3000/api/device/status/${imei}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('\n📊 Device Status:');
    console.log(JSON.stringify(statusResponse.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error:', error.response.status);
      console.log(JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ Error:', error.message);
    }
  }
}

checkDeviceStatus();