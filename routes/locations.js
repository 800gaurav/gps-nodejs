const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Location = require('../models/Location');

// Get live location of all devices
router.get('/live', async (req, res) => {
  try {
    const devices = await Device.find({});
    console.log('Total devices:', devices.length);
    console.log('Devices data:', JSON.stringify(devices, null, 2));
    
    const devicesWithLocation = devices.filter(d => {
      const hasLocation = d.lastLatitude != null && d.lastLongitude != null;
      console.log(`Device ${d.imei}: hasLocation=${hasLocation}, lat=${d.lastLatitude}, lng=${d.lastLongitude}`);
      return hasLocation;
    });
    
    res.json({ 
      success: true, 
      count: devicesWithLocation.length,
      total: devices.length,
      devices: devicesWithLocation 
    });
  } catch (error) {
    console.error('Error in /live:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get live location of specific device
router.get('/live/:deviceId', async (req, res) => {
  try {
    const device = await Device.findOne({ 
      $or: [
        { deviceId: req.params.deviceId },
        { imei: req.params.deviceId }
      ]
    });
    
    console.log('Device query:', req.params.deviceId);
    console.log('Device found:', device ? 'Yes' : 'No');
    if (device) {
      console.log('Device details:', JSON.stringify(device, null, 2));
    }
    
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, device });
  } catch (error) {
    console.error('Error in /live/:deviceId:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get location history
router.get('/history/:deviceId', async (req, res) => {
  try {
    const { startDate, endDate, limit = 100 } = req.query;
    
    const query = { deviceId: req.params.deviceId };
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const locations = await Location.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, count: locations.length, locations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
