/**
 * Dynamic Viewing Area System
 * Calculates personalized horizon views based on user location and heading
 */

export class ViewingArea {
    constructor(options = {}) {
        this.options = {
            viewingAngle: options.viewingAngle || 90, // 90-degree viewing arc
            maxDistance: options.maxDistance || 160934, // 100 miles in meters
            minDistance: options.minDistance || 160, // 0.1 miles in meters
            pointDensity: options.pointDensity || 'adaptive', // 'low', 'medium', 'high', 'adaptive'
            maxPoints: options.maxPoints || 360,
            ...options
        };
        
        // Concentric circle distances in meters
        this.distances = [
            160,    // 0.1 miles - Immediate foreground
            402,    // 0.25 miles - Near terrain
            805,    // 0.5 miles - Local topography
            1609,   // 1 mile - Neighborhood scale
            3219,   // 2 miles - Community scale
            8047,   // 5 miles - Regional features
            16093,  // 10 miles - Distant landmarks
            32187,  // 20 miles - Far terrain
            80467,  // 50 miles - Mountain ranges
            160934  // 100 miles - Horizon features
        ];
        
        this.collectionQueue = [];
        this.visibilityCache = new Map();
        this.elevationCache = new Map();
    }

    /**
     * Calculate viewing area points based on user location and heading
     * @param {number} userLat - User's latitude
     * @param {number} userLon - User's longitude
     * @param {number} userHeading - User's heading in degrees (0-360)
     * @param {number} userElevation - User's elevation in meters
     * @returns {Object} Collection of points organized by distance rings
     */
    calculateViewingArea(userLat, userLon, userHeading, userElevation = 0) {
        const viewingArea = {
            center: { lat: userLat, lon: userLon, elevation: userElevation },
            heading: userHeading,
            rings: [],
            totalPoints: 0,
            metadata: {
                timestamp: new Date().toISOString(),
                viewingAngle: this.options.viewingAngle,
                maxDistance: this.options.maxDistance
            }
        };

        // Calculate points for each concentric ring
        for (let i = 0; i < this.distances.length; i++) {
            const distance = this.distances[i];
            const ring = this.calculateRingPoints(
                userLat, userLon, userHeading, distance, i
            );
            
            viewingArea.rings.push(ring);
            viewingArea.totalPoints += ring.points.length;
        }

        return viewingArea;
    }

    /**
     * Calculate points for a single concentric ring
     * @param {number} centerLat - Center latitude
     * @param {number} centerLon - Center longitude
     * @param {number} heading - Viewing direction in degrees
     * @param {number} distance - Ring distance in meters
     * @param {number} ringIndex - Ring index (0 = closest)
     * @returns {Object} Ring data with points
     */
    calculateRingPoints(centerLat, centerLon, heading, distance, ringIndex) {
        const ring = {
            distance: distance,
            distanceMiles: this.metersToMiles(distance),
            ringIndex: ringIndex,
            points: [],
            priority: this.calculateRingPriority(distance, ringIndex)
        };

        // Calculate point density based on distance and ring index
        const pointCount = this.calculatePointDensity(distance, ringIndex);
        
        // Calculate angular step for points around the arc
        const angleStep = this.options.viewingAngle / (pointCount - 1);
        const startAngle = heading - (this.options.viewingAngle / 2);

        // Generate points along the viewing arc
        for (let i = 0; i < pointCount; i++) {
            const angle = startAngle + (i * angleStep);
            const point = this.calculatePointAtDistanceAndBearing(
                centerLat, centerLon, distance, angle
            );
            
            // Add metadata to point
            point.ringIndex = ringIndex;
            point.distance = distance;
            point.distanceMiles = ring.distanceMiles;
            point.bearing = this.normalizeBearing(angle);
            point.priority = ring.priority;
            point.pointIndex = i;
            point.id = `r${ringIndex}_p${i}_${Math.round(point.lat * 1000000)}_${Math.round(point.lon * 1000000)}`;
            
            ring.points.push(point);
        }

        return ring;
    }

