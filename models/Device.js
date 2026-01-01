const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  imei: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\d{15}$/, 'IMEI must be 15 digits']
  },
  deviceType: {
    type: String,
    required: true,
    enum: ['GT06', 'TELTONIKA', 'CONCOX', 'QUECLINK', 'OTHER']
  },
  model: {
    type: String,
    trim: true
  },
  firmwareVersion: {
    type: String,
    trim: true
  },
  protocol: {
    type: Number,
    required: true
  },
  vehicleName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  vehicleType: {
    type: String,
    enum: ['car', 'truck', 'motorcycle', 'bus', 'van', 'trailer', 'boat', 'other'],
    default: 'car'
  },
  licensePlate: {
    type: String,
    trim: true,
    uppercase: true
  },
  vin: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[A-HJ-NPR-Z0-9]{17}$/, 'Invalid VIN format']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeviceGroup'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'offline'],
    default: 'active'
  },
  online: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  lastLatitude: {
    type: Number,
    min: -90,
    max: 90
  },
  lastLongitude: {
    type: Number,
    min: -180,
    max: 180
  },
  lastAddress: {
    type: String,
    trim: true
  },
  engineLocked: {
    type: Boolean,
    default: false
  },
  ignition: {
    type: Boolean,
    default: false
  },
  speed: {
    type: Number,
    default: 0,
    min: 0
  },
  course: {
    type: Number,
    default: 0,
    min: 0,
    max: 360
  },
  altitude: {
    type: Number,
    default: 0
  },
  satellites: {
    type: Number,
    default: 0,
    min: 0
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
    default: 0,
    min: 0
  },
  engineHours: {
    type: Number,
    default: 0,
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
  settings: {
    reportingInterval: {
      type: Number,
      default: 30,
      min: 10,
      max: 3600
    },
    speedLimit: {
      type: Number,
      default: 80,
      min: 0,
      max: 300
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    password: {
      type: String,
      default: '123456'
    },
    server: {
      host: String,
      port: Number
    },
    apn: {
      name: String,
      username: String,
      password: String
    }
  },
  alerts: {
    overspeed: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, default: 80 },
      lastTriggered: Date
    },
    geofence: {
      enabled: { type: Boolean, default: true },
      lastTriggered: Date
    },
    powerCut: {
      enabled: { type: Boolean, default: true },
      lastTriggered: Date
    },
    lowBattery: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, default: 20 },
      lastTriggered: Date
    },
    sos: {
      enabled: { type: Boolean, default: true },
      lastTriggered: Date
    },
    offline: {
      enabled: { type: Boolean, default: true },
      timeout: { type: Number, default: 300 },
      lastTriggered: Date
    }
  },
  maintenance: {
    nextService: Date,
    lastService: Date,
    serviceInterval: { type: Number, default: 10000 },
    notes: String
  },
  driver: {
    name: String,
    license: String,
    phone: String,
    email: String
  },
  insurance: {
    company: String,
    policyNumber: String,
    expiryDate: Date
  },
  registration: {
    number: String,
    expiryDate: Date,
    authority: String
  },
  geofences: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Geofence'
  }],
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    maxlength: 1000
  },
  avatar: String
}, {
  timestamps: true
});

// Indexes
deviceSchema.index({ deviceId: 1 });
deviceSchema.index({ imei: 1 });
deviceSchema.index({ userId: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ online: 1 });
deviceSchema.index({ lastSeen: -1 });
deviceSchema.index({ 'lastLatitude': 1, 'lastLongitude': 1 });

// Virtual for online status
deviceSchema.virtual('isOnline').get(function() {
  if (!this.lastSeen) return false;
  const timeout = this.alerts.offline.timeout * 1000;
  return (Date.now() - this.lastSeen.getTime()) < timeout;
});

// Method to update location
deviceSchema.methods.updateLocation = function(latitude, longitude, address) {
  this.lastLatitude = latitude;
  this.lastLongitude = longitude;
  if (address) this.lastAddress = address;
  this.lastSeen = new Date();
  this.online = true;
};

// Static method to find by user
deviceSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  if (options.status) query.status = options.status;
  if (options.online !== undefined) query.online = options.online;
  
  return this.find(query)
    .populate('userId', 'username email firstName lastName')
    .sort(options.sort || { vehicleName: 1 });
};

// Static method to get statistics
deviceSchema.statics.getStatistics = async function(userId = null) {
  const matchStage = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDevices: { $sum: 1 },
        activeDevices: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        onlineDevices: { $sum: { $cond: ['$online', 1, 0] } },
        movingDevices: { $sum: { $cond: [{ $and: ['$online', { $gt: ['$speed', 0] }] }, 1, 0] } },
        engineLockedDevices: { $sum: { $cond: ['$engineLocked', 1, 0] } }
      }
    }
  ]);
  
  return stats[0] || {
    totalDevices: 0,
    activeDevices: 0,
    onlineDevices: 0,
    movingDevices: 0,
    engineLockedDevices: 0
  };
};

// Static method to cleanup offline devices
deviceSchema.statics.cleanupOfflineDevices = async function(daysOffline = 1) {
  const cutoffTime = new Date(Date.now() - (daysOffline * 24 * 60 * 60 * 1000));
  
  const result = await this.updateMany(
    { 
      lastSeen: { $lt: cutoffTime },
      online: true
    },
    { 
      $set: { 
        online: false,
        status: 'offline'
      }
    }
  );
  
  return result;
};

module.exports = mongoose.model('Device', deviceSchema);