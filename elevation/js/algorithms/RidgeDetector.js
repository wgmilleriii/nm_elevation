export class RidgeDetector {
    constructor(bounds, options = {}) {
        this.bounds = bounds;
        this.options = {
            gridResolution: options.gridResolution || 50,
            gradientThreshold: options.gradientThreshold || 0.1,
            minDistance: options.minDistance || 0.001 // ~100m at equator
        };
    }

    async detectRidgePoints(pointCount) {
        // 1. Create initial elevation grid
        const grid = await this.createElevationGrid();
        
        // 2. Calculate gradients
        const gradients = this.calculateGradients(grid);
        
        // 3. Identify ridge candidates
        const ridgePoints = this.findRidgeCandidates(gradients);
        
        // 4. Select points along ridges
        return this.selectRidgePoints(ridgePoints, pointCount);
    }

    async createElevationGrid() {
        const { gridResolution } = this.options;
        const grid = Array(gridResolution).fill().map(() => Array(gridResolution).fill(null));
        
        // Sample elevations in grid pattern
        for(let i = 0; i < gridResolution; i++) {
            for(let j = 0; j < gridResolution; j++) {
                const lat = this.bounds.minLat + (i/gridResolution) * (this.bounds.maxLat - this.bounds.minLat);
                const lon = this.bounds.minLon + (j/gridResolution) * (this.bounds.maxLon - this.bounds.minLon);
                
                // Fetch elevation data
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

    calculateGradients(grid) {
        const gradients = [];
        const { gridResolution } = this.options;
        
        for(let i = 1; i < gridResolution - 1; i++) {
            for(let j = 1; j < gridResolution - 1; j++) {
                if (grid[i][j] === null) continue;

                // Calculate elevation gradients in all 8 directions
                const directions = [
                    [-1,0], [1,0], [0,-1], [0,1],    // N,S,W,E
                    [-1,1], [-1,-1], [1,1], [1,-1]   // NE,NW,SE,SW
                ];

                const dirGradients = directions.map(([di, dj]) => {
                    const neighborElev = grid[i + di][j + dj];
                    return neighborElev !== null ? neighborElev - grid[i][j] : null;
                });

                if (!dirGradients.includes(null)) {
                    gradients.push({
                        i, j,
                        elevation: grid[i][j],
                        gradients: dirGradients
                    });
                }
            }
        }
        
        return gradients;
    }

    findRidgeCandidates(gradients) {
        const { gradientThreshold } = this.options;
        
        return gradients.filter(point => {
            // A point is a ridge if it's higher than its neighbors in opposite directions
            const oppositeGradients = [
                [point.gradients[0], point.gradients[1]], // N-S
                [point.gradients[2], point.gradients[3]], // E-W
                [point.gradients[4], point.gradients[7]], // NE-SW
                [point.gradients[5], point.gradients[6]]  // NW-SE
            ];
            
            // Check if any pair of opposite gradients indicates a ridge
            return oppositeGradients.some(([g1, g2]) => 
                g1 < -gradientThreshold && g2 < -gradientThreshold
            );
        });
    }

    selectRidgePoints(ridgePoints, targetCount) {
        // Sort ridge points by "ridgeness" (how strongly they exhibit ridge characteristics)
        const sortedPoints = ridgePoints.sort((a, b) => {
            const aStrength = Math.min(...a.gradients);
            const bStrength = Math.min(...b.gradients);
            return bStrength - aStrength;
        });
        
        // Select points, ensuring good distribution
        const selected = [];
        const { minDistance, gridResolution } = this.options;
        
        for(const point of sortedPoints) {
            const lat = this.bounds.minLat + (point.i/gridResolution) * (this.bounds.maxLat - this.bounds.minLat);
            const lon = this.bounds.minLon + (point.j/gridResolution) * (this.bounds.maxLon - this.bounds.minLon);
            
            // Check distance from already selected points
            const tooClose = selected.some(p => 
                this.distance(p.lat, p.lon, lat, lon) < minDistance
            );
            
            if(!tooClose) {
                selected.push({ 
                    lat, 
                    lon,
                    elevation: point.elevation,
                    type: 'ridge'
                });
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