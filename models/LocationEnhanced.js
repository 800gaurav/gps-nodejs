const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  altitude: {
    type: Number,
    default: 0
  },
  speed: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  course: {
    type: Number,
    min: 0,
    max: 360,
    default: 0
  },
  valid: {
    type: Boolean,
    default: true
  },
  satellites: {
    type: Number,
    min: 0,
    default: 0
  },
  hdop: {
    type: Number,
    min: 0
  },
  ignition: {
    type: Boolean,
    default: false
  },
  engineOn: {
    type: Boolean,
    default: false
  },
  battery: {
    type: Number,
    min: 0,
    max: 100
  },
  power: {
    type: Number,
    min: 0
  },
  rssi: {
    type: Number,
    min: -120,
    max: 0
  },
  odometer: {
    type: Number,
    min: 0
  },
  engineHours: {
    type: Number,
    min: 0
  },
  fuelLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  temperature: {
    type: Number
  },
  humidity: {
    type: Number,
    min: 0,
    max: 100
  },
  protocol: {
    type: String,
    required: true
  },
  alarms: [{
    type: String,
    enum: [
      'sos', 'powerCut', 'vibration', 'geofenceEnter', 'geofenceExit',
      'overspeed', 'lowBattery', 'powerOff', 'tampering', 'door',
      'accident', 'braking', 'cornering', 'acceleration', 'fallDown',
      'jamming', 'tow', 'removing'
    ]
  }],
  attributes: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  cellTowers: [{
    mcc: Number,
    mnc: Number,
    lac: Number,
    cid: Number,
    rssi: Number
  }],
  wifiPoints: [{
    mac: String,
    rssi: Number
  }],
  address: {
    type: String,
    trim: true
  },
  geofences: [{
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Geofence' },
    name: String,
    event: { type: String, enum: ['enter', 'exit'] }
  }],
  driverId: {
    type: String,
    trim: true
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip'
  },
  processed: {
    type: Boolean,
    default: false
  },
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'locations'
});

// Compound indexes for better query performance
locationSchema.index({ deviceId: 1, timestamp: -1 });
locationSchema.index({ deviceId: 1, timestamp: 1 });
locationSchema.index({ timestamp: -1 });
locationSchema.index({ latitude: 1, longitude: 1 });
locationSchema.index({ 'geofences.id': 1 });
locationSchema.index({ tripId: 1 });
locationSchema.index({ processed: 1 });
locationSchema.index({ archived: 1 });

// Geospatial index for location-based queries
locationSchema.index({ location: '2dsphere' });

// TTL index for automatic cleanup (keep data for 1 year)
locationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Virtual for GeoJSON location
locationSchema.virtual('location').get(function() {
  return {
    type: 'Point',
    coordinates: [this.longitude, this.latitude]
  };
});

// Virtual for speed in different units
locationSchema.virtual('speedMph').get(function() {
  return this.speed * 0.621371; // km/h to mph
});

locationSchema.virtual('speedKnots').get(function() {
  return this.speed * 0.539957; // km/h to knots
});

// Method to calculate distance from another location
locationSchema.methods.distanceTo = function(otherLocation) {
  const R = 6371; // Earth's radius in km
  const dLat = (otherLocation.latitude - this.latitude) * Math.PI / 180;
  const dLon = (otherLocation.longitude - this.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.latitude * Math.PI / 180) * Math.cos(otherLocation.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Method to calculate bearing to another location
locationSchema.methods.bearingTo = function(otherLocation) {
  const dLon = (otherLocation.longitude - this.longitude) * Math.PI / 180;
  const lat1 = this.latitude * Math.PI / 180;
  const lat2 = otherLocation.latitude * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

// Static method to find locations within date range
locationSchema.statics.findByDateRange = function(deviceId, startDate, endDate, options = {}) {
  const query = {
    deviceId,
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
  
  if (options.valid !== undefined) {
    query.valid = options.valid;
  }
  
  if (options.ignition !== undefined) {
    query.ignition = options.ignition;
  }
  
  return this.find(query)
    .sort({ timestamp: options.sort || 1 })
    .limit(options.limit || 1000)
    .select(options.select || '-attributes -cellTowers -wifiPoints');
};

// Static method to find locations within geographic bounds
locationSchema.statics.findWithinBounds = function(bounds, options = {}) {
  const query = {
    latitude: { $gte: bounds.south, $lte: bounds.north },
    longitude: { $gte: bounds.west, $lte: bounds.east }
  };
  
  if (options.deviceId) {
    query.deviceId = options.deviceId;
  }
  
  if (options.timeRange) {
    query.timestamp = {
      $gte: new Date(options.timeRange.start),
      $lte: new Date(options.timeRange.end)
    };
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 100);
};

// Static method to get route between two points
locationSchema.statics.getRoute = function(deviceId, startTime, endTime, options = {}) {
  const pipeline = [
    {
      $match: {
        deviceId,
        timestamp: {
          $gte: new Date(startTime),
          $lte: new Date(endTime)
        },
        valid: true
      }
    },
    {
      $sort: { timestamp: 1 }
    }
  ];
  
  if (options.simplify) {
    // Add simplification logic to reduce points
    pipeline.push({
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d %H:%M',
            date: '$timestamp'
          }
        },
        location: { $first: '$$ROOT' }
      }
    });
    pipeline.push({ $replaceRoot: { newRoot: '$location' } });
  }
  
  if (options.limit) {
    pipeline.push({ $limit: options.limit });
  }
  
  return this.aggregate(pipeline);
};

// Static method to get location statistics
locationSchema.statics.getStatistics = async function(deviceId, timeRange) {
  const matchStage = {
    deviceId,
    valid: true
  };
  
  if (timeRange) {
    matchStage.timestamp = {
      $gte: new Date(timeRange.start),
      $lte: new Date(timeRange.end)
    };
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPoints: { $sum: 1 },
        maxSpeed: { $max: '$speed' },
        avgSpeed: { $avg: '$speed' },
        totalDistance: { $sum: 0 }, // Calculate in application
        engineOnTime: {
          $sum: { $cond: ['$engineOn', 1, 0] }
        },
        ignitionOnTime: {
          $sum: { $cond: ['$ignition', 1, 0] }
        },
        firstLocation: { $first: '$$ROOT' },
        lastLocation: { $last: '$$ROOT' }
      }
    }
  ]);
  
  return stats[0] || {
    totalPoints: 0,
    maxSpeed: 0,
    avgSpeed: 0,
    totalDistance: 0,
    engineOnTime: 0,
    ignitionOnTime: 0
  };
};

// Static method to cleanup old locations
locationSchema.statics.cleanup = async function(daysToKeep = 365) {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  return this.deleteMany({
    timestamp: { $lt: cutoffDate },
    archived: { $ne: true }
  });
};

module.exports = mongoose.model('Location', locationSchema);