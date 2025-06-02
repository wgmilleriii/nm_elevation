import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

async function updateSchema() {
    const gridDir = 'grid_databases';
    const files = fs.readdirSync(gridDir);
    
    for (const file of files) {
        if (file.endsWith('.db')) {
            console.log(`Updating schema for ${file}...`);
            const db = await open({
                filename: path.join(gridDir, file),
                driver: sqlite3.Database
            });

            try {
                // Create new table with updated schema
                await db.exec(`
                    CREATE TABLE elevation_points_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        latitude REAL NOT NULL,
                        longitude REAL NOT NULL,
                        elevation REAL NOT NULL,
                        source TEXT NOT NULL,
                        grid_level INTEGER NOT NULL DEFAULT 0,
                        collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(latitude, longitude)
                    )
                `);

                // Copy data from old table to new table
                await db.exec(`
                    INSERT INTO elevation_points_new (latitude, longitude, elevation, source, grid_level)
                    SELECT latitude, longitude, elevation, 'aster30m', 0
                    FROM elevation_points
                `);

                // Drop old table and rename new one
                await db.exec(`
                    DROP TABLE elevation_points;
                    ALTER TABLE elevation_points_new RENAME TO elevation_points
                `);

                // Create indexes
                await db.exec(`
                    CREATE INDEX idx_points_location ON elevation_points(latitude, longitude);
                    CREATE INDEX idx_points_grid_level ON elevation_points(grid_level)
                `);

                // Create collection_progress table
                await db.exec(`
                    CREATE TABLE IF NOT EXISTS collection_progress (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        current_level INTEGER NOT NULL,
                        points_collected INTEGER NOT NULL,
                        bounds TEXT NOT NULL,
                        collection_direction TEXT NOT NULL,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);

                console.log(`Successfully updated schema for ${file}`);
            } catch (error) {
                console.error(`Error updating ${file}:`, error);
            } finally {
                await db.close();
            }
        }
    }
}

updateSchema().catch(console.error); 