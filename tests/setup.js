import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupTestDatabase() {
    const dbPath = path.join(__dirname, '..', 'mountains.test.db');
    
    // Open database connection
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Create tables
    await db.exec(`
        CREATE TABLE IF NOT EXISTS elevation_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            elevation REAL NOT NULL,
            source TEXT,
            collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(latitude, longitude)
        );
        
        CREATE INDEX IF NOT EXISTS idx_points_location ON elevation_points(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_points_elevation ON elevation_points(elevation);
    `);

    // Insert sample data covering New Mexico
    const samplePoints = [
        // Santa Fe area
        { lat: 35.6870, lon: -105.9378, elevation: 2194.0 },
        { lat: 35.6871, lon: -105.9379, elevation: 2195.0 },
        { lat: 35.6872, lon: -105.9380, elevation: 2196.0 },
        
        // Test area for grid (34.0,-106.0,34.1,-105.9)
        { lat: 34.000, lon: -106.000, elevation: 1500.0 },
        { lat: 34.025, lon: -105.975, elevation: 1525.0 },
        { lat: 34.050, lon: -105.950, elevation: 1550.0 },
        { lat: 34.075, lon: -105.925, elevation: 1575.0 },
        { lat: 34.100, lon: -105.900, elevation: 1600.0 },
        
        // Additional points around test area
        { lat: 33.990, lon: -106.010, elevation: 1490.0 },
        { lat: 34.110, lon: -105.890, elevation: 1610.0 },
        
        // Additional points for coverage
        { lat: 35.0000, lon: -106.5000, elevation: 1800.0 },
        { lat: 35.1000, lon: -106.6000, elevation: 1850.0 },
        { lat: 35.2000, lon: -106.7000, elevation: 1900.0 }
    ];

    // Insert sample points
    const stmt = await db.prepare(`
        INSERT OR REPLACE INTO elevation_points (latitude, longitude, elevation, source)
        VALUES (?, ?, ?, 'test')
    `);

    for (const point of samplePoints) {
        await stmt.run(point.lat, point.lon, point.elevation);
    }

    await stmt.finalize();
    await db.close();
    
    console.log('Test database setup complete');
}

// Run setup if this file is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    setupTestDatabase().catch(console.error);
}

export { setupTestDatabase }; 