const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const Location = require('../models/LocationEnhanced');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { body, validationResult, param, query } = require('express-validator');
const logger = require('../utils/logger');
const redisManager = require('../config/redis');

// Get all devices for user
router.get('/', auth, async (req, res) => {
  try {
    const { status, online, search, page = 1, limit = 50 } = req.query;
    const userId = req.user.role === 'admin' ? null : req.user._id;
    
    let query = {};
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (online !== undefined) query.online = online === 'true';
    
    if (search) {
      query.$or = [
        { vehicleName: { $regex: search, $options: 'i' } },
        { deviceId: { $regex: search, $options: 'i' } },
        { licensePlate: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const devices = await Device.find(query)
      .populate('userId', 'username email name mobile')
      .sort({ vehicleName: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Device.countDocuments(query);
    
    // Get real-time status from Redis
    const devicesWithStatus = await Promise.all(devices.map(async (device) => {
      const status = await redisManager.getDeviceStatus(device.deviceId);
      const lastLocation = await redisManager.getLastLocation(device.deviceId);
      
      return {
        ...device.toJSON(),
        realtimeStatus: status,
        realtimeLocation: lastLocation
      };
    }));

    res.json({
      devices: devicesWithStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Get device statistics
router.get('/statistics', auth, async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user._id;
    const stats = await Device.getStatistics(userId);
    
    res.json(stats);
  } catch (error) {
    logger.error('Error fetching device statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get single device
router.get('/:deviceId', 
  auth,
  param('deviceId').notEmpty().withMessage('Device ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      
      let query = { deviceId };
      if (req.user.role !== 'admin') {
        query.userId = req.user._id;
      }

      const device = await Device.findOne(query)
        .populate('userId', 'username email name mobile');

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Get real-time data from Redis
      const [status, lastLocation, locationHistory] = await Promise.all([
        redisManager.getDeviceStatus(deviceId),
        redisManager.getLastLocation(deviceId),
        redisManager.getLocationHistory(deviceId, 10)
      ]);

      res.json({
        ...device.toJSON(),
        realtimeStatus: status,
        realtimeLocation: lastLocation,
        recentLocations: locationHistory
      });
    } catch (error) {
      logger.error('Error fetching device:', error);
      res.status(500).json({ error: 'Failed to fetch device' });
    }
  }
);

// Create new device
router.post('/',
  auth,
  [
    body('deviceId').notEmpty().withMessage('Device ID is required'),
    body('imei').isLength({ min: 15, max: 15 }).withMessage('IMEI must be 15 digits'),
    body('deviceType').isIn(['GT06', 'TELTONIKA', 'CONCOX', 'QUECLINK', 'OTHER']).withMessage('Invalid device type'),
    body('protocol').isInt({ min: 1, max: 65535 }).withMessage('Invalid protocol port'),
    body('vehicleName').notEmpty().withMessage('Vehicle name is required'),
    body('userId').optional().isMongoId().withMessage('Invalid user ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check permissions
      if (req.user.role !== 'admin' && device.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const deviceData = req.body;
      
      // Set userId based on role
      if (req.user.role !== 'admin') {
        deviceData.userId = req.user._id;
      }

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

      // Check user device limit (simple limit of 50 devices per user)
      if (req.user.role !== 'admin') {
        const deviceCount = await Device.countDocuments({ userId: req.user._id });
        
        if (deviceCount >= 50) {
          return res.status(400).json({ 
            error: 'Device limit exceeded. Maximum 50 devices allowed.'
          });
        }
      }

      const device = new Device(deviceData);
      await device.save();

      logger.deviceActivity(device.deviceId, 'device_created', { 
        createdBy: req.user.username 
      });

      res.status(201).json(device);
    } catch (error) {
      logger.error('Error creating device:', error);
      
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

// Update device
router.put('/:deviceId',
  auth,
  [
    param('deviceId').notEmpty().withMessage('Device ID is required'),
    body('vehicleName').optional().notEmpty().withMessage('Vehicle name cannot be empty'),
    body('deviceType').optional().isIn(['GT06', 'TELTONIKA', 'CONCOX', 'QUECLINK', 'OTHER']),
    body('status').optional().isIn(['active', 'inactive', 'maintenance', 'offline'])
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      
      let query = { deviceId };
      if (req.user.role !== 'admin') {
        query.userId = req.user._id;
      }

      // Check permissions
      if (req.user.role !== 'admin' && device.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const device = await Device.findOne(query);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Update device
      Object.assign(device, req.body);
      await device.save();

      logger.deviceActivity(deviceId, 'device_updated', { 
        updatedBy: req.user.username,
        changes: Object.keys(req.body)
      });

      res.json(device);
    } catch (error) {
      logger.error('Error updating device:', error);
      res.status(500).json({ error: 'Failed to update device' });
    }
  }
);

// Delete device
router.delete('/:deviceId',
  auth,
  param('deviceId').notEmpty().withMessage('Device ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      
      // Check permissions
      if (req.user.role !== 'admin' && device.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      let query = { deviceId };
      if (req.user.role !== 'admin') {
        query.userId = req.user._id;
      }

      const device = await Device.findOne(query);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Delete device and related data
      await Promise.all([
        Device.deleteOne({ _id: device._id }),
        Location.deleteMany({ deviceId }),
        redisManager.removeDeviceSession(deviceId)
      ]);

      logger.deviceActivity(deviceId, 'device_deleted', { 
        deletedBy: req.user.username 
      });

      res.json({ message: 'Device deleted successfully' });
    } catch (error) {
      logger.error('Error deleting device:', error);
      res.status(500).json({ error: 'Failed to delete device' });
    }
  }
);

// Get device locations
router.get('/:deviceId/locations',
  auth,
  [
    param('deviceId').notEmpty().withMessage('Device ID is required'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limit must be between 1 and 10000')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      const { startDate, endDate, limit = 1000, valid, ignition } = req.query;
      
      // Check device access
      let deviceQuery = { deviceId };
      if (req.user.role !== 'admin') {
        deviceQuery.userId = req.user._id;
      }

      const device = await Device.findOne(deviceQuery);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Build location query
      const locationQuery = { deviceId };
      
      if (startDate && endDate) {
        locationQuery.timestamp = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      if (valid !== undefined) locationQuery.valid = valid === 'true';
      if (ignition !== undefined) locationQuery.ignition = ignition === 'true';

      const locations = await Location.find(locationQuery)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .select('-attributes -cellTowers -wifiPoints');

      res.json({
        deviceId,
        locations,
        count: locations.length
      });
    } catch (error) {
      logger.error('Error fetching device locations:', error);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  }
);

// Get device route
router.get('/:deviceId/route',
  auth,
  [
    param('deviceId').notEmpty().withMessage('Device ID is required'),
    query('startTime').isISO8601().withMessage('Start time is required'),
    query('endTime').isISO8601().withMessage('End time is required'),
    query('simplify').optional().isBoolean().withMessage('Simplify must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      const { startTime, endTime, simplify = false, limit } = req.query;
      
      // Check device access
      let deviceQuery = { deviceId };
      if (req.user.role !== 'admin') {
        deviceQuery.userId = req.user._id;
      }

      const device = await Device.findOne(deviceQuery);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const route = await Location.getRoute(deviceId, startTime, endTime, {
        simplify: simplify === 'true',
        limit: limit ? parseInt(limit) : undefined
      });

      // Calculate route statistics
      let totalDistance = 0;
      let maxSpeed = 0;
      let avgSpeed = 0;
      let totalTime = 0;

      if (route.length > 1) {
        for (let i = 1; i < route.length; i++) {
          const prev = route[i - 1];
          const curr = route[i];
          
          // Calculate distance between points
          const distance = curr.distanceTo ? curr.distanceTo(prev) : 0;
          totalDistance += distance;
          
          // Track max speed
          if (curr.speed > maxSpeed) maxSpeed = curr.speed;
          
          // Calculate time difference
          const timeDiff = new Date(curr.timestamp) - new Date(prev.timestamp);
          totalTime += timeDiff;
        }
        
        avgSpeed = route.reduce((sum, point) => sum + point.speed, 0) / route.length;
      }

      res.json({
        deviceId,
        route,
        statistics: {
          totalDistance: Math.round(totalDistance * 100) / 100, // km
          maxSpeed: Math.round(maxSpeed * 100) / 100, // km/h
          avgSpeed: Math.round(avgSpeed * 100) / 100, // km/h
          totalTime: Math.round(totalTime / 1000 / 60), // minutes
          pointCount: route.length
        }
      });
    } catch (error) {
      logger.error('Error fetching device route:', error);
      res.status(500).json({ error: 'Failed to fetch route' });
    }
  }
);

// Send command to device
router.post('/:deviceId/commands',
  auth,
  [
    param('deviceId').notEmpty().withMessage('Device ID is required'),
    body('type').notEmpty().withMessage('Command type is required'),
    body('parameters').optional().isObject().withMessage('Parameters must be an object')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      const { type, parameters = {} } = req.body;
      
      // Check device access and control permission
      if (req.user.role !== 'admin' && device.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      let deviceQuery = { deviceId };
      if (req.user.role !== 'admin') {
        deviceQuery.userId = req.user._id;
      }

      const device = await Device.findOne(deviceQuery);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Queue command in Redis for when device connects
      const commandId = await redisManager.queueCommand(deviceId, {
        type,
        parameters,
        userId: req.user._id,
        username: req.user.username,
        timestamp: new Date()
      });

      logger.commandSent(deviceId, type, { 
        commandId,
        sentBy: req.user.username,
        parameters 
      });

      res.json({
        commandId,
        deviceId,
        type,
        parameters,
        status: 'queued',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error sending device command:', error);
      res.status(500).json({ error: 'Failed to send command' });
    }
  }
);

// Get device alerts configuration
router.get('/:deviceId/alerts',
  auth,
  param('deviceId').notEmpty().withMessage('Device ID is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      
      let query = { deviceId };
      if (req.user.role !== 'admin') {
        query.userId = req.user._id;
      }

      const device = await Device.findOne(query).select('alerts');
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      res.json(device.alerts);
    } catch (error) {
      logger.error('Error fetching device alerts:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  }
);

// Update device alerts configuration
router.put('/:deviceId/alerts',
  auth,
  [
    param('deviceId').notEmpty().withMessage('Device ID is required'),
    body('overspeed.enabled').optional().isBoolean(),
    body('overspeed.threshold').optional().isInt({ min: 0, max: 300 }),
    body('geofence.enabled').optional().isBoolean(),
    body('powerCut.enabled').optional().isBoolean(),
    body('lowBattery.enabled').optional().isBoolean(),
    body('lowBattery.threshold').optional().isInt({ min: 0, max: 100 }),
    body('sos.enabled').optional().isBoolean(),
    body('offline.enabled').optional().isBoolean(),
    body('offline.timeout').optional().isInt({ min: 60, max: 86400 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deviceId } = req.params;
      
      // Check permissions
      if (req.user.role !== 'admin' && device.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      let query = { deviceId };
      if (req.user.role !== 'admin') {
        query.userId = req.user._id;
      }

      const device = await Device.findOne(query);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Update alerts configuration
      Object.assign(device.alerts, req.body);
      await device.save();

      logger.deviceActivity(deviceId, 'alerts_updated', { 
        updatedBy: req.user.username 
      });

      res.json(device.alerts);
    } catch (error) {
      logger.error('Error updating device alerts:', error);
      res.status(500).json({ error: 'Failed to update alerts' });
    }
  }
);

module.exports = router;