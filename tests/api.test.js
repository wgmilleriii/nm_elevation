import fetch from 'node-fetch';

const API_BASE = process.env.NODE_ENV === 'test' 
    ? 'http://localhost:3001/api'
    : 'http://localhost:3000/api';

describe('Elevation API Tests', () => {
    // Helper function to check if a point has valid elevation data
    const isValidElevationPoint = (point) => {
        expect(point).toHaveProperty('latitude');
        expect(point).toHaveProperty('longitude');
        expect(point).toHaveProperty('elevation');
        expect(typeof point.latitude).toBe('number');
        expect(typeof point.longitude).toBe('number');
        expect(typeof point.elevation).toBe('number');
    };

    // Helper function to check if stats object is valid
    const isValidStats = (stats) => {
        expect(stats).toHaveProperty('min_elevation');
        expect(stats).toHaveProperty('max_elevation');
        expect(stats).toHaveProperty('point_count');
        expect(typeof stats.min_elevation).toBe('number');
        expect(typeof stats.max_elevation).toBe('number');
        expect(typeof stats.point_count).toBe('number');
        expect(stats.min_elevation).toBeLessThanOrEqual(stats.max_elevation);
        expect(stats.point_count).toBeGreaterThan(0);
    };

    describe('GET /api/elevation-data', () => {
        test('should return initial data without bounds', async () => {
            const response = await fetch(`${API_BASE}/elevation-data`);
            expect(response.status).toBe(200);
            
            const data = await response.json();
            expect(data).toHaveProperty('points');
            expect(data).toHaveProperty('stats');
            expect(Array.isArray(data.points)).toBe(true);
            expect(data.points.length).toBeGreaterThan(0);
            
            // Check first point structure
            isValidElevationPoint(data.points[0]);
            isValidStats(data.stats);
        });

        test('should return grid data with bounds', async () => {
            const bounds = '34.0,-106.0,34.1,-105.9'; // Small area in NM
            const response = await fetch(`${API_BASE}/elevation-data?bounds=${bounds}`);
            expect(response.status).toBe(200);
            
            const data = await response.json();
            expect(data).toHaveProperty('points');
            expect(data).toHaveProperty('stats');
            expect(Array.isArray(data.points)).toBe(true);
            expect(data.points.length).toBe(24 * 24); // Should return exact grid
            
            // Check grid points
            data.points.forEach(isValidElevationPoint);
            isValidStats(data.stats);
        });

        test('should handle invalid bounds gracefully', async () => {
            const bounds = 'invalid,bounds';
            const response = await fetch(`${API_BASE}/elevation-data?bounds=${bounds}`);
            expect(response.status).toBe(400);
            
            const data = await response.json();
            expect(data).toHaveProperty('error');
            expect(data.error).toContain('Invalid bounds format');
        });

        test('should reject bounds outside New Mexico', async () => {
            const bounds = '40.0,-110.0,41.0,-109.0'; // Outside NM
            const response = await fetch(`${API_BASE}/elevation-data?bounds=${bounds}`);
            expect(response.status).toBe(400);
            
            const data = await response.json();
            expect(data).toHaveProperty('error');
            expect(data.error).toBe('Bounds must be within New Mexico');
            expect(data).toHaveProperty('validBounds');
        });

        test('should reject invalid bounds order', async () => {
            const bounds = '34.1,-106.0,34.0,-105.9'; // maxLat < minLat
            const response = await fetch(`${API_BASE}/elevation-data?bounds=${bounds}`);
            expect(response.status).toBe(400);
            
            const data = await response.json();
            expect(data).toHaveProperty('error');
            expect(data.error).toContain('min values must be less than max values');
        });
    });

    describe('GET /api/santa-fe-elevation', () => {
        test('should return elevation data for Santa Fe area', async () => {
            const params = {
                lat: 35.6870,
                lon: -105.9378,
                radius: 5 // 5km radius
            };
            
            const response = await fetch(
                `${API_BASE}/santa-fe-elevation?lat=${params.lat}&lon=${params.lon}&radius=${params.radius}`
            );
            expect(response.status).toBe(200);
            
            const data = await response.json();
            expect(data).toHaveProperty('points');
            expect(data).toHaveProperty('stats');
            expect(Array.isArray(data.points)).toBe(true);
            expect(data.points.length).toBeGreaterThan(0);
            
            // Check points and stats
            data.points.forEach(isValidElevationPoint);
            isValidStats(data.stats);
            
            // Check additional Santa Fe specific stats
            expect(data.stats).toHaveProperty('avg_elevation');
            expect(data.stats).toHaveProperty('area_km2');
            expect(typeof data.stats.avg_elevation).toBe('number');
            expect(typeof data.stats.area_km2).toBe('number');
        });

        test('should handle invalid coordinates', async () => {
            const params = {
                lat: 'invalid',
                lon: 'invalid',
                radius: 'invalid'
            };
            
            const response = await fetch(
                `${API_BASE}/santa-fe-elevation?lat=${params.lat}&lon=${params.lon}&radius=${params.radius}`
            );
            expect(response.status).toBe(500);
            
            const data = await response.json();
            expect(data).toHaveProperty('error');
        });
    });

    describe('POST /api/enhance-region', () => {
        test('should start enhancement process for valid bounds', async () => {
            const bounds = {
                minLat: 34.0,
                maxLat: 34.1,
                minLon: -106.0,
                maxLon: -105.9
            };
            
            const response = await fetch(`${API_BASE}/enhance-region`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bounds)
            });
            expect(response.status).toBe(200);
            
            const data = await response.json();
            expect(data).toHaveProperty('status');
            expect(data).toHaveProperty('bounds');
            expect(data).toHaveProperty('message');
            expect(data.status).toBe('started');
        });

        test('should reject bounds outside New Mexico', async () => {
            const bounds = {
                minLat: 40.0, // Outside NM
                maxLat: 41.0,
                minLon: -110.0,
                maxLon: -109.0
            };
            
            const response = await fetch(`${API_BASE}/enhance-region`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bounds)
            });
            expect(response.status).toBe(400);
            
            const data = await response.json();
            expect(data).toHaveProperty('error');
            expect(data.error).toContain('Selected region must be within New Mexico');
        });

        test('should handle missing bounds parameters', async () => {
            const bounds = {
                minLat: 34.0
                // Missing other parameters
            };
            
            const response = await fetch(`${API_BASE}/enhance-region`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bounds)
            });
            expect(response.status).toBe(400);
            
            const data = await response.json();
            expect(data).toHaveProperty('error');
            expect(data).toHaveProperty('details');
        });
    });
}); 