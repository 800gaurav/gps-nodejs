const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all devices (Admin gets all, User gets assigned only)
router.get('/', auth, async (req, res) => {
  try {
    let devices;
    
    if (req.user.role === 'admin') {
      devices = await Device.find({}).populate('userId', 'username email name');
    } else {
      devices = await Device.find({ userId: req.user._id });
    }

    res.json({ success: true, devices, count: devices.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add device (Admin only) - IMEI auto-detection
router.post('/add-by-imei', auth, [
  body('imei').isLength({ min: 15, max: 15 }),
  body('vehicleName').notEmpty()
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

    const existingDevice = await Device.findOne({ imei });
    if (existingDevice) {
      return res.status(400).json({ success: false, message: 'Device with this IMEI already exists' });
    }

    // Auto-detect device type and protocol based on IMEI patterns
    let deviceType = 'GT06'; // Default
    let protocol = 5023;
    
    // IMEI pattern detection (you can customize these patterns)
    const imeiPrefix = imei.substring(0, 8);
    
    // Common GT06 IMEI prefixes
    const gt06Prefixes = ['35683607', '35683608', '35683609', '86471503'];
    // Common Teltonika IMEI prefixes  
    const teltonikaPrefix = ['35238507', '35238508'];
    
    if (teltonikaPrefix.some(prefix => imeiPrefix.startsWith(prefix))) {
      deviceType = 'TELTONIKA';
      protocol = 5023;
    }

    const device = new Device({
      deviceId: imei, // Use IMEI as deviceId
      imei,
      deviceType,
      vehicleName,
      protocol,
      userId: null,
      status: 'active'
    });

    await device.save();
    res.status(201).json({ 
      success: true, 
      message: `Device added with auto-detected type: ${deviceType}`, 
      device 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update device (Admin only)
router.put('/:deviceId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can update devices' });
    }

    const { deviceId } = req.params;
    const { vehicleName, deviceType, status } = req.body;

    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    if (vehicleName) device.vehicleName = vehicleName;
    if (deviceType) device.deviceType = deviceType;
    if (status) device.status = status;

    await device.save();
    res.json({ success: true, message: 'Device updated', device });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete device (Admin only)
router.delete('/:deviceId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can delete devices' });
    }

    const { deviceId } = req.params;
    
    const device = await Device.findOneAndDelete({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Assign device to user (Admin only) - flexible search
router.put('/assign/:identifier', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can assign devices' });
    }

    const { identifier } = req.params;
    const { userId } = req.body;

    // Verify user exists if userId provided
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).json({ success: false, message: 'User not found' });
      }
    }

    // Search by deviceId or IMEI
    const device = await Device.findOne({
      $or: [
        { deviceId: identifier },
        { imei: identifier }
      ]
    });
    
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    device.userId = userId || null; // null to unassign
    await device.save();

    const updatedDevice = await Device.findOne({ _id: device._id }).populate('userId', 'username email name');

    res.json({
      success: true,
      message: userId ? 'Device assigned successfully' : 'Device unassigned successfully',
      device: updatedDevice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Bulk assign devices (Admin only)
router.put('/bulk-assign', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can assign devices' });
    }

    const { deviceIds, userId } = req.body;

    if (!Array.isArray(deviceIds)) {
      return res.status(400).json({ success: false, message: 'Device IDs array required' });
    }

    // Verify user exists if userId provided
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(400).json({ success: false, message: 'User not found' });
      }
    }

    const result = await Device.updateMany(
      { deviceId: { $in: deviceIds } },
      { userId: userId || null }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} devices ${userId ? 'assigned' : 'unassigned'}`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unassigned devices (Admin only)
router.get('/unassigned', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const devices = await Device.find({ userId: null });
    res.json({ success: true, devices, count: devices.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get device by deviceId or IMEI (flexible search)
router.get('/search/:identifier', auth, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Search by deviceId or IMEI
    const query = {
      $or: [
        { deviceId: identifier },
        { imei: identifier }
      ]
    };
    
    // If not admin, only show assigned devices
    if (req.user.role !== 'admin') {
      query.userId = req.user._id;
    }

    const device = await Device.findOne(query).populate('userId', 'username email name');
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    res.json({ success: true, device });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test: Get device by IMEI (Admin only - for testing)
router.get('/test/:imei', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { imei } = req.params;
    
    // Simple search by IMEI
    const device = await Device.findOne({ imei });
    
    if (!device) {
      return res.status(404).json({ 
        success: false, 
        message: 'Device not found',
        searchedIMEI: imei
      });
    }

    res.json({ 
      success: true, 
      message: 'Device found!',
      device: {
        _id: device._id,
        deviceId: device.deviceId,
        imei: device.imei,
        vehicleName: device.vehicleName,
        deviceType: device.deviceType
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;