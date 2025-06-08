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
            percentComplete: 0,
            lastModified: null
        };
    }

    try {
        const db = new Database(dbPath);
        const count = db.prepare('SELECT COUNT(*) as count FROM elevation_points').get();
        const percentComplete = (count.count / EXPECTED_POINTS) * 100;
        
        // Get last modified time of database
        const stats = fs.statSync(dbPath);
        const lastModified = stats.mtime;
        
        // Get most recent point timestamp
        let lastPointTime = null;
        try {
            const lastPoint = db.prepare('SELECT MAX(timestamp) as last_time FROM elevation_points').get();
            if (lastPoint && lastPoint.last_time) {
                lastPointTime = new Date(lastPoint.last_time);
            }
        } catch (e) {
            console.log(`Note: Could not get last point time for ${gridX},${gridY}`);
        }
        
        db.close();
        return {
            gridX,
            gridY,
            exists: true,
            points: count.count,
            percentComplete: percentComplete.toFixed(2),
            lastModified,
            lastPointTime
        };
    } catch (error) {
        console.error(`Error checking database ${gridX},${gridY}:`, error.message);
        return {
            gridX,
            gridY,
            exists: false,
            points: 0,
            percentComplete: 0,
            error: error.message,
            lastModified: null,
            lastPointTime: null
        };
    }
}

function formatTimeDiff(date) {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
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

        // Sort and categorize results
        const complete = deltas.filter(r => r.exists && r.percentComplete >= 100);
        const incomplete = deltas.filter(r => r.exists && r.percentComplete < 100);
        const active = deltas.find(r => r.delta > 0);
        const missing = deltas.filter(r => !r.exists);

        // Print summary
        console.log('=== SUMMARY ===');
        console.log(`Total points: ${totalPoints.toLocaleString()}`);
        console.log(`Grids with data: ${totalGrids} / ${GRID_SIZE * GRID_SIZE}`);
        console.log(`Complete grids: ${completeGrids}`);
        console.log(`Incomplete grids: ${incomplete.length}`);
        console.log(`Missing grids: ${missing.length}`);
        console.log(`Overall completion: ${((totalPoints / (EXPECTED_POINTS * GRID_SIZE * GRID_SIZE)) * 100).toFixed(2)}%\n`);

        // Print detailed results
        console.log('=== COMPLETE GRIDS ===');
        console.log('Grid\tPoints\t\tCompletion\tLast Updated');
        console.log('----\t------\t\t----------\t------------');
        complete.sort((a, b) => b.lastModified - a.lastModified).forEach(result => {
            console.log(
                `${result.gridX},${result.gridY}\t` +
                `${result.points.toLocaleString().padEnd(8)}\t` +
                `${result.percentComplete}%\t\t` +
                formatTimeDiff(result.lastModified)
            );
        });

        console.log('\n=== INCOMPLETE GRIDS ===');
        console.log('Grid\tPoints\t\tCompletion\tΔ Points\tLast Updated');
        console.log('----\t------\t\t----------\t--------\t------------');
        incomplete.sort((a, b) => b.percentComplete - a.percentComplete).forEach(result => {
            console.log(
                `${result.gridX},${result.gridY}\t` +
                `${result.points.toLocaleString().padEnd(8)}\t` +
                `${result.percentComplete}%\t\t` +
                `${result.delta > 0 ? '+' + result.delta : result.delta}\t\t` +
                formatTimeDiff(result.lastModified)
            );
        });

        if (active) {
            console.log('\n=== CURRENTLY ACTIVE ===');
            console.log('Grid\tPoints\t\tCompletion\tΔ Points\tLast Point');
            console.log('----\t------\t\t----------\t--------\t----------');
            console.log(
                `${active.gridX},${active.gridY}\t` +
                `${active.points.toLocaleString().padEnd(8)}\t` +
                `${active.percentComplete}%\t\t` +
                `+${active.delta}\t\t` +
                formatTimeDiff(active.lastPointTime)
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