import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'sandia_detail.db');

function checkDatabase() {
    const db = new Database(dbPath);
    try {
        // Get total count
        const count = db.prepare('SELECT COUNT(*) as count FROM elevation_points').get();
        console.log(`Total elevation points: ${count.count}`);

        // Get sample of records
        const samples = db.prepare('SELECT * FROM elevation_points LIMIT 5').all();
        console.log('\nSample records:');
        samples.forEach(record => {
            console.log(`Lat: ${record.lat}, Lon: ${record.lon}, Elevation: ${record.elevation}m, Source: ${record.source}, Time: ${record.timestamp}`);
        });

        // Get stats by source
        const sourceStats = db.prepare('SELECT source, COUNT(*) as count FROM elevation_points GROUP BY source').all();
        console.log('\nPoints by source:');
        sourceStats.forEach(stat => {
            console.log(`${stat.source}: ${stat.count} points`);
        });

    } finally {
        db.close();
    }
}

checkDatabase(); 