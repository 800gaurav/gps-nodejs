const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Location = require('../models/Location');
const { body, validationResult, param } = require('express-validator');

// Get all devices (compatible with frontend)
router.get('/', async (req, res) => {
  try {
    const devices = await Device.find().sort({ createdAt: -1 });
    
    // Transform to match frontend expectations
    const transformedDevices = devices.map(device => ({
      ...device.toJSON(),
      isActive: device.status === 'active' || device.online,
      engineLocked: device.engineLocked || false,
      lastSeen: device.lastSeen || device.updatedAt
    }));
    
    res.json(transformedDevices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get single device
router.get('/:deviceId', 
  param('deviceId').notEmpty().withMessage('Device ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      const device = await Device.findOne({ deviceId });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      res.json({
        ...device.toJSON(),
        isActive: device.status === 'active' || device.online,
        engineLocked: device.engineLocked || false,
        lastSeen: device.lastSeen || device.updatedAt
      });
    } catch (error) {
      console.error('Error fetching device:', error);
      res.status(500).json({ error: 'Failed to fetch device' });
    }
  }
);

// Add new device (compatible with frontend form)
router.post('/',
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('imei').isLength({ min: 15, max: 15 }).withMessage('IMEI must be 15 digits'),
    body('vehicleName').notEmpty().withMessage('Vehicle name is required'),
    body('deviceType').optional().isIn(['GT06', 'TELTONIKA', 'CONCOX', 'OTHER']).withMessage('Invalid device type'),
    body('protocol').optional().isInt({ min: 1, max: 65535 }).withMessage('Invalid protocol port')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const deviceData = req.body;
      
      // Set default values
      deviceData.status = 'active';
      deviceData.online = false;
      deviceData.engineLocked = false;
      deviceData.lastSeen = new Date();
      deviceData.deviceType = deviceData.deviceType || 'GT06';
      deviceData.protocol = deviceData.protocol || 5023;

      // Check if device already exists
      const existingDevice = await Device.findOne({
        $or: [
          { deviceId: deviceData.deviceId },
          { imei: deviceData.imei }
        ]
      });

      if (existingDevice) {
        return res.status(400).json({ 
          error: 'Device already exists',
          field: existingDevice.deviceId === deviceData.deviceId ? 'deviceId' : 'imei'
        });
      }

      const device = new Device(deviceData);
      await device.save();

      console.log('✅ Device created successfully:', device.deviceId);

      res.status(201).json({
        ...device.toJSON(),
        isActive: true,
        engineLocked: false
      });
    } catch (error) {
      console.error('Error creating device:', error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({ 
          error: `${field} already exists`,
          field 
        });
      }
      
      res.status(500).json({ error: 'Failed to create device' });
    }
  }
);

// Engine control endpoints
router.post('/:deviceId/engine/lock',
  param('deviceId').notEmpty().withMessage('Device ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      const { password = '123456' } = req.body;
      
      const device = await Device.findOne({ deviceId });
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Send engine lock command via GPS protocol if available
      let success = false;
      if (global.gpsProtocol) {
        success = await global.gpsProtocol.sendEngineCommand(deviceId, true, password);
      }
      
      // Update device status regardless
      await Device.findOneAndUpdate(
        { deviceId },
        { $set: { engineLocked: true } }
      );
      
      console.log(`🔒 Engine lock command sent to ${deviceId}, success: ${success}`);
      
      res.json({ 
        message: 'Engine lock command sent successfully',
        deviceId,
        status: 'locked',
        commandSent: success
      });
    } catch (error) {
      console.error('Error locking engine:', error);
      res.status(500).json({ error: 'Failed to lock engine' });
    }
  }
);

router.post('/:deviceId/engine/unlock',
  param('deviceId').notEmpty().withMessage('Device ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      const { password = '123456' } = req.body;
      
      const device = await Device.findOne({ deviceId });
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Send engine unlock command via GPS protocol if available
      let success = false;
      if (global.gpsProtocol) {
        success = await global.gpsProtocol.sendEngineCommand(deviceId, false, password);
      }
      
      // Update device status regardless
      await Device.findOneAndUpdate(
        { deviceId },
        { $set: { engineLocked: false } }
      );
      
      console.log(`🔓 Engine unlock command sent to ${deviceId}, success: ${success}`);
      
      res.json({ 
        message: 'Engine unlock command sent successfully',
        deviceId,
        status: 'unlocked',
        commandSent: success
      });
    } catch (error) {
      console.error('Error unlocking engine:', error);
      res.status(500).json({ error: 'Failed to unlock engine' });
    }
  }
);

// Update device
router.put('/:deviceId',
  [
    param('deviceId').notEmpty().withMessage('Device ID is required'),
    body('vehicleName').optional().notEmpty().withMessage('Vehicle name cannot be empty'),
    body('deviceType').optional().isIn(['GT06', 'TELTONIKA', 'CONCOX', 'OTHER']),
    body('status').optional().isIn(['active', 'inactive', 'maintenance', 'offline'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      const device = await Device.findOneAndUpdate(
        { deviceId },
        { $set: req.body },
        { new: true }
      );

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      res.json({
        ...device.toJSON(),
        isActive: device.status === 'active' || device.online,
        engineLocked: device.engineLocked || false
      });
    } catch (error) {
      console.error('Error updating device:', error);
      res.status(500).json({ error: 'Failed to update device' });
    }
  }
);

// Delete device
router.delete('/:deviceId',
  param('deviceId').notEmpty().withMessage('Device ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      const device = await Device.findOneAndDelete({ deviceId });
      
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Delete related location data
      await Location.deleteMany({ deviceId });

      console.log('🗑️ Device deleted:', deviceId);
      res.json({ message: 'Device deleted successfully' });
    } catch (error) {
      console.error('Error deleting device:', error);
      res.status(500).json({ error: 'Failed to delete device' });
    }
  }
);

module.exports = router;