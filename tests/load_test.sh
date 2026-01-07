#!/bin/bash

# Spawn 5 simulators with different IDs
echo "🚀 Starting Load Test with 5 Concurrent Buses..."

node ../server/simulate_journey.js "BUS-TEST-001" 50 &
PID1=$!
node ../server/simulate_journey.js "BUS-TEST-002" 60 &
PID2=$!
node ../server/simulate_journey.js "BUS-TEST-003" 70 &
PID3=$!
node ../server/simulate_journey.js "BUS-TEST-004" 40 &
PID4=$!
node ../server/simulate_journey.js "BUS-TEST-005" 80 &
PID5=$!

echo "✅ Simulators running. Press Ctrl+C to stop."

trap "kill $PID1 $PID2 $PID3 $PID4 $PID5" SIGINT

wait
