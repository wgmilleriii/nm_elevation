// Reference points
const CORRALES_LAT = 35.2378;
const CORRALES_LON = -106.6067;
const PAISANO_LAT = 35.09993547269065;
const PAISANO_LON = -106.51323662365995;

// Version
const VERSION = '3.4.3';

// Google Maps API key
const GOOGLE_MAPS_API_KEY = 'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8';

// Default settings
const DEFAULT_SETTINGS = {
    distance: 20,
    height: 100,
    opacity: 50,
    mapType: 'satellite'
};

// Make constants available globally
window.VERSION = VERSION;
window.CORRALES_LAT = CORRALES_LAT;
window.CORRALES_LON = CORRALES_LON;
window.PAISANO_LAT = PAISANO_LAT;
window.PAISANO_LON = PAISANO_LON;
window.GOOGLE_MAPS_API_KEY = GOOGLE_MAPS_API_KEY;
window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

// Configuration for Elevation GPS Tracker
// Allows switching between local development and production

const CONFIG = {
    // Development mode - set to true for local testing
    DEV_MODE: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    
    // API Configuration
    API: {
        // Production API (hanon.artsmetrics.net)
        PRODUCTION: {
            BASE_URL: 'https://hanon.artsmetrics.net/elevation',
            ENDPOINTS: {
                USER_INIT: 'https://hanon.artsmetrics.net/elevation/api/user/init',
                SESSION_START: 'https://hanon.artsmetrics.net/elevation/api/user/session/start',
                SESSION_END: 'https://hanon.artsmetrics.net/elevation/api/user/session/end',
                SESSION_HEARTBEAT: 'https://hanon.artsmetrics.net/elevation/api/user/session/heartbeat',
                TRACK_POINT: 'https://hanon.artsmetrics.net/elevation/api/user/track-point',
                VERSION: 'https://hanon.artsmetrics.net/elevation/api/version',
                ELEVATION: 'https://hanon.artsmetrics.net/elevation/api/elevation'
            }
        },
        
        // Local development (relative paths, but can post to production)
        LOCAL: {
            BASE_URL: '',
            ENDPOINTS: {
                // Option 1: Use production APIs from local (recommended for testing)
                USER_INIT: 'https://hanon.artsmetrics.net/elevation/api/user/init',
                SESSION_START: 'https://hanon.artsmetrics.net/elevation/api/user/session/start',
                SESSION_END: 'https://hanon.artsmetrics.net/elevation/api/user/session/end',
                SESSION_HEARTBEAT: 'https://hanon.artsmetrics.net/elevation/api/user/session/heartbeat',
                TRACK_POINT: 'https://hanon.artsmetrics.net/elevation/api/user/track-point',
                VERSION: 'https://hanon.artsmetrics.net/elevation/api/version',
                ELEVATION: 'https://hanon.artsmetrics.net/elevation/api/elevation'
                
                // Option 2: Use local APIs (uncomment if you have local backend)
                // USER_INIT: './api/user/init',
                // SESSION_START: './api/user/session/start',
                // SESSION_END: './api/user/session/end',
                // SESSION_HEARTBEAT: './api/user/session/heartbeat',
                // TRACK_POINT: './api/user/track-point',
                // VERSION: './api/version',
                // ELEVATION: './api/elevation'
            }
        }
    },
    
    // Get current API configuration
    getAPI() {
        return this.DEV_MODE ? this.API.LOCAL : this.API.PRODUCTION;
    },
    
    // Get endpoint URL
    getEndpoint(name) {
        const api = this.getAPI();
        return api.ENDPOINTS[name] || api.ENDPOINTS[name.toUpperCase()];
    },
    
    // Development settings
    DEV: {
        // Enhanced logging in development
        VERBOSE_LOGGING: true,
        
        // More lenient GPS settings for testing
        GPS_TIMEOUT: 20000, // 20 seconds
        GPS_MAX_AGE: 10000, // 10 seconds
        GPS_HIGH_ACCURACY: false, // Faster for testing
        
        // Mock data for testing without GPS
        MOCK_GPS: false,
        MOCK_LOCATION: {
            lat: 35.0844,
            lon: -106.6504,
            accuracy: 25
        }
    },
    
    // Production settings
    PROD: {
        VERBOSE_LOGGING: false,
        GPS_TIMEOUT: 15000,
        GPS_MAX_AGE: 5000,
        GPS_HIGH_ACCURACY: true,
        MOCK_GPS: false
    },
    
    // Get current settings
    getSettings() {
        return this.DEV_MODE ? this.DEV : this.PROD;
    },
    
    // Utility functions
    log(...args) {
        if (this.getSettings().VERBOSE_LOGGING) {
            console.log(`[${this.DEV_MODE ? 'DEV' : 'PROD'}]`, ...args);
        }
    },
    
    warn(...args) {
        console.warn(`[${this.DEV_MODE ? 'DEV' : 'PROD'}]`, ...args);
    },
    
    error(...args) {
        console.error(`[${this.DEV_MODE ? 'DEV' : 'PROD'}]`, ...args);
    }
};

// Auto-detect environment and log
CONFIG.log('🔧 Environment detected:', CONFIG.DEV_MODE ? 'DEVELOPMENT' : 'PRODUCTION');
CONFIG.log('🌐 API Base URL:', CONFIG.getAPI().BASE_URL || 'relative');
CONFIG.log('⚙️ Settings:', CONFIG.getSettings());

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
} 