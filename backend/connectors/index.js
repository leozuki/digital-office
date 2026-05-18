/**
 * Connectors Registry
 * Central hub for all external platform connections.
 */
const WordPressService = require('../services/wordpressService');
// Add more services as they are built (HubSpot, Zalo, etc.)

class ConnectorsManager {
  constructor() {
    this.connectors = new Map();
    this.init();
  }

  init() {
    // Initialize WordPress if config exists
    if (process.env.WP_URL) {
      this.register('wordpress', new WordPressService(
        process.env.WP_URL,
        process.env.WP_USER,
        process.env.WP_APP_PASSWORD
      ));
    }
    
    // Placeholder for other connectors
    // this.register('hubspot', new HubSpotService(...));
    // this.register('zalo', new ZaloService(...));
  }

  register(name, instance) {
    console.log(`[Connectors] Registered: ${name}`);
    this.connectors.set(name, instance);
  }

  get(name) {
    return this.connectors.get(name);
  }

  list() {
    return Array.from(this.connectors.keys());
  }
}

module.exports = new ConnectorsManager();
