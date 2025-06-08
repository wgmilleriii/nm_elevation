import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.NODE_ENV === 'test' ? 3001 : 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Ensure grid databases directory exists
const GRID_DB_DIR = path.join(__dirname, 'grid_databases');
if (!fs.existsSync(GRID_DB_DIR)) {
    fs.mkdirSync(GRID_DB_DIR, { recursive: true });
}

// Database connection pool
const dbConnections = new Map();

// Get or create database connection
function getDb(gridKey) {
    if (!gridKey) {
        throw new Error('Grid key is required');
    }

    // Check if we already have a connection
    if (dbConnections.has(gridKey)) {
        return dbConnections.get(gridKey);
    }

    // Create new connection
    const dbPath = path.join(GRID_DB_DIR, `${gridKey}.db`);
    console.log('Opening database at:', dbPath);
    
    try {
        const db = new Database(dbPath);
        
        // Initialize if needed
        db.exec(`
            CREATE TABLE IF NOT EXISTS elevation_points (
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                elevation REAL NOT NULL,
                PRIMARY KEY (latitude, longitude)
            );
            CREATE INDEX IF NOT EXISTS idx_lat_lon ON elevation_points(latitude, longitude);
        `);

        // Store in connection pool
        dbConnections.set(gridKey, db);
        return db;
    } catch (error) {
        console.error(`Error opening database ${dbPath}:`, error);
        throw error;
    }
}

// Close all database connections on exit
function closeAllConnections() {
    for (const [key, db] of dbConnections.entries()) {
        try {
            db.close();
            dbConnections.delete(key);
        } catch (error) {
            console.error(`Error closing database ${key}:`, error);
        }
    }
}

process.on('SIGINT', () => {
    closeAllConnections();
    process.exit(0);
});

process.on('SIGTERM', () => {
    closeAllConnections();
    process.exit(0);
});

// Logging endpoint
app.post('/api/log', (req, res) => {
    const { timestamp, logger, level, message, data, error } = req.body;
    const logFile = path.join(logsDir, `${logger.toLowerCase()}.log`);
    
    let logEntry = `[${timestamp}] ${level === 'error' ? 'ERROR: ' : ''}${message}\n`;
    if (data) {
        logEntry += JSON.stringify(data, null, 2) + '\n';
    }
    if (error) {
        logEntry += error + '\n';
    }
    
    try {
        fs.appendFileSync(logFile, logEntry + '\n');
        res.sendStatus(200);
    } catch (err) {
        console.error('Error writing to log file:', err);
        res.status(500).json({ error: 'Failed to write log entry' });
    }
});

