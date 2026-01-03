const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const redisManager = require('../config/redis');

// Use existing Location model
const Location = mongoose.models.Location || require('../models/Location');

// Get real-time device data
router.get('/:imei/live-data', auth, async (req, res) => {
  try {
    const { imei } = req.params;
    
    // Find device by IMEI
    const device = await Device.findOne({ 
      $or: [{ imei }, { deviceId: imei }] 
    }).populate('userId', 'username email name');
    
    if (!device) {
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found' 
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && device.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Get latest location from database
    const latestLocation = await Location.findOne({ 
      deviceId: device.deviceId 
    }).sort({ timestamp: -1 });

    // Try to get real-time data from Redis cache
    let realtimeData = null;
    try {
      realtimeData = await redisManager.getLastLocation(device.deviceId);
    } catch (error) {
      console.log('Redis not available, using database data');
    }

    // Use Redis data if available and newer, otherwise use database
    const locationData = (realtimeData && realtimeData.timestamp > latestLocation?.timestamp) 
      ? realtimeData 
      : latestLocation;

    const response = {
      success: true,
      device: {
        deviceId: device.deviceId,
        imei: device.imei,
        vehicleName: device.vehicleName,
        deviceType: device.deviceType,
        protocol: device.protocol,
        status: device.status,
        online: device.online,
        lastSeen: device.lastSeen
      },
      location: locationData ? {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        speed: locationData.speed || 0,
        course: locationData.course || 0,
        altitude: locationData.altitude || 0,
        ignition: locationData.ignition || false,
        engineOn: locationData.engineOn || false,
        gpsValid: locationData.gpsValid || true,
        satellites: locationData.satellites || 0,
        timestamp: locationData.timestamp,
        address: locationData.address || 'Unknown'
      } : null,
      connectionInfo: {
        serverIP: req.get('host'),
        serverPort: device.protocol,
        deviceConfigured: device.online,
        lastDataReceived: latestLocation?.timestamp || null
      }
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get device connection status
router.get('/:imei/connection-status', auth, async (req, res) => {
  try {
    const { imei } = req.params;
    
    const device = await Device.findOne({ 
      $or: [{ imei }, { deviceId: imei }] 
    });
    
    if (!device) {
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found' 
      });
    }

    // Get server IP for device configuration
    const serverIP = req.get('host').split(':')[0];
    
    const connectionStatus = {
      success: true,
      device: {
        imei: device.imei,
        vehicleName: device.vehicleName,
        deviceType: device.deviceType
      },
      connectionInfo: {
        serverIP: serverIP,
        serverPort: device.protocol,
        protocol: device.deviceType,
        online: device.online,
        lastSeen: device.lastSeen,
        configured: device.online
      },
      configuration: {
        message: `Configure your ${device.deviceType} device with:`,
        serverIP: serverIP,
        port: device.protocol,
        apn: 'internet', // Default APN
        commands: device.deviceType === 'GT06' ? [
          `SERVER,1,${serverIP},${device.protocol},0#`,
          `APN,internet#`,
          `RESET#`
        ] : [
          `setparam 2003:1;2004:${serverIP};2005:${device.protocol}`
        ]
      }
    };

    res.json(connectionStatus);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get device location history (last 24 hours)
router.get('/:imei/history', auth, async (req, res) => {
  try {
    const { imei } = req.params;
    const { hours = 24, limit = 100 } = req.query;
    
    const device = await Device.findOne({ 
      $or: [{ imei }, { deviceId: imei }] 
    });
    
    if (!device) {
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found' 
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && device.userId?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const hoursAgo = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const locations = await Location.find({
      deviceId: device.deviceId,
      timestamp: { $gte: hoursAgo }
    })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .select('latitude longitude speed course ignition engineOn timestamp address');

    res.json({
      success: true,
      device: {
        imei: device.imei,
        vehicleName: device.vehicleName
      },
      history: {
        period: `Last ${hours} hours`,
        count: locations.length,
        locations: locations
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;