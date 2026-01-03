const axios = require('axios');

async function testAdminRegister() {
  try {
    console.log('Testing Admin Registration...');
    
    const response = await axios.post('http://localhost:3000/api/auth/admin/register', {
      username: 'testadmin',
      email: 'testadmin@example.com',
      password: 'admin123',
      name: 'Test Admin',
      mobile: '+9876543210',
      adminKey: 'admin123'
    });
    
    console.log('✅ Admin Registration Success:');
    console.log('Message:', response.data.message);
    console.log('User:', response.data.user);
    console.log('Token:', response.data.token ? 'Generated' : 'Not generated');
    
  } catch (error) {
    console.error('❌ Admin Registration Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testAdminRegister();