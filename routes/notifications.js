const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');

// Register FCM token
router.post('/fcm/register',
  auth,
  [
    body('token').notEmpty().withMessage('FCM token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token } = req.body;
      const success = await notificationService.registerFCMToken(req.user._id, token);

      if (success) {
        res.json({ message: 'FCM token registered successfully' });
      } else {
        res.status(500).json({ error: 'Failed to register FCM token' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Remove FCM token
router.delete('/fcm/remove',
  auth,
  [
    body('token').notEmpty().withMessage('FCM token is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token } = req.body;
      const success = await notificationService.removeFCMToken(req.user._id, token);

      if (success) {
        res.json({ message: 'FCM token removed successfully' });
      } else {
        res.status(500).json({ error: 'Failed to remove FCM token' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Get notification settings
router.get('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationSettings');
    res.json(user.notificationSettings || {
      ignition: true,
      alerts: true,
      reports: false
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update notification settings
router.put('/settings',
  auth,
  [
    body('ignition').optional().isBoolean(),
    body('alerts').optional().isBoolean(),
    body('reports').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      Object.assign(user.notificationSettings, req.body);
      await user.save();

      res.json(user.notificationSettings);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Test notification
router.post('/test',
  auth,
  async (req, res) => {
    try {
      const success = await notificationService.sendIgnitionNotification(
        'TEST_DEVICE',
        true,
        { latitude: 28.6139, longitude: 77.2090 }
      );

      res.json({ 
        message: 'Test notification sent',
        success 
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;