const axios = require('axios');

async function testDeviceVerify() {
  try {
    // First login to get token
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('Login successful, token received');
    
    // Test device verify endpoint
    const imei = '123456789012345'; // Replace with actual IMEI
    
    const verifyResponse = await axios.get(`http://localhost:3000/api/device/verify/${imei}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Device verify response:', verifyResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.log('Error status:', error.response.status);
      console.log('Error data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testDeviceVerify();