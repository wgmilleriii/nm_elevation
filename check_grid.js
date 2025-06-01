import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkGrid(gridX, gridY) {
    const dbPath = path.join(__dirname, 'grid_databases', `mountains_${gridX}_${gridY}.db`);
    
    console.log(`\nChecking grid ${gridX},${gridY}:`);
    console.log('Database path:', dbPath);
    
    if (!fs.existsSync(dbPath)) {
        console.log('Database file does not exist!');
        return;
    }

    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    try {
        // Check if table exists
        const tableCheck = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='elevation_points'");
        if (!tableCheck) {
            console.log('Table elevation_points does not exist!');
            await db.close();
            return;
        }

        // Get total count
        const count = await db.get('SELECT COUNT(*) as count FROM elevation_points');
        console.log('Total points:', count.count);

        // Get min/max coordinates
        const bounds = await db.get(`
            SELECT 
                MIN(latitude) as minLat,
                MAX(latitude) as maxLat,
                MIN(longitude) as minLon,
                MAX(longitude) as maxLon
            FROM elevation_points
        `);
        console.log('Coordinate bounds:', bounds);

        // Get min/max elevation
        const elevation = await db.get(`
            SELECT 
                MIN(elevation) as minElev,
                MAX(elevation) as maxElev,
                AVG(elevation) as avgElev
            FROM elevation_points
        `);
        console.log('Elevation stats:', elevation);

        // Get a sample point
        const sample = await db.get('SELECT * FROM elevation_points LIMIT 1');
        console.log('Sample point:', sample);

    } catch (error) {
        console.error('Error checking database:', error.message);
    } finally {
        await db.close();
    }
}

async function main() {
    // Check a few representative grids
    await checkGrid(0, 0);  // Southwest corner
    await checkGrid(5, 5);  // Center
    await checkGrid(9, 9);  // Northeast corner
}

main().catch(console.error); 