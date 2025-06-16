import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function checkDb(dbPath) {
    console.log(`\nChecking database: ${dbPath}`);
    try {
        const db = new Database(dbPath);
        
        // Get table schema
        console.log('\nTable schema:');
        const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='elevation_points'").get();
        console.log(schema?.sql || 'No elevation_points table found');

        // Get total count
        const count = db.prepare('SELECT COUNT(*) as count FROM elevation_points').get();
        console.log(`\nTotal elevation points: ${count.count.toLocaleString()}`);

        // Get elevation range
        const range = db.prepare('SELECT MIN(elevation) as min, MAX(elevation) as max, AVG(elevation) as avg FROM elevation_points').get();
        console.log(`\nElevation range: ${range.min.toFixed(1)}m to ${range.max.toFixed(1)}m (avg: ${range.avg.toFixed(1)}m)`);

        // Get stats by source
        const sourceStats = db.prepare('SELECT source, COUNT(*) as count FROM elevation_points GROUP BY source').all();
        console.log('\nPoints by source:');
        sourceStats.forEach(stat => {
            console.log(`${stat.source}: ${stat.count.toLocaleString()} points`);
        });

        // Get sample of records
        console.log('\nSample records:');
        const samples = db.prepare('SELECT * FROM elevation_points ORDER BY RANDOM() LIMIT 5').all();
        samples.forEach(record => {
            console.log(`Lat: ${record.latitude}, Lon: ${record.longitude}, Elevation: ${record.elevation}m, Source: ${record.source}`);
        });

        db.close();
    } catch (error) {
        console.error('Error checking database:', error.message);
    }
}

// Check both database files
checkDb(path.join(__dirname, 'sandia_detail.db'));
checkDb(path.join(__dirname, 'data', 'sandia_detail.db')); 