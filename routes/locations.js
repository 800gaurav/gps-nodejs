const express = require('express');
const router = express.Router();
const locationService = require('../services/locationService');
const auth = require('../middleware/auth');

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