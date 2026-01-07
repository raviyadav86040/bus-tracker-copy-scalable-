const BusState = require('../models/BusState');

class BusStateManager {
    constructor() {
        this.states = new Map(); // busId -> state object
        this.isDirty = new Set(); // busIds that need saving
        this.batchIntervalMs = 5000; // 5 Seconds

        // Start the flush loop
        setInterval(() => this.flush(), this.batchIntervalMs);
    }

    /**
     * Get the latest state for a bus (from memory or DB)
     */
    async getBusState(busId) {
        if (this.states.has(busId)) {
            return this.states.get(busId);
        }
        // Fallback: try to load from DB into memory
        const fromDb = await BusState.findOne({ busId });
        if (fromDb) {
            this.states.set(busId, fromDb.toObject());
            return this.states.get(busId);
        }
        return null;
    }

    /**
     * Update state in memory. 
     * This is synchronous and non-blocking for the caller!
     */
    updateBusState(busId, newStatePartial) {
        let current = this.states.get(busId) || {};

        // Merge
        const updated = { ...current, ...newStatePartial, busId };

        this.states.set(busId, updated);
        this.isDirty.add(busId);

        return updated;
    }

    /**
     * Flush dirty states to MongoDB
     */
    async flush() {
        if (this.isDirty.size === 0) return;

        const idsToUpdate = Array.from(this.isDirty);
        this.isDirty.clear(); // Reset immediately

        console.log(`💾 Flushing ${idsToUpdate.length} bus states to DB...`);

        // Bulk Write
        const ops = idsToUpdate.map(busId => {
            const state = this.states.get(busId);
            return {
                updateOne: {
                    filter: { busId: busId },
                    update: { $set: state },
                    upsert: true
                }
            };
        });

        try {
            if (ops.length > 0) {
                await BusState.bulkWrite(ops);
            }
        } catch (err) {
            console.error("❌ Failed to flush bus states:", err);
            // Re-add to dirty set to try again? 
            // Simplified: just log for now.
        }
    }
}

module.exports = new BusStateManager();
