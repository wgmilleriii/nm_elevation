import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration based on your existing system
const MAX_POINTS_PER_DB = 40000;  // Same as your mountains_x_y.db limit
const DEFAULT_RADIUS_MILES = [10, 5, 1, 0.5, 0.1]; // Concentric zones around user
const GRID_PRECISION = 4; // Decimal places for GPS grid naming

// Database naming system for user-centric GPS boundaries
class UserDatabaseManager {
    constructor() {
        this.userDbDir = path.join(__dirname, '..', 'user_databases');
        this.ensureDirectoryExists(this.userDbDir);
    }

    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    /**
     * Generate database name based on user GPS position and session
     * Format: user_{userId}_{sessionId}_{gpsGrid}_{radiusMiles}.db
     * Example: user_abc123_session001_3584_-1048_radius10.db
     */
    generateDatabaseName(userId, sessionId, lat, lon, radiusMiles) {
        // Create GPS grid coordinates (4 decimal precision = ~11m accuracy)
        const latGrid = Math.floor(lat * Math.pow(10, GRID_PRECISION));
        const lonGrid = Math.floor(lon * Math.pow(10, GRID_PRECISION));
        
        // Clean session ID for filename
        const cleanSessionId = sessionId.replace(/[^a-zA-Z0-9_]/g, '_');
        const cleanUserId = userId.replace(/[^a-zA-Z0-9_]/g, '_');
        
        return `user_${cleanUserId}_${cleanSessionId}_${latGrid}_${lonGrid}_radius${radiusMiles}.db`;
    }

    /**
     * Get GPS bounds for a given center point and radius
     */
    calculateGPSBounds(centerLat, centerLon, radiusMiles) {
        // Convert miles to degrees (approximate)
        // 1 degree latitude ≈ 69 miles
        // 1 degree longitude ≈ 69 * cos(latitude) miles
        const latDegreePerMile = 1 / 69;
        const lonDegreePerMile = 1 / (69 * Math.cos(centerLat * Math.PI / 180));
        
        const latRadius = radiusMiles * latDegreePerMile;
        const lonRadius = radiusMiles * lonDegreePerMile;
        
        return {
            minLat: centerLat - latRadius,
            maxLat: centerLat + latRadius,
            minLon: centerLon - lonRadius,
            maxLon: centerLon + lonRadius,
            centerLat,
            centerLon,
            radiusMiles
        };
    }

    /**
     * Find or create user database for specific GPS location and radius
     */
    getUserDatabase(userId, sessionId, lat, lon, radiusMiles) {
        const dbName = this.generateDatabaseName(userId, sessionId, lat, lon, radiusMiles);
        const dbPath = path.join(this.userDbDir, dbName);
        
        let db;
        const isNew = !fs.existsSync(dbPath);
        
        if (isNew) {
            console.log(`Creating new user database: ${dbName}`);
            db = new Database(dbPath);
            this.initializeUserDatabase(db, userId, sessionId, lat, lon, radiusMiles);
        } else {
            console.log(`Using existing user database: ${dbName}`);
            db = new Database(dbPath);
        }
        
        return {
            db,
            dbPath,
            dbName,
            isNew,
            bounds: this.calculateGPSBounds(lat, lon, radiusMiles)
        };
    }

