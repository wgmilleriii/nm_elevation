// Calculate bearing between two points
export function calculateBearing(from, to) {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLon = (to.lng - from.lng) * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
             Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    if (bearing < 0) bearing += 360;
    return bearing;
}

// Check if point is within New Mexico bounds
export function isWithinNewMexico(lat, lng) {
    const NM_BOUNDS = {
        minLat: 31.33,
        maxLat: 37.00,
        minLon: -109.05,
        maxLon: -103.00
    };
    
    return lat >= NM_BOUNDS.minLat && lat <= NM_BOUNDS.maxLat &&
           lng >= NM_BOUNDS.minLon && lng <= NM_BOUNDS.maxLon;
}

// Calculate points along multiple concentric arcs
export function calculateArcPoints(center, edge, numArcs = 10) {
    const baseRadius = center.distanceTo(edge);
    const bearing = calculateBearing(center, edge);
    const allPoints = [];
    
    // Fixed radius increment (in meters)
    const radiusIncrement = baseRadius * 0.2; // 20% of base radius as increment
    
    // Calculate points for each arc
    for (let arcIndex = 0; arcIndex < numArcs; arcIndex++) {
        const radius = baseRadius + (arcIndex * radiusIncrement);
        const points = [];
        
        // Calculate 10 points along this arc
        const arcAngle = 45; // degrees on each side of bearing
        const angleStep = (arcAngle * 2) / 9; // 9 steps for 10 points
        
        for (let i = 0; i < 10; i++) {
            const angle = ((bearing - arcAngle + (i * angleStep)) * Math.PI / 180);
            const lat = center.lat + (radius * Math.cos(angle) / 111320);
            const lng = center.lng + (radius * Math.sin(angle) / (111320 * Math.cos(center.lat * Math.PI / 180)));
            
            // Only add points within New Mexico
            if (isWithinNewMexico(lat, lng)) {
                points.push({
                    lat,
                    lng,
                    arcIndex,
                    pointIndex: i,
                    radius,
                    angle: bearing - arcAngle + (i * angleStep)
                });
            }
        }
        
        if (points.length > 0) {
            allPoints.push(points);
        }
    }
    
    return allPoints;
}

// Draw viewing arc on the map
export async function drawViewingArc(center, edge, map) {
    // Calculate radius and bearing
    const radius = center.distanceTo(edge);
    const bearing = calculateBearing(center, edge);
    
    // Create arc points (90 degrees total, 45 degrees each side of bearing)
    const points = [];
    const arcAngle = 45; // degrees on each side of bearing
    for (let i = -arcAngle; i <= arcAngle; i++) {
        const angle = ((bearing + i) * Math.PI / 180);
        const point = [
            center.lat + (radius * Math.cos(angle) / 111320),
            center.lng + (radius * Math.sin(angle) / (111320 * Math.cos(center.lat * Math.PI / 180)))
        ];
        
        // Only add points within New Mexico
        if (isWithinNewMexico(point[0], point[1])) {
            points.push(point);
        }
    }
    
    // Draw arc if we have points
    if (points.length > 0) {
        return L.polyline(points, {
            color: 'green',
            weight: 4
        }).addTo(map);
    }
    
    return null;
} 