const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Add device by IMEI only (Production ready)
router.post('/add', auth, [
  body('imei').isLength({ min: 15, max: 15 }).withMessage('IMEI must be 15 digits'),
  body('vehicleName').notEmpty().withMessage('Vehicle name required')
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can add devices' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { imei, vehicleName } = req.body;

    // Check if device already exists
    const existingDevice = await Device.findOne({ 
      $or: [{ imei }, { deviceId: imei }] 
    });
    
    if (existingDevice) {
      return res.status(400).json({ 
        success: false, 
        message: 'Device already exists',
        existingDevice: {
          deviceId: existingDevice.deviceId,
          imei: existingDevice.imei,
          vehicleName: existingDevice.vehicleName
        }
      });
    }

    // Auto-detect device type based on IMEI
    let deviceType = 'GT06';
    let protocol = 5023;
    
    const imeiPrefix = imei.substring(0, 8);
    const teltonikaPrefix = ['35238507', '35238508'];
    
    if (teltonikaPrefix.some(prefix => imeiPrefix.startsWith(prefix))) {
      deviceType = 'TELTONIKA';
      protocol = 5027;
    }

    // Create device
    const device = new Device({
      deviceId: imei,  // Use IMEI as device identifier
      imei,
      deviceType,
      vehicleName,
      protocol,
      userId: null,    // Initially unassigned
      status: 'active'
    });

    await device.save();

    res.status(201).json({ 
      success: true, 
      message: `Device added successfully (${deviceType})`,
      device: {
        _id: device._id,
        deviceId: device.deviceId,
        imei: device.imei,
        vehicleName: device.vehicleName,
        deviceType: device.deviceType,
        protocol: device.protocol,
        status: device.status
      }
    });
  } catch (error) {
    console.error('Add device error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get device by IMEI (for verification)
router.get('/verify/:imei', auth, async (req, res) => {
  try {
    const { imei } = req.params;
    
    const device = await Device.findOne({ 
      $or: [{ imei }, { deviceId: imei }] 
    }).populate('userId', 'username email name');
    
    if (!device) {
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found',
        imei: imei
      });
    }

    res.json({ 
      success: true, 
      device: {
        _id: device._id,
        deviceId: device.deviceId,
        imei: device.imei,
        vehicleName: device.vehicleName,
        deviceType: device.deviceType,
        protocol: device.protocol,
        status: device.status,
        userId: device.userId,
        createdAt: device.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;