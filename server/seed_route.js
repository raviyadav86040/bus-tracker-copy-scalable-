const mongoose = require('mongoose');
const Route = require('./models/Route');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bus_tracker";

// Demo Route: Haldwani -> Rudrapur -> Rampur -> Moradabad -> Delhi (Anand Vihar)
const routeData = {
    routeId: "R_UK_DEL",
    name: "Haldwani - Anand Vihar",
    distanceKm: 260, // Total Distance
    stops: [
        { id: "S01", name: "Haldwani", lat: 29.2183, lng: 79.5130 },
        { id: "S02", name: "Rudrapur", lat: 28.9740, lng: 79.4050 },
        { id: "S03", name: "Rampur", lat: 28.8030, lng: 79.0250 },
        { id: "S04", name: "Moradabad", lat: 28.8350, lng: 78.7700 }, // Approx
        { id: "S05", name: "Gajraula", lat: 28.8350, lng: 78.2350 },
        { id: "S06", name: "Garhmukteshwar", lat: 28.7800, lng: 78.1000 },
        { id: "S07", name: "Hapur", lat: 28.7300, lng: 77.7700 },
        { id: "S08", name: "Anand Vihar", lat: 28.6469, lng: 77.3160 }
    ],
    polyline: [
        // Simplified Polyline for Projection
        { lat: 29.2183, lng: 79.5130 },
        { lat: 28.9740, lng: 79.4050 },
        { lat: 28.8030, lng: 79.0250 },
        { lat: 28.8350, lng: 78.7700 },
        { lat: 28.8350, lng: 78.2350 },
        { lat: 28.6469, lng: 77.3160 }
    ]
};

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to DB");

        await Route.findOneAndUpdate(
            { routeId: routeData.routeId },
            routeData,
            { upsert: true, new: true }
        );

        console.log("✅ Route Seeded Successfully");
        process.exit(0);
    } catch (err) {
        console.error("Seed Error", err);
        process.exit(1);
    }
}

seed();
