const express = require('express');
const router = express.Router();
const Device = require('../models/Device');

// Send command to device
router.post('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command, password = '123456' } = req.body;
    
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    if (!device.online) {
      return res.status(400).json({ 
        success: false, 
        error: 'Device is offline. Cannot send command.' 
      });
    }

    // Get GPS protocol instance from global
    const gpsProtocol = global.gpsProtocol;
    if (!gpsProtocol) {
      return res.status(500).json({ 
        success: false, 
        error: 'GPS protocol not initialized' 
      });
    }

    let success = false;
    let message = '';

    switch (command) {
      case 'engineStop':
      case 'lock':
        success = await gpsProtocol.sendEngineCommand(deviceId, true, password);
        message = success ? 'Engine lock command sent' : 'Failed to send engine lock command';
        if (success) {
          device.engineLocked = true;
          await device.save();
        }
        break;

      case 'engineResume':
      case 'unlock':
        success = await gpsProtocol.sendEngineCommand(deviceId, false, password);
        message = success ? 'Engine unlock command sent' : 'Failed to send engine unlock command';
        if (success) {
          device.engineLocked = false;
          await device.save();
        }
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid command. Use: engineStop, engineResume, lock, or unlock' 
        });
    }

    res.json({ 
      success, 
      message,
      device: {
        deviceId: device.deviceId,
        vehicleName: device.vehicleName,
        engineLocked: device.engineLocked
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get device command status
router.get('/:deviceId/status', async (req, res) => {
  try {
    const device = await Device.findOne({ deviceId: req.params.deviceId });
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    res.json({ 
      success: true, 
      status: {
        online: device.online,
        engineLocked: device.engineLocked,
        ignition: device.ignition,
        lastSeen: device.lastSeen
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
