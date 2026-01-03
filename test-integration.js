const axios = require('axios');

async function testIntegration() {
  console.log('🧪 Testing GPS Web React Integration...\n');

  try {
    // Test 1: Check if backend is running
    console.log('1. Testing Backend Health...');
    const health = await axios.get('http://localhost:3000/health');
    console.log('✅ Backend Status:', health.data.status);

    // Test 2: Create admin user
    console.log('\n2. Creating Admin User...');
    try {
      const adminResponse = await axios.post('http://localhost:3000/api/auth/register', {
        username: 'admin',
        email: 'admin@gps.com',
        password: 'admin123',
        name: 'Administrator',
        mobile: '+1234567890'
      });
      console.log('✅ Admin Created:', adminResponse.data.message);
    } catch (error) {
      if (error.response?.data?.error?.includes('already exists')) {
        console.log('✅ Admin Already Exists');
      } else {
        throw error;
      }
    }

    // Test 3: Test Login API
    console.log('\n3. Testing Login API...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ Login Success:', loginResponse.data.user.name, '- Role:', loginResponse.data.user.role);
    const token = loginResponse.data.token;

    // Test 4: Test Protected Route
    console.log('\n4. Testing Protected Route...');
    const profileResponse = await axios.get('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profile Access:', profileResponse.data.user.name);

    // Test 5: Test Devices API
    console.log('\n5. Testing Devices API...');
    const devicesResponse = await axios.get('http://localhost:3000/api/devices', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Devices API:', devicesResponse.data.devices?.length || 0, 'devices found');

    console.log('\n🎉 All Integration Tests Passed!');
    console.log('\n📱 Frontend Ready:');
    console.log('- Start React app: cd gps-web-react && npm run dev');
    console.log('- Login with: admin / admin123');
    console.log('- Backend API: http://localhost:3000/api');

  } catch (error) {
    console.error('❌ Integration Test Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testIntegration();