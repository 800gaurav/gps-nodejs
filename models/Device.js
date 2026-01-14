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
    trim: true
  },
  vehicleName: {
    type: String,
    required: true,
    trim: true
  },
  online: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  lastLatitude: Number,
  lastLongitude: Number,
  speed: {
    type: Number,
    default: 0
  },
  course: Number,
  altitude: Number,
  satellites: Number,
  engineLocked: {
    type: Boolean,
    default: false
  },
  ignition: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

deviceSchema.index({ deviceId: 1 });
deviceSchema.index({ imei: 1 });

module.exports = mongoose.model('Device', deviceSchema);
