const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get devices based on user role
router.get('/', auth, async (req, res) => {
  try {
    let devices;
    
    if (req.user.role === 'admin') {
      // Admin sees all devices
      devices = await Device.find({})
        .populate('userId', 'username email name mobile')
        .sort({ createdAt: -1 });
    } else {
      // User sees only assigned devices
      devices = await Device.find({ userId: req.user._id })
        .populate('userId', 'username email name mobile')
        .sort({ createdAt: -1 });
    }

    res.json({
      success: true,
      devices,
      count: devices.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch devices',
      error: error.message
    });
  }
});

// Add new device (Admin only)
router.post('/add', 
  auth,
  [
    body('deviceId').notEmpty().withMessage('Device ID required'),
    body('imei').isLength({ min: 15, max: 15 }).withMessage('IMEI must be 15 digits'),
    body('deviceType').isIn(['GT06', 'TELTONIKA']).withMessage('Invalid device type'),
    body('vehicleName').notEmpty().withMessage('Vehicle name required')
  ],
  async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admin can add devices'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { deviceId, imei, deviceType, vehicleName } = req.body;

      // Check if device already exists
      const existingDevice = await Device.findOne({
        $or: [{ deviceId }, { imei }]
      });

      if (existingDevice) {
        return res.status(400).json({
          success: false,
          message: 'Device already exists'
        });
      }

      const device = new Device({
        deviceId,
        imei,
        deviceType,
        protocol: deviceType === 'GT06' ? 5023 : 5027,
        vehicleName,
        userId: null, // Initially unassigned
        status: 'active'
      });

      await device.save();

      res.status(201).json({
        success: true,
        message: 'Device added successfully',
        device
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to add device',
        error: error.message
      });
    }
  }
);

// Update device (Admin only)
router.put('/update/:deviceId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can update devices'
      });
    }

    const { deviceId } = req.params;
    const { vehicleName, deviceType, status } = req.body;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    if (vehicleName) device.vehicleName = vehicleName;
    if (deviceType) device.deviceType = deviceType;
    if (status) device.status = status;

    await device.save();

    res.json({
      success: true,
      message: 'Device updated successfully',
      device
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update device',
      error: error.message
    });
  }
});

// Assign device to user (Admin only)
router.put('/assign/:deviceId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can assign devices'
      });
    }

    const { deviceId } = req.params;
    const { userId } = req.body;

    // Verify user exists if userId provided
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    device.userId = userId || null; // Can unassign by passing null
    await device.save();

    const updatedDevice = await Device.findOne({ deviceId })
      .populate('userId', 'username email name mobile');

    res.json({
      success: true,
      message: userId ? 'Device assigned successfully' : 'Device unassigned successfully',
      device: updatedDevice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to assign device',
      error: error.message
    });
  }
});

// Bulk assign devices to user (Admin only)
router.put('/bulk-assign', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can assign devices'
      });
    }

    const { deviceIds, userId } = req.body;

    if (!Array.isArray(deviceIds) || deviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Device IDs array required'
      });
    }

    // Verify user exists if userId provided
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    const result = await Device.updateMany(
      { deviceId: { $in: deviceIds } },
      { userId: userId || null }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} devices ${userId ? 'assigned' : 'unassigned'} successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to assign devices',
      error: error.message
    });
  }
});

// Get unassigned devices (Admin only)
router.get('/unassigned', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const devices = await Device.find({ userId: null })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      devices,
      count: devices.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unassigned devices',
      error: error.message
    });
  }
});

// Get devices by user (Admin only)
router.get('/by-user/:userId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { userId } = req.params;
    const devices = await Device.find({ userId })
      .populate('userId', 'username email name mobile')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      devices,
      count: devices.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user devices',
      error: error.message
    });
  }
});

// Get all users (Admin only)
router.get('/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const users = await User.find({ role: 'user' })
      .select('username email name mobile')
      .sort({ username: 1 });

    // Get device count for each user
    const usersWithDeviceCount = await Promise.all(
      users.map(async (user) => {
        const deviceCount = await Device.countDocuments({ userId: user._id });
        return {
          ...user.toJSON(),
          deviceCount
        };
      })
    );

    res.json({
      success: true,
      users: usersWithDeviceCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// Delete device (Admin only)
router.delete('/:deviceId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can delete devices'
      });
    }

    const { deviceId } = req.params;
    
    const device = await Device.findOneAndDelete({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete device',
      error: error.message
    });
  }
});

module.exports = router;