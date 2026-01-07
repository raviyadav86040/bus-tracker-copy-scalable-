const mongoose = require('mongoose');

const BusStateSchema = new mongoose.Schema({
    busId: { type: String, required: true, unique: true },
    routeId: { type: String, required: true },
    lat: Number,
    lng: Number,
    speed: Number,
    heading: Number,
    source: String,

    // ETA & Progress
    nextStopId: String,
    nextStopName: String,
    distanceCoveredKm: Number,
    remainingDistanceKm: Number,
    etaToNextStopMin: Number,
    etaToDestMin: Number,
    progressPercent: Number,
    lastPolylineIndex: { type: Number, default: 0 }, // Optimization hint

    // Status
    status: { type: String, enum: ['MOVING', 'STOPPED', 'PASSED', 'UNKNOWN'], default: 'UNKNOWN' },
    lastUpdated: { type: Date, default: Date.now },

    // Crowd info (optional for now)
    passengers: { type: Number, default: 0 },
    capacity: { type: Number, default: 60 },

    // Cell Tower Info
    cellTowerId: String,
    signalStrength: Number
});

module.exports = mongoose.model('BusState', BusStateSchema);
