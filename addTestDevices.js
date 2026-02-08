const mongoose = require('mongoose');
require('dotenv').config();

const Device = require('./models/Device');

async function addTestDevices() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gps_tracker');
    console.log('Connected to MongoDB');

    // Clear existing devices
    await Device.deleteMany({});
    console.log('Cleared existing devices');

    // Add test devices
    const testDevices = [
      {
        deviceId: 'GT06_001',
        imei: '123456789012345',
        vehicleName: 'Test Car 1',
        online: true,
        lastLatitude: 28.6139,
        lastLongitude: 77.2090,
        speed: 45,
        engineLocked: false
      },
      {
        deviceId: 'GT06_002', 
        imei: '123456789012346',
        vehicleName: 'Test Car 2',
        online: false,
        lastLatitude: 28.7041,
        lastLongitude: 77.1025,
        speed: 0,
        engineLocked: true
      },
      {
        deviceId: 'GT06_003',
        imei: '123456789012347', 
        vehicleName: 'Test Truck',
        online: true,
        lastLatitude: 28.5355,
        lastLongitude: 77.3910,
        speed: 60,
        engineLocked: false
      }
    ];

    for (const deviceData of testDevices) {
      const device = new Device(deviceData);
      await device.save();
      console.log(`✅ Added device: ${device.vehicleName}`);
    }

    console.log('✅ Test devices added successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addTestDevices();