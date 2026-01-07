const mongoose = require('mongoose');
const BusState = require('./models/BusState');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bus_tracker";

async function resetBus() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to DB");

        const startLat = 29.2183;
        const startLng = 79.5130;

        await BusState.findOneAndUpdate(
            { busId: "UK-07-PA-1234" },
            {
                $set: {
                    routeId: "R_UK_DEL",
                    lat: startLat,
                    lng: startLng,
                    speed: 0,
                    source: "GPS",
                    lastUpdated: new Date(),
                    distanceCoveredKm: 0,
                    remainingDistanceKm: 260,
                    progressPercent: 0,
                    nextStopId: "S02", // Next is Rudrapur
                    nextStopName: "Rudrapur",
                    distanceToNextStop: 30000, // 30 km to Rudrapur
                    etaToDestMin: 360 // 6 hours
                }
            },
            { upsert: true }
        );

        console.log("✅ Bus Reset to Haldwani (Start)");
        process.exit(0);
    } catch (err) {
        console.error("Reset Error", err);
        process.exit(1);
    }
}

resetBus();
