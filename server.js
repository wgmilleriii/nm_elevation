const express = require('express');
const path = require('path');
const app = express();
<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
const port = 8020;
=======
const port = process.env.NODE_ENV === 'test' ? 3001 : 3000;
>>>>>>> Stashed changes
=======
const port = process.env.NODE_ENV === 'test' ? 3001 : 3000;
>>>>>>> Stashed changes
=======
const port = process.env.NODE_ENV === 'test' ? 3001 : 3000;
>>>>>>> Stashed changes

// Serve static files from the public directory
app.use(express.static('public'));
<<<<<<< Updated upstream

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
=======
app.use(express.json());  // Add JSON body parser
app.use(express.urlencoded({ extended: true }));  // Add URL-encoded parser

// Initialize database connection
async function getDb() {
    const dbPath = process.env.NODE_ENV === 'test' 
        ? path.join(__dirname, 'mountains.test.db')
        : path.join(__dirname, 'mountains.db');
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
        console.error('Database file not found:', dbPath);
        throw new Error('Database file not found');
    }
    
    console.log('Opening database at:', dbPath);
    return open({
        filename: dbPath,
        driver: sqlite3.Database
    });
}

app.get('/api/elevation-data', async (req, res) => {
    try {
        const bounds = req.query.bounds ? req.query.bounds.split(',').map(Number) : null;
        const mode = req.query.mode || 'grid'; // 'grid' for 24x24, 'high-res' for SVG1
        const offset = parseInt(req.query.offset) || 0; // New offset parameter for chunking
        const chunkSize = 10000; // Number of points per chunk
        
        // Skip bounds validation if no bounds provided (initial load)
        if (bounds !== null) {
            // Check if we have exactly 4 numbers
            if (bounds.length !== 4 || bounds.some(isNaN)) {
                console.error('Invalid bounds format:', req.query.bounds);
                return res.status(400).json({ 
                    error: 'Invalid bounds format. Expected: minLat,minLon,maxLat,maxLon' 
                });
            }

            const [minLat, minLon, maxLat, maxLon] = bounds;
            
            // Validate bounds values
            if (minLat > maxLat || minLon > maxLon) {
                console.error('Invalid bounds values:', { minLat, minLon, maxLat, maxLon });
                return res.status(400).json({ 
                    error: 'Invalid bounds: min values must be less than max values' 
                });
            }

            // Validate bounds are within New Mexico (with some buffer)
            const NM_BOUNDS = {
                minLat: 31.20, // Slightly south of NM border
                maxLat: 37.20, // Slightly north of NM border
                minLon: -109.20, // Slightly west of NM border
                maxLon: -102.80  // Slightly east of NM border
            };

            if (minLat < NM_BOUNDS.minLat || maxLat > NM_BOUNDS.maxLat ||
                minLon < NM_BOUNDS.minLon || maxLon > NM_BOUNDS.maxLon) {
                console.error('Bounds outside New Mexico:', { minLat, minLon, maxLat, maxLon });
                return res.status(400).json({ 
                    error: 'Selected region extends outside New Mexico',
                    requestedBounds: { minLat, minLon, maxLat, maxLon },
                    validBounds: NM_BOUNDS,
                    message: 'Please select an area within New Mexico'
                });
            }

            // Log the validated bounds
            console.log('Valid bounds received:', { minLat, minLon, maxLat, maxLon });
        }

        console.log(`Received request for elevation data${bounds ? ' with bounds: ' + bounds.join(',') : ' (initial load)'}`);
        const db = await getDb();
        
        // Check if table exists
        const tableCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='elevation_points'");
        if (!tableCheck) {
            console.error('elevation_points table not found in database');
            throw new Error('Database table not found');
        }
        
        let query;
        let countQuery;
        const params = [];
        
        if (bounds) {
            const [minLat, minLon, maxLat, maxLon] = bounds;
            console.log('Processing bounds:', { minLat, minLon, maxLat, maxLon });
            
            if (mode === 'grid') {
                // For bounded grid requests (map and SVG2), use 24x24 grid
                const gridSize = 24;
                const latStep = (maxLat - minLat) / (gridSize - 1);
                const lonStep = (maxLon - minLon) / (gridSize - 1);
                
                // Generate grid points and find nearest elevation for each
                const gridPoints = [];
                for (let i = 0; i < gridSize; i++) {
                    for (let j = 0; j < gridSize; j++) {
                        const lat = minLat + (i * latStep);
                        const lon = minLon + (j * lonStep);
                        gridPoints.push([lat, lon]);
                    }
                }
                console.log(`Created ${gridPoints.length} grid points`);
                
                // Get points in the area
                query = `
                    SELECT latitude, longitude, elevation
                    FROM elevation_points
                    WHERE latitude BETWEEN ? AND ?
                    AND longitude BETWEEN ? AND ?
                `;
                const searchParams = [minLat - 0.01, maxLat + 0.01, minLon - 0.01, maxLon + 0.01];
                console.log('Searching with params:', searchParams);
                params.push(...searchParams);
            } else {
                // For high-res requests (SVG1), return points in chunks
                countQuery = `
                    WITH points AS (
                        SELECT latitude, longitude, elevation,
                               ROUND(latitude * 100) as lat_grid,
                               ROUND(longitude * 100) as lon_grid
                        FROM elevation_points
                        WHERE latitude BETWEEN ? AND ?
                        AND longitude BETWEEN ? AND ?
                    ),
                    density AS (
                        SELECT lat_grid, lon_grid,
                               COUNT(*) as point_count,
                               MIN(elevation) as min_elev,
                               MAX(elevation) as max_elev
                        FROM points
                        GROUP BY lat_grid, lon_grid
                    ),
                    sampled AS (
                        SELECT p.latitude, p.longitude, p.elevation,
                               d.point_count,
                               ROW_NUMBER() OVER (
                                   PARTITION BY p.lat_grid, p.lon_grid 
                                   ORDER BY 
                                       CASE 
                                           WHEN p.elevation = d.min_elev THEN 1
                                           WHEN p.elevation = d.max_elev THEN 1
                                           ELSE 2 
                                       END,
                                       ABS(p.elevation - (d.min_elev + d.max_elev) / 2) DESC
                               ) as rn
                        FROM points p
                        JOIN density d ON p.lat_grid = d.lat_grid AND p.lon_grid = d.lon_grid
                    )
                    SELECT COUNT(*) as total_points
                    FROM sampled
                    WHERE (point_count < 4 OR rn <= 2)
                `;
                
                query = `
                    WITH points AS (
                        SELECT latitude, longitude, elevation,
                               ROUND(latitude * 100) as lat_grid,
                               ROUND(longitude * 100) as lon_grid
                        FROM elevation_points
                        WHERE latitude BETWEEN ? AND ?
                        AND longitude BETWEEN ? AND ?
                    ),
                    density AS (
                        SELECT lat_grid, lon_grid,
                               COUNT(*) as point_count,
                               MIN(elevation) as min_elev,
                               MAX(elevation) as max_elev
                        FROM points
                        GROUP BY lat_grid, lon_grid
                        HAVING point_count > 0
                    ),
                    sampled AS (
                        SELECT p.latitude, p.longitude, p.elevation,
                               d.point_count,
                               ROW_NUMBER() OVER (
                                   PARTITION BY p.lat_grid, p.lon_grid 
                                   ORDER BY 
                                       CASE 
                                           WHEN p.elevation = d.min_elev THEN 1
                                           WHEN p.elevation = d.max_elev THEN 1
                                           ELSE 2 
                                       END,
                                       ABS(p.elevation - (d.min_elev + d.max_elev) / 2) DESC
                               ) as rn
                        FROM points p
                        JOIN density d ON p.lat_grid = d.lat_grid AND p.lon_grid = d.lon_grid
                    )
                    SELECT latitude, longitude, elevation
                    FROM sampled s
                    WHERE (s.point_count < 4 OR s.rn <= 2)
                    ORDER BY s.latitude, s.longitude
                    LIMIT ? OFFSET ?
                `;
                params.push(minLat, maxLat, minLon, maxLon);
                
                // Get total count first
                const countResult = await db.get(countQuery, params);
                const totalPoints = countResult.total_points;
                
                // Add limit and offset to params
                params.push(chunkSize, offset);
                
                // Calculate if there are more points
                const hasMore = offset + chunkSize < totalPoints;
                
                const data = await db.all(query, params);
                console.log(`Found ${data.length} elevation points (chunk ${offset / chunkSize + 1} of ${Math.ceil(totalPoints / chunkSize)})`);
                
                // Calculate min/max elevation efficiently
                const elevations = data.map(p => p.elevation).filter(e => e !== null);
                const stats = {
                    min_elevation: elevations.reduce((min, e) => Math.min(min, e), Infinity),
                    max_elevation: elevations.reduce((max, e) => Math.max(max, e), -Infinity),
                    point_count: data.length,
                    total_points: totalPoints,
                    offset: offset,
                    hasMore: hasMore,
                    chunk: offset / chunkSize + 1,
                    total_chunks: Math.ceil(totalPoints / chunkSize)
                };
                
                console.log('Sending chunked response with stats:', stats);
                await db.close();
                return res.json({ points: data, stats });
            }
        } else {
            // For initial load, get a sparse sampling across New Mexico
            query = `
                WITH RECURSIVE
                grid_points AS (
                    SELECT latitude, longitude, elevation,
                           ROUND(latitude * 5) as lat_grid,
                           ROUND(longitude * 5) as lon_grid
                    FROM elevation_points
                    WHERE latitude BETWEEN 31.20 AND 37.20
                    AND longitude BETWEEN -109.20 AND -102.80
                ),
                sampled_points AS (
                    SELECT latitude, longitude, elevation,
                           ROW_NUMBER() OVER (PARTITION BY lat_grid, lon_grid ORDER BY RANDOM()) as rn
                    FROM grid_points
                )
                SELECT latitude, longitude, elevation
                FROM sampled_points
                WHERE rn = 1
                LIMIT 2000
            `;
        }
        
        const data = await db.all(query, params);
        console.log(`Found ${data.length} elevation points`);
        
        await db.close();
        
        if (data.length === 0) {
            console.warn('No elevation points found in database');
            return res.json({ points: [], stats: { min_elevation: 0, max_elevation: 0, point_count: 0 } });
        }
        
        // Calculate min/max elevation efficiently
        const elevations = data.map(p => p.elevation).filter(e => e !== null);
        const stats = {
            min_elevation: elevations.reduce((min, e) => Math.min(min, e), Infinity),
            max_elevation: elevations.reduce((max, e) => Math.max(max, e), -Infinity),
            point_count: data.length
        };
        
        console.log('Sending response with stats:', stats);
        return res.json({ points: data, stats });
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
        
        const db = await getDb();
        
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
        const db = await getDb();
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
    console.log('Current directory:', __dirname);
    console.log('Database exists:', fs.existsSync(path.join(__dirname, process.env.NODE_ENV === 'test' ? 'mountains.test.db' : 'mountains.db')));
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
}); 