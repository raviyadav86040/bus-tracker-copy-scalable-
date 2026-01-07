// Modular services scaffolding for Smart Transit MVP
// This file encapsulates route/geo, tracking, ETA, crowd, ranking, and booking utilities.
// Step 1: Provide in-memory demo data and pure functions.
// Step 2 (next commit): Wire into server/index.js routes and sockets.

// Helper: Distance in KM
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helper: Simple ETA
function calculateETA(lat1, lon1, lat2, lon2, speedKmh) {
  const dist = distanceKm(lat1, lon1, lat2, lon2);
  if (speedKmh <= 0) return 0;
  return (dist / speedKmh) * 60; // minutes
}

// const { calculateETA, distanceKm } = require("../eta"); // REMOVED


// ---------------- Route Service ----------------
// ---------------- Route Service ----------------
// Routes are now fetched from MongoDB in index.js
// This file provides pure geometric/helper functions only.
// ROUTES removed to prevent hardcoding.

function findNearestStop(route, lat, lng) {
  return route.stops
    .map(s => ({ s, d: distanceKm(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a.d - b.d)[0]?.s || null;
}

function projectAlongPolyline(polyline, point, hintIndex = -1) {
  let best = {
    lat: polyline[0].lat,
    lng: polyline[0].lng,
    distanceFromStartKm: 0,
    totalKm: 0,
    minDist: Infinity,
    index: 0
  };

  // 1. Calculate cumulative distances (Cache this in production!)
  // For now, we compute it. In a real highly-scaled app, Route object should have this pre-calculated.
  const cumDist = [0];
  for (let i = 1; i < polyline.length; i++) {
    cumDist[i] = cumDist[i - 1] + distanceKm(polyline[i - 1].lat, polyline[i - 1].lng, polyline[i].lat, polyline[i].lng);
  }
  const totalLength = cumDist[cumDist.length - 1];

  // Optimization: Search Window
  let startIndex = 0;
  let endIndex = polyline.length - 1;

  // If hint provided, look ahead 50 points, look back 5 points
  if (hintIndex !== -1 && hintIndex < polyline.length) {
    startIndex = Math.max(0, hintIndex - 5);
    endIndex = Math.min(polyline.length - 1, hintIndex + 50);
  }

  function checkSegment(i) {
    const a = polyline[i];
    const b = polyline[i + 1];

    const ax = a.lat, ay = a.lng;
    const bx = b.lat, by = b.lng;
    const px = point.lat, py = point.lng;

    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;

    const abLenSq = abx * abx + aby * aby;
    const t = abLenSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));

    const projLat = ax + abx * t;
    const projLng = ay + aby * t;

    const d = distanceKm(px, py, projLat, projLng);

    if (d < best.minDist) {
      // Precise distance from start: Distance to A + Distance from A to Proj
      const distToA = cumDist[i];
      const distAToProj = distanceKm(ax, ay, projLat, projLng);

      best = {
        lat: projLat,
        lng: projLng,
        distanceFromStartKm: distToA + distAToProj,
        totalKm: totalLength,
        minDist: d,
        index: i
      };
    }
  }

  // 1. Try Window Search
  for (let i = startIndex; i < endIndex; i++) {
    checkSegment(i);
  }

  // 2. Fallback: If the best match in window is > 200m away, maybe we jumped?
  // Or if we didn't have a hint.
  if (best.minDist > 0.2 && hintIndex !== -1) {
    // console.log("⚠️ Off-route or jump detected. Doing full search.");
    // Search the rest (excluding what we already checked to save CPU?)
    // For simplicity, just search everything else.
    for (let i = 0; i < polyline.length - 1; i++) {
      if (i >= startIndex && i < endIndex) continue; // Skip already checked
      checkSegment(i);
    }
  }

  return best;
}

// ---------------- Tracking Service ----------------
function smoothSpeed(prevSpeed, newSpeed, alpha = 0.4) {
  if (prevSpeed == null) return newSpeed;
  return alpha * newSpeed + (1 - alpha) * prevSpeed;
}

function computeHeadingDeg(prev, curr) {
  // simple bearing calculation
  const y = Math.sin((curr.lng - prev.lng)) * Math.cos(curr.lat);
  const x = Math.cos(prev.lat) * Math.sin(curr.lat) - Math.sin(prev.lat) * Math.cos(curr.lat) * Math.cos(curr.lng - prev.lng);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  if (brng < 0) brng += 360; return brng;
}

// ---------------- ETA Service ----------------
function etaToPointMinutes(from, to, speedKmh = 25) {
  return calculateETA(from.lat, from.lng, to.lat, to.lng, speedKmh);
}

function etaAlongRouteMinutes(route, busPoint, stopPoint, speedKmh = 25) {
  // Optimization: We could pass hints here too if we tracked stop indices, 
  // but for now full search is okay for occasional ETA re-calc.
  const busProj = projectAlongPolyline(route.polyline, busPoint);
  const stopProj = projectAlongPolyline(route.polyline, stopPoint);

  const remainingKm = Math.max(
    0,
    stopProj.distanceFromStartKm - busProj.distanceFromStartKm
  );

  const speed = Math.max(5, speedKmh || 25);
  return Number(((remainingKm / speed) * 60).toFixed(1));
}

// ---------------- Ranking Service ----------------
// Government-grade bus ranking with reliability priority
// Weights: ETA 35%, Reliability 25%, Crowd 20%, Speed 10%, Freshness 10%

function computeBusScore(bus) {
  // If bus has passed pickup, give it a terrible score equivalent to "do not show"
  if (bus.hasPassed || bus.status === 'PASSED') {
    return -9999;
  }

  // Normalize values to 0-100 scale

  // ETA: Lower ETA = higher score (max 35 points)
  // Cap at 30 min for normalization
  const eta = Math.min(30, bus.etaToPickupMin || 30);
  const etaNorm = Math.max(0, 100 - (eta / 30) * 100);

  // Reliability: Higher = better (max 25 points)
  // This is CRITICAL - reliable buses should be preferred
  const reliabilityNorm = bus.reliability || 50;

  // Crowd: Lower = better (max 20 points)
  const crowdNorm = Math.max(0, 100 - (bus.crowd || 50));

  // Speed: Consider if bus is moving (max 10 points)
  const speedNorm = bus.speed > 0 ? Math.min(100, bus.speed * 3) : 40;

  // Freshness: Recent update = better (max 10 points)
  const ageMs = Date.now() - (bus.lastUpdated || 0);
  const freshnessNorm = ageMs < 5000 ? 100 : ageMs < 15000 ? 80 : ageMs < 30000 ? 50 : 20;

  // Weighted sum
  const score =
    etaNorm * 0.35 +
    reliabilityNorm * 0.25 +
    crowdNorm * 0.20 +
    speedNorm * 0.10 +
    freshnessNorm * 0.10;

  return Math.round(score);
}

function rankBuses(buses) {
  if (!buses || buses.length === 0) return [];

  // Compute scores
  const scored = buses.map(b => ({
    ...b,
    score: computeBusScore(b)
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Find best in each category
  const fastestIdx = scored.reduce((best, b, i) =>
    (b.etaToPickupMin || 999) < (scored[best].etaToPickupMin || 999) ? i : best, 0);
  const leastCrowdedIdx = scored.reduce((best, b, i) =>
    (b.crowd || 100) < (scored[best].crowd || 100) ? i : best, 0);
  const mostSeatsIdx = scored.reduce((best, b, i) =>
    (b.seatsRemaining || 0) > (scored[best].seatsRemaining || 0) ? i : best, 0);

  // Assign labels
  return scored.map((b, i) => {
    const labels = [];

    if (i === 0) labels.push("BEST CHOICE");
    if (i === fastestIdx && !labels.includes("BEST CHOICE")) labels.push("FASTEST");
    if (i === leastCrowdedIdx && labels.length === 0) labels.push("LESS CROWDED");
    if (i === mostSeatsIdx && labels.length === 0) labels.push("MOST SEATS");

    return {
      ...b,
      rank: i + 1,
      label: labels[0] || (b.status === "ON TIME" ? "ON TIME" : "AVAILABLE")
    };
  });
}

function labelFor(b) {
  const labels = [];
  if ((b.etaToDestMin || 999) < 20) labels.push("Fastest");
  if ((b.fullness || 0) < 40) labels.push("Less crowded");
  if ((b.delayMin || 0) < 3) labels.push("On-time");
  return labels[0] || "Recommended";
}

module.exports = {
  // data
  // data


  // route helpers


  findNearestStop,
  projectAlongPolyline,
  // tracking helpers
  smoothSpeed,
  computeHeadingDeg,
  // eta helpers
  etaToPointMinutes,
  etaAlongRouteMinutes,
  // ranking
  rankBuses,
  // Additional exports needed by index.js
  distanceKm
};
