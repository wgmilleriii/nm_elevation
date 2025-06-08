import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { promisify } from 'util';
import config from './config.json' assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPECTED_POINTS = 10000; // Expected points per grid (Level 3 from original collection)
const GRID_SIZE = 10;
const LAST_CHECK_FILE = path.join(__dirname, 'last_check_results.json');
const HISTORY_FILE = path.join(__dirname, 'check_history.jsonl');

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

async function checkGridCompletion(gridX, gridY) {
    const dbPath = path.join(__dirname, 'grid_databases', `mountains_${gridX}_${gridY}.db`);
    
    if (!fs.existsSync(dbPath)) {
        return {
            gridX,
            gridY,
            exists: false,
            points: 0,
            percentComplete: 0
        };
    }

    try {
        const db = new Database(dbPath);
        const count = db.prepare('SELECT COUNT(*) as count FROM elevation_points').get();
        const percentComplete = (count.count / EXPECTED_POINTS) * 100;
        
        db.close();
        return {
            gridX,
            gridY,
            exists: true,
            points: count.count,
            percentComplete: percentComplete.toFixed(2)
        };
    } catch (error) {
        console.error(`Error checking database ${gridX},${gridY}:`, error.message);
        return {
            gridX,
            gridY,
            exists: false,
            points: 0,
            percentComplete: 0,
            error: error.message
        };
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

        let results = [];
        let totalPoints = 0;
        let totalGrids = 0;
        let completeGrids = 0;

        // Check all grid cells
        for (let x = 0; x < GRID_SIZE; x++) {
            for (let y = 0; y < GRID_SIZE; y++) {
                const result = await checkGridCompletion(x, y);
                results.push(result);
                
                if (result.exists) {
                    totalPoints += result.points;
                    totalGrids++;
                    if (result.percentComplete >= 100) {
                        completeGrids++;
                    }
                }
            }
        }

        // Calculate deltas from last check
        const deltas = lastCheck && lastCheck.results ? results.map(result => {
            const lastResult = lastCheck.results.find(r => r.gridX === result.gridX && r.gridY === result.gridY);
            return {
                ...result,
                delta: lastResult ? result.points - lastResult.points : result.points
            };
        }) : results.map(result => ({ ...result, delta: result.points }));

        // Print summary
        console.log('=== SUMMARY ===');
        console.log(`Total points: ${totalPoints.toLocaleString()}`);
        console.log(`Grids with data: ${totalGrids} / ${GRID_SIZE * GRID_SIZE}`);
        console.log(`Complete grids (≥100%): ${completeGrids}`);
        console.log(`Overall completion: ${((totalPoints / (EXPECTED_POINTS * GRID_SIZE * GRID_SIZE)) * 100).toFixed(2)}%\n`);

        // Print detailed results
        console.log('=== DETAILED RESULTS ===');
        console.log('Grid\tPoints\t\tCompletion\tΔ Points\tStatus');
        console.log('----\t------\t\t----------\t--------\t------');
        
        for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
            const x = Math.floor(i / GRID_SIZE);
            const y = i % GRID_SIZE;
            const result = deltas.find(r => r.gridX === x && r.gridY === y);
            
            const status = !result?.exists ? '✗ Missing' :
                          result.percentComplete >= 100 ? '✓ Complete' :
                          '⚠ Incomplete';

            const delta = result?.delta > 0 ? `+${result.delta}` : result?.delta || 0;
            
            console.log(
                `${x},${y}\t` +
                `${(result?.points || 0).toLocaleString().padEnd(8)}\t` +
                `${result?.percentComplete || '0.00'}%\t\t` +
                `${delta.toString().padEnd(8)}\t` +
                status
            );
        }

        // Save results
        saveCheckResults({
            timestamp: new Date().toISOString(),
            results
        });
        
        appendHistoryEntry({
            timestamp: new Date().toISOString(),
            results
        });

    } catch (error) {
        console.error('Unhandled error:', error);
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
}); 