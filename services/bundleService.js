// services/bundleService.js
const { PLANS } = require('../config/plans');

class BundleService {
    constructor() {
        this.lastUpdate = Date.now();
        this.updateInterval = 300000;
    }

    async getBundles() {
        // Generate bundles from PLANS config
        // Each plan becomes a bundle that works for all networks
        const bundles = PLANS.map((plan, index) => ({
            id: index + 1,
            name: `${plan.gb}GB SME Bundle`,
            price: plan.price,
            originalPrice: plan.originalPrice,
            data: `${plan.gb}GB`
        }));

        if (Date.now() - this.lastUpdate > this.updateInterval) {
            console.log('🔄 Refreshing bundle data...');
            this.lastUpdate = Date.now();
        }
        return bundles;
    }
}

module.exports = new BundleService();