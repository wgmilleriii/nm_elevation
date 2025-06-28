import { CORRALES_LAT, CORRALES_LON } from './config.js';

// Convert degrees to miles (approximate)
export function degreesToMiles(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
             Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
             Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Get color based on elevation
export function getColor(elev, min, max) {
    const t = (elev - min) / (max - min);
    const r = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 2)));
    const g = Math.round(255 * (1 - Math.abs(t - 0.5) * 2));
    const b = Math.round(255 * Math.max(0, (0.5 - t) * 2));
    return `rgb(${r},${g},${b})`;
}

// Calculate distance from Corrales
export function getDistanceFromCorrales(lat, lon) {
    return degreesToMiles(CORRALES_LAT, CORRALES_LON, lat, lon);
} 