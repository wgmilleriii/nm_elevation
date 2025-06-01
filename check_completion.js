import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPECTED_POINTS = 10000; // Expected points per grid (Level 3 from original collection)
const GRID_SIZE = 10;

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

    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    try {
        const count = await db.get('SELECT COUNT(*) as count FROM elevation_points');
        const percentComplete = (count.count / EXPECTED_POINTS) * 100;
        
        return {
            gridX,
            gridY,
            exists: true,
            points: count.count,
            percentComplete: percentComplete.toFixed(2)
        };
    } catch (error) {
        console.error(`Error checking grid ${gridX},${gridY}:`, error.message);
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

async function main() {
    console.log('Checking completion status of grid databases...\n');
    console.log('Expected points per grid:', EXPECTED_POINTS.toLocaleString());
    console.log('Grid size:', GRID_SIZE, 'x', GRID_SIZE, '\n');

    const results = [];
    let totalPoints = 0;
    let totalGrids = 0;
    let completeGrids = 0;

    // Check all grids
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

    // Sort results by completion percentage
    results.sort((a, b) => b.percentComplete - a.percentComplete);

    // Print summary
    console.log('=== SUMMARY ===');
    console.log(`Total points across all grids: ${totalPoints.toLocaleString()}`);
    console.log(`Total grids with data: ${totalGrids}`);
    console.log(`Complete grids (100%): ${completeGrids}`);
    console.log(`Overall completion: ${((totalPoints / (EXPECTED_POINTS * totalGrids)) * 100).toFixed(2)}%\n`);

    // Print detailed results
    console.log('=== DETAILED RESULTS ===');
    console.log('Grid\tPoints\t\t% Complete\tStatus');
    console.log('----\t------\t\t----------\t------');
    
    results.forEach(result => {
        const status = result.exists ? 
            (result.percentComplete >= 100 ? '✓ Complete' : '⚠ Incomplete') : 
            '✗ Missing';
        console.log(
            `${result.gridX},${result.gridY}\t` +
            `${result.points.toLocaleString().padEnd(12)}\t` +
            `${result.percentComplete}%\t\t` +
            status
        );
    });
}

main().catch(console.error); 