    /**
     * Calculate point density for a given distance ring
     * @param {number} distance - Distance in meters
     * @param {number} ringIndex - Ring index
     * @returns {number} Number of points for this ring
     */
    calculatePointDensity(distance, ringIndex) {
        const baseDensity = {
            low: [5, 8, 10, 12, 15, 18, 20, 22, 25, 30],
            medium: [8, 12, 16, 20, 25, 30, 35, 40, 45, 50],
            high: [12, 18, 24, 30, 40, 50, 60, 70, 80, 100],
            adaptive: [6, 10, 14, 18, 24, 30, 36, 42, 48, 60]
        };

        const density = baseDensity[this.options.pointDensity] || baseDensity.adaptive;
        return density[ringIndex] || density[density.length - 1];
    }

    /**
     * Calculate priority for a ring based on distance and importance
     * @param {number} distance - Distance in meters
     * @param {number} ringIndex - Ring index
     * @returns {number} Priority score (higher = more important)
     */
    calculateRingPriority(distance, ringIndex) {
        // Closer rings get higher priority, but with some adjustments
        const basePriority = 100 - ringIndex * 10;
        
        // Boost priority for certain "sweet spot" distances
        const sweetSpots = [805, 1609, 8047, 32187]; // 0.5mi, 1mi, 5mi, 20mi
        const isSweetSpot = sweetSpots.includes(distance);
        
        return basePriority + (isSweetSpot ? 15 : 0);
    }

    /**
     * Calculate a point at a specific distance and bearing from origin
     * @param {number} lat - Origin latitude
     * @param {number} lon - Origin longitude
     * @param {number} distance - Distance in meters
     * @param {number} bearing - Bearing in degrees
     * @returns {Object} Point with lat/lon coordinates
     */
    calculatePointAtDistanceAndBearing(lat, lon, distance, bearing) {
        const R = 6371000; // Earth's radius in meters
        const φ1 = lat * Math.PI / 180;
        const λ1 = lon * Math.PI / 180;
        const θ = bearing * Math.PI / 180;

        const φ2 = Math.asin(
            Math.sin(φ1) * Math.cos(distance / R) +
            Math.cos(φ1) * Math.sin(distance / R) * Math.cos(θ)
        );

        const λ2 = λ1 + Math.atan2(
            Math.sin(θ) * Math.sin(distance / R) * Math.cos(φ1),
            Math.cos(distance / R) - Math.sin(φ1) * Math.sin(φ2)
        );

        return {
            lat: φ2 * 180 / Math.PI,
            lon: λ2 * 180 / Math.PI
        };
    }

    /**
     * Filter points based on visibility from user's vantage point
     * @param {Object} viewingArea - Viewing area data
     * @param {Array} elevationData - Array of elevation data points
     * @returns {Object} Filtered viewing area with visibility data
     */
    filterByVisibility(viewingArea, elevationData) {
        const userPoint = viewingArea.center;
        const filteredArea = { ...viewingArea };
        
        filteredArea.rings = viewingArea.rings.map(ring => {
            const filteredRing = { ...ring };
            filteredRing.points = ring.points.map(point => {
                const visibility = this.calculateLineOfSight(
                    userPoint, point, elevationData
                );
                
                return {
                    ...point,
                    visible: visibility.visible,
                    obstruction: visibility.obstruction,
                    visibilityScore: visibility.score
                };
            });
            
            // Update ring statistics
            filteredRing.visiblePoints = filteredRing.points.filter(p => p.visible).length;
            filteredRing.visibilityRatio = filteredRing.visiblePoints / filteredRing.points.length;
            
            return filteredRing;
        });

        return filteredArea;
    }

    /**
     * Calculate line of sight between two points
     * @param {Object} observer - Observer point with lat, lon, elevation
     * @param {Object} target - Target point with lat, lon, elevation
     * @param {Array} elevationData - Terrain elevation data
     * @returns {Object} Visibility information
     */
    calculateLineOfSight(observer, target, elevationData) {
        // Simple line of sight calculation
        // In a real implementation, this would sample terrain points along the line
        
        const distance = this.calculateDistance(
            observer.lat, observer.lon, target.lat, target.lon
        );
        
        // For now, assume visibility decreases with distance and terrain complexity
        const baseVisibility = Math.max(0, 1 - (distance / this.options.maxDistance));
        
        // Add some terrain-based visibility logic here
        const terrainFactor = this.estimateTerrainObstruction(observer, target, elevationData);
        
        const visibilityScore = baseVisibility * terrainFactor;
        
        return {
            visible: visibilityScore > 0.3,
            score: visibilityScore,
            obstruction: visibilityScore < 0.3 ? 'terrain' : null
        };
    }

