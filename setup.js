const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: String,
  isActive: Boolean
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function setup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gps_tracker');
    console.log('Connected to MongoDB');

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const admin = new User({
        username: 'admin',
        email: 'admin@gps.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      await admin.save();
      console.log('✓ Default admin user created:');
      console.log('  Username: admin');
      console.log('  Password: admin123');
      console.log('  Email: admin@gps.com');
    } else {
      console.log('✓ Admin user already exists');
    }

    console.log('\n✓ Setup completed successfully!');
    console.log('\nTo start the server:');
    console.log('  npm start');
    console.log('\nTo test with simulated devices:');
    console.log('  node test-devices.js');
    console.log('\nServer will run on:');
    console.log('  Dashboard: http://localhost:3000');
    console.log('  GPS Port 5027: For GT06 devices');
    console.log('  GPS Port 2023: For Teltonika devices');
    
    process.exit(0);
  } catch (error) {
    console.error('Setup error:', error.message);
    process.exit(1);
  }
}

setup();