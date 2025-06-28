const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Constants for the journey
const ALBUQUERQUE = { lat: 35.0844, lon: -106.6504, name: 'Albuquerque' };
const DENVER = { lat: 39.7392, lon: -104.9903, name: 'Denver' };
const ROUTE_POINTS = [
    ALBUQUERQUE,
    { lat: 35.6869, lon: -105.9378, name: 'Santa Fe' },
    { lat: 36.4072, lon: -105.5734, name: 'Taos' },
    { lat: 37.1700, lon: -104.5005, name: 'Trinidad' },
    { lat: 38.2544, lon: -104.6091, name: 'Pueblo' },
    { lat: 39.1911, lon: -104.8619, name: 'Colorado Springs' },
    DENVER
];

// Database setup
const DB_PATH = path.join(__dirname, 'journeys.db');
const SCHEMA_PATH = path.join(__dirname, 'SQL', '004_journey_tracking.sql');

// Initialize database
const db = new sqlite3.Database(DB_PATH);
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

let currentJourney = null;

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function findNearestPoint(lat, lon) {
    let nearest = null;
    let minDist = Infinity;
    
    for (const point of ROUTE_POINTS) {
        const dist = calculateDistance(lat, lon, point.lat, point.lon);
        if (dist < minDist) {
            minDist = dist;
            nearest = point;
        }
    }
    
    return { point: nearest, distance: minDist };
}

function calculateProgress(lat, lon) {
    const totalDistance = calculateDistance(ALBUQUERQUE.lat, ALBUQUERQUE.lon, DENVER.lat, DENVER.lon);
    const distanceFromStart = calculateDistance(ALBUQUERQUE.lat, ALBUQUERQUE.lon, lat, lon);
    return (distanceFromStart / totalDistance) * 100;
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString();
}

function clearScreen() {
    process.stdout.write('\x1Bc');
}

function drawProgressBar(progress, width = 40) {
    // Ensure progress is between 0 and 100
    progress = Math.max(0, Math.min(100, progress));
    const filled = Math.max(0, Math.min(width, Math.floor(progress * width / 100)));
    const empty = Math.max(0, width - filled);
    return `[${'='.repeat(filled)}${'-'.repeat(empty)}] ${progress.toFixed(1)}%`;
}

async function startNewJourney() {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare('INSERT INTO journeys (name, start_lat, start_lon) VALUES (?, ?, ?)');
        stmt.run('ABQ to Denver', ALBUQUERQUE.lat, ALBUQUERQUE.lon, function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

async function saveJourneyPoint(journeyId, point) {
    return new Promise((resolve, reject) => {
        const nearest = findNearestPoint(point.latitude, point.longitude);
        const stmt = db.prepare(`
            INSERT INTO journey_points (
                journey_id, latitude, longitude, elevation, speed, 
                heading, accuracy, nearest_landmark, distance_to_landmark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            journeyId,
            point.latitude,
            point.longitude,
            point.elevation,
            point.speed || 0,
            point.heading || 0,
            point.accuracy,
            nearest.point.name,
            nearest.distance / 1000,
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

let lastPoint = null;
let lastTimestamp = null;

async function checkProgress() {
    try {
        // Start a new journey if none exists
        if (!currentJourney) {
            currentJourney = await startNewJourney();
            console.log(`Started new journey with ID: ${currentJourney}`);
        }

        // Get latest GPS position from the web interface's database
        const webDb = new sqlite3.Database(path.join(__dirname, 'grid_databases/user_tracking.db'));
        webDb.get(`
            SELECT latitude, longitude, elevation, accuracy, timestamp
            FROM user_track_points 
            ORDER BY timestamp DESC 
            LIMIT 1
        `, [], async (err, row) => {
            if (err) {
                console.error('Error reading position:', err);
                return;
            }

            if (!row) {
                console.log('Waiting for GPS data...');
                return;
            }

            const { latitude, longitude, elevation, accuracy, timestamp } = row;
            
            // Calculate speed if we have a previous point
            let speed = 0;
            if (lastPoint && lastTimestamp) {
                const distance = calculateDistance(lastPoint.lat, lastPoint.lon, latitude, longitude);
                const timeDiff = (timestamp - lastTimestamp) / (1000 * 60 * 60); // hours
                speed = (distance / 1000) / timeDiff; // km/h
            }

            // Save point to our journey tracking database
            const point = {
                latitude,
                longitude,
                elevation,
                speed,
                accuracy,
                timestamp
            };
            await saveJourneyPoint(currentJourney, point);

            const nearest = findNearestPoint(latitude, longitude);
            const progress = calculateProgress(latitude, longitude);

            clearScreen();
            console.log('\n=== Albuquerque to Denver Journey Tracker ===\n');
            console.log(drawProgressBar(progress));
            console.log(`\nCurrent Position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            console.log(`Elevation: ${elevation.toFixed(0)}m`);
            console.log(`Speed: ${speed.toFixed(1)} km/h`);
            console.log(`GPS Accuracy: ${accuracy.toFixed(0)}m`);
            console.log(`\nNearest landmark: ${nearest.point.name} (${(nearest.distance/1000).toFixed(1)}km away)`);
            console.log(`Last update: ${formatTime(timestamp)}`);
            console.log('\nJourney data is being saved automatically.');
            console.log('Press Ctrl+C to end journey tracking\n');

            lastPoint = { lat: latitude, lon: longitude };
            lastTimestamp = timestamp;
            
            webDb.close();
        });
    } catch (error) {
        console.error('Error in progress check:', error);
    }
}

// Check progress every 5 seconds
console.log('Starting journey tracker...');
checkProgress();
setInterval(checkProgress, 5000);

// Clean up on exit
process.on('SIGINT', () => {
    console.log('\nEnding journey tracking...');
    if (currentJourney && lastPoint) {
        const stmt = db.prepare(`
            UPDATE journeys 
            SET end_time = CURRENT_TIMESTAMP,
                end_lat = ?,
                end_lon = ?
            WHERE id = ?
        `);
        stmt.run(lastPoint.lat, lastPoint.lon, currentJourney, () => {
            console.log('Journey data saved.');
            db.close();
            process.exit();
        });
    } else {
        db.close();
        process.exit();
    }
}); 