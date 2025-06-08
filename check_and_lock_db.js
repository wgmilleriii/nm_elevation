import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const LOCK_DIR = path.join(__dirname, 'locks');
const DB_DIR = path.join(__dirname, 'grid_databases');
const LOG_DIR = path.join(__dirname, 'logs');
const MAC_DIR = path.join(__dirname, 'MAC');

// Create necessary directories
[LOCK_DIR, DB_DIR, LOG_DIR, MAC_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Logging function
function logSync(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} [${type}] ${message}\n`;
    const logFile = path.join(LOG_DIR, 'lock_sync.log');
    fs.appendFileSync(logFile, logMessage);
    console.log(`[${type}] ${message}`);
}

// Function to sync lock files with retries
async function syncLockFiles(retries = 3, delay = 1000) {
    const maxRetries = retries;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            if (process.platform === 'win32') {
                // Sync from PC to Pi1 using scp
                logSync(`Attempting to sync locks from PC to Pi1 (attempt ${attempt + 1}/${maxRetries})`);
                
                // First ensure the locks directory exists on Pi
                execSync(`ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68 "mkdir -p /home/pi/nm_elevation/locks"`, {
                    stdio: 'pipe'
                });

                // Ensure local locks directory exists
                if (!fs.existsSync(LOCK_DIR)) {
                    fs.mkdirSync(LOCK_DIR, { recursive: true });
                }

                // Get list of lock files
                const lockFiles = fs.readdirSync(LOCK_DIR)
                    .filter(file => file.endsWith('.lock'));

                if (lockFiles.length === 0) {
                    logSync('No lock files to sync');
                    return true;
                }

                // Copy each lock file individually
                for (const lockFile of lockFiles) {
                    const sourcePath = path.join(LOCK_DIR, lockFile);
                    execSync(`scp -i "C:/Users/Wgmil/.ssh/pi_auto_key" "${sourcePath}" "pi@10.0.0.68:/home/pi/nm_elevation/locks/"`, {
                        stdio: 'pipe'
                    });
                }
                
                logSync('Successfully synced locks from PC to Pi1');
            } else {
                // Sync from Pi to PC using scp
                logSync(`Attempting to sync locks from Pi to PC (attempt ${attempt + 1}/${maxRetries})`);
                
                // First ensure the locks directory exists locally
                if (!fs.existsSync(LOCK_DIR)) {
                    fs.mkdirSync(LOCK_DIR, { recursive: true });
                }

                // Get list of lock files
                const lockFiles = fs.readdirSync(LOCK_DIR)
                    .filter(file => file.endsWith('.lock'));

                if (lockFiles.length === 0) {
                    logSync('No lock files to sync');
                    return true;
                }

                // Copy each lock file individually
                for (const lockFile of lockFiles) {
                    const sourcePath = path.join(LOCK_DIR, lockFile);
                    execSync(`scp -i /home/pi/.ssh/pi_auto_key "${sourcePath}" "C:/Users/Wgmil/OneDrive/Documents/GitHub/nm_elevation/locks/"`, {
                        stdio: 'pipe'
                    });
                }
                
                logSync('Successfully synced locks from Pi to PC');
            }
            return true;
        } catch (error) {
            attempt++;
            logSync(`Sync attempt ${attempt} failed: ${error.message}`, 'ERROR');
            
            if (attempt < maxRetries) {
                logSync(`Waiting ${delay/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                // Exponential backoff
                delay *= 2;
            } else {
                logSync('All sync attempts failed', 'ERROR');
                throw new Error(`Failed to sync lock files after ${maxRetries} attempts: ${error.message}`);
            }
        }
    }
    return false;
}

function getCompletionPercentage(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new Database(dbPath);
        db.get("SELECT COUNT(*) as count FROM elevation_points", (err, row) => {
            db.close();
            if (err) {
                reject(err);
                return;
            }
            // Assuming 10000 points is 100% complete
            const percentage = (row.count / 10000) * 100;
            resolve(percentage);
        });
    });
}

function isLockStale(lockFile) {
    try {
        const contents = fs.readFileSync(lockFile, 'utf8').split('\n');
        if (contents.length !== 2) return true;  // Invalid format
        
        const lockTime = new Date(contents[1]);
        const now = new Date();
        const staleDuration = 1000 * 60 * 60;  // 1 hour
        
        return (now - lockTime) > staleDuration;
    } catch (error) {
        logSync(`Error checking lock staleness: ${error.message}`, 'ERROR');
        return true;  // If we can't read the lock, consider it stale
    }
}

function isLocked(dbName) {
    const lockFile = path.join(LOCK_DIR, `${dbName}.lock`);
    return fs.existsSync(lockFile) && !isLockStale(lockFile);
}

