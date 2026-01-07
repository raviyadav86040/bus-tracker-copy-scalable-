const mongoose = require("mongoose");


const LocationPingSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  busId: { type: String, index: true },
  lat: Number,
  lng: Number,
  speed: Number,
  createdAt: { type: Date, default: Date.now, index: true }
});



module.exports = mongoose.model("LocationPing", LocationPingSchema);