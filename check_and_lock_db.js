import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const LOCK_DIR = path.join(__dirname, 'locks');
const DB_DIR = path.join(__dirname, 'grid_databases');
const LOG_DIR = path.join(__dirname, 'logs');

// Create necessary directories
[LOCK_DIR, DB_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

export function findNextDatabase() {
    const files = fs.readdirSync(DB_DIR);
    for (const file of files) {
        if (!file.endsWith('.db')) continue;
        const dbPath = path.join(DB_DIR, file);
        const lockFile = getLockFile(dbPath);
        if (!fs.existsSync(lockFile)) {
            return dbPath;
        }
    }
    return null;
}

export function getLockFile(dbPath) {
    const dbName = path.basename(dbPath);
    return path.join(LOCK_DIR, `${dbName}.lock`);
}

export function acquireLock(dbPath) {
    const lockFile = getLockFile(dbPath);
    try {
        fs.writeFileSync(lockFile, new Date().toISOString());
        return true;
    } catch (error) {
        console.error(`Failed to acquire lock for ${dbPath}:`, error);
        return false;
    }
}

export function removeLockFile(dbPath) {
    const lockFile = getLockFile(dbPath);
    try {
        if (fs.existsSync(lockFile)) {
            fs.unlinkSync(lockFile);
        }
    } catch (error) {
        console.error(`Failed to remove lock for ${dbPath}:`, error);
    }
}

export { removeLockFile as releaseLock };

export function checkAndLockDb(dbPath) {
    return true;
}

export function unlockDb(dbPath) {
    return;
}

export function getDb(dbPath) {
    return null;
}

// If run directly, find and lock the next database
if (import.meta.url === `file://${process.argv[1]}`) {
    findNextDatabase()
        .then(db => {
            if (db) {
                console.log(`Next database to process: ${db}`);
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