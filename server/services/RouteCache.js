const Route = require('../models/Route');

class RouteCacheService {
    constructor() {
        this.routes = new Map();
        this.isLoaded = false;
    }

    /**
     * Load all routes from MongoDB into memory.
     * Should be called on server startup.
     */
    async init() {
        try {
            console.log("🔄 Loading Route Cache...");
            const allRoutes = await Route.find({});

            for (const route of allRoutes) {
                // Ensure we optimize the polyline structure if needed, 
                // but for now, raw storage is fine as long as it's in RAM.
                this.routes.set(route.routeId, route);
            }

            this.isLoaded = true;
            console.log(`✅ Route Cache Loaded: ${this.routes.size} routes in memory.`);
        } catch (err) {
            console.error("❌ Failed to load Route Cache:", err);
            // Retry logic could go here
        }
    }

    /**
     * Get a route by ID from memory.
     * @param {string} routeId 
     * @returns {Object|null} The route document or null
     */
    getRoute(routeId) {
        if (!this.isLoaded) {
            console.warn("⚠️ RouteCache accessed before initialization.");
        }
        return this.routes.get(routeId) || null;
    }

    /**
     * manual reload if needed (e.g. admin api updates a route)
     */
    async reload() {
        this.routes.clear();
        await this.init();
    }
}

// Singleton instance
module.exports = new RouteCacheService();
