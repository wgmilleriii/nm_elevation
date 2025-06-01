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

async function syncDatabases(sourcePi, targetPi) {
    const sourceConfig = config.instances[sourcePi];
    const targetConfig = config.instances[targetPi];
    
    logger.info(`Starting sync from ${sourcePi} to ${targetPi}`);
    
    try {
        // Create sync command based on config
        const syncCmd = `rsync -avz --delete \
            --exclude '${config.sync.exclude.join("' --exclude '")}' \
            ${config.sync.targetDir}/ \
            pi@${targetPi}:${config.sync.targetDir}/`;
        
        logger.info(`Executing sync command: ${syncCmd}`);
        const { stdout, stderr } = await execAsync(syncCmd);
        
        if (stderr) {
            logger.warn(`Sync warnings: ${stderr}`);
        }
        
        logger.info(`Sync completed: ${stdout}`);
        return true;
    } catch (error) {
        logger.error(`Sync failed: ${error.message}`);
        return false;
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

// Run sync every interval
setInterval(main, config.instances.pi1.syncInterval);

// Initial run
main().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
}); 