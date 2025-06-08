import ZoomBasedCollector from './public/js/ZoomBasedCollector.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Function to count points in a region across all databases
async function countPointsInRegion(bounds) {
    const gridDbDir = path.join(process.cwd(), 'grid_databases');
    const zoomDbDir = path.join(process.cwd(), 'zoom_databases');
    let totalPoints = 0;
    let dbCounts = {};

    // Helper function to count points in a database
    const countPoints = (dbPath, dbName) => {
        if (!fs.existsSync(dbPath)) return 0;
        const db = new Database(dbPath);
        try {
            const result = db.prepare(`
                SELECT COUNT(*) as count, 
                       MIN(elevation) as min_elev,
                       MAX(elevation) as max_elev,
                       AVG(elevation) as avg_elev
                FROM points 
                WHERE lat >= ? AND lat <= ? 
                AND lon >= ? AND lon <= ?
            `).get(bounds.south, bounds.north, bounds.west, bounds.east);
            return {
                count: result.count,
                min_elev: result.min_elev,
                max_elev: result.max_elev,
                avg_elev: result.avg_elev
            };
        } finally {
            db.close();
        }
    };

    // Count in grid databases
    if (fs.existsSync(gridDbDir)) {
        const files = fs.readdirSync(gridDbDir);
        for (const file of files) {
            if (!file.endsWith('.db')) continue;
            const stats = countPoints(path.join(gridDbDir, file), file);
            if (stats.count > 0) {
                dbCounts[`grid/${file}`] = stats;
                totalPoints += stats.count;
            }
        }
    }

    // Count in zoom databases
    if (fs.existsSync(zoomDbDir)) {
        const files = fs.readdirSync(zoomDbDir);
        for (const file of files) {
            if (!file.endsWith('.db')) continue;
            const stats = countPoints(path.join(zoomDbDir, file), file);
            if (stats.count > 0) {
                dbCounts[`zoom/${file}`] = stats;
                totalPoints += stats.count;
            }
        }
    }

    return { totalPoints, dbCounts };
}

// Function to create a test grid database
async function createTestGridDb() {
    const gridDbDir = path.join(process.cwd(), 'grid_databases');
    if (!fs.existsSync(gridDbDir)) {
        fs.mkdirSync(gridDbDir, { recursive: true });
    }

    const dbPath = path.join(gridDbDir, 'test_grid.db');
    const db = new Database(dbPath);

    try {
        // Create schema
        db.exec(`
            CREATE TABLE IF NOT EXISTS points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                elevation REAL,
                source TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(lat, lon)
            );
            CREATE INDEX IF NOT EXISTS idx_lat_lon ON points(lat, lon);
        `);

        // Insert some sparse test data
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO points (lat, lon, elevation, source)
            VALUES (?, ?, ?, ?)
        `);

        // Add some sparse points in our test region
        const testPoints = [
            { lat: 32.3250, lon: -104.8250, elevation: 1500, source: 'test_sparse' },
            { lat: 32.3300, lon: -104.8300, elevation: 1520, source: 'test_sparse' },
            { lat: 32.3400, lon: -104.8400, elevation: 1540, source: 'test_sparse' }
        ];

        for (const point of testPoints) {
            stmt.run(point.lat, point.lon, point.elevation, point.source);
        }

        console.log('Created test grid database with sparse points');
    } finally {
        db.close();
    }
}

// Test case for a remote area in New Mexico
const remoteArea = {
    name: 'Remote NM Area (Guadalupe Mountains)',
    zoom: 13,
    bounds: {
        north: 32.3500,
        south: 32.3000,
        east: -104.8000,
        west: -104.8500,
        center: {
            lat: 32.3250,
            lon: -104.8250
        }
    }
};

async function runTest() {
    const collector = new ZoomBasedCollector();
    
    console.log('Starting data gathering test for remote area...\n');

    // First, create a test grid database with sparse points
    console.log('Setting up test environment...');
    await createTestGridDb();
    
    // Check initial point count
    console.log('\nChecking initial point count in region...');
    const initialCounts = await countPointsInRegion(remoteArea.bounds);
    console.log('Initial points in region:', initialCounts.totalPoints);
    console.log('Distribution across databases:');
    Object.entries(initialCounts.dbCounts).forEach(([db, stats]) => {
        console.log(`  ${db}:`);
        console.log(`    Count: ${stats.count} points`);
        console.log(`    Elevation range: ${stats.min_elev.toFixed(1)}m to ${stats.max_elev.toFixed(1)}m`);
        console.log(`    Average elevation: ${stats.avg_elev.toFixed(1)}m`);
    });
    
    // Start collection
    console.log('\nStarting collection for remote area...');
    console.log('Zoom Level:', remoteArea.zoom);
    console.log('Bounds:', remoteArea.bounds);
    
    try {
        await collector.startCollection(remoteArea.bounds, remoteArea.zoom);
        console.log('✓ Collection completed\n');
        
        // Check final point count
        console.log('Checking final point count in region...');
        const finalCounts = await countPointsInRegion(remoteArea.bounds);
        console.log('Final points in region:', finalCounts.totalPoints);
        console.log('Distribution across databases:');
        Object.entries(finalCounts.dbCounts).forEach(([db, stats]) => {
            console.log(`  ${db}:`);
            console.log(`    Count: ${stats.count} points`);
            console.log(`    Elevation range: ${stats.min_elev.toFixed(1)}m to ${stats.max_elev.toFixed(1)}m`);
            console.log(`    Average elevation: ${stats.avg_elev.toFixed(1)}m`);
        });
        
        // Show difference
        const pointsAdded = finalCounts.totalPoints - initialCounts.totalPoints;
        console.log(`\nPoints added: ${pointsAdded}`);
        
        // Show new databases
        const newDbs = Object.keys(finalCounts.dbCounts)
            .filter(db => !initialCounts.dbCounts[db]);
        if (newDbs.length > 0) {
            console.log('\nNew databases created:');
            newDbs.forEach(db => {
                const stats = finalCounts.dbCounts[db];
                console.log(`  ${db}:`);
                console.log(`    Count: ${stats.count} points`);
                console.log(`    Elevation range: ${stats.min_elev.toFixed(1)}m to ${stats.max_elev.toFixed(1)}m`);
                console.log(`    Average elevation: ${stats.avg_elev.toFixed(1)}m`);
            });
        }
        
    } catch (error) {
        console.error('✗ Error during collection:', error);
    }
}

// Run the test
runTest().catch(console.error); 