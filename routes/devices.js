const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Location = require('../models/Location');

// Simple validation helper
const validateRequired = (fields, body) => {
  const missing = [];
  for (const field of fields) {
    if (!body[field]) missing.push(field);
  }
  return missing;
};

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
    
    res.json({
      success: true,
      devices: transformedDevices
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch devices' 
    });
  }
});

// Get single device
router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

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
});

// Add new device (compatible with frontend form)
router.post('/', async (req, res) => {
  try {
    const missing = validateRequired(['deviceId', 'imei', 'vehicleName'], req.body);
    if (missing.length > 0) {
      return res.status(400).json({ 
        success: false,
        error: `Missing required fields: ${missing.join(', ')}` 
      });
    }

    const { imei } = req.body;
    if (imei.length !== 15) {
      return res.status(400).json({ 
        success: false,
        error: 'IMEI must be 15 digits' 
      });
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
        success: false,
        error: 'Device already exists',
        field: existingDevice.deviceId === deviceData.deviceId ? 'deviceId' : 'imei'
      });
    }

    const device = new Device(deviceData);
    await device.save();

    console.log('✅ Device created successfully:', device.deviceId);

    res.status(201).json({
      success: true,
      device: {
        ...device.toJSON(),
        isActive: true,
        engineLocked: false
      }
    });
  } catch (error) {
    console.error('Error creating device:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        success: false,
        error: `${field} already exists`,
        field 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create device' 
    });
  }
});

// Engine control endpoints
router.post('/:deviceId/engine/lock', async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

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
});

router.post('/:deviceId/engine/unlock', async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

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
});

// Update device
router.put('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

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
});

// Delete device
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ 
        success: false,
        error: 'Device ID is required' 
      });
    }

    // Try to find by MongoDB _id first, then by deviceId
    let device;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a MongoDB ObjectId
      device = await Device.findByIdAndDelete(id);
    } else {
      // It's a deviceId
      device = await Device.findOneAndDelete({ deviceId: id });
    }
    
    if (!device) {
      return res.status(404).json({ 
        success: false,
        error: 'Device not found' 
      });
    }

    // Delete related location data
    await Location.deleteMany({ deviceId: device.deviceId });

    console.log('🗑️ Device deleted:', device.deviceId);
    res.json({ 
      success: true,
      message: 'Device deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting device:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete device' 
    });
  }
});

module.exports = router;