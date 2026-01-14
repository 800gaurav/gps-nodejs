const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Location = require('../models/Location');

// Get live location of all devices
router.get('/live', async (req, res) => {
  try {
    const devices = await Device.find({ online: true });
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get live location of specific device
router.get('/live/:deviceId', async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, device });
  } catch (error) {
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
