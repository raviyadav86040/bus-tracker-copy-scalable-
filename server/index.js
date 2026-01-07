require('dotenv').config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require('path');

// Models
const Route = require('./models/Route');
const BusState = require('./models/BusState');
const RawCrowdData = require('./models/RawCrowdData');
const S = require("./services/services");
const RouteCache = require('./services/RouteCache');
const BusStateManager = require('./services/BusStateManager');

// Config
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/bus_tracker";

// App Setup
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Database Connection
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    RouteCache.init(); // Initialize Cache
  })
  .catch(err => console.error(" MongoDB error:", err));

// ---------------------------------------------------------
// 1️⃣ SEARCH BUSES API
// GET /api/buses/search?from=...&to=...&date=...
// ---------------------------------------------------------
app.get("/api/buses/search", async (req, res) => {
  // In a real app, filtering by from/to/date would happen here.
  // For MVP, we return all active buses or a predefined list linked to routes.

  // Mocking a schedule based on active routes
  const buses = [
    {
      bus_id: "UK-07-PA-1234",
      route_id: "R_UK_DEL",
      departure_time: "08:00 AM",
      arrival_time: "02:00 PM",
      tracking_state: await getBusState("UK-07-PA-1234")
    }
  ];
  res.json({ buses });
});

async function getBusState(busId) {
  const bus = await BusState.findOne({ busId });
  if (!bus) return "OFFLINE";

  const timeDiff = (Date.now() - new Date(bus.lastUpdated).getTime()) / 1000;
  if (timeDiff < 30) return "LIVE";
  if (timeDiff < 300) return "LAST_KNOWN";
  return "OFFLINE";
}

