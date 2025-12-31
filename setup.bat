@echo off
echo Installing GPS Tracking Backend Dependencies...

cd /d "%~dp0"

echo.
echo Installing Node.js dependencies...
call npm install

echo.
echo Creating default admin user...
node -e "
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://localhost:27017/gps_tracker');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: String,
  isActive: Boolean
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
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
      console.log('Default admin user created:');
      console.log('Username: admin');
      console.log('Password: admin123');
      console.log('Email: admin@gps.com');
    } else {
      console.log('Admin user already exists');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin:', error.message);
    process.exit(1);
  }
}

createAdmin();
"

echo.
echo Setup completed successfully!
echo.
echo To start the server:
echo   npm start
echo.
echo To test with simulated devices:
echo   node test-devices.js
echo.
echo Default admin credentials:
echo   Username: admin
echo   Password: admin123
echo   Email: admin@gps.com
echo.
echo Server will run on:
echo   HTTP API: http://localhost:3000
echo   GPS Port 5027: For GT06 devices
echo   GPS Port 2023: For Teltonika devices
echo.
pause