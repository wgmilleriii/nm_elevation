export class EdgeDetector {
    constructor(bounds, options = {}) {
        this.bounds = bounds;
        this.options = {
            gridResolution: options.gridResolution || 50,
            slopeThreshold: options.slopeThreshold || 30, // degrees
            edgeProminence: options.edgeProminence || 100, // meters
            minDistance: options.minDistance || 0.001, // ~100m at equator
            ...options
        };
    }

    async detectEdgePoints(pointCount) {
        // 1. Create elevation grid
        const grid = await this.createElevationGrid();
        
        // 2. Calculate slope and aspect
        const terrainMetrics = this.calculateTerrainMetrics(grid);
        
        // 3. Identify edge candidates
        const edgePoints = this.findEdgeCandidates(terrainMetrics);
        
        // 4. Select points along edges
        return this.selectEdgePoints(edgePoints, pointCount);
    }

    async createElevationGrid() {
        const { gridResolution } = this.options;
        const grid = Array(gridResolution).fill().map(() => Array(gridResolution).fill(null));
        
        // Sample elevations in grid pattern
        for(let i = 0; i < gridResolution; i++) {
            for(let j = 0; j < gridResolution; j++) {
                const lat = this.bounds.minLat + (i/gridResolution) * (this.bounds.maxLat - this.bounds.minLat);
                const lon = this.bounds.minLon + (j/gridResolution) * (this.bounds.maxLon - this.bounds.minLon);
                
                try {
                    const response = await fetch(`/api/elevation?lat=${lat}&lon=${lon}`);
                    const data = await response.json();
                    grid[i][j] = data.elevation;
                } catch (error) {
                    console.error(`Error fetching elevation for point (${lat}, ${lon}):`, error);
                    grid[i][j] = null;
                }
            }
        }
        
        return grid;
    }

    calculateTerrainMetrics(grid) {
        const { gridResolution } = this.options;
        const metrics = [];
        
        // Calculate cell size in meters (approximate)
        const latDist = (this.bounds.maxLat - this.bounds.minLat) * 111000; // 1 degree ≈ 111km
        const lonDist = (this.bounds.maxLon - this.bounds.minLon) * 111000 * 
                       Math.cos((this.bounds.minLat + this.bounds.maxLat) * Math.PI / 360);
        const cellSizeNS = latDist / gridResolution;
        const cellSizeEW = lonDist / gridResolution;

        for(let i = 1; i < gridResolution - 1; i++) {
            for(let j = 1; j < gridResolution - 1; j++) {
                if (grid[i][j] === null) continue;

                // Calculate elevation differences in all directions
                const dz_ns = (grid[i+1][j] - grid[i-1][j]) / (2 * cellSizeNS); // N-S slope
                const dz_ew = (grid[i][j+1] - grid[i][j-1]) / (2 * cellSizeEW); // E-W slope

                // Calculate slope and aspect
                const slope = Math.atan(Math.sqrt(dz_ns*dz_ns + dz_ew*dz_ew)) * 180/Math.PI;
                const aspect = Math.atan2(dz_ew, dz_ns) * 180/Math.PI;

                // Calculate terrain ruggedness (variation in elevation)
                const neighbors = [
                    grid[i-1][j], grid[i+1][j],
                    grid[i][j-1], grid[i][j+1],
                    grid[i-1][j-1], grid[i-1][j+1],
                    grid[i+1][j-1], grid[i+1][j+1]
                ].filter(e => e !== null);

                const ruggedness = Math.sqrt(
                    neighbors.reduce((sum, e) => sum + Math.pow(e - grid[i][j], 2), 0) / neighbors.length
                );

                metrics.push({
                    i, j,
                    elevation: grid[i][j],
                    slope,
                    aspect,
                    ruggedness
                });
            }
        }
        
        return metrics;
    }

    findEdgeCandidates(metrics) {
        const { slopeThreshold, edgeProminence } = this.options;
        
        // Filter points based on slope and ruggedness
        return metrics.filter(point => {
            // Consider points with steep slopes
            const steepSlope = point.slope > slopeThreshold;
            
            // Consider points with high ruggedness (terrain variability)
            const significantRuggedness = point.ruggedness > edgeProminence;
            
            return steepSlope || significantRuggedness;
        }).sort((a, b) => {
            // Sort by combined score of slope and ruggedness
            const scoreA = (a.slope / slopeThreshold) + (a.ruggedness / edgeProminence);
            const scoreB = (b.slope / slopeThreshold) + (b.ruggedness / edgeProminence);
            return scoreB - scoreA;
        });
    }

    selectEdgePoints(candidates, targetCount) {
        const selected = [];
        const { minDistance, gridResolution } = this.options;
        
        // Helper function to check if a point forms a good edge sequence
        const formsGoodSequence = (point, lastPoint) => {
            if (!lastPoint) return true;
            
            // Check if the points are reasonably aligned (similar aspect)
            const aspectDiff = Math.abs(point.aspect - lastPoint.aspect);
            return aspectDiff < 45 || aspectDiff > 315;
        };

        let lastSelected = null;
        for(const point of candidates) {
            const lat = this.bounds.minLat + (point.i/gridResolution) * (this.bounds.maxLat - this.bounds.minLat);
            const lon = this.bounds.minLon + (point.j/gridResolution) * (this.bounds.maxLon - this.bounds.minLon);
            
            // Check distance from already selected points
            const tooClose = selected.some(p => 
                this.distance(p.lat, p.lon, lat, lon) < minDistance
            );
            
            // Check if this point forms a good sequence with the last selected point
            const goodSequence = formsGoodSequence(point, lastSelected);
            
            if(!tooClose && goodSequence) {
                selected.push({ 
                    lat, 
                    lon,
                    elevation: point.elevation,
                    type: 'edge',
                    metadata: {
                        slope: point.slope,
                        aspect: point.aspect,
                        ruggedness: point.ruggedness
                    }
                });
                lastSelected = point;
            }
            
            if(selected.length >= targetCount) break;
        }
        
        return selected;
    }

    distance(lat1, lon1, lat2, lon2) {
        // Haversine distance calculation
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
} 