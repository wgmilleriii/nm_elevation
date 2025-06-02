import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function checkSchema() {
    const db = await open({
        filename: 'grid_databases/mountains_1_9.db',
        driver: sqlite3.Database
    });

    try {
        const schema = await db.all("SELECT sql FROM sqlite_master WHERE type='table' AND name='elevation_points'");
        console.log('Schema:', schema[0].sql);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.close();
    }
}

checkSchema().catch(console.error); 