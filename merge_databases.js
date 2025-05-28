import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DB = 'mountains_ne_sw.db';
const TARGET_DB = 'mountains.db';
const BATCH_SIZE = 1000;

async function openDatabase(dbPath) {
    return await open({
        filename: dbPath,
        driver: sqlite3.Database
    });
}

async function mergeData() {
    console.log(`Starting merge from ${SOURCE_DB} to ${TARGET_DB}`);
    
    const sourceDb = await openDatabase(SOURCE_DB);
    const targetDb = await openDatabase(TARGET_DB);
    
    try {
        // Get total count for progress tracking
        const { count } = await sourceDb.get('SELECT COUNT(*) as count FROM elevation_points');
        console.log(`Found ${count} points to merge`);
        
        let processed = 0;
        let merged = 0;
        let skipped = 0;
        
        // Process in batches
        while (processed < count) {
            // Begin transaction for better performance
            await targetDb.run('BEGIN TRANSACTION');
            
            try {
                // Get next batch of points
                const points = await sourceDb.all(`
                    SELECT latitude, longitude, elevation, source, grid_level, collection_direction
                    FROM elevation_points
                    LIMIT ${BATCH_SIZE} OFFSET ${processed}
                `);
                
                // Process each point
                for (const point of points) {
                    try {
                        // Check if point exists
                        const exists = await targetDb.get(
                            'SELECT id FROM elevation_points WHERE latitude = ? AND longitude = ?',
                            [point.latitude, point.longitude]
                        );
                        
                        if (!exists) {
                            // Insert new point
                            await targetDb.run(`
                                INSERT INTO elevation_points 
                                (latitude, longitude, elevation, source, grid_level, collection_direction)
                                VALUES (?, ?, ?, ?, ?, ?)
                            `, [
                                point.latitude,
                                point.longitude,
                                point.elevation,
                                point.source,
                                point.grid_level,
                                point.collection_direction
                            ]);
                            merged++;
                        } else {
                            skipped++;
                        }
                    } catch (error) {
                        console.error(`Error processing point: ${JSON.stringify(point)}`, error);
                    }
                }
                
                // Commit transaction
                await targetDb.run('COMMIT');
                
                processed += points.length;
                console.log(`Progress: ${processed}/${count} points processed (${merged} merged, ${skipped} skipped)`);
                
            } catch (error) {
                // Rollback on error
                await targetDb.run('ROLLBACK');
                console.error('Error processing batch:', error);
            }
        }
        
        // Merge collection_progress
        console.log('\nMerging collection progress...');
        const progressRecords = await sourceDb.all('SELECT * FROM collection_progress');
        
        for (const record of progressRecords) {
            try {
                await targetDb.run(`
                    INSERT INTO collection_progress 
                    (current_level, points_collected, bounds, collection_direction, last_updated)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    record.current_level,
                    record.points_collected,
                    record.bounds,
                    record.collection_direction,
                    record.last_updated
                ]);
            } catch (error) {
                console.error('Error merging progress record:', error);
            }
        }
        
        console.log('\nMerge complete!');
        console.log(`Total points processed: ${processed}`);
        console.log(`Points merged: ${merged}`);
        console.log(`Points skipped (already existed): ${skipped}`);
        
    } finally {
        await sourceDb.close();
        await targetDb.close();
    }
}

// Run the merge
mergeData().catch(error => {
    console.error('Merge failed:', error);
    process.exit(1);
}); 