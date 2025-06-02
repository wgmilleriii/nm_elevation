import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import winston from 'winston';
import config from './config.json' assert { type: "json" };

const execAsync = promisify(exec);

// Configure logger
const logger = winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: config.logging.file,
            maxsize: config.logging.maxSize,
            maxFiles: config.logging.maxFiles
        }),
        new winston.transports.Console()
    ]
});

// Function to check if a database file exists
function checkDatabaseFile(gridId) {
    const dbPath = path.join(config.sync.targetDir, `mountains_${gridId}.db`);
    return fs.existsSync(dbPath);
}

// Function to sync databases
async function syncDatabases() {
    try {
        // Get PC and pi1 instances
        const pc = config.instances.pc;
        const pi1 = config.instances.pi1;

        // Check PC databases
        logger.info('Checking PC databases...');
        for (const gridId of pc.grids) {
            if (!checkDatabaseFile(gridId)) {
                logger.warn(`Database file missing for grid ${gridId} on PC`);
            }
        }

        // Check pi1 databases
        logger.info('Checking pi1 databases...');
        for (const gridId of pi1.grids) {
            if (!checkDatabaseFile(gridId)) {
                logger.warn(`Database file missing for grid ${gridId} on pi1`);
            }
        }

        // Sync from PC to pi1
        logger.info('Starting sync from PC to pi1');
        const pcToPi1Cmd = `rsync -avz --delete --exclude '*.db-journal' --exclude '*.log' ${config.sync.targetDir}/ pi@${pi1.ip}:${config.sync.targetDir}/`;
        logger.info(`Executing sync command: ${pcToPi1Cmd}`);
        
        exec(pcToPi1Cmd, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Sync failed: ${error.message}`);
                return;
            }
            logger.info('Sync from PC to pi1 completed successfully');
        });

        // Sync from pi1 to PC
        logger.info('Starting sync from pi1 to PC');
        const pi1ToPcCmd = `rsync -avz --delete --exclude '*.db-journal' --exclude '*.log' pi@${pi1.ip}:${config.sync.targetDir}/ ${config.sync.targetDir}/`;
        logger.info(`Executing sync command: ${pi1ToPcCmd}`);
        
        exec(pi1ToPcCmd, (error, stdout, stderr) => {
            if (error) {
                logger.error(`Sync failed: ${error.message}`);
                return;
            }
            logger.info('Sync from pi1 to PC completed successfully');
        });

    } catch (error) {
        logger.error(`Error during sync: ${error.message}`);
    }
}

async function checkDatabaseHealth(piId) {
    const piConfig = config.instances[piId];
    const dbPath = config.sync.targetDir;
    
    try {
        // Check if database directory exists
        if (!fs.existsSync(dbPath)) {
            logger.error(`Database directory not found for ${piId}`);
            return false;
        }
        
        // Check each grid database
        for (const grid of piConfig.grids) {
            const dbFile = path.join(dbPath, `mountains_${grid}.db`);
            if (!fs.existsSync(dbFile)) {
                logger.warn(`Database file missing for grid ${grid} on ${piId}`);
            }
        }
        
        return true;
    } catch (error) {
        logger.error(`Health check failed for ${piId}: ${error.message}`);
        return false;
    }
}

async function main() {
    const pis = Object.keys(config.instances);
    
    // Check health of all databases
    for (const pi of pis) {
        const isHealthy = await checkDatabaseHealth(pi);
        logger.info(`Health check for ${pi}: ${isHealthy ? 'OK' : 'Issues found'}`);
    }
    
    // Sync between Pis
    for (let i = 0; i < pis.length; i++) {
        const sourcePi = pis[i];
        const targetPi = pis[(i + 1) % pis.length];
        
        await syncDatabases(sourcePi, targetPi);
    }
}

// Run sync immediately and then on interval
syncDatabases();
setInterval(syncDatabases, config.sync.syncInterval);

// Handle process termination
process.on('SIGTERM', () => {
    logger.info('Sync service shutting down');
    process.exit(0);
});

// Initial run
main().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
}); 