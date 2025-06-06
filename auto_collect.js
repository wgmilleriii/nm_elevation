import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GRID_SIZE = 10;
const POINTS_PER_CELL = 10000;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const GRID_DB_DIR = path.join(__dirname, 'grid_databases');

// Ensure grid_databases directory exists
if (!fs.existsSync(GRID_DB_DIR)) {
    fs.mkdirSync(GRID_DB_DIR, { recursive: true });
}

// Initialize log file
const logFile = path.join(__dirname, 'auto_collect.log');
function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${message}\n`;
    fs.appendFileSync(logFile, logMessage);
    console.log(message);
}

// Function to check cell completion
function checkCellCompletion(i, j) {
    const dbPath = path.join(GRID_DB_DIR, `mountains_${i}_${j}.db`);
    if (!fs.existsSync(dbPath)) return 0;

    try {
        const sqlite3 = await import('better-sqlite3');
        const db = new sqlite3.default(dbPath);
        const result = db.prepare('SELECT COUNT(*) as count FROM points').get();
        db.close();
        return result.count;
    } catch (error) {
        log(`Error checking cell ${i},${j}: ${error.message}`);
        return 0;
    }
}

// Function to find next incomplete cell
async function findNextIncompleteCell() {
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            const points = await checkCellCompletion(i, j);
            if (points < POINTS_PER_CELL) {
                return { i, j, points };
            }
        }
    }
    return null;
}

// Function to collect data for a cell
function collectCell(i, j) {
    return new Promise((resolve, reject) => {
        const process = spawn('node', ['collect_sparse_points.js'], {
            env: { ...process.env },
            stdio: 'pipe'
        });

        let output = '';
        process.stdout.on('data', (data) => {
            output += data;
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) log(`Cell ${i},${j}: ${line.trim()}`);
            });
        });

        process.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) log(`Cell ${i},${j} ERROR: ${line.trim()}`);
            });
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}\nOutput: ${output}`));
            }
        });
    });
}

// Main collection loop
async function startCollection() {
    log('Starting automated collection process');
    
    while (true) {
        try {
            const nextCell = await findNextIncompleteCell();
            if (!nextCell) {
                log('All cells complete! Collection finished.');
                break;
            }

            const { i, j, points } = nextCell;
            log(`Processing cell ${i},${j} (current points: ${points})`);

            let retries = 0;
            while (retries < MAX_RETRIES) {
                try {
                    await collectCell(i, j);
                    log(`Successfully completed cell ${i},${j}`);
                    break;
                } catch (error) {
                    retries++;
                    log(`Attempt ${retries}/${MAX_RETRIES} failed for cell ${i},${j}: ${error.message}`);
                    if (retries >= MAX_RETRIES) {
                        log(`Moving to next cell after ${MAX_RETRIES} failed attempts`);
                        break;
                    }
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
                }
            }

            // Wait between cells to avoid overwhelming APIs
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
        } catch (error) {
            log(`Error in collection loop: ${error.message}`);
            // Wait before continuing
            await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL));
        }
    }
}

// Start the collection process
startCollection().catch(error => {
    log(`Fatal error in collection process: ${error.message}`);
    process.exit(1);
}); 