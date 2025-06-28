const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

// Connect to the database
const db = new sqlite3.Database(path.join(__dirname, 'grid_databases/user_tracking.db'));

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
    const filled = Math.floor(progress * width / 100);
    const empty = width - filled;
    return `[${'='.repeat(filled)}${'-'.repeat(empty)}] ${progress.toFixed(1)}%`;
}

let lastPoint = null;
let lastTimestamp = null;

function checkProgress() {
    db.get(`
        SELECT latitude, longitude, elevation, speed, accuracy, timestamp
        FROM user_track_points 
        ORDER BY timestamp DESC 
        LIMIT 1
    `, [], (err, row) => {
        if (err) {
            console.error('Error reading from database:', err);
            return;
        }

        if (!row) {
            console.log('No tracking data available yet...');
            return;
        }

        const { latitude, longitude, elevation, speed, accuracy, timestamp } = row;
        const nearest = findNearestPoint(latitude, longitude);
        const progress = calculateProgress(latitude, longitude);
        
        // Calculate speed if we have a previous point
        let calculatedSpeed = speed;
        if (lastPoint && lastTimestamp) {
            const distance = calculateDistance(lastPoint.lat, lastPoint.lon, latitude, longitude);
            const timeDiff = (timestamp - lastTimestamp) / (1000 * 60 * 60); // hours
            calculatedSpeed = (distance / 1000) / timeDiff; // km/h
        }

        clearScreen();
        console.log('\n=== Albuquerque to Denver Journey Tracker ===\n');
        console.log(drawProgressBar(progress));
        console.log(`\nCurrent Position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        console.log(`Elevation: ${elevation.toFixed(0)}m`);
        console.log(`Speed: ${calculatedSpeed ? calculatedSpeed.toFixed(1) : '0'} km/h`);
        console.log(`GPS Accuracy: ${accuracy.toFixed(0)}m`);
        console.log(`\nNearest landmark: ${nearest.point.name} (${(nearest.distance/1000).toFixed(1)}km away)`);
        console.log(`Last update: ${formatTime(timestamp)}`);
        console.log('\nPress Ctrl+C to exit\n');

        lastPoint = { lat: latitude, lon: longitude };
        lastTimestamp = timestamp;
    });
}

// Check progress every 5 seconds
console.log('Starting journey tracker...');
checkProgress();
setInterval(checkProgress, 5000);

// Clean up on exit
process.on('SIGINT', () => {
    console.log('\nClosing database connection...');
    db.close();
    process.exit();
}); 