app.get('/api/elevation-data', async (req, res) => {
    try {
        const { bounds, offset = 0, collect = false } = req.query;
        if (!bounds) {
            return res.status(400).json({ error: 'Bounds parameter is required' });
        }

        const [south, west, north, east] = bounds.split(',').map(Number);
        if (bounds.split(',').length !== 4 || [south, west, north, east].some(isNaN)) {
            return res.status(400).json({ error: 'Invalid bounds format. Expected: south,west,north,east' });
        }
        
        console.log('Getting elevation data for bounds:', { south, west, north, east, collect });

        // If collect flag is true, trigger sparse point collection
        if (collect === 'true') {
            const { spawn } = await import('child_process');
            const collectScript = path.join(__dirname, 'collect_sparse_points.js');
            
            // Spawn collection process with bounds
            const collector = spawn('node', [
                collectScript,
                '--bounds', bounds,
                '--direction=sw_to_ne'
            ], {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            // Log collection output
            collector.stdout.on('data', (data) => {
                console.log(`Collection output: ${data}`);
            });

            collector.stderr.on('data', (data) => {
                console.error(`Collection error: ${data}`);
            });

            // Don't wait for collection to complete, just acknowledge it started
            res.json({
                success: true,
                message: 'Started sparse point collection',
                bounds: { south, west, north, east }
            });
            return;
        }
        
        // Generate grid key for this area
        const gridKey = generateDbName({
            minLat: south,
            minLon: west,
            maxLat: north,
            maxLon: east
        });

        // Get database connection
        const db = getDb(gridKey);
        
        // Get points for the requested bounds
        const points = db.prepare(`
            SELECT latitude, longitude, elevation
            FROM elevation_points
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
            ORDER BY latitude, longitude
            LIMIT 1000 OFFSET ?
        `).all(south, north, west, east, parseInt(offset) || 0);
        
        // Get statistics
        const stats = db.prepare(`
            SELECT 
                MIN(elevation) as min_elevation,
                MAX(elevation) as max_elevation,
                AVG(elevation) as avg_elevation,
                COUNT(*) as total_count
            FROM elevation_points
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
        `).get(south, north, west, east);
        
        console.log(`Found ${points.length} points in bounds`);
        
        res.json({
            success: true,
            points,
            stats: {
                min_elevation: stats.min_elevation,
                max_elevation: stats.max_elevation,
                avg_elevation: stats.avg_elevation,
                point_count: points.length,
                total_points: stats.total_count,
                hasMore: points.length === 1000,
                chunkSize: 1000
            }
        });
        
    } catch (error) {
        console.error('Error getting elevation data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to generate database name from bounds
function generateDbName(bounds) {
    const gridSize = 1; // 1 degree grid size
    const minLatGrid = Math.floor(bounds.minLat / gridSize) * gridSize;
    const minLonGrid = Math.floor(bounds.minLon / gridSize) * gridSize;
    return `grid_${minLatGrid}_${minLonGrid}`;
}

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
        
        const db = await getDb(centerLat.toFixed(4) + '_' + centerLon.toFixed(4) + '_' + (centerLat + radiusKm * 2).toFixed(4) + '_' + (centerLon + radiusKm * 2).toFixed(4));
        
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
        const db = await getDb(bounds.minLat.toFixed(4) + '_' + bounds.minLon.toFixed(4) + '_' + bounds.maxLat.toFixed(4) + '_' + bounds.maxLon.toFixed(4));
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

// Add collect_sparse endpoint
app.post('/api/collect_sparse', async (req, res) => {
    try {
        const { center, size, direction } = req.body;
        
        if (!center || !size || !direction) {
            return res.status(400).json({
                error: 'Missing required parameters: center (lat, lon), size, direction (x, y)'
            });
        }

        // Validate coordinates
        if (!validateCoordinates(center.lat, center.lon)) {
            return res.status(400).json({
                error: 'Invalid coordinates'
            });
        }

        // Calculate window bounds
        const bounds = {
            minLat: center.lat - size/2,
            maxLat: center.lat + size/2,
            minLon: center.lon - size/2,
            maxLon: center.lon + size/2
        };

        const db = await getDb(bounds.minLat.toFixed(4) + '_' + bounds.minLon.toFixed(4) + '_' + bounds.maxLat.toFixed(4) + '_' + bounds.maxLon.toFixed(4));
        
        // Get points in the window
        const query = `
            SELECT latitude, longitude, elevation
            FROM elevation_points
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
            ORDER BY 
                (latitude - ?) * ? + (longitude - ?) * ? DESC
            LIMIT 100
        `;

        const points = await db.all(query, [
            bounds.minLat,
            bounds.maxLat,
            bounds.minLon,
            bounds.maxLon,
            center.lat,
            direction.y,
            center.lon,
            direction.x
        ]);

        // Transform points for response
        const transformedPoints = points.map(p => ({
            lat: p.latitude,
            lon: p.longitude,
            elevation: p.elevation
        }));

        res.json({
            center,
            size,
            direction,
            points: transformedPoints
        });

    } catch (error) {
        console.error('Error in collect_sparse:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Helper function to simulate elevation
function simulateElevation(lat, lon) {
    // Base elevation around 1500m (typical for New Mexico)
    let elevation = 1500;
    
    // Add variation based on latitude (higher in north)
    elevation += (lat - 34) * 100;
    
    // Add some longitude-based variation
    elevation += Math.sin(lon * 0.5) * 200;
    
    // Add some random variation (±100m)
    elevation += (Math.random() - 0.5) * 200;
    
    // Ensure elevation stays within reasonable bounds for New Mexico
    elevation = Math.max(1000, Math.min(4000, elevation));
    
    return elevation;
}

// API endpoint to collect points
app.post('/api/collect-points', async (req, res) => {
    try {
        const { bounds, zoom } = req.body;
        
        if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
            throw new Error('Invalid bounds provided');
        }
        
        // Calculate grid coordinates
        const centerLat = (bounds.north + bounds.south) / 2;
        const centerLon = (bounds.east + bounds.west) / 2;
        
        // Generate grid key for this area
        const gridKey = generateDbName({
            minLat: bounds.south,
            minLon: bounds.west,
            maxLat: bounds.north,
            maxLon: bounds.east
        });
        
        console.log('Collecting points for:', { bounds, zoom, gridKey });
        
        // Get database connection
        const db = getDb(gridKey);
        
        try {
            // Calculate grid size based on zoom level
            const gridSize = Math.pow(2, Math.min(zoom - 8, 6)); // Max 64x64 grid
            const latStep = (bounds.north - bounds.south) / gridSize;
            const lonStep = (bounds.east - bounds.west) / gridSize;
            
            const points = [];
            
            // Generate points in a grid pattern
            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    const lat = bounds.south + (i * latStep) + (latStep / 2);
                    const lon = bounds.west + (j * lonStep) + (lonStep / 2);
                    
                    points.push({
                        latitude: lat,
                        longitude: lon,
                        elevation: simulateElevation(lat, lon)
                    });
                }
            }
            
            console.log(`Generated ${points.length} points for grid`);
            
            // Insert points into database
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO elevation_points (latitude, longitude, elevation)
                VALUES (?, ?, ?)
            `);
            
            // Begin transaction for better performance
            const insertMany = db.transaction((points) => {
                for (const point of points) {
                    insertStmt.run(
                        point.latitude,
                        point.longitude,
                        point.elevation
                    );
                }
            });
            
            // Execute the transaction
            insertMany(points);
            
            // Get statistics
            const stats = db.prepare(`
                SELECT 
                    COUNT(*) as count,
                    MIN(elevation) as min_elevation,
                    MAX(elevation) as max_elevation,
                    AVG(elevation) as avg_elevation
                FROM elevation_points
                WHERE latitude BETWEEN ? AND ?
                AND longitude BETWEEN ? AND ?
            `).get(bounds.south, bounds.north, bounds.west, bounds.east);
            
            console.log('Collection completed:', stats);
            
            res.json({
                success: true,
                points,
                stats
            });
            
        } catch (error) {
            console.error('Error in database operations:', error);
            throw error;
        }
        
    } catch (error) {
        console.error('Error collecting points:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Current directory:', __dirname);
    console.log('Grid databases directory:', GRID_DB_DIR);
    console.log('Grid databases directory exists:', fs.existsSync(GRID_DB_DIR));
}); 