const API_BASE = "/api";
const BUS_ID = "UK-07-PA-1234";

// DOM MAPPING
const dom = {
    // Header
    labelStop: document.getElementById('label-stop'),
    labelTotalDist: document.getElementById('label-total-dist'),
    progressBar: document.getElementById('trip-progress-bar'),

    // Cards
    cardAvailable: document.getElementById('card-stops-available'),
    cardUnavailable: document.getElementById('card-stops-unavailable'),

    // Stop Info
    stopName: document.getElementById('stop-name'),
    stopDist: document.getElementById('stop-dist'),
    stopNum: document.getElementById('stop-num'),
    atStopBadge: document.getElementById('at-stop-badge'),

    // Trip Progress
    nearLocation: document.getElementById('near-location'),
    timeRemaining: document.getElementById('time-remaining'),
    distLeft: document.getElementById('distance-left'),
    speed: document.getElementById('speed'),
    coords: document.getElementById('coords'),

    // Warning Injection (Only use ONE container for global warning)
    warningContainer1: document.getElementById('conn-warning-1'),

    // Status
    liveIndicator: document.querySelector('.live-indicator')
};

// Auto-Start (No manual trigger)
setInterval(() => fetchUpdate(BUS_ID), 1000);

function fetchUpdate(busId) {
    fetch(`${API_BASE}/bus/${busId}/live`)
        .then(res => res.json())
        .then(data => {
            updateUI(data);
        })
        .catch(err => console.error("Tracking error", err));
}

function updateUI(data) {
    if (!data || !data.route) return;

    // 1. HEADER & PROGRESS (Green Line)
    dom.labelStop.textContent = `Stop ${data.route.current_stop_index} of ${data.route.total_stops}`;

    // Header Distance: Show Reducing Distance ("230km left")
    const kmLeft = data.trip_progress.distance_left_km || "0";
    dom.labelTotalDist.textContent = `${kmLeft} km left`;

    // Green Line Progress
    const pct = data.trip_progress.progress_percent || 0;
    dom.progressBar.style.width = `${pct}%`;

    // 2. STOP CARD
    if (data.stops && data.stops.available) {
        dom.cardAvailable.classList.remove('hidden');
        dom.cardUnavailable.classList.add('hidden');

        dom.stopName.textContent = data.stops.current_stop;

        // LOGIC FIX: Exclusive State (Moving vs At Stop)
        if (data.stops.stop_status === "AT_STOP") {
            dom.stopNum.textContent = "Current Stop"; // 🟢 Semantic Fix
            dom.atStopBadge.classList.remove('hidden'); // Show Badge
            dom.stopDist.textContent = "Arrived"; // Text swap
            dom.stopDist.style.color = "#059669"; // Green
        } else {
            dom.stopNum.textContent = "Next Stop"; // 🟢 Default Status
            dom.atStopBadge.classList.add('hidden'); // Hide Badge
            dom.stopDist.textContent = fmtDist(data.stops.distance_to_stop_m); // Show Dist
            dom.stopDist.style.color = ""; // Default Blue
        }

    } else {
        dom.cardAvailable.classList.add('hidden');
        dom.cardUnavailable.classList.remove('hidden');
    }

    // 3. TRIP STATS
    // Fix: "Near" duplication solved by backend sending raw name.
    dom.nearLocation.textContent = "Near " + (data.trip_progress.near || "Unknown");

    dom.timeRemaining.textContent = data.trip_progress.time_remaining || "--";
    dom.distLeft.textContent = (kmLeft) + " km"; // Bottom stat matching header

    const speed = data.trip_progress.speed_kmph;
    dom.speed.textContent = speed;

    // 4. CONNECTION STATE & WARNINGS
    const state = data.tracking.state; // LIVE, LAST_KNOWN, OFFLINE
    const source = data.tracking.source; // GPS, CELL_TOWER

    // Coords styling
    const lat = data.tracking.lat ? data.tracking.lat.toFixed(4) : "--";
    const lng = data.tracking.lng ? data.tracking.lng.toFixed(4) : "--";

    if (state === 'LAST_KNOWN') {
        dom.coords.textContent = `${lat}, ${lng} (Last Known)`;
        dom.coords.style.color = "#9ca3af"; // Gray
        dom.speed.textContent = "--"; // Don't show old speed
    } else {
        dom.coords.textContent = `${lat}, ${lng}`;
        dom.coords.style.color = "";
    }

    // Global Warning Logic
    if (state === 'LIVE') {
        if (dom.warningContainer1) {
            dom.warningContainer1.classList.add('hidden');
            dom.warningContainer1.innerHTML = ""; // Clean up
        }
        if (dom.liveIndicator) {
            dom.liveIndicator.classList.remove('hidden');
            if (source === 'CELL_TOWER') {
                dom.liveIndicator.innerHTML = '<span style="color:#f59e0b; font-size:8px;">●</span> CELL DATA';
            } else {
                dom.liveIndicator.innerHTML = '<span style="color:#10b981; font-size:8px;">●</span> LIVE';
            }
        }
    } else {
        if (dom.warningContainer1) {
            dom.warningContainer1.classList.remove('hidden');
            const msg = state === 'LAST_KNOWN' ? "Connection unstable. Showing last known location." : "GPS Signal Lost.";
            dom.warningContainer1.innerHTML = `
                <div class="warn-strip">
                    <i class="ri-alert-fill"></i>
                    <span>${msg}</span>
                </div>
            `;
        }
        if (dom.liveIndicator) dom.liveIndicator.classList.add('hidden');
    }
}

function fmtDist(m) {
    if (m >= 1000) return (m / 1000).toFixed(1) + "km";
    return m + "m";
}