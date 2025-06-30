import express from 'express';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { calculateDistance, calculatePointDistance } from './utils/distance.js';
import SerialPort from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpPort = process.env.PORT || 3001;
const httpsPort = process.env.HTTPS_PORT || 3443;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Redirect HTTP to HTTPS
app.use((req, res, next) => {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https' && process.env.NODE_ENV !== 'development') {
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
});

// Create HTTPS credentials
const certPath = path.join(__dirname, 'certs');
let httpsOptions = null;

try {
    httpsOptions = {
        key: fs.readFileSync(path.join(certPath, 'localhost.key')),
        cert: fs.readFileSync(path.join(certPath, 'localhost.crt'))
    };
} catch (error) {
    console.log('No SSL certificates found. Will generate self-signed certificates...');
    
    // Generate self-signed certificate using OpenSSL
    const openssl = spawn('openssl', [
        'req',
        '-x509',
        '-newkey', 'rsa:2048',
        '-keyout', path.join(certPath, 'localhost.key'),
        '-out', path.join(certPath, 'localhost.crt'),
        '-days', '365',
        '-nodes',
        '-subj', '/CN=localhost'
    ]);

    openssl.stdout.on('data', (data) => {
        console.log(`OpenSSL output: ${data}`);
    });

    openssl.stderr.on('data', (data) => {
        console.error(`OpenSSL error: ${data}`);
    });

    openssl.on('close', (code) => {
        if (code === 0) {
            console.log('SSL certificates generated successfully');
            httpsOptions = {
                key: fs.readFileSync(path.join(certPath, 'localhost.key')),
                cert: fs.readFileSync(path.join(certPath, 'localhost.crt'))
            };
            // Start HTTPS server after generating certificates
            const httpsServer = https.createServer(httpsOptions, app);
            httpsServer.listen(httpsPort, () => {
                console.log(`HTTPS Server running at https://localhost:${httpsPort}`);
            });
        } else {
            console.error('Failed to generate SSL certificates');
        }
    });
}

// Start HTTP server
const httpServer = http.createServer(app);
httpServer.listen(httpPort, '0.0.0.0', () => {
    console.log(`\nServer Configuration:`);
    console.log(`- HTTP Port: ${httpPort}`);
    console.log(`- HTTPS Port: ${httpsPort}`);
    console.log('\nAccess the tracking interface at:');
    console.log(`http://localhost:${httpPort}/gps_live.html`);
    console.log(`https://localhost:${httpsPort}/gps_live.html`);
    console.log(`http://192.168.105.126:${httpPort}/gps_live.html`);
    console.log(`https://192.168.105.126:${httpsPort}/gps_live.html`);
});

// Start HTTPS server if certificates exist
if (httpsOptions) {
    const httpsServer = https.createServer(httpsOptions, app);
    httpsServer.listen(httpsPort, '0.0.0.0', () => {
        console.log(`HTTPS Server running at https://localhost:${httpsPort}`);
    });
}

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

// Get database path from environment or use default
const DB_PATH = process.env.TEST_DB_PATH || path.join(__dirname, 'grid_databases', 'user_tracking.db');

