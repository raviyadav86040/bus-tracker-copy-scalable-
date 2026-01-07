const mongoose = require('mongoose');

const RawCrowdDataSchema = new mongoose.Schema({
    busId: String,
    routeId: String,
    lat: Number,
    lng: Number,
    speed: Number,
    accuracy: Number,
    source: { type: String, enum: ['GPS', 'CELL_TOWER'] },
    cellTowerId: String,
    signalStrength: Number,
    timestamp: Date,
    receivedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RawCrowdData', RawCrowdDataSchema);
