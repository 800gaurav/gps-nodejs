const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const auth = require('../middleware/auth');

// Simple test to find device by IMEI
router.get('/find/:imei', auth, async (req, res) => {
  try {
    const { imei } = req.params;
    
    console.log('Searching for IMEI:', imei);
    
    const device = await Device.findOne({ imei });
    
    if (!device) {
      console.log('Device not found for IMEI:', imei);
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found',
        imei: imei
      });
    }
    
    console.log('Device found:', device.deviceId);
    
    res.json({ 
      success: true, 
      device: {
        _id: device._id,
        deviceId: device.deviceId,
        imei: device.imei,
        vehicleName: device.vehicleName,
        deviceType: device.deviceType,
        userId: device.userId
      }
    });
  } catch (error) {
    console.error('Error finding device:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// List all devices for debugging
router.get('/list-all', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    
    const devices = await Device.find({}).select('deviceId imei vehicleName deviceType userId');
    
    res.json({ 
      success: true, 
      count: devices.length,
      devices 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;