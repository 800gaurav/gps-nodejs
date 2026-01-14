const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

// Use existing Location model or create reference
const Location = mongoose.models.Location || require('../models/Location');

// Get device complete data with latest location and vehicle info
router.get('/:identifier/complete-data', auth, async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Check device access - search by deviceId or IMEI
    let query = {
      $or: [
        { deviceId: identifier },
        { imei: identifier }
      ]
    };
    
    if (req.user.role !== 'admin') {
      query.userId = req.user._id;
    }

    const device = await Device.findOne(query).populate('userId', 'username email name');
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    // Get latest location - use device.deviceId for location search
    const latestLocation = await Location.findOne({ deviceId: device.deviceId }).sort({ timestamp: -1 });

    // Get location history (last 10 points)
    const locationHistory = await Location.find({ deviceId: device.deviceId })
      .sort({ timestamp: -1 })
      .limit(10);

    // Calculate today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayLocations = await Location.find({
      deviceId: device.deviceId,
      timestamp: { $gte: today, $lt: tomorrow }
    }).sort({ timestamp: 1 });

    // Calculate distance and engine hours for today
    let todayDistance = 0;
    let engineOnTime = 0;
    let maxSpeed = 0;

    if (todayLocations.length > 1) {
      for (let i = 1; i < todayLocations.length; i++) {
        const prev = todayLocations[i - 1];
        const curr = todayLocations[i];
        
        // Calculate distance (simple calculation)
        const lat1 = prev.latitude * Math.PI / 180;
        const lat2 = curr.latitude * Math.PI / 180;
        const deltaLat = (curr.latitude - prev.latitude) * Math.PI / 180;
        const deltaLon = (curr.longitude - prev.longitude) * Math.PI / 180;
        
        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = 6371 * c; // Earth radius in km
        
        todayDistance += distance;
        
        // Track max speed
        if (curr.speed > maxSpeed) maxSpeed = curr.speed;
        
        // Calculate engine on time
        if (curr.engineOn) {
          const timeDiff = new Date(curr.timestamp) - new Date(prev.timestamp);
          engineOnTime += timeDiff;
        }
      }
    }

    const completeData = {
      // Device Information
      device: {
        _id: device._id,
        deviceId: device.deviceId,
        imei: device.imei,
        deviceType: device.deviceType,
        protocol: device.protocol,
        status: device.status,
        online: device.online,
        lastSeen: device.lastSeen,
        createdAt: device.createdAt
      },
      
      // Vehicle Information
      vehicle: {
        name: device.vehicleName,
        type: device.vehicleType,
        licensePlate: device.licensePlate,
        vin: device.vin,
        engineLocked: device.engineLocked,
        driver: device.driver,
        insurance: device.insurance,
        registration: device.registration,
        maintenance: device.maintenance
      },
      
      // Current Location & Status
      currentStatus: {
        latitude: latestLocation?.latitude || device.lastLatitude,
        longitude: latestLocation?.longitude || device.lastLongitude,
        address: latestLocation?.address || device.lastAddress,
        speed: latestLocation?.speed || device.speed,
        course: latestLocation?.course || device.course,
        altitude: latestLocation?.altitude || device.altitude,
        ignition: latestLocation?.ignition || device.ignition,
        engineOn: latestLocation?.engineOn || false,
        gpsValid: latestLocation?.gpsValid || true,
        satellites: latestLocation?.satellites || device.satellites,
        battery: device.battery,
        power: device.power,
        rssi: device.rssi,
        timestamp: latestLocation?.timestamp || device.lastSeen
      },
      
      // Today's Statistics
      todayStats: {
        distance: Math.round(todayDistance * 100) / 100, // km
        maxSpeed: Math.round(maxSpeed * 100) / 100, // km/h
        engineHours: Math.round(engineOnTime / 1000 / 60 / 60 * 100) / 100, // hours
        trips: todayLocations.length,
        firstLocation: todayLocations[0]?.timestamp,
        lastLocation: todayLocations[todayLocations.length - 1]?.timestamp
      },
      
      // Device Settings & Alerts
      settings: device.settings,
      alerts: device.alerts,
      
      // Assigned User
      assignedUser: device.userId,
      
      // Recent Location History
      locationHistory: locationHistory.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed,
        ignition: loc.ignition,
        engineOn: loc.engineOn,
        timestamp: loc.timestamp
      }))
    };

    res.json({
      success: true,
      data: completeData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get device engine report
router.get('/:deviceId/engine-report', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Check device access
    let query = { deviceId };
    if (req.user.role !== 'admin') {
      query.userId = req.user._id;
    }

    const device = await Device.findOne(query);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    // Build date query
    const dateQuery = { deviceId };
    if (startDate && endDate) {
      dateQuery.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else {
      // Default to last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      dateQuery.timestamp = { $gte: sevenDaysAgo };
    }

    const locations = await Location.find(dateQuery).sort({ timestamp: 1 });

    let engineOnTime = 0;
    let engineOffTime = 0;
    let totalDistance = 0;
    let engineOnEvents = [];
    let engineOffEvents = [];
    let currentEngineSession = null;

    for (let i = 0; i < locations.length; i++) {
      const current = locations[i];
      const previous = locations[i - 1];

      // Calculate distance
      if (previous) {
        const lat1 = previous.latitude * Math.PI / 180;
        const lat2 = current.latitude * Math.PI / 180;
        const deltaLat = (current.latitude - previous.latitude) * Math.PI / 180;
        const deltaLon = (current.longitude - previous.longitude) * Math.PI / 180;
        
        const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = 6371 * c;
        
        totalDistance += distance;

        // Calculate engine time
        const timeDiff = new Date(current.timestamp) - new Date(previous.timestamp);
        
        if (current.engineOn) {
          engineOnTime += timeDiff;
        } else {
          engineOffTime += timeDiff;
        }
      }

      // Track engine events
      if (previous && previous.engineOn !== current.engineOn) {
        if (current.engineOn) {
          // Engine turned on
          engineOnEvents.push({
            timestamp: current.timestamp,
            latitude: current.latitude,
            longitude: current.longitude,
            address: current.address
          });
          currentEngineSession = {
            startTime: current.timestamp,
            startLocation: { latitude: current.latitude, longitude: current.longitude }
          };
        } else {
          // Engine turned off
          engineOffEvents.push({
            timestamp: current.timestamp,
            latitude: current.latitude,
            longitude: current.longitude,
            address: current.address,
            sessionDuration: currentEngineSession ? 
              (new Date(current.timestamp) - new Date(currentEngineSession.startTime)) / 1000 / 60 : 0
          });
        }
      }
    }

    const report = {
      deviceId,
      vehicleName: device.vehicleName,
      reportPeriod: {
        startDate: startDate || locations[0]?.timestamp,
        endDate: endDate || locations[locations.length - 1]?.timestamp
      },
      summary: {
        totalDistance: Math.round(totalDistance * 100) / 100, // km
        engineOnTime: Math.round(engineOnTime / 1000 / 60 / 60 * 100) / 100, // hours
        engineOffTime: Math.round(engineOffTime / 1000 / 60 / 60 * 100) / 100, // hours
        totalEngineEvents: engineOnEvents.length + engineOffEvents.length,
        engineOnEvents: engineOnEvents.length,
        engineOffEvents: engineOffEvents.length
      },
      events: {
        engineOn: engineOnEvents,
        engineOff: engineOffEvents
      },
      currentStatus: {
        engineLocked: device.engineLocked,
        lastEngineStatus: locations[locations.length - 1]?.engineOn || false,
        lastIgnitionStatus: locations[locations.length - 1]?.ignition || false
      }
    };

    res.json({
      success: true,
      report
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;