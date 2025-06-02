import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = process.platform === 'win32' 
    ? 'C:/Users/Wgmil/OneDrive/Documents/GitHub/nm_elevation/grid_databases'
    : '/home/pi/nm_elevation/grid_databases';

const LOCK_DIR = process.platform === 'win32'
    ? 'C:/Users/Wgmil/OneDrive/Documents/GitHub/nm_elevation/locks'
    : '/home/pi/nm_elevation/locks';

const LOG_DIR = process.platform === 'win32'
    ? 'C:/Users/Wgmil/OneDrive/Documents/GitHub/nm_elevation/logs'
    : '/home/pi/nm_elevation/logs';

// Create directories if they don't exist
[LOCK_DIR, LOG_DIR].forEach(dir => {
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
                // Sync from PC to Pi1 using PowerShell
                logSync(`Attempting to sync locks from PC to Pi1 (attempt ${attempt + 1}/${maxRetries})`);
                const psCommand = `$session = New-PSSession -HostName 10.0.0.68 -UserName pi -KeyFilePath "C:/Users/Wgmil/.ssh/pi_auto_key"; Copy-Item -Path "${LOCK_DIR}/*" -Destination "/home/pi/nm_elevation/locks/" -ToSession $session -Force; Remove-PSSession $session`;
                execSync(`powershell -Command "${psCommand}"`, {
                    stdio: 'pipe'
                });
                logSync('Successfully synced locks from PC to Pi1');
            } else {
                // Sync from Pi to PC using scp
                logSync(`Attempting to sync locks from Pi to PC (attempt ${attempt + 1}/${maxRetries})`);
                execSync(`scp -i /home/pi/.ssh/pi_auto_key -r "${LOCK_DIR}/*" "C:/Users/Wgmil/OneDrive/Documents/GitHub/nm_elevation/locks/"`, {
                    stdio: 'pipe'
                });
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
        const db = new sqlite3.Database(dbPath);
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

function isLocked(dbName) {
    const lockFile = path.join(LOCK_DIR, `${dbName}.lock`);
    return fs.existsSync(lockFile);
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

async function removeLock(dbName) {
    const lockFile = path.join(LOCK_DIR, `${dbName}.lock`);
    if (fs.existsSync(lockFile)) {
        try {
            fs.unlinkSync(lockFile);
            logSync(`Removed lock file for ${dbName}`);
            
            // Immediately sync the removal with retries
            await syncLockFiles();
            logSync(`Successfully synced lock removal for ${dbName}`);
        } catch (error) {
            logSync(`Failed to remove/sync lock for ${dbName}: ${error.message}`, 'ERROR');
            throw error;
        }
    }
}

async function findNextDatabase() {
    const dbs = fs.readdirSync(DB_DIR)
        .filter(file => file.endsWith('.db'))
        .map(file => ({
            name: file,
            path: path.join(DB_DIR, file)
        }));

    let leastComplete = null;
    let lowestPercentage = 100;

    for (const db of dbs) {
        if (isLocked(db.name)) {
            console.log(`${db.name} is locked, skipping...`);
            continue;
        }

        try {
            const percentage = await getCompletionPercentage(db.path);
            console.log(`${db.name} is ${percentage.toFixed(2)}% complete`);
            
            if (percentage < lowestPercentage) {
                lowestPercentage = percentage;
                leastComplete = db;
            }
        } catch (err) {
            console.error(`Error checking ${db.name}:`, err);
        }
    }

    if (leastComplete) {
        createLock(leastComplete.name);
        console.log(`Locked ${leastComplete.name} for processing`);
        return leastComplete;
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