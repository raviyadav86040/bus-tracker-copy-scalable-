const mongoose = require('mongoose');

const StopSchema = new mongoose.Schema({
  id: String,
  name: String,
  lat: Number,
  lng: Number
});

const RouteSchema = new mongoose.Schema({
  routeId: { type: String, required: true, unique: true },
  name: String,
  stops: [StopSchema],
  polyline: [{ lat: Number, lng: Number }],
  distanceKm: Number
});

module.exports = mongoose.model('Route', RouteSchema);
