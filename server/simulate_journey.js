// const axios = require('axios');
// // Using native fetch if available (Node 18+) or axios if installed. 
// // Fallback to http is possible but let's assume fetch or axios works for this environment.

// const API_BASE = "http://localhost:3000/api";
// // Allow passing BUS_ID and SPEED via args
// const BUS_ID = process.argv[2] || "UK-07-PA-1234";
// const ROUTE_ID = "R_UK_DEL"; // Use this ID to fetch from DB

// // Configuration
// const UPDATE_INTERVAL_MS = 2000;
// const SPEED_KMPH = parseInt(process.argv[3]) || 60;
// const STEPS_PER_SEGMENT = 20;

// function interpolate(p1, p2, fraction) {
//     return {
//         lat: p1.lat + (p2.lat - p1.lat) * fraction,
//         lng: p1.lng + (p2.lng - p1.lng) * fraction
//     };
// }

// async function fetchRouteData(routeId) {
//     try {
//         console.log(`🌐 Fetching Route Data for ${routeId}...`);
//         const res = await fetch(`${API_BASE}/routes/${routeId}`);
//         if (!res.ok) throw new Error(`API Error: ${res.status}`);
//         const route = await res.json();

//         // Use stops as waypoints. 
//         // In a real system, you'd use a high-res polyline here.
//         if (!route.stops || route.stops.length < 2) {
//             throw new Error("Route has insufficient stops for simulation");
//         }
//         return route.stops;
//     } catch (e) {
//         console.error("❌ Failed to fetch route:", e.message);
//         console.log("⚠️ Make sure the server is running on port 3000");
//         process.exit(1);
//     }
// }

// async function generateFullPath(waypoints) {
//     const fullPath = [];
//     for (let i = 0; i < waypoints.length - 1; i++) {
//         const start = waypoints[i];
//         const end = waypoints[i + 1];
//         for (let j = 0; j < STEPS_PER_SEGMENT; j++) {
//             fullPath.push(interpolate(start, end, j / STEPS_PER_SEGMENT));
//         }
//     }
//     fullPath.push(waypoints[waypoints.length - 1]); // Add end
//     return fullPath;
// }

// async function runSimulation() {
//     // 1. Fetch Route
//     const waypoints = await fetchRouteData(ROUTE_ID);
//     console.log(`✅ Loaded ${waypoints.length} waypoints from DB`);

//     // 2. Generate Path
//     const fullPath = await generateFullPath(waypoints);
//     console.log(`🛣️  Generated path with ${fullPath.length} simulation steps`);

//     console.log(`\n🚌 Starting Auto-Simulation for ${BUS_ID}`);
//     let idx = 0;

//     while (true) {
//         const point = fullPath[idx];

//         // Logic: Simulate Cell Tower "Dead Zone" (approx middle of route)
//         const isDeadZone = (idx > (fullPath.length * 0.4) && idx < (fullPath.length * 0.6));

//         if (isDeadZone) {
//             console.log(`⚠️  [Dead Zone] Sending Cell Update...`);
//             // Simulating a cell tower in that area
//             await sendCellUpdate({
//                 mcc: 404, mnc: 10, lac: 5000 + Math.floor(idx / 10), cid: 9999, signal_dbm: -90
//             });
//         } else {
//             console.log(`📍 [GPS] Sending Update: ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`);
//             await sendGpsUpdate({
//                 lat: point.lat,
//                 lng: point.lng,
//                 speed_kmph: SPEED_KMPH + (Math.random() * 5)
//             });
//         }

//         // Loop
//         idx++;
//         if (idx >= fullPath.length) idx = 0; // Restart

//         await new Promise(r => setTimeout(r, UPDATE_INTERVAL_MS));
//     }
// }

// async function sendGpsUpdate(data) {
//     try {
//         await fetch(`${API_BASE}/gps/update`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 bus_id: BUS_ID,
//                 route_id: ROUTE_ID,
//                 lat: data.lat,
//                 lng: data.lng,
//                 speed_kmph: data.speed_kmph
//             })
//         });
//     } catch (e) {
//         console.error("Failed to send GPS", e.message);
//     }
// }

// async function sendCellUpdate(cellData) {
//     try {
//         await fetch(`${API_BASE}/cell/update`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//                 bus_id: BUS_ID,
//                 route_id: ROUTE_ID,
//                 cell: cellData
//             })
//         });
//     } catch (e) {
//         console.error("Failed to send Cell", e.message);
//     }
// }

// runSimulation();