    /**
     * Initialize user database with schema and metadata
     */
    initializeUserDatabase(db, userId, sessionId, centerLat, centerLon, radiusMiles) {
        // Same schema as your existing system but with user metadata
        const schema = `
            CREATE TABLE IF NOT EXISTS points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                elevation REAL,
                source TEXT,
                collection_type TEXT DEFAULT 'adaptive',
                priority_score REAL DEFAULT 0,
                distance_from_user REAL,
                elevation_anomaly_score REAL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_lat_lon ON points(lat, lon);
            CREATE INDEX IF NOT EXISTS idx_distance ON points(distance_from_user);
            CREATE INDEX IF NOT EXISTS idx_anomaly ON points(elevation_anomaly_score);
            
            CREATE TABLE IF NOT EXISTS user_metadata (
                id INTEGER PRIMARY KEY,
                user_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                center_lat REAL NOT NULL,
                center_lon REAL NOT NULL,
                radius_miles REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_points INTEGER DEFAULT 0,
                ridge_points INTEGER DEFAULT 0,
                edge_points INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS collection_progress (
                radius_zone REAL PRIMARY KEY,
                points_collected INTEGER DEFAULT 0,
                anomalies_found INTEGER DEFAULT 0,
                last_collection DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        db.exec(schema);
        
        // Insert user metadata
        const insertMetadata = db.prepare(`
            INSERT INTO user_metadata (user_id, session_id, center_lat, center_lon, radius_miles)
            VALUES (?, ?, ?, ?, ?)
        `);
        insertMetadata.run(userId, sessionId, centerLat, centerLon, radiusMiles);
        
        // Initialize collection progress for each radius zone
        const insertProgress = db.prepare(`
            INSERT INTO collection_progress (radius_zone) VALUES (?)
        `);
        DEFAULT_RADIUS_MILES.forEach(radius => {
            if (radius <= radiusMiles) {
                insertProgress.run(radius);
            }
        });
        
        console.log(`Initialized database for user ${userId}, session ${sessionId}, center (${centerLat}, ${centerLon}), radius ${radiusMiles} miles`);
    }

    /**
     * Get all databases for a specific user
     */
    getUserDatabases(userId) {
        const pattern = `user_${userId.replace(/[^a-zA-Z0-9_]/g, '_')}_*.db`;
        const files = fs.readdirSync(this.userDbDir)
            .filter(file => file.match(new RegExp(pattern.replace('*', '.*'))))
            .map(file => {
                const fullPath = path.join(this.userDbDir, file);
                const stats = fs.statSync(fullPath);
                
                // Parse database name to extract metadata
                const parts = file.replace('.db', '').split('_');
                const sessionId = parts.slice(2, -3).join('_'); // Everything between user_id and coordinates
                const latGrid = parseInt(parts[parts.length - 3]);
                const lonGrid = parseInt(parts[parts.length - 2]);
                const radiusPart = parts[parts.length - 1];
                const radiusMiles = parseFloat(radiusPart.replace('radius', ''));
                
                return {
                    file,
                    path: fullPath,
                    sessionId,
                    centerLat: latGrid / Math.pow(10, GRID_PRECISION),
                    centerLon: lonGrid / Math.pow(10, GRID_PRECISION),
                    radiusMiles,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                };
            });
        
        return files.sort((a, b) => b.modified - a.modified); // Most recent first
    }

    /**
     * Get database status and point count
     */
    getDatabaseStatus(dbPath) {
        try {
            const db = new Database(dbPath);
            const pointCount = db.prepare('SELECT COUNT(*) as count FROM points').get();
            const metadata = db.prepare('SELECT * FROM user_metadata LIMIT 1').get();
            const progress = db.prepare('SELECT * FROM collection_progress ORDER BY radius_zone').all();
            db.close();
            
            return {
                pointCount: pointCount.count,
                maxPoints: MAX_POINTS_PER_DB,
                completion: pointCount.count / MAX_POINTS_PER_DB,
                metadata,
                progress,
                isFull: pointCount.count >= MAX_POINTS_PER_DB
            };
        } catch (error) {
            console.error(`Error getting database status for ${dbPath}:`, error);
            return null;
        }
    }

    /**
     * Clean up old databases for a user (keep only most recent N)
     */
    cleanupOldDatabases(userId, keepCount = 5) {
        const userDbs = this.getUserDatabases(userId);
        
        if (userDbs.length > keepCount) {
            const toDelete = userDbs.slice(keepCount);
            
            for (const dbInfo of toDelete) {
                try {
                    fs.unlinkSync(dbInfo.path);
                    console.log(`Cleaned up old database: ${dbInfo.file}`);
                } catch (error) {
                    console.error(`Error deleting ${dbInfo.file}:`, error);
                }
            }
        }
    }

    /**
     * List all user databases with status
     */
    listAllUserDatabases() {
        const files = fs.readdirSync(this.userDbDir)
            .filter(file => file.startsWith('user_') && file.endsWith('.db'))
            .map(file => {
                const fullPath = path.join(this.userDbDir, file);
                const status = this.getDatabaseStatus(fullPath);
                
                return {
                    file,
                    path: fullPath,
                    ...status
                };
            });
        
        return files.sort((a, b) => b.metadata?.last_updated?.localeCompare(b.metadata?.last_updated) || 0);
    }
}

// Example usage and testing
export { UserDatabaseManager };

// Test the system if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const manager = new UserDatabaseManager();
    
    // Test with sample user data
    const testUserId = 'user_abc123';
    const testSessionId = 'session_000024_user_abc123_1751143393';
    const testLat = 35.0844; // Albuquerque
    const testLon = -106.6504;
    
    console.log('🧪 Testing User Database Manager');
    console.log('================================');
    
    // Test database creation for different radii
    for (const radius of [10, 5, 1]) {
        console.log(`\n📍 Testing radius: ${radius} miles`);
        
        const dbInfo = manager.getUserDatabase(testUserId, testSessionId, testLat, testLon, radius);
        console.log(`Database: ${dbInfo.dbName}`);
        console.log(`Bounds:`, dbInfo.bounds);
        console.log(`Is new: ${dbInfo.isNew}`);
        
        const status = manager.getDatabaseStatus(dbInfo.dbPath);
        console.log(`Status:`, status);
        
        dbInfo.db.close();
    }
    
    // List all databases for this user
    console.log('\n📊 All databases for user:');
    const userDbs = manager.getUserDatabases(testUserId);
    userDbs.forEach(db => {
        console.log(`  ${db.file} - Session: ${db.sessionId}, Radius: ${db.radiusMiles}mi, Modified: ${db.modified}`);
    });
    
    // List all user databases in system
    console.log('\n🗄️ All user databases in system:');
    const allDbs = manager.listAllUserDatabases();
    allDbs.forEach(db => {
        console.log(`  ${db.file} - Points: ${db.pointCount}/${db.maxPoints} (${(db.completion * 100).toFixed(1)}%)`);
    });
}
