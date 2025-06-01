import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Add middleware
app.use(express.static('public'));
app.use(express.json());  // Add JSON body parser
app.use(express.urlencoded({ extended: true }));  // Add URL-encoded parser

// Initialize database connection
async function getDb(lat, lon) {
    // Determine grid coordinates based on lat and lon
    const gridX = Math.floor((lon - (-109.05)) / ((-103.00) - (-109.05)) * 10);
    const gridY = Math.floor((lat - 31.33) / (37.00 - 31.33) * 10);
    const dbPath = path.join(__dirname, 'grid_databases', `mountains_${gridX}_${gridY}.db');
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
        console.error('Grid database file not found:', dbPath);
        throw new Error('Grid database file not found');
    }
    
    console.log('Opening grid database at:', dbPath);
    return open({
        filename: dbPath,
        driver: sqlite3.Database
    });
}

app.get('/api/elevation-data', async (req, res) => {
    try {
        const isHighRes = req.query.resolution === 'high';
        console.log(`Received request for elevation data (${isHighRes ? 'high' : 'low'} resolution)`);
        
        // Use a default grid (e.g., 0,0) if no coordinates are provided
        const lat = parseFloat(req.query.lat) || 31.33;
        const lon = parseFloat(req.query.lon) || -109.05;
        const db = await getDb(lat, lon);
        
        // Check if table exists
        const tableCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='elevation_points'");
        if (!tableCheck) {
            console.error('elevation_points table not found in database');
            throw new Error('Database table not found');
        }
        
        // In low-res mode, only select every 7th point using ROW_NUMBER
        const query = isHighRes ? 
            'SELECT latitude, longitude, elevation FROM elevation_points' :
            `WITH numbered_points AS (
                SELECT latitude, longitude, elevation,
                ROW_NUMBER() OVER (ORDER BY latitude, longitude) as row_num
                FROM elevation_points
            )
            SELECT latitude, longitude, elevation
            FROM numbered_points
            WHERE row_num % 2 = 0`;
        
        const data = await db.all(query);
        console.log(`Found ${data.length} elevation points`);
        
        await db.close();
        
        if (data.length === 0) {
            console.warn('No elevation points found in database');
            return res.json({ points: [], stats: { min_elevation: 0, max_elevation: 0, point_count: 0 } });
        }
        
        // Calculate min/max elevation for color scaling using a loop instead of spread
        let minElevation = data[0].elevation;
        let maxElevation = data[0].elevation;
        for (let i = 1; i < data.length; i++) {
            if (data[i].elevation < minElevation) minElevation = data[i].elevation;
            if (data[i].elevation > maxElevation) maxElevation = data[i].elevation;
        }
        
        const stats = {
            min_elevation: minElevation,
            max_elevation: maxElevation,
            point_count: data.length,
            resolution: isHighRes ? 'high' : 'low'
        };
        
        console.log('Sending response with stats:', stats);
        res.json({ points: data, stats });
    } catch (error) {
        console.error('Error fetching elevation data:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch elevation data' });
    }
});

// Helper function to parse JSON body from request
async function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

// Helper function to get elevation profile points
function generateProfilePoints(start, end, numPoints = 100) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        const fraction = i / (numPoints - 1);
        const lat = start.lat + (end.lat - start.lat) * fraction;
        const lon = start.lon + (end.lon - start.lon) * fraction;
        points.push({ lat, lon });
    }
    return points;
}

// Helper function to validate coordinates
function validateCoordinates(lat, lon) {
    // New Mexico bounds
    const NM_BOUNDS = {
        minLat: 31.33,
        maxLat: 37.00,
        minLon: -109.05,
        maxLon: -103.00
    };
    
    return (
        lat >= NM_BOUNDS.minLat && lat <= NM_BOUNDS.maxLat &&
        lon >= NM_BOUNDS.minLon && lon <= NM_BOUNDS.maxLon
    );
}

// Calculate distance between two points in meters
function calculateDistance(point1, point2) {
    const R = 6371000; // Earth's radius in meters
    const lat1 = point1.lat * Math.PI / 180;
    const lat2 = point2.lat * Math.PI / 180;
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// API endpoints
app.get('/api/elevation/batch', async (req, res) => {
    try {
        const body = await getRequestBody(req);
        if (!Array.isArray(body.points)) {
            throw new Error('Invalid request body: points array required');
        }
        
        const results = await Promise.all(
            body.points.map(async point => {
                const elevation = await getElevation(point.lat, point.lon);
                return { ...point, elevation };
            })
        );
        
        res.json({ points: results });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/elevation/profile', async (req, res) => {
    try {
        const body = await getRequestBody(req);
        if (!body.start || !body.end) {
            throw new Error('Invalid request body: start and end points required');
        }
        
        const numPoints = body.numPoints || 100;
        const profilePoints = generateProfilePoints(body.start, body.end, numPoints);
        
        // Calculate total distance
        const totalDistance = calculateDistance(body.start, body.end);
        const distanceStep = totalDistance / (numPoints - 1);
        
        const results = await Promise.all(
            profilePoints.map(async (point, index) => {
                const elevation = await getElevation(point.lat, point.lon);
                return {
                    ...point,
                    elevation,
                    distance: distanceStep * index
                };
            })
        );
        
        res.json({
            points: results,
            metadata: {
                totalDistance,
                numPoints,
                start: body.start,
                end: body.end
            }
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/santa-fe-elevation', async (req, res) => {
    try {
        const { lat, lon, radius } = req.query;
        const centerLat = parseFloat(lat);
        const centerLon = parseFloat(lon);
        const radiusKm = parseFloat(radius);
        
        if (isNaN(centerLat) || isNaN(centerLon) || isNaN(radiusKm)) {
            throw new Error('Invalid parameters');
        }
        
        const db = await getDb(centerLat, centerLon);
        
        // Get points within a larger radius to show available data
        const searchRadius = radiusKm * 2; // Double the search radius
        const latRange = searchRadius / 111;
        const lonRange = searchRadius / (111 * Math.cos(centerLat * Math.PI / 180));
        
        // First, get the count of points in the area
        const countResult = await db.get(`
            SELECT COUNT(*) as count
            FROM elevation_points
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
        `, [
            centerLat - latRange,
            centerLat + latRange,
            centerLon - lonRange,
            centerLon + lonRange
        ]);

        if (countResult.count === 0) {
            // If no points in doubled radius, get nearest 1000 points
            const points = await db.all(`
                SELECT latitude, longitude, elevation,
                       ((latitude - ?) * (latitude - ?) + 
                        (longitude - ?) * (longitude - ?)) as distance
                FROM elevation_points
                ORDER BY distance ASC
                LIMIT 1000
            `, [centerLat, centerLat, centerLon, centerLon]);

            const elevations = points.map(p => p.elevation);
            const stats = {
                min_elevation: Math.min(...elevations),
                max_elevation: Math.max(...elevations),
                point_count: points.length,
                avg_elevation: elevations.reduce((a, b) => a + b) / elevations.length,
                area_km2: Math.PI * radiusKm * radiusKm,
                note: "Showing nearest available points as requested area has no data yet"
            };
            
            res.json({ points, stats });
        } else {
            // Get points within the larger radius
            const points = await db.all(`
                SELECT latitude, longitude, elevation
                FROM elevation_points
                WHERE latitude BETWEEN ? AND ?
                AND longitude BETWEEN ? AND ?
            `, [
                centerLat - latRange,
                centerLat + latRange,
                centerLon - lonRange,
                centerLon + lonRange
            ]);
            
            // Calculate statistics
            const elevations = points.map(p => p.elevation);
            const stats = {
                min_elevation: Math.min(...elevations),
                max_elevation: Math.max(...elevations),
                point_count: points.length,
                avg_elevation: elevations.reduce((a, b) => a + b) / elevations.length,
                area_km2: Math.PI * searchRadius * searchRadius,
                note: "Showing data from a larger area due to sparse coverage"
            };
            
            res.json({ points, stats });
        }
        
        await db.close();
    } catch (error) {
        console.error('Error fetching Santa Fe elevation data:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch elevation data' });
    }
});

app.post('/api/enhance-region', async (req, res) => {
    console.log('Received POST to /api/enhance-region');
    console.log('Request body:', req.body);
    
    try {
        const bounds = req.body;
        
        // Validate bounds
        if (!bounds || !bounds.minLat || !bounds.maxLat || !bounds.minLon || !bounds.maxLon) {
            console.error('Invalid bounds:', bounds);
            return res.status(400).json({ 
                error: 'Invalid bounds provided',
                details: 'All bounds (minLat, maxLat, minLon, maxLon) must be provided'
            });
        }
        
        // Validate bound values are numbers
        const boundValues = [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon];
        if (!boundValues.every(val => typeof val === 'number' && !isNaN(val))) {
            console.error('Invalid bound values:', bounds);
            return res.status(400).json({ 
                error: 'Invalid bound values',
                details: 'All bounds must be valid numbers'
            });
        }
        
        // Validate bound values are within New Mexico
        const NM_BOUNDS = {
            minLat: 31.33,
            maxLat: 37.00,
            minLon: -109.05,
            maxLon: -103.00
        };
        
        if (bounds.minLat < NM_BOUNDS.minLat || bounds.maxLat > NM_BOUNDS.maxLat ||
            bounds.minLon < NM_BOUNDS.minLon || bounds.maxLon > NM_BOUNDS.maxLon) {
            console.error('Bounds outside New Mexico:', bounds);
            return res.status(400).json({ 
                error: 'Selected region must be within New Mexico',
                details: `Bounds must be within: ${JSON.stringify(NM_BOUNDS)}`
            });
        }

        // Pre-populate grid points with NULL elevations
        const db = await getDb(bounds.maxLat, bounds.minLon);
        await db.run('BEGIN TRANSACTION');

        try {
            // Calculate grid size for approximately 10,000 points
            const gridSize = Math.ceil(Math.sqrt(10000));
            const latStep = (bounds.maxLat - bounds.minLat) / (gridSize - 1);
            const lonStep = (bounds.maxLon - bounds.minLon) / (gridSize - 1);

            console.log('Enhancement region bounds:', bounds);
            console.log(`Creating grid: ${gridSize}x${gridSize} (${gridSize * gridSize} points total)`);
            console.log(`Grid steps: lat=${latStep.toFixed(6)}, lon=${lonStep.toFixed(6)}`);

            // First, ensure we have the correct table structure
            await db.exec(`
                CREATE TABLE IF NOT EXISTS elevation_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    elevation REAL,
                    source TEXT,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(latitude, longitude)
                );
                
                CREATE INDEX IF NOT EXISTS idx_points_location ON elevation_points(latitude, longitude);
                CREATE INDEX IF NOT EXISTS idx_points_elevation ON elevation_points(elevation);
            `);

            // Clear any existing points in the region that have NULL elevation
            await db.run(`
                DELETE FROM elevation_points 
                WHERE latitude BETWEEN ? AND ? 
                AND longitude BETWEEN ? AND ?
                AND elevation IS NULL
            `, [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);

            console.log('Cleared existing NULL elevation points in region');

            // Prepare the insert statement
            const stmt = await db.prepare(`
                INSERT OR IGNORE INTO elevation_points (latitude, longitude, elevation, source)
                VALUES (?, ?, NULL, 'pending')
            `);

            // Generate and insert grid points
            let insertedPoints = 0;
            let batchSize = 1000;
            let pointsToInsert = [];

            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    const lat = bounds.maxLat - (i * latStep);
                    const lon = bounds.minLon + (j * lonStep);
                    
                    pointsToInsert.push([lat, lon]);
                    
                    if (pointsToInsert.length >= batchSize) {
                        for (const point of pointsToInsert) {
                            await stmt.run(point[0], point[1]);
                        }
                        insertedPoints += pointsToInsert.length;
                        console.log(`Inserted ${insertedPoints} points so far...`);
                        pointsToInsert = [];
                    }
                }
            }

            // Insert any remaining points
            if (pointsToInsert.length > 0) {
                for (const point of pointsToInsert) {
                    await stmt.run(point[0], point[1]);
                }
                insertedPoints += pointsToInsert.length;
            }

            await stmt.finalize();
            await db.run('COMMIT');
            
            // Verify the points were created
            const verification = await db.get(`
                SELECT COUNT(*) as count
                FROM elevation_points
                WHERE latitude BETWEEN ? AND ?
                AND longitude BETWEEN ? AND ?
                AND elevation IS NULL
            `, [bounds.minLat, bounds.maxLat, bounds.minLon, bounds.maxLon]);
            
            console.log(`Grid point creation complete:
                Attempted to insert: ${insertedPoints} points
                Actually created: ${verification.count} points
                Region bounds: ${bounds.minLat.toFixed(4)}°N to ${bounds.maxLat.toFixed(4)}°N, 
                              ${bounds.minLon.toFixed(4)}°W to ${bounds.maxLon.toFixed(4)}°W
            `);

            if (verification.count < insertedPoints * 0.9) {
                console.warn('Warning: Significant number of points were not created!');
            }

        } catch (error) {
            console.error('Error pre-populating grid points:', error);
            await db.run('ROLLBACK');
            throw error;
        } finally {
            await db.close();
        }
        
        // Save bounds to a file for the collection script
        const boundsFile = path.join(__dirname, 'enhance_bounds.json');
        fs.writeFileSync(boundsFile, JSON.stringify(bounds, null, 2));
        console.log('Wrote bounds to:', boundsFile);
        
        // Start the collection process
        const collectScript = path.join(__dirname, 'collect_sparse_points.js');
        console.log('Starting collection script:', collectScript);
        
        const child = spawn('node', [collectScript, '--enhance'], {
            detached: true,
            stdio: 'pipe'
        });
        
        child.stdout.on('data', (data) => {
            console.log('Collection process output:', data.toString());
        });
        
        child.stderr.on('data', (data) => {
            console.error('Collection process error:', data.toString());
        });
        
        child.on('error', (error) => {
            console.error('Failed to start collection process:', error);
            return res.status(500).json({ 
                error: 'Failed to start collection process',
                details: error.message
            });
        });
        
        child.unref();
        
        console.log('Enhancement process started successfully');
        res.json({ 
            status: 'started', 
            bounds,
            message: 'Enhancement process started successfully'
        });
    } catch (error) {
        console.error('Error in enhance-region endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    // Log the current directory and check for database
    console.log('Current directory:', __dirname);
    console.log('Database exists:', fs.existsSync(path.join(__dirname, 'mountains.db')));
}); 