const express = require('express');
const router = express.Router();
const locationService = require('../services/locationService');
const Device = require('../models/Device');
const Location = require('../models/LocationEnhanced');
const auth = require('../middleware/auth');
const redisManager = require('../config/redis');

// Get all live locations
router.get('/live', auth, async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user._id;
    
    // Get user's devices
    let deviceQuery = {};
    if (userId) deviceQuery.userId = userId;
    
    const devices = await Device.find(deviceQuery).select('deviceId vehicleName');
    const deviceIds = devices.map(d => d.deviceId);
    
    // Get latest locations for all devices
    const locations = await Promise.all(
      deviceIds.map(async (deviceId) => {
        const location = await redisManager.getLastLocation(deviceId);
        const device = devices.find(d => d.deviceId === deviceId);
        return {
          deviceId,
          vehicleName: device?.vehicleName,
          ...location
        };
      })
    );
    
    // Filter out null locations
    const validLocations = locations.filter(loc => loc.latitude && loc.longitude);
    
    res.json(validLocations);
  } catch (error) {
    console.error('Error fetching live locations:', error);
    res.status(500).json({ error: 'Failed to fetch live locations' });
  }
});

// Get live location for specific device
router.get('/live/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Check device access
    let deviceQuery = { deviceId };
    if (req.user.role !== 'admin') {
      deviceQuery.userId = req.user._id;
    }
    
    const device = await Device.findOne(deviceQuery);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    const location = await redisManager.getLastLocation(deviceId);
    
    res.json({
      deviceId,
      vehicleName: device.vehicleName,
      ...location
    });
  } catch (error) {
    console.error('Error fetching live location:', error);
    res.status(500).json({ error: 'Failed to fetch live location' });
  }
});

// Get locations for device
router.get('/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate, limit } = req.query;

    const locations = await locationService.getLocations(
      deviceId, 
      startDate, 
      endDate, 
      { limit: parseInt(limit) || 1000 }
    );

    res.json({ locations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

module.exports = router;