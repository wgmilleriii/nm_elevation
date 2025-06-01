import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// New Mexico bounds
const NM_BOUNDS = {
    minLat: 31.33,
    maxLat: 37.00,
    minLon: -109.05,
    maxLon: -103.00
};

// Create grid boundaries
const latStep = (NM_BOUNDS.maxLat - NM_BOUNDS.minLat) / 10;
const lonStep = (NM_BOUNDS.maxLon - NM_BOUNDS.minLon) / 10;

async function createGridDatabase(gridX, gridY) {
    const minLat = NM_BOUNDS.minLat + (gridY * latStep);
    const maxLat = minLat + latStep;
    const minLon = NM_BOUNDS.minLon + (gridX * lonStep);
    const maxLon = minLon + lonStep;

    const dbName = `mountains_${gridX}_${gridY}.db`;
    const dbPath = path.join(__dirname, 'grid_databases', dbName);

    // Create grid_databases directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, 'grid_databases'))) {
        fs.mkdirSync(path.join(__dirname, 'grid_databases'));
    }

    console.log(`Creating database for grid ${gridX},${gridY} (${dbName})`);
    console.log(`Latitude range: ${minLat} to ${maxLat}`);
    console.log(`Longitude range: ${minLon} to ${maxLon}`);

    // First, get the data from the main database
    const mainDb = await open({
        filename: path.join(__dirname, 'mountains.db'),
        driver: sqlite3.Database
    });

    const points = await mainDb.all(`
        SELECT latitude, longitude, elevation
        FROM elevation_points
        WHERE latitude >= ? AND latitude < ?
        AND longitude >= ? AND longitude < ?
    `, [minLat, maxLat, minLon, maxLon]);

    await mainDb.close();

    // Now create the grid database and insert the data
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Create the table
    await db.exec(`
        CREATE TABLE IF NOT EXISTS elevation_points (
            latitude REAL,
            longitude REAL,
            elevation REAL
        )
    `);

    // Insert the data
    const stmt = await db.prepare(`
        INSERT INTO elevation_points (latitude, longitude, elevation)
        VALUES (?, ?, ?)
    `);

    for (const point of points) {
        await stmt.run([point.latitude, point.longitude, point.elevation]);
    }

    await stmt.finalize();

    // Create index for faster queries
    await db.exec('CREATE INDEX IF NOT EXISTS idx_coords ON elevation_points(latitude, longitude)');

    const count = await db.get('SELECT COUNT(*) as count FROM elevation_points');
    console.log(`Grid ${gridX},${gridY} contains ${count.count} points`);

    await db.close();
}

async function main() {
    for (let x = 0; x < 10; x++) {
        let startY = 0;
        if (x === 2) startY = 3; // start at 2,3
        if (x < 2) continue;     // skip all x < 2
        for (let y = startY; y < 10; y++) {
            await createGridDatabase(x, y);
        }
    }
    console.log('All grid databases created successfully!');
}

main().catch(console.error); 