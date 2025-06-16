import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Queue configuration for Sandia Mountains area
const SANDIA_BOUNDS = {
    // Centered on the viewpoint (35.11542, -106.4979)
    minLat: 35.0,  // Extend south
    maxLat: 35.3,  // Extend north
    minLon: -106.6, // Extend west
    maxLon: -106.3  // Extend east
};

const GRID_SIZE = 100; // 100x100 grid for high resolution
const PRIORITY_LEVELS = {
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3
};

// Database schema
const DB_SCHEMA = `
    CREATE TABLE IF NOT EXISTS elevation_points (
        lat REAL,
        lon REAL,
        elevation REAL,
        source TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (lat, lon)
    );

    CREATE TABLE IF NOT EXISTS collection_stats (
        total_points INTEGER,
        high_priority_points INTEGER,
        medium_priority_points INTEGER,
        low_priority_points INTEGER,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP
    );
`;

class QueueManager {
    constructor() {
        this.queueFile = path.join(__dirname, 'data', 'collection_queue.json');
        this.dbPath = path.join(__dirname, 'data', 'sandia_elevation.db');
        this.ensureDirectories();
        this.initializeDatabase();
    }

    ensureDirectories() {
        const dataDir = path.dirname(this.queueFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        if (!fs.existsSync(this.queueFile)) {
            fs.writeFileSync(this.queueFile, JSON.stringify({ queue: [] }));
        }
    }

    initializeDatabase() {
        const db = new Database(this.dbPath);
        db.exec(DB_SCHEMA);
        
        // Initialize stats if not exists
        const hasStats = db.prepare('SELECT COUNT(*) as count FROM collection_stats').get();
        if (hasStats.count === 0) {
            db.prepare(`
                INSERT INTO collection_stats 
                (total_points, high_priority_points, medium_priority_points, low_priority_points) 
                VALUES (0, 0, 0, 0)
            `).run();
        }
        
        db.close();
    }

    generateSandiaGrid() {
        const latStep = (SANDIA_BOUNDS.maxLat - SANDIA_BOUNDS.minLat) / GRID_SIZE;
        const lonStep = (SANDIA_BOUNDS.maxLon - SANDIA_BOUNDS.minLon) / GRID_SIZE;
        const grid = [];

        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                const lat = SANDIA_BOUNDS.minLat + (i * latStep);
                const lon = SANDIA_BOUNDS.minLon + (j * lonStep);
                
                // Calculate priority based on distance from viewpoint
                const distance = this.calculateDistance(
                    lat, lon,
                    35.11542, -106.4979 // Viewpoint coordinates
                );
                
                const priority = distance < 5000 ? PRIORITY_LEVELS.HIGH :
                               distance < 10000 ? PRIORITY_LEVELS.MEDIUM :
                               PRIORITY_LEVELS.LOW;

                grid.push({
                    lat,
                    lon,
                    priority,
                    distance
                });
            }
        }

        return grid;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
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

    async populateQueue() {
        const grid = this.generateSandiaGrid();
        const queue = JSON.parse(fs.readFileSync(this.queueFile));
        const db = new Database(this.dbPath);

        try {
            // Check which points we already have
            const stmt = db.prepare(`
                SELECT lat, lon FROM elevation_points 
                WHERE lat BETWEEN ? AND ? 
                AND lon BETWEEN ? AND ?
            `);

            const existingPoints = stmt.all(
                SANDIA_BOUNDS.minLat,
                SANDIA_BOUNDS.maxLat,
                SANDIA_BOUNDS.minLon,
                SANDIA_BOUNDS.maxLon
            );

            const existingSet = new Set(
                existingPoints.map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`)
            );

            // Add missing points to queue
            const newPoints = grid.filter(point => 
                !existingSet.has(`${point.lat.toFixed(6)},${point.lon.toFixed(6)}`)
            );

            // Sort by priority and distance
            newPoints.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                return a.distance - b.distance;
            });

            queue.queue = [...queue.queue, ...newPoints];
            fs.writeFileSync(this.queueFile, JSON.stringify(queue, null, 2));

            return {
                totalPoints: grid.length,
                existingPoints: existingPoints.length,
                newPointsQueued: newPoints.length
            };
        } finally {
            db.close();
        }
    }

    getNextBatch(batchSize = 50) {
        const queue = JSON.parse(fs.readFileSync(this.queueFile));
        const batch = queue.queue.slice(0, batchSize);
        queue.queue = queue.queue.slice(batchSize);
        fs.writeFileSync(this.queueFile, JSON.stringify(queue, null, 2));
        return batch;
    }

    markPointsComplete(points) {
        const queue = JSON.parse(fs.readFileSync(this.queueFile));
        const pointSet = new Set(points.map(p => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`));
        
        queue.queue = queue.queue.filter(point => 
            !pointSet.has(`${point.lat.toFixed(6)},${point.lon.toFixed(6)}`)
        );
        
        fs.writeFileSync(this.queueFile, JSON.stringify(queue, null, 2));

        // Update stats in database
        const db = new Database(this.dbPath);
        try {
            db.transaction(() => {
                const updateStats = db.prepare(`
                    UPDATE collection_stats 
                    SET 
                        total_points = total_points + ?,
                        high_priority_points = high_priority_points + ?,
                        medium_priority_points = medium_priority_points + ?,
                        low_priority_points = low_priority_points + ?,
                        last_updated = CURRENT_TIMESTAMP
                `);

                const priorityCounts = {
                    [PRIORITY_LEVELS.HIGH]: 0,
                    [PRIORITY_LEVELS.MEDIUM]: 0,
                    [PRIORITY_LEVELS.LOW]: 0
                };

                points.forEach(point => {
                    if (point.priority) {
                        priorityCounts[point.priority]++;
                    }
                });

                updateStats.run(
                    points.length,
                    priorityCounts[PRIORITY_LEVELS.HIGH],
                    priorityCounts[PRIORITY_LEVELS.MEDIUM],
                    priorityCounts[PRIORITY_LEVELS.LOW]
                );
            })();
        } finally {
            db.close();
        }
    }

    getQueueStats() {
        const queue = JSON.parse(fs.readFileSync(this.queueFile));
        const db = new Database(this.dbPath);
        
        try {
            const dbStats = db.prepare('SELECT * FROM collection_stats').get();
            const priorityCounts = {
                [PRIORITY_LEVELS.HIGH]: 0,
                [PRIORITY_LEVELS.MEDIUM]: 0,
                [PRIORITY_LEVELS.LOW]: 0
            };

            queue.queue.forEach(point => {
                priorityCounts[point.priority]++;
            });

            return {
                totalQueued: queue.queue.length,
                byPriority: priorityCounts,
                collected: {
                    total: dbStats.total_points,
                    high: dbStats.high_priority_points,
                    medium: dbStats.medium_priority_points,
                    low: dbStats.low_priority_points,
                    lastUpdated: dbStats.last_updated
                }
            };
        } finally {
            db.close();
        }
    }

    getDbPath() {
        return this.dbPath;
    }
}

export default QueueManager; 