const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  speed: { type: Number, default: 0 },
  course: { type: Number, default: 0 },
  altitude: { type: Number, default: 0 },
  engineOn: { type: Boolean, default: false },
  ignition: { type: Boolean, default: false },
  gpsValid: { type: Boolean, default: true },
  satellites: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  address: { type: String, default: '' }
}, { timestamps: true });

 locationSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('Location', locationSchema);