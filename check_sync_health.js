import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import winston from 'winston';
import config from './config.json' assert { type: "json" };

const execAsync = promisify(exec);

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/sync_health.log' }),
        new winston.transports.Console()
    ]
});

async function checkSyncHealth() {
    try {
        const pc = config.instances.pc;
        const pi1 = config.instances.pi1;
        const results = {
            timestamp: new Date().toISOString(),
            pc: { status: 'unknown', grids: [] },
            pi1: { status: 'unknown', grids: [] },
            sync: { status: 'unknown', lastSync: null }
        };

        // Check PC databases
        logger.info('Checking PC databases...');
        for (const gridId of pc.grids) {
            const dbPath = path.join(config.sync.targetDir, `mountains_${gridId}.db`);
            const exists = fs.existsSync(dbPath);
            const size = exists ? fs.statSync(dbPath).size : 0;
            results.pc.grids.push({
                gridId,
                exists,
                size,
                lastModified: exists ? fs.statSync(dbPath).mtime : null
            });
        }

        // Check pi1 databases
        logger.info('Checking pi1 databases...');
        const pi1CheckCmd = `ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@${pi1.ip} "ls -l ${config.sync.targetDir}/mountains_*.db"`;
        const { stdout: pi1Files } = await execAsync(pi1CheckCmd);
        
        for (const gridId of pi1.grids) {
            const fileInfo = pi1Files.split('\n').find(line => line.includes(`mountains_${gridId}.db`));
            if (fileInfo) {
                const [permissions, size, date, time, filename] = fileInfo.trim().split(/\s+/);
                results.pi1.grids.push({
                    gridId,
                    exists: true,
                    size: parseInt(size),
                    lastModified: new Date(`${date} ${time}`).toISOString()
                });
            } else {
                results.pi1.grids.push({
                    gridId,
                    exists: false,
                    size: 0,
                    lastModified: null
                });
            }
        }

        // Check sync status
        logger.info('Checking sync status...');
        const syncLogPath = 'logs/sync.log';
        if (fs.existsSync(syncLogPath)) {
            const syncLog = fs.readFileSync(syncLogPath, 'utf8');
            const lastSync = syncLog.split('\n')
                .filter(line => line.includes('Sync completed successfully'))
                .pop();
            if (lastSync) {
                results.sync.lastSync = new Date(lastSync.split('"timestamp":"')[1].split('"')[0]).toISOString();
                results.sync.status = 'ok';
            }
        }

        // Determine overall status
        const now = new Date();
        const lastSyncTime = results.sync.lastSync ? new Date(results.sync.lastSync) : null;
        const syncAge = lastSyncTime ? (now - lastSyncTime) / 1000 : Infinity; // in seconds

        if (syncAge > config.sync.syncInterval / 1000) {
            results.sync.status = 'stale';
        }

        // Check for missing or mismatched files
        const pcGrids = new Set(results.pc.grids.map(g => g.gridId));
        const pi1Grids = new Set(results.pi1.grids.map(g => g.gridId));
        
        const missingOnPC = [...pi1Grids].filter(g => !pcGrids.has(g));
        const missingOnPi1 = [...pcGrids].filter(g => !pi1Grids.has(g));

        if (missingOnPC.length > 0 || missingOnPi1.length > 0) {
            results.sync.status = 'incomplete';
            results.sync.missingOnPC = missingOnPC;
            results.sync.missingOnPi1 = missingOnPi1;
        }

        // Log results
        logger.info('Sync health check results:', results);

        // Print summary
        console.log('\n=== Sync Health Check Results ===');
        console.log(`Timestamp: ${results.timestamp}`);
        console.log('\nPC Status:');
        console.log(`Grids: ${results.pc.grids.length}`);
        console.log(`Missing: ${results.pc.grids.filter(g => !g.exists).length}`);
        
        console.log('\nPi1 Status:');
        console.log(`Grids: ${results.pi1.grids.length}`);
        console.log(`Missing: ${results.pi1.grids.filter(g => !g.exists).length}`);
        
        console.log('\nSync Status:');
        console.log(`Status: ${results.sync.status}`);
        console.log(`Last Sync: ${results.sync.lastSync || 'Never'}`);
        
        if (results.sync.status === 'incomplete') {
            console.log('\nMissing Files:');
            if (results.sync.missingOnPC?.length > 0) {
                console.log('Missing on PC:', results.sync.missingOnPC.join(', '));
            }
            if (results.sync.missingOnPi1?.length > 0) {
                console.log('Missing on Pi1:', results.sync.missingOnPi1.join(', '));
            }
        }

        return results;
    } catch (error) {
        logger.error('Error checking sync health:', error);
        throw error;
    }
}

// Run health check
checkSyncHealth().catch(console.error); 