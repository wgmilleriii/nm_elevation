import QueueManager from './queue_manager.js';
import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import fs from 'fs';

const BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
const MAX_RETRIES = 3;

// API configurations
const APIS = [
    {
        name: 'srtm30m',
        url: (points) => {
            const locations = points.map(p => `${p.lat},${p.lon}`).join('|');
            return `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`;
        },
        parseResponse: (data) => data.results.map(r => ({
            lat: parseFloat(r.location.lat),
            lon: parseFloat(r.location.lng),
            elevation: r.elevation,
            source: 'srtm30m'
        }))
    },
    {
        name: 'aster30m',
        url: (points) => {
            const locations = points.map(p => `${p.lat},${p.lon}`).join('|');
            return `https://api.opentopodata.org/v1/aster30m?locations=${locations}`;
        },
        parseResponse: (data) => data.results.map(r => ({
            lat: parseFloat(r.location.lat),
            lon: parseFloat(r.location.lng),
            elevation: r.elevation,
            source: 'aster30m'
        }))
    }
];

async function fetchElevationData(points, api) {
    const url = api.url(points);
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`API ${api.name} returned ${response.status}`);
    }
    
    const data = await response.json();
    return api.parseResponse(data);
}

async function processQueue() {
    const queueManager = new QueueManager();
    const sandiaDb = new Database(queueManager.getDbPath());
    
    try {
        // First, populate the queue with Sandia points
        console.log('Populating queue with Sandia Mountains points...');
        const queueStats = await queueManager.populateQueue();
        console.log('Queue populated:', queueStats);

        // Process queue in batches
        while (true) {
            const batch = queueManager.getNextBatch(BATCH_SIZE);
            if (batch.length === 0) {
                console.log('Queue processing complete!');
                break;
            }

            console.log(`Processing batch of ${batch.length} points...`);

            // Try each API until successful
            let success = false;
            let elevationData;

            for (const api of APIS) {
                let retries = 0;
                while (retries < MAX_RETRIES && !success) {
                    try {
                        elevationData = await fetchElevationData(batch, api);
                        success = true;
                        break;
                    } catch (error) {
                        console.error(`Error with ${api.name}, attempt ${retries + 1}:`, error.message);
                        retries++;
                        if (retries < MAX_RETRIES) {
                            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
                        }
                    }
                }
                if (success) break;
            }

            if (!success) {
                console.error('Failed to get elevation data for batch after all retries');
                continue;
            }

            // Save the elevation data to Sandia database
            const stmt = sandiaDb.prepare(`
                INSERT OR REPLACE INTO elevation_points (lat, lon, elevation, source, timestamp)
                VALUES (?, ?, ?, ?, datetime('now'))
            `);

            sandiaDb.transaction(() => {
                for (const point of elevationData) {
                    stmt.run(point.lat, point.lon, point.elevation, point.source);
                }
            })();

            // Mark these points as complete
            queueManager.markPointsComplete(elevationData);

            // Log progress
            const stats = queueManager.getQueueStats();
            console.log('Progress:', stats);

            // Wait before next batch
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
    } catch (error) {
        console.error('Error processing queue:', error);
    } finally {
        sandiaDb.close();
    }
}

// Run the queue processor
processQueue().catch(console.error); 