// ---------------------------------------------------------
// 1.5 ROUTE DETAILS API
// GET /api/routes/:routeId
// ---------------------------------------------------------
app.get("/api/routes/:routeId", async (req, res) => {
  try {
    const { routeId } = req.params;
    const route = await Route.findOne({ routeId });
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }
    res.json(route);
  } catch (err) {
    console.error("Fetch Route Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// ---------------------------------------------------------
// 2️⃣ OUTSIDE TRACKING API
// GET /api/bus/:busId/live
// ---------------------------------------------------------
app.get("/api/bus/:busId/live", async (req, res) => {
  try {
    const { busId } = req.params;
    // Use State Manager (Memory first)
    const bus = await BusStateManager.getBusState(busId);

    if (!bus) {
      return res.json({
        tracking: { state: "OFFLINE", message: "Bus has not started." }
      });
    }

    const timeDiff = (Date.now() - new Date(bus.lastUpdated).getTime()) / 1000;

    // STRICT STATE MAPPING
    let state = "LIVE";
    if (timeDiff > 20) state = "LAST_KNOWN";
    if (timeDiff > 300) state = "OFFLINE";

    // Route & Stop Logic
    let current_stop_index = 1;
    let total_stops = 0;
    let routeName = "Unknown Route";

    const route = await Route.findOne({ routeId: bus.routeId });
    if (route) {
      total_stops = route.stops.length;
      routeName = route.name || "Haldwani → Anand Vihar";
      if (bus.nextStopId) {
        const idx = route.stops.findIndex(s => s.id === bus.nextStopId);
        if (idx !== -1) current_stop_index = idx + 1; // 1-based for UI
      }
    }

    // CRITICAL FIX: STOP STATUS (Exclusive)
    // < 100m = AT_STOP. Else MOVING.
    const distM = bus.distanceToNextStop || 0;
    const isAtStop = (distM <= 100);
    const stopStatus = isAtStop ? "AT_STOP" : "MOVING";

    // CRITICAL FIX: NEAR STRING (Raw name only)
    const nearLocation = bus.nextStopName || "En Route";

    res.json({
      route: {
        name: routeName,
        current_stop_index: current_stop_index,
        total_stops: total_stops
      },
      stops: {
        available: !!bus.nextStopName,
        current_stop: bus.nextStopName || "Finishing Trip",
        distance_to_stop_m: distM,
        stop_status: stopStatus // "AT_STOP" | "MOVING"
      },
      trip_progress: {
        near: nearLocation,
        time_remaining: bus.etaToDestMin ? `${Math.floor(bus.etaToDestMin / 60)}h ${Math.floor(bus.etaToDestMin % 60)}m` : "--",
        distance_left_km: bus.remainingDistanceKm ? bus.remainingDistanceKm.toFixed(1) : "0.0",
        speed_kmph: Math.round(bus.speed),
        progress_percent: bus.progressPercent || 0
      },
      tracking: {
        state: state, // "LIVE" | "LAST_KNOWN" | "OFFLINE"
        source: bus.source, // "GPS" | "CELL_TOWER"
        lat: bus.lat,
        lng: bus.lng,
        last_updated_ts: bus.lastUpdated
      }
    });
  } catch (err) {
    console.error("Live API Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ---------------------------------------------------------
// 3️⃣ GPS UPDATE API (Inside Bus)
// POST /api/gps/update
// ---------------------------------------------------------
app.post("/api/gps/update", async (req, res) => {
  try {
    const { bus_id, route_id, lat, lng, speed_kmph } = req.body;
    await processBusUpdate(bus_id, route_id, { lat, lng, speed: speed_kmph, source: "GPS" });
    res.json({ success: true, status: "GPS_UPDATED" });
  } catch (err) {
    console.error("GPS Update Error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

// ---------------------------------------------------------
// 4️⃣ CELL TOWER UPDATE API (Inside Bus)
// POST /api/cell/update
// ---------------------------------------------------------
app.post("/api/cell/update", async (req, res) => {
  try {
    const { bus_id, route_id, cell } = req.body;

    // Update metadata primarily in memory
    BusStateManager.updateBusState(bus_id, {
      source: "CELL_TOWER",
      cellTowerId: `${cell.mcc}-${cell.mnc}-${cell.lac}-${cell.cid}`,
      signalStrength: cell.signal_dbm,
      lastUpdated: new Date()
    });

    res.json({ success: true, status: "CELL_UPDATED" });
  } catch (err) {
    console.error("Cell Update Error:", err);
    res.status(500).json({ error: "Update failed" });
  }
});

async function processBusUpdate(busId, routeId, data) {
  // Use Cache instead of DB
  let route = RouteCache.getRoute(routeId);

  // Fallback (optional, maybe cache isn't ready or route is new)
  if (!route) {
    console.warn(`⚠️ Route ${routeId} not in cache. Fetching from DB...`);
    route = await Route.findOne({ routeId });
  }

  if (!route) {
    console.warn(`Route ${routeId} not found. Saving raw pos.`);
    await BusState.findOneAndUpdate(
      { busId },
      { $set: { lat: data.lat, lng: data.lng, speed: data.speed, lastUpdated: new Date() } },
      { upsert: true }
    );
    return;
  }

  // Retrieve previous state for Optimization Hint
  const prevState = await BusStateManager.getBusState(busId);
  const hintIndex = prevState && prevState.lastPolylineIndex ? prevState.lastPolylineIndex : -1;

  const busPoint = { lat: data.lat, lng: data.lng };
  const proj = S.projectAlongPolyline(route.polyline, busPoint, hintIndex);

  const distanceCoveredKm = proj.distanceFromStartKm;
  const remainingDistanceKm = Math.max(0, route.distanceKm - distanceCoveredKm);
  const progressPercent = (distanceCoveredKm / route.distanceKm) * 100;

  // Calc ETA
  const speed = data.speed || 30;
  const safeSpeed = Math.max(speed, 20);
  const etaToDestMin = (remainingDistanceKm / safeSpeed) * 60;

  // Detect Next Stop
  let nextStop = null;
  let nextStopDist = Infinity;

  for (const stop of route.stops) {
    // Optimization: stops are just points, we could optimize this too, but it's small loop.
    const stopProj = S.projectAlongPolyline(route.polyline, stop);
    if (stopProj.distanceFromStartKm > distanceCoveredKm) {
      nextStop = stop;
      nextStopDist = stopProj.distanceFromStartKm - distanceCoveredKm; // km
      break;
    }
  }

  // Calculate dist in meters
  // Ensure we don't have negative distance
  const distM = nextStopDist !== Infinity ? Math.round(Math.max(0, nextStopDist * 1000)) : 0;

  const updateData = {
    routeId: routeId,
    lat: data.lat,
    lng: data.lng,
    speed: data.speed,
    source: data.source,
    distanceCoveredKm: distanceCoveredKm,
    remainingDistanceKm: remainingDistanceKm,
    progressPercent: progressPercent,
    etaToDestMin: etaToDestMin,
    nextStopId: nextStop ? nextStop.id : null,
    nextStopName: nextStop ? nextStop.name : null,
    distanceToNextStop: distM,
    lastUpdated: new Date(),
    lastPolylineIndex: proj.index // SAVE THE INDEX HINT
  };

  // Update In-Memory State (Write-Back later)
  BusStateManager.updateBusState(busId, updateData);
}

// ---------------------------------------------------------
// 5️⃣ DISCOVER BUSES API (Stub)
// ---------------------------------------------------------
app.get("/api/buses/search", async (req, res) => {
  res.json({ buses: [{ bus_id: "UK-07-PA-1234", tracking_state: "LIVE", departure_time: "08:00 AM", arrival_time: "02:00 PM" }] });
});

// Start Server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`✅ Bus Tracker Backend running on http://localhost:${PORT}`);
  });
}
