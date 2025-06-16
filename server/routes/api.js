const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Create connection pools for both databases
const pgPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'elevation',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
});

// Connect to Sandia detail database
const sandiaDb = new sqlite3.Database(path.join(__dirname, '..', '..', 'sandia_detail.db'), (err) => {
    if (err) {
        console.error('Error connecting to sandia_detail.db:', err);
    } else {
        console.log('Connected to sandia_detail.db');
    }
});

router.get('/elevation-data', async (req, res) => {
    try {
        const bounds = req.query.bounds.split(',').map(Number);
        const numPoints = parseInt(req.query.points) || 10000;
        
        console.log('API Request:', {
            bounds,
            numPoints,
            query: req.query
        });
        
        if (bounds.length !== 4) {
            return res.status(400).json({ success: false, error: 'Invalid bounds format' });
        }

        const [minLat, minLon, maxLat, maxLon] = bounds;
        console.log('Parsed bounds:', { minLat, minLon, maxLat, maxLon });

        // Check if this is a Sandia Mountains query
        const isSandiaQuery = (
            minLat >= 35.0 && maxLat <= 35.3 &&     // Wider latitude range
            minLon >= -106.6 && maxLon <= -106.3    // Wider longitude range
        );
        
        console.log('Query type:', { isSandiaQuery });

        if (isSandiaQuery) {
            console.log('Using Sandia detail database for query');
            
            // Debug: Check available points
            const countStmt = sandiaDb.prepare('SELECT COUNT(*) as count FROM elevation_points WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?');
            const count = countStmt.get(minLat, maxLat, minLon, maxLon);
            console.log('Available points in bounds:', count);
            
            // Use the detailed Sandia database
            sandiaDb.all(`
                SELECT 
                    latitude, 
                    longitude, 
                    elevation,
                    source
                FROM elevation_points
                WHERE latitude BETWEEN ? AND ?
                AND longitude BETWEEN ? AND ?
                ORDER BY RANDOM()
                LIMIT ?
            `, [minLat, maxLat, minLon, maxLon, numPoints], (err, rows) => {
                if (err) {
                    console.error('Error querying Sandia database:', err);
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                
                console.log('Query results:', {
                    requestedPoints: numPoints,
                    returnedPoints: rows?.length,
                    samplePoint: rows?.[0]
                });
                
                res.json({
                    success: true,
                    points: rows,
                    bounds: { minLat, maxLat, minLon, maxLon },
                    source: 'sandia_detail'
                });
            });
        } else {
            console.log('Using PostgreSQL database for query');
            // Use the regular PostgreSQL database for other areas
            const query = `
                WITH grid AS (
                    SELECT 
                        latitude,
                        longitude,
                        elevation,
                        ROW_NUMBER() OVER (
                            PARTITION BY 
                                ROUND(latitude::numeric, 4),
                                ROUND(longitude::numeric, 4)
                            ORDER BY elevation DESC
                        ) as rn
                    FROM elevation_points
                    WHERE latitude BETWEEN $1 AND $2
                    AND longitude BETWEEN $3 AND $4
                    AND elevation > 2000
                )
                SELECT latitude, longitude, elevation
                FROM grid
                WHERE rn = 1
                ORDER BY elevation DESC
                LIMIT $5;
            `;

            const result = await pgPool.query(query, [minLat, maxLat, minLon, maxLon, numPoints]);

            res.json({
                success: true,
                points: result.rows,
                bounds: { minLat, maxLat, minLon, maxLon },
                source: 'postgres'
            });
        }
    } catch (error) {
        console.error('Error fetching elevation data:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch elevation data' });
    }
}); 