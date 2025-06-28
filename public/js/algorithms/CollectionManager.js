import { CollectionAlgorithm } from './CollectionAlgorithm.js';
import { RidgeDetector } from './RidgeDetector.js';
import { EdgeDetector } from './EdgeDetector.js';

export class CollectionManager {
    constructor(options = {}) {
        this.options = {
            defaultAlgorithm: CollectionAlgorithm.RANDOM,
            pointsPerZoomLevel: (zoom) => Math.pow(2, Math.min(zoom - 8, 6)) * 100,
            ...options
        };
        this.currentAlgorithm = this.options.defaultAlgorithm;
    }

    setAlgorithm(algorithm) {
        if (!Object.values(CollectionAlgorithm).includes(algorithm)) {
            throw new Error(`Invalid algorithm: ${algorithm}`);
        }
        this.currentAlgorithm = algorithm;
    }

    async collectPoints(bounds, zoom) {
        const pointCount = this.options.pointsPerZoomLevel(zoom);
        const normalizedBounds = CollectionManager.normalizeBounds(bounds);
        
        switch(this.currentAlgorithm) {
            case CollectionAlgorithm.RIDGE_DETECT:
                return this.collectRidgePoints(normalizedBounds, pointCount, zoom);
            case CollectionAlgorithm.EDGE_FOLLOW:
                return this.collectEdgePoints(normalizedBounds, pointCount, zoom);
            case CollectionAlgorithm.RANDOM:
            default:
                return this.collectRandomPoints(normalizedBounds, pointCount);
        }
    }

    async collectRidgePoints(bounds, pointCount, zoom) {
        const detector = new RidgeDetector(bounds, {
            gridResolution: Math.min(50, Math.ceil(Math.sqrt(pointCount) * 1.5)),
            gradientThreshold: 0.1,
            minDistance: (bounds.maxLat - bounds.minLat) / Math.sqrt(pointCount)
        });

        return await detector.detectRidgePoints(pointCount);
    }

    async collectEdgePoints(bounds, pointCount, zoom) {
        const detector = new EdgeDetector(bounds, {
            gridResolution: Math.min(50, Math.ceil(Math.sqrt(pointCount) * 1.5)),
            slopeThreshold: 30 - Math.min(10, zoom), // Adjust threshold based on zoom
            edgeProminence: 100 * Math.pow(0.8, Math.max(0, zoom - 12)), // Reduce prominence requirement at high zoom
            minDistance: (bounds.maxLat - bounds.minLat) / Math.sqrt(pointCount)
        });

        return await detector.detectEdgePoints(pointCount);
    }

    collectRandomPoints(bounds, pointCount) {
        const points = [];
        for(let i = 0; i < pointCount; i++) {
            const lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
            const lon = bounds.minLon + Math.random() * (bounds.maxLon - bounds.minLon);
            points.push({ lat, lon, type: 'random' });
        }
        return points;
    }

    // Helper method to validate and normalize bounds
    static normalizeBounds(bounds) {
        const normalized = {
            minLat: Math.max(-90, Math.min(bounds.south, bounds.north)),
            maxLat: Math.min(90, Math.max(bounds.south, bounds.north)),
            minLon: Math.max(-180, Math.min(bounds.west, bounds.east)),
            maxLon: Math.min(180, Math.max(bounds.west, bounds.east))
        };

        if (normalized.maxLat - normalized.minLat < 0.0001 ||
            normalized.maxLon - normalized.minLon < 0.0001) {
            throw new Error('Bounds area too small');
        }

        return normalized;
    }
} 