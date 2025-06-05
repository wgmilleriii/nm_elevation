import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import config from './config.json' assert { type: "json" };

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPECTED_POINTS = 10000; // Expected points per grid (Level 3 from original collection)
const GRID_SIZE = 10;
const LAST_CHECK_FILE = path.join(__dirname, 'last_check_results.json');
const HISTORY_FILE = path.join(__dirname, 'check_history.jsonl');

// Parse command line arguments
const args = process.argv.slice(2);
const checkPC = args.includes('-pc');
const checkPi = args.includes('-pi1');

// If no specific system is specified, check both
const shouldCheckPC = checkPC || (!checkPC && !checkPi);
const shouldCheckPi = checkPi || (!checkPC && !checkPi);

// Load last check results if they exist
function loadLastCheckResults() {
    try {
        if (fs.existsSync(LAST_CHECK_FILE)) {
            const data = fs.readFileSync(LAST_CHECK_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading last check results:', error.message);
    }
    return null;
}

// Save current results for next comparison
function saveCheckResults(results) {
    try {
        fs.writeFileSync(LAST_CHECK_FILE, JSON.stringify(results, null, 2));
    } catch (error) {
        console.error('Error saving check results:', error.message);
    }
}

function appendHistoryEntry(entry) {
    try {
        fs.appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n');
    } catch (error) {
        console.error('Error appending to history file:', error.message);
    }
}

async function checkGridCompletion(gridX, gridY, isPi = false) {
    let dbPath;
    if (isPi) {
        // For Pi, check database directly
        dbPath = path.join(config.sync.targetDir, `mountains_${gridX}_${gridY}.db`);
        console.log(`Checking Pi database ${gridX},${gridY}...`);
        
        if (!fs.existsSync(dbPath)) {
            console.log(`Pi database ${gridX},${gridY} does not exist`);
            return {
                gridX,
                gridY,
                exists: false,
                points: 0,
                percentComplete: 0
            };
        }

        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        try {
            const count = await db.get('SELECT COUNT(*) as count FROM elevation_points');
            const percentComplete = (count.count / EXPECTED_POINTS) * 100;
            console.log(`Found ${count.count} points in Pi database ${gridX},${gridY}`);
            
            return {
                gridX,
                gridY,
                exists: true,
                points: count.count,
                percentComplete: percentComplete.toFixed(2)
            };
        } catch (error) {
            console.error(`Error checking Pi database ${gridX},${gridY}:`, error.message);
            return {
                gridX,
                gridY,
                exists: false,
                points: 0,
                percentComplete: 0,
                error: error.message
            };
        } finally {
            await db.close();
        }
    } else {
        // For PC, check local database
        dbPath = path.join(__dirname, 'grid_databases', `mountains_${gridX}_${gridY}.db`);
        console.log(`Checking PC database ${gridX},${gridY}...`);
        
        if (!fs.existsSync(dbPath)) {
            console.log(`PC database ${gridX},${gridY} does not exist`);
            return {
                gridX,
                gridY,
                exists: false,
                points: 0,
                percentComplete: 0
            };
        }

        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        try {
            const count = await db.get('SELECT COUNT(*) as count FROM elevation_points');
            const percentComplete = (count.count / EXPECTED_POINTS) * 100;
            console.log(`Found ${count.count} points in PC database ${gridX},${gridY}`);
            
            return {
                gridX,
                gridY,
                exists: true,
                points: count.count,
                percentComplete: percentComplete.toFixed(2)
            };
        } catch (error) {
            console.error(`Error checking PC database ${gridX},${gridY}:`, error.message);
            return {
                gridX,
                gridY,
                exists: false,
                points: 0,
                percentComplete: 0,
                error: error.message
            };
        } finally {
            await db.close();
        }
    }
}

async function main() {
    try {
        console.log('Starting completion check...');
        console.log('Checking completion status of grid databases...\n');
        console.log('Expected points per grid:', EXPECTED_POINTS.toLocaleString());
        console.log('Grid size:', GRID_SIZE, 'x', GRID_SIZE, '\n');

        // Load last check results
        const lastCheck = loadLastCheckResults();
        const lastCheckTime = lastCheck ? new Date(lastCheck.timestamp) : null;
        console.log('Last check:', lastCheckTime ? lastCheckTime.toLocaleString() : 'No previous check found\n');

        let pcResults = [];
        let piResults = [];
        let pcTotalPoints = 0;
        let pcTotalGrids = 0;
        let pcCompleteGrids = 0;
        let piTotalPoints = 0;
        let piTotalGrids = 0;
        let piCompleteGrids = 0;

        // Check PC databases if needed
        if (shouldCheckPC) {
            console.log('=== PC DATABASES ===');
            for (let x = 0; x < GRID_SIZE; x++) {
                for (let y = 0; y < GRID_SIZE; y++) {
                    try {
                        console.log(`Processing grid ${x},${y}...`);
                        const result = await checkGridCompletion(x, y, false);
                        pcResults.push(result);
                        
                        if (result.exists) {
                            pcTotalPoints += result.points;
                            pcTotalGrids++;
                            if (result.percentComplete >= 100) {
                                pcCompleteGrids++;
                            }
                        }
                    } catch (error) {
                        console.error(`Error processing grid ${x},${y}:`, error);
                    }
                }
            }
        }

        // Check Pi databases if needed
        if (shouldCheckPi) {
            console.log('\n=== PI DATABASES ===');
            for (let x = 0; x < GRID_SIZE; x++) {
                for (let y = 0; y < GRID_SIZE; y++) {
                    const result = await checkGridCompletion(x, y, true);
                    piResults.push(result);
                    
                    if (result.exists) {
                        piTotalPoints += result.points;
                        piTotalGrids++;
                        if (result.percentComplete >= 100) {
                            piCompleteGrids++;
                        }
                    }
                }
            }
        }

        // Calculate deltas
        const pcDeltas = lastCheck ? pcResults.map(result => {
            const lastResult = lastCheck.pcResults.find(r => r.gridX === result.gridX && r.gridY === result.gridY);
            return {
                ...result,
                delta: lastResult ? result.points - lastResult.points : result.points
            };
        }) : pcResults.map(result => ({ ...result, delta: result.points }));

        const piDeltas = lastCheck ? piResults.map(result => {
            const lastResult = lastCheck.piResults.find(r => r.gridX === result.gridX && r.gridY === result.gridY);
            return {
                ...result,
                delta: lastResult ? result.points - lastResult.points : result.points
            };
        }) : piResults.map(result => ({ ...result, delta: result.points }));

        // Print PC summary if checked
        if (shouldCheckPC) {
            console.log('\n=== PC SUMMARY ===');
            console.log(`Total points across all grids: ${pcTotalPoints.toLocaleString()}`);
            console.log(`Total grids with data: ${pcTotalGrids}`);
            console.log(`Complete grids (100%): ${pcCompleteGrids}`);
            console.log(`Overall completion: ${((pcTotalPoints / (EXPECTED_POINTS * pcTotalGrids)) * 100).toFixed(2)}%\n`);
        }

        // Print Pi summary if checked
        if (shouldCheckPi) {
            console.log('\n=== PI SUMMARY ===');
            console.log(`Total points across all grids: ${piTotalPoints.toLocaleString()}`);
            console.log(`Total grids with data: ${piTotalGrids}`);
            console.log(`Complete grids (100%): ${piCompleteGrids}`);
            console.log(`Overall completion: ${((piTotalPoints / (EXPECTED_POINTS * piTotalGrids)) * 100).toFixed(2)}%\n`);
        }

        // Print detailed results
        console.log('=== DETAILED RESULTS ===');
        if (shouldCheckPC && shouldCheckPi) {
            console.log('Grid\tPC Points\tPC %\tPC Δ\tPi Points\tPi %\tPi Δ\tStatus');
            console.log('----\t---------\t----\t---\t---------\t----\t---\t------');
        } else if (shouldCheckPC) {
            console.log('Grid\tPC Points\tPC %\tPC Δ\tStatus');
            console.log('----\t---------\t----\t---\t------');
        } else if (shouldCheckPi) {
            console.log('Grid\tPi Points\tPi %\tPi Δ\tStatus');
            console.log('----\t---------\t----\t---\t------');
        }
        
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const x = Math.floor(i / GRID_SIZE);
            const y = i % GRID_SIZE;
            const pc = pcDeltas.find(r => r.gridX === x && r.gridY === y);
            const pi = piDeltas.find(r => r.gridX === x && r.gridY === y);
            
            let status = '✗ Missing';
            if (shouldCheckPC && shouldCheckPi) {
                status = pc?.exists && pi?.exists ? 
                    (pc.percentComplete >= 100 && pi.percentComplete >= 100 ? '✓ Complete' : '⚠ Incomplete') : 
                    '✗ Missing';
            } else if (shouldCheckPC) {
                status = pc?.exists ? 
                    (pc.percentComplete >= 100 ? '✓ Complete' : '⚠ Incomplete') : 
                    '✗ Missing';
            } else if (shouldCheckPi) {
                status = pi?.exists ? 
                    (pi.percentComplete >= 100 ? '✓ Complete' : '⚠ Incomplete') : 
                    '✗ Missing';
            }

            if (shouldCheckPC && shouldCheckPi) {
                const pcDelta = pc?.delta > 0 ? `+${pc.delta}` : pc?.delta || 0;
                const piDelta = pi?.delta > 0 ? `+${pi.delta}` : pi?.delta || 0;
                console.log(
                    `${x},${y}\t` +
                    `${(pc?.points || 0).toLocaleString().padEnd(10)}\t` +
                    `${pc?.percentComplete || '0.00'}%\t` +
                    `${pcDelta.toString().padEnd(4)}\t` +
                    `${(pi?.points || 0).toLocaleString().padEnd(10)}\t` +
                    `${pi?.percentComplete || '0.00'}%\t` +
                    `${piDelta.toString().padEnd(4)}\t` +
                    status
                );
            } else if (shouldCheckPC) {
                const pcDelta = pc?.delta > 0 ? `+${pc.delta}` : pc?.delta || 0;
                console.log(
                    `${x},${y}\t` +
                    `${(pc?.points || 0).toLocaleString().padEnd(10)}\t` +
                    `${pc?.percentComplete || '0.00'}%\t` +
                    `${pcDelta.toString().padEnd(4)}\t` +
                    status
                );
            } else if (shouldCheckPi) {
                const piDelta = pi?.delta > 0 ? `+${pi.delta}` : pi?.delta || 0;
                console.log(
                    `${x},${y}\t` +
                    `${(pi?.points || 0).toLocaleString().padEnd(10)}\t` +
                    `${pi?.percentComplete || '0.00'}%\t` +
                    `${piDelta.toString().padEnd(4)}\t` +
                    status
                );
            }
        }

        // Save current results for next comparison
        saveCheckResults({
            timestamp: new Date().toISOString(),
            pcResults,
            piResults
        });
        // Append to history file (only systems checked)
        const historyEntry = {
            timestamp: new Date().toISOString(),
        };
        if (shouldCheckPC) historyEntry.pcResults = pcResults;
        if (shouldCheckPi) historyEntry.piResults = piResults;
        appendHistoryEntry(historyEntry);
    } catch (error) {
        console.error('Unhandled error:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
}); 