import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const GRID_DB_DIR = path.join(__dirname, 'grid_databases');
const QUEUE_FILE = path.join(__dirname, 'collection_queue.json');
const LOCKS_DIR = path.join(__dirname, 'locks');
const STALE_LOCK_THRESHOLD = 30 * 60 * 1000; // 30 minutes

// Ensure directories exist
[GRID_DB_DIR, LOCKS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Initialize queue file if it doesn't exist
if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({ queue: [] }));
}

// Function to initialize database tables
function initializeDatabase(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS points (
            lat REAL,
            lon REAL,
            elevation REAL,
            source TEXT,
            timestamp TEXT,
            PRIMARY KEY (lat, lon)
        );

        CREATE TABLE IF NOT EXISTS grid_progress (
            grid_size INTEGER,
            cell_i INTEGER,
            cell_j INTEGER,
            points_collected INTEGER DEFAULT 0,
            PRIMARY KEY (grid_size, cell_i, cell_j)
        );
    `);
}

export function cleanupStaleLocks() {
    const now = Date.now();
    const files = fs.readdirSync(LOCKS_DIR);
    
    files.forEach(file => {
        const lockPath = path.join(LOCKS_DIR, file);
        try {
            const stats = fs.statSync(lockPath);
            if (now - stats.mtimeMs > STALE_LOCK_THRESHOLD) {
                fs.unlinkSync(lockPath);
                console.log(`Removed stale lock: ${file}`);
            }
        } catch (error) {
            console.error(`Error checking lock file ${file}:`, error);
        }
    });
}

function isLocked(dbPath) {
    const dbName = path.basename(dbPath);
    const lockFile = path.join(LOCKS_DIR, `${dbName}.lock`);
    return fs.existsSync(lockFile);
}

function getQueuedBounds() {
    try {
        const queueData = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        if (queueData.queue && queueData.queue.length > 0) {
            return queueData.queue[0];
        }
    } catch (error) {
        console.error('Error reading queue file:', error);
    }
    return null;
}

export function findIncompleteDatabase() {
    cleanupStaleLocks();  // Clean up stale locks first
    
    let leastComplete = null;
    let minCompletion = 1.0;
    
    // First check queued areas
    const queuedBounds = getQueuedBounds();
    if (queuedBounds) {
        return {
            bounds: queuedBounds,
            type: 'queued'
        };
    }
    
    // Then check existing databases
    const files = fs.readdirSync(GRID_DB_DIR);
    for (const file of files) {
        if (!file.endsWith('.db')) continue;
        
        const dbPath = path.join(GRID_DB_DIR, file);
        
        // Skip if locked
        if (isLocked(dbPath)) continue;
        
        try {
            const db = new Database(dbPath);
            // Initialize database tables if they don't exist
            initializeDatabase(db);
            
            const result = db.prepare('SELECT COUNT(*) as count FROM points').get();
            const completion = result.count / 10000;
            
            if (completion < minCompletion) {
                minCompletion = completion;
                leastComplete = {
                    path: dbPath,
                    completion,
                    count: result.count
                };
            }
            
            db.close();
        } catch (error) {
            console.error(`Error checking ${file}:`, error);
        }
    }
    
    if (leastComplete) {
        return {
            database: leastComplete,
            type: 'incomplete'
        };
    }
    
    // If no incomplete databases found, return null
    return null;
} 