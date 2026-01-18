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
      protocol = 5023;
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

// Get all devices (to check if device is added)
router.get('/list', auth, async (req, res) => {
  try {
    const devices = await Device.find({})
      .populate('userId', 'username email name')
      .sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      count: devices.length,
      devices: devices.map(device => ({
        _id: device._id,
        deviceId: device.deviceId,
        imei: device.imei,
        vehicleName: device.vehicleName,
        deviceType: device.deviceType,
        protocol: device.protocol,
        status: device.status,
        userId: device.userId,
        createdAt: device.createdAt,
        lastSeen: device.lastSeen
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Check device connection status
router.get('/status/:imei', auth, async (req, res) => {
  try {
    const { imei } = req.params;
    const mongoose = require('mongoose');
    
    // Get Location model safely
    let Location;
    try {
      Location = mongoose.model('Location');
    } catch (error) {
      Location = require('../models/Location');
    }
    
    // Find device
    const device = await Device.findOne({ 
      $or: [{ imei }, { deviceId: imei }] 
    });
    
    if (!device) {
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found in database',
        imei: imei,
        suggestion: 'Please add device first using POST /api/device/add'
      });
    }

    // Check latest location
    const latestLocation = await Location.findOne({ 
      deviceId: imei 
    }).sort({ timestamp: -1 });

    const now = new Date();
    let connectionStatus = 'never_connected';
    let lastSeenMinutes = null;
    
    if (latestLocation) {
      const timeDiff = now - new Date(latestLocation.timestamp);
      lastSeenMinutes = Math.floor(timeDiff / (1000 * 60));
      
      if (lastSeenMinutes < 5) {
        connectionStatus = 'online';
      } else if (lastSeenMinutes < 30) {
        connectionStatus = 'recently_online';
      } else {
        connectionStatus = 'offline';
      }
    }

    res.json({ 
      success: true,
      device: {
        deviceId: device.deviceId,
        imei: device.imei,
        vehicleName: device.vehicleName,
        deviceType: device.deviceType,
        protocol: device.protocol,
        status: device.status,
        addedAt: device.createdAt
      },
      connection: {
        status: connectionStatus,
        lastSeen: latestLocation ? latestLocation.timestamp : null,
        lastSeenMinutesAgo: lastSeenMinutes,
        hasEverConnected: !!latestLocation
      },
      troubleshooting: {
        serverIP: 'Your server IP here',
        port: device.protocol || 5023,
        deviceConfiguration: `SERVER,1,YOUR_SERVER_IP,${device.protocol || 5023},0#`,
        possibleIssues: [
          latestLocation ? null : 'Device never sent data - check device configuration',
          connectionStatus === 'offline' ? 'Device offline - check power and network' : null,
          'Verify APN settings on device',
          'Check if device has active SIM card with data plan'
        ].filter(Boolean)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;