    /**
     * Estimate terrain obstruction between two points
     * @param {Object} observer - Observer point
     * @param {Object} target - Target point
     * @param {Array} elevationData - Terrain data
     * @returns {number} Terrain factor (0-1, 1 = no obstruction)
     */
    estimateTerrainObstruction(observer, target, elevationData) {
        // Simplified terrain obstruction calculation
        // Real implementation would sample elevation along the line of sight
        
        const elevationDiff = Math.abs((target.elevation || 0) - (observer.elevation || 0));
        const distance = this.calculateDistance(
            observer.lat, observer.lon, target.lat, target.lon
        );
        
        // Simple heuristic: steep elevation changes over short distances suggest obstruction
        const gradient = elevationDiff / distance;
        
        if (gradient > 0.1) return 0.5; // Moderate obstruction
        if (gradient > 0.05) return 0.7; // Light obstruction
        
        return 1.0; // No significant obstruction
    }

    /**
     * Prioritize points for data collection
     * @param {Object} viewingArea - Viewing area data
     * @returns {Array} Prioritized list of points for collection
     */
    prioritizeForCollection(viewingArea) {
        const allPoints = [];
        
        // Flatten all points from all rings
        viewingArea.rings.forEach(ring => {
            ring.points.forEach(point => {
                allPoints.push({
                    ...point,
                    ringPriority: ring.priority,
                    needsElevation: !point.elevation
                });
            });
        });

        // Sort by priority (higher priority first)
        allPoints.sort((a, b) => {
            // First sort by whether elevation is needed
            if (a.needsElevation && !b.needsElevation) return -1;
            if (!a.needsElevation && b.needsElevation) return 1;
            
            // Then by visibility (visible points first)
            if (a.visible && !b.visible) return -1;
            if (!a.visible && b.visible) return 1;
            
            // Then by ring priority
            if (a.ringPriority !== b.ringPriority) {
                return b.ringPriority - a.ringPriority;
            }
            
            // Finally by distance (closer first)
            return a.distance - b.distance;
        });

        return allPoints;
    }

    // Utility functions
    metersToMiles(meters) {
        return meters * 0.000621371;
    }

    milesToMeters(miles) {
        return miles * 1609.34;
    }

    normalizeBearing(bearing) {
        while (bearing < 0) bearing += 360;
        while (bearing >= 360) bearing -= 360;
        return bearing;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    /**
     * Generate collection request for API
     * @param {Object} viewingArea - Viewing area data
     * @returns {Object} API request payload
     */
    generateCollectionRequest(viewingArea) {
        const prioritizedPoints = this.prioritizeForCollection(viewingArea);
        
        return {
            type: 'viewing_area_collection',
            center: viewingArea.center,
            heading: viewingArea.heading,
            timestamp: viewingArea.metadata.timestamp,
            points: prioritizedPoints.slice(0, 100), // Limit to first 100 points
            metadata: {
                totalRings: viewingArea.rings.length,
                totalPoints: viewingArea.totalPoints,
                viewingAngle: this.options.viewingAngle,
                maxDistance: this.options.maxDistance
            }
        };
    }

    calculateDestinationPoint(lat, lon, distance, bearing) {
        const R = 6371000; // Earth's radius in meters
        const d = distance / R; // Angular distance
        const lat1 = this.toRadians(lat);
        const lon1 = this.toRadians(lon);
        const brng = this.toRadians(bearing);

        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(d) +
            Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
        );

        const lon2 = lon1 + Math.atan2(
            Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );

        return {
            lat: this.toDegrees(lat2),
            lon: this.toDegrees(lon2)
        };
    }

    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    toDegrees(radians) {
        return radians * 180 / Math.PI;
    }
} 