// Initialize database
async function getDb(dbName = 'user_tracking') {
    const dbPath = path.join(GRID_DB_DIR, `${dbName}.db`);
    
    // Create database if it doesn't exist
    const db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Initialize schema based on database type
    if (dbName === 'elevation_cache') {
        db.exec(`
            CREATE TABLE IF NOT EXISTS elevation_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                elevation REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(latitude, longitude)
            );
            CREATE INDEX IF NOT EXISTS idx_points_location ON elevation_points(latitude, longitude);
        `);
    } else if (dbName === 'user_tracking') {
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                start_time DATETIME NOT NULL,
                end_time DATETIME,
                total_distance REAL,
                max_elevation REAL,
                min_elevation REAL,
                avg_elevation REAL,
                point_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS user_track_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                elevation REAL,
                accuracy REAL NOT NULL,
                timestamp DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES user_sessions(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
        `);
    }
    
    return db;
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
        const bounds = req.query.bounds ? req.query.bounds.split(',').map(Number) : null;
        const offset = parseInt(req.query.offset) || 0;
        const chunkSize = 1000; // Smaller chunks for more frequent updates
        
        if (!bounds) {
            return res.status(400).json({ error: 'Bounds are required' });
        }

        const [minLat, minLon, maxLat, maxLon] = bounds;
        
        // Validate bounds
        if (bounds.length !== 4 || bounds.some(isNaN)) {
            return res.status(400).json({ 
                error: 'Invalid bounds format. Expected: minLat,minLon,maxLat,maxLon' 
            });
        }

        // Validate bounds are within New Mexico
        const NM_BOUNDS = {
            minLat: 31.20,
            maxLat: 37.20,
            minLon: -109.20,
            maxLon: -102.80
        };

        // Clip bounds to New Mexico
        const clippedBounds = {
            minLat: Math.max(minLat, NM_BOUNDS.minLat),
            maxLat: Math.min(maxLat, NM_BOUNDS.maxLat),
            minLon: Math.max(minLon, NM_BOUNDS.minLon),
            maxLon: Math.min(maxLon, NM_BOUNDS.maxLon)
        };

        // Generate grid key based on bounds
        const gridKey = generateDbName(clippedBounds);
        const db = getDb(gridKey);
        
        // Get total count first
        const countResult = db.prepare(`
            SELECT COUNT(*) as count 
            FROM elevation_points 
            WHERE latitude BETWEEN ? AND ? 
            AND longitude BETWEEN ? AND ?
        `).get(clippedBounds.minLat, clippedBounds.maxLat, clippedBounds.minLon, clippedBounds.maxLon);

        const totalPoints = countResult.count;
        
        // Get chunk of points
        const points = db.prepare(`
            SELECT latitude, longitude, elevation
            FROM elevation_points
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
            ORDER BY latitude, longitude
            LIMIT ? OFFSET ?
        `).all(
            clippedBounds.minLat, clippedBounds.maxLat,
            clippedBounds.minLon, clippedBounds.maxLon,
            chunkSize, offset
        );

        // Calculate progress
        const progress = {
            offset: offset,
            chunkSize: chunkSize,
            totalPoints: totalPoints,
            hasMore: offset + chunkSize < totalPoints,
            percentComplete: Math.round((offset + points.length) / totalPoints * 100)
        };

        // Calculate stats for this chunk
        const elevations = points.map(p => p.elevation).filter(e => e !== null);
        const stats = elevations.length > 0 ? {
            min_elevation: Math.min(...elevations),
            max_elevation: Math.max(...elevations),
            point_count: points.length,
            ...progress
        } : {
            min_elevation: null,
            max_elevation: null,
            point_count: 0,
            ...progress
        };

        res.json({ points, stats });
        
    } catch (error) {
        console.error('Error fetching elevation data:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch elevation data' });
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
        
        // Calculate total distance using the utility function
        const totalDistance = calculatePointDistance(body.start, body.end);
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

// Add elevation endpoint for grid sampling
app.get('/api/elevation', (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({
                error: 'Missing required parameters: lat, lon'
            });
        }

        // Convert lat/lon to numbers
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        // Validate coordinates
        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({
                error: 'Invalid coordinates format'
            });
        }

        // Basic bounds check for reasonable values
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                error: 'Coordinates out of valid range'
            });
        }

        // Calculate elevation using the same method as test endpoint
        const baseElevation = 1500; // Base elevation for New Mexico
        const latEffect = (latitude - 34) * 100; // Higher in the north
        const lonEffect = Math.sin(longitude * 0.5) * 200; // Variation based on longitude
        const randomEffect = (Math.random() - 0.5) * 200; // Random variation
        
        let elevation = baseElevation + latEffect + lonEffect + randomEffect;
        elevation = Math.max(1000, Math.min(4000, elevation)); // Keep within reasonable bounds
        elevation = Math.round(elevation);

        // Return elevation with metadata
        res.json({ 
            elevation,
            metadata: {
                lat: latitude,
                lon: longitude,
                source: 'simulation',
                timestamp: new Date().toISOString(),
                components: {
                    base: baseElevation,
                    latitudeEffect: latEffect,
                    longitudeEffect: lonEffect,
                    randomVariation: randomEffect
                }
            }
        });

    } catch (error) {
        console.error('Error in elevation endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Add collect-points endpoint
app.post('/api/collect-points', async (req, res) => {
    try {
        const { bounds, zoom, algorithm = 'random' } = req.body;
        
        if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
            return res.status(400).json({
                error: 'Invalid bounds provided'
            });
        }

        // Generate database name based on bounds and zoom
        const dbName = `zoom_${zoom}_${bounds.south.toFixed(4)}_${bounds.west.toFixed(4)}`;
        const db = await getDb(dbName);
        
        // Ensure we have the updated schema
        await db.exec(`
            CREATE TABLE IF NOT EXISTS elevation_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                elevation REAL,
                collection_method TEXT NOT NULL,
                zoom_level INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(latitude, longitude, zoom_level)
            );
            
            CREATE INDEX IF NOT EXISTS idx_points_location 
                ON elevation_points(latitude, longitude);
            CREATE INDEX IF NOT EXISTS idx_points_zoom 
                ON elevation_points(zoom_level);
            CREATE INDEX IF NOT EXISTS idx_points_method 
                ON elevation_points(collection_method);
        `);

        // Create collection manager instance
        const manager = new CollectionManager();
        manager.setAlgorithm(algorithm);

        // Normalize bounds
        const normalizedBounds = CollectionManager.normalizeBounds(bounds);
        
        // Collect points using specified algorithm
        const points = await manager.collectPoints(normalizedBounds, zoom);
        
        // Begin transaction for point insertion
        await db.exec('BEGIN TRANSACTION');
        
        try {
            const insertStmt = db.prepare(`
                INSERT OR REPLACE INTO elevation_points 
                (latitude, longitude, elevation, collection_method, zoom_level)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            for (const point of points) {
                insertStmt.run(
                    point.lat,
                    point.lon,
                    point.elevation,
                    point.type || algorithm,
                    zoom
                );
            }
            
            await db.exec('COMMIT');
            
            res.json({
                points: points.length,
                algorithm,
                bounds: normalizedBounds,
                zoom
            });
            
        } catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('Error collecting points:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to get current timestamp in SQLite format
function getCurrentTimestamp() {
    return new Date().toISOString();
}

// User tracking endpoints
app.post('/api/user/init', async (req, res) => {
    try {
        const { deviceId } = req.body;
        
        if (!deviceId) {
            return res.status(400).json({
                error: 'Device ID is required'
            });
        }

        const db = await getDb();
        
        try {
            // Check if user exists
            const stmt = db.prepare('SELECT * FROM users WHERE device_id = ?');
            let user = stmt.get(deviceId);
            
            if (!user) {
                // Create new user
                const insertStmt = db.prepare('INSERT INTO users (device_id) VALUES (?)');
                const result = insertStmt.run(deviceId);
                user = {
                    id: result.lastInsertRowid,
                    device_id: deviceId
                };
            }

            res.json({ userId: user.id });

        } finally {
            db.close();
        }

    } catch (error) {
        console.error('Error initializing user:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/user/session/start', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                error: 'User ID is required'
            });
        }

        const db = await getDb();
        
        try {
            // Create new session
            const stmt = db.prepare(
                'INSERT INTO user_sessions (user_id, start_time) VALUES (?, ?)'
            );
            const result = stmt.run(userId, getCurrentTimestamp());

            res.json({ 
                sessionId: result.lastInsertRowid,
                startTime: new Date().toISOString()
            });

        } finally {
            db.close();
        }

    } catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/user/track-point', async (req, res) => {
    try {
        console.log('\n=== Incoming GPS Data ===');
        console.log('Time:', new Date().toLocaleTimeString());
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const { userId, sessionId, point } = req.body;
        
        if (!userId || !sessionId || !point) {
            console.error('Missing required data:', { userId, sessionId, point });
            return res.status(400).json({
                error: 'User ID, session ID, and point data are required'
            });
        }

        console.log('\nProcessed GPS Data:');
        console.log(`- Coordinates: ${point.lat}°N, ${point.lon}°W`);
        console.log(`- Elevation: ${point.elevation}m`);
        console.log(`- Accuracy: ${point.accuracy}m`);
        console.log(`- Speed: ${point.speed || 0} km/h`);
        console.log(`- Heading: ${point.heading || 'N/A'}°`);
        console.log('======================\n');

        const db = await getDb();
        
        try {
            // Verify user and session exist before proceeding
            const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(userId);
            if (!userExists) {
                return res.status(400).json({
                    error: 'Invalid user ID',
                    code: 'INVALID_USER'
                });
            }

            const sessionExists = db.prepare('SELECT 1 FROM user_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId);
            if (!sessionExists) {
                return res.status(400).json({
                    error: 'Invalid session ID or session does not belong to user',
                    code: 'INVALID_SESSION'
                });
            }

            // Begin transaction
            db.exec('BEGIN TRANSACTION');

            // Insert track point
            const insertStmt = db.prepare(`
                INSERT INTO user_track_points (
                    user_id, session_id, latitude, longitude, 
                    elevation, accuracy, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            insertStmt.run(
                userId,
                sessionId,
                point.lat,
                point.lon,
                point.elevation,
                point.accuracy,
                point.timestamp || getCurrentTimestamp()
            );

            // Update session statistics
            const statsStmt = db.prepare(`
                SELECT 
                    COUNT(*) as point_count,
                    MIN(elevation) as min_elevation,
                    MAX(elevation) as max_elevation,
                    AVG(elevation) as avg_elevation
                FROM user_track_points
                WHERE session_id = ?
            `);
            
            const stats = statsStmt.get(sessionId);

            const updateStmt = db.prepare(`
                UPDATE user_sessions SET
                    point_count = ?,
                    min_elevation = ?,
                    max_elevation = ?,
                    avg_elevation = ?
                WHERE id = ?
            `);
            
            updateStmt.run(
                stats.point_count,
                stats.min_elevation,
                stats.max_elevation,
                stats.avg_elevation,
                sessionId
            );

            // Commit transaction
            db.exec('COMMIT');

            res.json({ success: true, stats });

        } catch (error) {
            db.exec('ROLLBACK');
            // Check for specific SQLite errors
            if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
                return res.status(400).json({
                    error: 'Invalid user ID or session ID',
                    code: 'FOREIGN_KEY_VIOLATION',
                    details: error.message
                });
            }
            throw error;
        } finally {
            db.close();
        }

    } catch (error) {
        console.error('Error saving track point:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.post('/api/user/session/end', async (req, res) => {
    try {
        const { userId, sessionId } = req.body;
        
        if (!userId || !sessionId) {
            return res.status(400).json({
                error: 'User ID and session ID are required'
            });
        }

        const db = await getDb();
        
        try {
            // Calculate total distance
            const pointsStmt = db.prepare(`
                SELECT latitude, longitude
                FROM user_track_points
                WHERE session_id = ?
                ORDER BY timestamp
            `);
            
            const points = pointsStmt.all(sessionId);

            let totalDistance = 0;
            for (let i = 1; i < points.length; i++) {
                totalDistance += calculateDistance(
                    points[i-1].latitude,
                    points[i-1].longitude,
                    points[i].latitude,
                    points[i].longitude
                );
            }

            // Update session end time and distance
            const updateStmt = db.prepare(`
                UPDATE user_sessions SET
                    end_time = ?,
                    total_distance = ?
                WHERE id = ?
            `);
            
            const endTime = getCurrentTimestamp();
            updateStmt.run(endTime, totalDistance, sessionId);

            res.json({ 
                success: true,
                totalDistance,
                endTime
            });

        } finally {
            db.close();
        }

    } catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user/:userId/sessions', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 10, offset = 0 } = req.query;
        
        const db = await getDb();
        
        try {
            // Get user's sessions with statistics
            const stmt = db.prepare(`
                SELECT 
                    id,
                    start_time,
                    end_time,
                    total_distance,
                    point_count,
                    min_elevation,
                    max_elevation,
                    avg_elevation
                FROM user_sessions
                WHERE user_id = ?
                ORDER BY start_time DESC
                LIMIT ? OFFSET ?
            `);
            
            const sessions = stmt.all(userId, limit, offset);

            res.json({ sessions });

        } finally {
            db.close();
        }

    } catch (error) {
        console.error('Error fetching sessions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test endpoint for elevation data
app.get('/api/test-elevation', (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        if (!lat || !lon) {
            return res.status(400).json({
                error: 'Missing required parameters: lat, lon'
            });
        }

        // Convert lat/lon to numbers
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);

        // Validate coordinates
        if (isNaN(latitude) || isNaN(longitude)) {
            return res.status(400).json({
                error: 'Invalid coordinates format'
            });
        }

        // Basic bounds check for reasonable values
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                error: 'Coordinates out of valid range'
            });
        }

        // Calculate a simple elevation based on coordinates
        const baseElevation = 1500; // Base elevation for New Mexico
        const latEffect = (latitude - 34) * 100; // Higher in the north
        const lonEffect = Math.sin(longitude * 0.5) * 200; // Variation based on longitude
        const randomEffect = (Math.random() - 0.5) * 200; // Random variation
        
        let elevation = baseElevation + latEffect + lonEffect + randomEffect;
        elevation = Math.max(1000, Math.min(4000, elevation)); // Keep within reasonable bounds
        elevation = Math.round(elevation);

        // Return elevation with metadata
        res.json({ 
            elevation,
            metadata: {
                lat: latitude,
                lon: longitude,
                source: 'test-simulation',
                timestamp: new Date().toISOString(),
                components: {
                    base: baseElevation,
                    latitudeEffect: latEffect,
                    longitudeEffect: lonEffect,
                    randomVariation: randomEffect
                }
            }
        });

    } catch (error) {
        console.error('Error in test elevation endpoint:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Version endpoint
app.get('/api/version', (req, res) => {
    res.json({
        version: process.version,
        environment: process.env.NODE_ENV || 'development'
    });
});

// GPS tracking state
let nativeGPSActive = false;
let lastKnownPosition = null;
let gpsQuality = 'none';
let activeGPSSource = 'none';

// Add GPS endpoints
app.get('/api/gps/status', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
        nativeGPSActive: false,  // Default to false since we're focusing on browser GPS
        lastKnownPosition: null,
        gpsQuality: 'browser',
        activeGPSSource: 'browser',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/gps/source', (req, res) => {
    const { source } = req.body;
    activeGPSSource = source;
    res.json({ success: true, activeGPSSource });
});

// Native GPS handling
async function initializeNativeGPS() {
    try {
        const ports = await SerialPort.list();
        console.log('\nAvailable Serial Ports:');
        ports.forEach(port => {
            console.log(`- ${port.path}: ${port.manufacturer || 'Unknown manufacturer'}`);
        });

        // Try to identify GPS device
        const gpsPort = ports.find(port => 
            port.manufacturer?.toLowerCase().includes('u-blox') ||
            port.manufacturer?.toLowerCase().includes('garmin') ||
            port.manufacturer?.toLowerCase().includes('gps')
        );

        if (gpsPort) {
            console.log(`\nFound potential GPS device: ${gpsPort.path}`);
            const port = new SerialPort({
                path: gpsPort.path,
                baudRate: 9600
            });

            const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

            port.on('open', () => {
                console.log('Native GPS connection established');
                nativeGPSActive = true;
            });

            parser.on('data', (data) => {
                if (data.startsWith('$GPGGA')) {
                    const position = parseGPGGA(data);
                    if (position) {
                        lastKnownPosition = position;
                        gpsQuality = getGPSQualityDescription(position.quality);
                        activeGPSSource = 'native';
                        console.log('\nNative GPS Update:', position);
                    }
                }
            });

            port.on('error', (err) => {
                console.error('Native GPS error:', err.message);
                nativeGPSActive = false;
            });

            port.on('close', () => {
                console.log('Native GPS connection closed');
                nativeGPSActive = false;
            });
        } else {
            console.log('\nNo native GPS device found. Will use browser GPS if available.');
        }
    } catch (error) {
        console.error('Failed to initialize native GPS:', error);
    }
}

function parseGPGGA(data) {
    const parts = data.split(',');
    if (parts.length < 14) return null;

    const lat = convertGPSCoord(parts[2], parts[3]);
    const lon = convertGPSCoord(parts[4], parts[5]);
    
    return {
        timestamp: new Date(),
        latitude: lat,
        longitude: lon,
        quality: parseInt(parts[6]),
        satellites: parseInt(parts[7]),
        hdop: parseFloat(parts[8]),
        altitude: parseFloat(parts[9]),
        accuracy: parseFloat(parts[8]) * 5 // Approximate accuracy from HDOP
    };
}

function convertGPSCoord(coord, dir) {
    if (!coord) return null;
    const degrees = parseInt(coord.substring(0, 2));
    const minutes = parseFloat(coord.substring(2));
    let decimal = degrees + (minutes / 60);
    if (dir === 'S' || dir === 'W') decimal *= -1;
    return decimal;
}

function getGPSQualityDescription(quality) {
    const qualities = {
        0: 'No fix',
        1: 'GPS fix',
        2: 'DGPS fix',
        3: 'PPS fix',
        4: 'Real Time Kinematic',
        5: 'Float RTK',
        6: 'Estimated',
        7: 'Manual input',
        8: 'Simulation'
    };
    return qualities[quality] || 'Unknown';
}

// Initialize native GPS on startup
initializeNativeGPS();

// Log server status
console.log('\nServer Configuration:');
console.log(`- HTTP Port: ${httpPort}`);
console.log(`- HTTPS Port: ${httpsPort}`);
console.log('- GPS Sources: Browser Geolocation API');
console.log('\nAccess the tracking interface at:');
console.log(`http://localhost:${httpPort}/gps_live.html`);
console.log(`https://localhost:${httpsPort}/gps_live.html`);
console.log(`http://192.168.105.126:${httpPort}/gps_live.html`);
console.log(`https://192.168.105.126:${httpsPort}/gps_live.html`);

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Add viewing area collection endpoints
app.post('/api/viewing-area/collect', async (req, res) => {
    try {
        const { type, center, heading, points, metadata } = req.body;
        
        if (!points || !Array.isArray(points) || points.length === 0) {
            return res.status(400).json({ error: 'Points array required' });
        }

        console.log(`📡 Received viewing area collection request: ${points.length} points`);
        console.log(`🧭 Center: ${center.lat.toFixed(6)}, ${center.lon.toFixed(6)}, Heading: ${heading}°`);

        // Add points to elevation processing queue
        const db = getDatabase();
        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO gps_queue 
            (lat, lon, timestamp, priority, source, metadata) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        let addedCount = 0;
        const timestamp = new Date().toISOString();

        for (const point of points) {
            try {
                // Calculate priority based on ring and visibility
                const priority = calculateViewingAreaPriority(point, center);
                
                const metadata_json = JSON.stringify({
                    type: 'viewing_area',
                    pointId: point.id,
                    ringIndex: point.ringIndex,
                    distance: point.distance,
                    bearing: point.bearing,
                    visible: point.visible,
                    priority: point.priority,
                    centerLat: center.lat,
                    centerLon: center.lon,
                    heading: heading
                });

                insertStmt.run(
                    point.lat,
                    point.lon,
                    timestamp,
                    priority,
                    'viewing_area',
                    metadata_json
                );
                addedCount++;
            } catch (error) {
                console.error('Error adding point to queue:', error);
            }
        }

        console.log(`✅ Added ${addedCount}/${points.length} points to elevation queue`);

        res.json({
            success: true,
            pointsQueued: addedCount,
            totalPoints: points.length,
            queueId: `viewing_area_${Date.now()}`,
            estimatedTime: Math.ceil(addedCount / 25) * 2, // Rough estimate: 25 points per 2-second batch
            metadata: {
                center,
                heading,
                timestamp
            }
        });

    } catch (error) {
        console.error('Error processing viewing area collection request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/viewing-area/results', async (req, res) => {
    try {
        const { pointIds } = req.body;
        
        if (!pointIds || !Array.isArray(pointIds)) {
            return res.status(400).json({ error: 'Point IDs array required' });
        }

        const db = getDatabase();
        
        // Query for completed points
        const placeholders = pointIds.map(() => '?').join(',');
        const query = `
            SELECT lat, lon, elevation, elevation_source, metadata
            FROM gps_queue 
            WHERE elevation IS NOT NULL 
            AND JSON_EXTRACT(metadata, '$.pointId') IN (${placeholders})
            ORDER BY priority DESC
        `;

        const results = db.prepare(query).all(...pointIds);
        
        // Parse results and add point IDs
        const points = results.map(row => {
            let metadata = {};
            try {
                metadata = JSON.parse(row.metadata || '{}');
            } catch (e) {
                console.warn('Failed to parse metadata:', row.metadata);
            }

            return {
                id: metadata.pointId,
                lat: row.lat,
                lon: row.lon,
                elevation: row.elevation,
                elevationSource: row.elevation_source,
                ringIndex: metadata.ringIndex,
                distance: metadata.distance,
                bearing: metadata.bearing,
                visible: metadata.visible,
                priority: metadata.priority
            };
        });

        console.log(`📊 Returning ${points.length}/${pointIds.length} completed viewing area points`);

        res.json({
            success: true,
            points,
            totalRequested: pointIds.length,
            totalCompleted: points.length,
            completionRatio: points.length / pointIds.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching viewing area results:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to calculate priority for viewing area points
function calculateViewingAreaPriority(point, center) {
    let priority = 50; // Base priority
    
    // Higher priority for closer points
    if (point.distance < 1609) priority += 30; // Within 1 mile
    else if (point.distance < 8047) priority += 20; // Within 5 miles
    else if (point.distance < 32187) priority += 10; // Within 20 miles
    
    // Higher priority for visible points
    if (point.visible) priority += 25;
    
    // Higher priority for certain ring indices (sweet spots)
    if ([0, 2, 4, 7].includes(point.ringIndex)) priority += 15;
    
    // Add point's own priority
    priority += (point.priority || 0) / 10;
    
    return Math.min(100, Math.max(1, Math.round(priority)));
} 