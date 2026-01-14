const express = require('express');
const router = express.Router();

// Get device info by IMEI
router.get('/:imei', async (req, res) => {
  try {
    const Device = require('../models/Device');
    const Location = require('../models/Location');
    
    const imei = req.params.imei;
    
    // Get device
    const device = await Device.findOne({ imei });
    
    // Get recent locations
    const locations = await Location.find({ deviceId: imei })
      .sort({ timestamp: -1 })
      .limit(10);
    
    // Get GPS protocol stats
    const gpsProtocol = global.gpsProtocol;
    const isConnected = gpsProtocol.deviceSessions.has(imei);
    
    res.json({
      success: true,
      device: device || { imei, status: 'Not registered' },
      isConnected,
      recentLocations: locations,
      locationCount: locations.length,
      hasGPSData: locations.length > 0,
      instructions: locations.length === 0 ? {
        issue: 'Device is connected but not sending GPS data',
        solution: 'Send SMS commands to device',
        commands: [
          'GPRSON# - Enable GPS',
          'TIMER,30# - Set 30 second interval',
          'WHERE# - Request current location',
          'STATUS# - Check device status'
        ]
      } : null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