async function createLock(dbName) {
    const lockFile = path.join(LOCK_DIR, `${dbName}.lock`);
    const hostname = process.platform === 'win32' ? 'PC' : require('os').hostname();
    
    try {
        fs.writeFileSync(lockFile, `${hostname}\n${new Date().toISOString()}`);
        logSync(`Created lock file for ${dbName}`);
        
        // Immediately sync the lock file with retries
        await syncLockFiles();
        logSync(`Successfully synced lock file for ${dbName}`);
    } catch (error) {
        logSync(`Failed to create/sync lock for ${dbName}: ${error.message}`, 'ERROR');
        // If we can't sync, we should remove the local lock to prevent inconsistency
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
        }
        throw error;
    }
}

async function removeLock(x, y) {
    const lockPath = path.join(LOCK_DIR, `mountains_${x}_${y}.lock`);
    if (fs.existsSync(lockPath)) {
        try {
            fs.unlinkSync(lockPath);
            logSync(`Removed lock file for mountains_${x}_${y}`);
            
            // Immediately sync the removal with retries
            await syncLockFiles();
            logSync(`Successfully synced lock removal for mountains_${x}_${y}`);
        } catch (error) {
            logSync(`Failed to remove/sync lock for mountains_${x}_${y}: ${error.message}`, 'ERROR');
            throw error;
        }
    }
}

function findNextDatabase() {
    const gridSize = 10;
    let mostIncomplete = null;
    let lowestCompletion = 1.0; // 100%

    // Check each potential database location
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const dbPath = path.join(DB_DIR, `mountains_${i}_${j}.db`);
            const lockPath = path.join(LOCK_DIR, `mountains_${i}_${j}.lock`);

            // Check if locked and not stale
            if (fs.existsSync(lockPath)) {
                if (isLockStale(lockPath)) {
                    // Remove stale lock
                    try {
                        fs.unlinkSync(lockPath);
                        logSync(`Removed stale lock for mountains_${i}_${j}`);
                    } catch (error) {
                        logSync(`Failed to remove stale lock for mountains_${i}_${j}: ${error.message}`, 'ERROR');
                        continue;
                    }
                } else {
                    continue;  // Skip if lock is valid
                }
            }

            // If database doesn't exist, this is our target
            if (!fs.existsSync(dbPath)) {
                return { x: i, y: j, points: 0, completion: 0 };
            }

            try {
                // Create lock file
                fs.writeFileSync(lockPath, `${process.platform === 'win32' ? 'PC' : require('os').hostname()}\n${new Date().toISOString()}`);
                return { x: i, y: j };
            } catch (error) {
                console.error(`Error creating lock for ${i},${j}:`, error);
                continue;
            }
        }
    }

    return null;
}

// Export functions for use in other scripts
export {
    findNextDatabase,
    removeLock,
    isLocked
};

// If run directly, find and lock the next database
if (import.meta.url === `file://${process.argv[1]}`) {
    findNextDatabase()
        .then(db => {
            if (db) {
                console.log(`Next database to process: ${db.name}`);
                process.exit(0);
            } else {
                console.log('No available databases to process');
                process.exit(1);
            }
        })
        .catch(err => {
            console.error('Error:', err);
            process.exit(1);
        });
}

export function checkAndLockDb(dbPath) {
    const lockFile = path.join(LOCK_DIR, path.basename(dbPath) + '.lock');
    
    try {
        // Check if database exists, if not create it
        if (!fs.existsSync(dbPath)) {
            const db = new Database(dbPath);
            db.exec(`
                CREATE TABLE IF NOT EXISTS points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lat REAL NOT NULL,
                    lon REAL NOT NULL,
                    elevation REAL,
                    source TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_lat_lon ON points(lat, lon);
            `);
            db.close();
        }

        // Try to acquire lock
        fs.writeFileSync(lockFile, process.pid.toString(), { flag: 'wx' });
        return true;
    } catch (err) {
        if (err.code === 'EEXIST') {
            try {
                // Check if process holding lock is still alive
                const pid = parseInt(fs.readFileSync(lockFile, 'utf8'));
                try {
                    process.kill(pid, 0);
                    return false; // Process is still alive, lock is valid
                } catch (e) {
                    // Process is dead, remove stale lock
                    fs.unlinkSync(lockFile);
                    // Try to acquire lock again
                    return checkAndLockDb(dbPath);
                }
            } catch (e) {
                // Error reading lock file, assume it's stale
                try {
                    fs.unlinkSync(lockFile);
                    return checkAndLockDb(dbPath);
                } catch (e) {
                    return false;
                }
            }
        }
        return false;
    }
}

export function unlockDb(dbPath) {
    const lockFile = path.join(LOCK_DIR, path.basename(dbPath) + '.lock');
    try {
        fs.unlinkSync(lockFile);
        return true;
    } catch (err) {
        return false;
    }
}

export function getDb(dbPath) {
    return new Database(dbPath);
} 