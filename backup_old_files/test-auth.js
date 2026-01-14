const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testAPIs() {
  console.log('Testing GPS Node APIs...\n');

  try {
    // Test User Registration
    console.log('1. Testing User Registration...');
    const userRegister = await axios.post(`${API_BASE}/auth/register`, {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
      mobile: '+1234567890'
    });
    console.log('✅ User Registration:', userRegister.data.message);
    
    // Test User Login
    console.log('\n2. Testing User Login...');
    const userLogin = await axios.post(`${API_BASE}/auth/login`, {
      username: 'testuser',
      password: 'password123'
    });
    console.log('✅ User Login:', userLogin.data.message);
    const userToken = userLogin.data.token;

    // Test Admin Registration
    console.log('\n3. Testing Admin Registration...');
    const adminRegister = await axios.post(`${API_BASE}/auth/admin/register`, {
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',
      name: 'Admin User',
      mobile: '+1234567891',
      adminKey: 'admin123'
    });
    console.log('✅ Admin Registration:', adminRegister.data.message);

    // Test Admin Login
    console.log('\n4. Testing Admin Login...');
    const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    console.log('✅ Admin Login:', adminLogin.data.message);
    const adminToken = adminLogin.data.token;

    // Test Profile Access
    console.log('\n5. Testing Profile Access...');
    const profile = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    console.log('✅ Profile Access:', profile.data.user.name, '- Role:', profile.data.user.role);

    console.log('\n🎉 All APIs working correctly!');

  } catch (error) {
    console.error('❌ API Test Failed:', error.response?.data || error.message);
  }
}

// Run tests
testAPIs();