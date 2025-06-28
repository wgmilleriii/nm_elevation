/**
 * Calculate distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @param {string} unit - Unit of measurement ('km', 'm', or 'mi')
 * @returns {number} Distance in specified unit
 */
export function calculateDistance(lat1, lon1, lat2, lon2, unit = 'km') {
    // Earth's radius in different units
    const R = {
        km: 6371,
        m: 6371000,
        mi: 3959
    };

    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R[unit] * c;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
export function toRad(degrees) {
    return degrees * Math.PI / 180;
}

/**
 * Calculate distance between two points with object parameters
 * @param {Object} point1 - First point {lat, lon} or {latitude, longitude}
 * @param {Object} point2 - Second point {lat, lon} or {latitude, longitude}
 * @param {string} unit - Unit of measurement ('km', 'm', or 'mi')
 * @returns {number} Distance in specified unit
 */
export function calculatePointDistance(point1, point2, unit = 'km') {
    const lat1 = point1.lat || point1.latitude;
    const lon1 = point1.lon || point1.longitude;
    const lat2 = point2.lat || point2.latitude;
    const lon2 = point2.lon || point2.longitude;

    return calculateDistance(lat1, lon1, lat2, lon2, unit);
} 