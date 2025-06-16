// Viewpoint Configuration (Corrales looking at Sandias)
export const VIEWPOINT_LAT = 35.11542;  // Moved closer to the mountains
export const VIEWPOINT_LON = -106.4979;
export const VIEWPOINT_HEADING = 0;  // Looking directly north

// Reference points
export const CORRALES_LAT = 35.2372;
export const CORRALES_LON = -106.6067;
export const PAISANO_LAT = 35.1154;
export const PAISANO_LON = -106.4979;
export const CHICAGO_LAT = 41.8781;
export const CHICAGO_LON = -87.6298;

// View Range Configuration
export const NUM_RIDGES = 15;
export const DISTANCE_RANGE = 30000;  // 30km range
export const ANGLE_RANGE = 120;       // 120 degree field of view
export const MIN_OBSERVER_HEIGHT = 1500;
export const MAX_OBSERVER_HEIGHT = 2500;  // Increased max height
export const DEFAULT_OBSERVER_HEIGHT = 1700;

// Log configuration on load
console.log('Sandia Viewer Configuration:', {
    viewpoint: {
        lat: VIEWPOINT_LAT,
        lon: VIEWPOINT_LON,
        heading: VIEWPOINT_HEADING
    },
    viewRange: {
        distance: DISTANCE_RANGE,
        angle: ANGLE_RANGE
    },
    observer: {
        minHeight: MIN_OBSERVER_HEIGHT,
        maxHeight: MAX_OBSERVER_HEIGHT,
        defaultHeight: DEFAULT_OBSERVER_HEIGHT
    }
});

// Ridge Colors (from front to back)
export const RIDGE_COLORS = [
    'rgba(169, 169, 169, 0.9)', // Light front ridges
    'rgba(128, 128, 128, 0.8)',
    'rgba(105, 105, 105, 0.7)',
    'rgba(90, 90, 90, 0.6)',
    'rgba(75, 75, 75, 0.5)',
    'rgba(60, 60, 60, 0.4)',
    'rgba(45, 45, 45, 0.3)',
    'rgba(30, 30, 30, 0.2)',
    'rgba(15, 15, 15, 0.1)', // Dark distant ridges
];

// Google Maps API key
export const GOOGLE_MAPS_API_KEY = 'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8';

// Default settings
export const DEFAULT_SETTINGS = {
    distance: 20,
    height: 100,
    opacity: 50,
    mapType: 'satellite'
}; 