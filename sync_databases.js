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

// Add at the top after imports
const isWindows = process.platform === 'win32';
const targetDir = isWindows ? 
    path.join(process.cwd(), 'grid_databases') : 
    config.sync.targetDir;

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
    logger.info(`Creating target directory: ${targetDir}`);
    fs.mkdirSync(targetDir, { recursive: true });
}

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
        const pcFiles = {};
        for (const gridId of pc.grids) {
            const dbPath = path.join(config.sync.targetDir, `mountains_${gridId}.db`);
            if (fs.existsSync(dbPath)) {
                pcFiles[gridId] = fs.statSync(dbPath).size;
            } else {
                logger.warn(`Database file missing for grid ${gridId} on PC`);
            }
        }

        // Check pi1 databases
        logger.info('Checking pi1 databases...');
        const pi1Files = {};
        const pi1CheckCmd = `ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@${pi1.ip} "ls -l ${config.sync.targetDir}/mountains_*.db"`;
        const { stdout: pi1LsOutput } = await execAsync(pi1CheckCmd);
        
        pi1LsOutput.split('\n').forEach(line => {
            if (line.includes('mountains_')) {
                const [permissions, size, date, time, filename] = line.trim().split(/\s+/);
                const gridId = filename.match(/mountains_(\d+_\d+)\.db/)[1];
                pi1Files[gridId] = parseInt(size);
            }
        });

        // Compare file sizes and create sync commands
        const pcToPi1Files = [];
        const pi1ToPcFiles = [];

        for (const gridId of pc.grids) {
            const pcSize = pcFiles[gridId] || 0;
            const pi1Size = pi1Files[gridId] || 0;

            if (pcSize > pi1Size) {
                pcToPi1Files.push(`mountains_${gridId}.db`);
            } else if (pi1Size > pcSize) {
                pi1ToPcFiles.push(`mountains_${gridId}.db`);
            }
        }

        // Sync from PC to pi1 (only larger files)
        if (pcToPi1Files.length > 0) {
            logger.info('Starting sync from PC to pi1 for larger files:', pcToPi1Files);
            const pcToPi1Cmd = `rsync -avz --delete --exclude '*.db-journal' --exclude '*.log' ${pcToPi1Files.map(f => path.join(config.sync.targetDir, f)).join(' ')} pi@${pi1.ip}:${config.sync.targetDir}/`;
            logger.info(`Executing sync command: ${pcToPi1Cmd}`);
            
            await execAsync(pcToPi1Cmd);
            logger.info('Sync from PC to pi1 completed successfully');
        }

        // Sync from pi1 to PC (only larger files)
        if (pi1ToPcFiles.length > 0) {
            logger.info('Starting sync from pi1 to PC for larger files:', pi1ToPcFiles);
            const pi1ToPcCmd = `rsync -avz --delete --exclude '*.db-journal' --exclude '*.log' ${pi1ToPcFiles.map(f => `pi@${pi1.ip}:${config.sync.targetDir}/${f}`).join(' ')} ${config.sync.targetDir}/`;
            logger.info(`Executing sync command: ${pi1ToPcCmd}`);
            
            await execAsync(pi1ToPcCmd);
            logger.info('Sync from pi1 to PC completed successfully');
        }

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

async function testSyncSingleDatabase(gridId) {
    try {
        logger.info(`Testing sync for single database: mountains_${gridId}.db`);
        
        // Get PC and pi1 instances
        const pc = config.instances.pc;
        const pi1 = config.instances.pi1;

        // Check PC database
        const pcDbPath = path.join(targetDir, `mountains_${gridId}.db`);
        const pcSize = fs.existsSync(pcDbPath) ? fs.statSync(pcDbPath).size : 0;
        logger.info(`PC database size: ${pcSize} bytes`);

        // Check pi1 database
        const pi1CheckCmd = `ssh -i "${isWindows ? 'C:/Users/Wgmil/.ssh/pi_auto_key' : '/home/pi/.ssh/pi_auto_key'}" pi@${pi1.ip} "ls -l ${config.sync.targetDir}/mountains_${gridId}.db"`;
        logger.info(`Executing command: ${pi1CheckCmd}`);
        const { stdout: pi1LsOutput } = await execAsync(pi1CheckCmd);
        const pi1Size = pi1LsOutput.includes('mountains_') ? 
            parseInt(pi1LsOutput.trim().split(/\s+/)[4]) : 0;
        logger.info(`Pi1 database size: ${pi1Size} bytes`);

        // Compare sizes and sync if needed
        if (pcSize > pi1Size) {
            logger.info('PC version is larger, syncing to Pi1...');
            const pcToPi1Cmd = `rsync -avz --delete --exclude '*.db-journal' --exclude '*.log' "${pcDbPath}" pi@${pi1.ip}:${config.sync.targetDir}/`;
            logger.info(`Executing sync command: ${pcToPi1Cmd}`);
            await execAsync(pcToPi1Cmd);
            logger.info('Sync to Pi1 completed successfully');
        } else if (pi1Size > pcSize) {
            logger.info('Pi1 version is larger, syncing to PC...');
            const pi1ToPcCmd = `rsync -avz --delete --exclude '*.db-journal' --exclude '*.log' pi@${pi1.ip}:${config.sync.targetDir}/mountains_${gridId}.db "${targetDir}/"`;
            logger.info(`Executing sync command: ${pi1ToPcCmd}`);
            await execAsync(pi1ToPcCmd);
            logger.info('Sync to PC completed successfully');
        } else {
            logger.info('Both versions are the same size, no sync needed');
        }

    } catch (error) {
        logger.error(`Error during test sync: ${error.message}`);
        if (error.stderr) {
            logger.error(`Error details: ${error.stderr}`);
        }
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

// Run test sync for grid 6_9
testSyncSingleDatabase('6_9').catch(error => {
    logger.error(`Test sync failed: ${error.message}`);
    process.exit(1);
});

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