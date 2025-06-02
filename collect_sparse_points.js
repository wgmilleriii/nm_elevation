import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { findNextDatabase, removeLock } from './check_and_lock_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_BATCH_SIZE = 25;  // Default batch size
const MAX_BATCH_SIZE = 100;  // Maximum batch size we'll ever use

// Collection direction configuration
const COLLECTION_DIRECTIONS = {
    SOUTHWEST_TO_NORTHEAST: 'sw_to_ne',
    NORTHEAST_TO_SOUTHWEST: 'ne_to_sw'
};

// Get direction from command line argument or environment variable
const collectionDirection = process.argv.includes('--direction=ne_to_sw') 
    ? COLLECTION_DIRECTIONS.NORTHEAST_TO_SOUTHWEST 
    : process.argv.includes('--direction=sw_to_ne')
        ? COLLECTION_DIRECTIONS.SOUTHWEST_TO_NORTHEAST
        : process.env.COLLECTION_DIRECTION || COLLECTION_DIRECTIONS.SOUTHWEST_TO_NORTHEAST;

const API_BATCH_SIZES = {
    'srtm30m': 100,     // OpenTopoData limit
    'aster30m': 100,    // OpenTopoData limit
    'open-meteo': 50,   // Conservative limit
    'open-elevation': 50 // Conservative limit
};
const DELAY_MS = 2000;  // 2 second delay between batches
const REQUEST_TIMEOUT = 15000;  // 15 second timeout
const POINTS_TO_COLLECT = 1000;  // Reduced to 1k points for lower resolution

// New Mexico bounds
const NM_BOUNDS = {
    minLat: 31.33,
    maxLat: 37.00,
    minLon: -109.05,
    maxLon: -103.00
};

// API configurations - using batch-capable APIs
const APIS = [
    {
        name: 'srtm30m',
        url: (points) => {
            const locations = points.map(p => `${p.lat},${p.lon}`).join('|');
            return `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`;
        },
        parseResponse: (data, points) => 
            data.results.map((r, i) => ({
                lat: points[i].lat,
                lon: points[i].lon,
                elevation: r.elevation,
                source: 'srtm30m'
            }))
    },
    {
        name: 'open-meteo',
        url: (points) => {
            const lats = points.map(p => p.lat).join(',');
            const lons = points.map(p => p.lon).join(',');
            return `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
        },
        parseResponse: (data, points) => {
            const elevations = Array.isArray(data.elevation) ? data.elevation : [data.elevation];
            return points.map((p, i) => ({
                lat: p.lat,
                lon: p.lon,
                elevation: elevations[i],
                source: 'open-meteo'
            }));
        }
    },
    {
        name: 'aster30m',
        url: (points) => {
            const locations = points.map(p => `${p.lat},${p.lon}`).join('|');
            return `https://api.opentopodata.org/v1/aster30m?locations=${locations}`;
        },
        parseResponse: (data, points) => 
            data.results.map((r, i) => ({
                lat: points[i].lat,
                lon: points[i].lon,
                elevation: r.elevation,
                source: 'aster30m'
            }))
    },
    {
        name: 'open-elevation',
        url: (points) => {
            const locations = points.map(p => `${p.lat},${p.lon}`).join('|');
            return `https://api.open-elevation.com/api/v1/lookup?locations=${locations}`;
        },
        parseResponse: (data, points) => 
            data.results.map((r, i) => ({
                lat: points[i].lat,
                lon: points[i].lon,
                elevation: r.elevation,
                source: 'open-elevation'
            }))
    }
];

// Grid configuration
const GRID_LEVELS = [
    { size: 10, points: 100 },    // Level 1: 10x10 grid = 100 points
    { size: 10, points: 1000 },   // Level 2: Each L1 cell -> 10 points = 1,000 total
    { size: 10, points: 10000 }   // Level 3: Each L2 cell -> 10 points = 10,000 total
];

// Add rate limit handling configuration
const RATE_LIMIT_CONFIG = {
    initialDelay: 2000,    // Start with 2 second delay
    maxDelay: 60000,       // Max 1 minute delay
    backoffFactor: 2,      // Double delay after each rate limit
    resetAfter: 300000     // Reset delays after 5 minutes of success
};

// Add API status tracking
const API_STATUS = {
    'srtm30m': {
        currentDelay: RATE_LIMIT_CONFIG.initialDelay,
        lastSuccess: Date.now(),
        lastTry: Date.now(),
        failCount: 0
    },
    'open-meteo': {
        currentDelay: RATE_LIMIT_CONFIG.initialDelay,
        lastSuccess: Date.now(),
        lastTry: Date.now(),
        failCount: 0
    },
    'aster30m': {
        currentDelay: RATE_LIMIT_CONFIG.initialDelay,
        lastSuccess: Date.now(),
        lastTry: Date.now(),
        failCount: 0
    },
    'open-elevation': {
        currentDelay: RATE_LIMIT_CONFIG.initialDelay,
        lastSuccess: Date.now(),
        lastTry: Date.now(),
        failCount: 0
    }
};

// Add last successful API tracking
let lastSuccessfulApiIndex = -1;

// Modify calculateGridPoints to handle different directions
function calculateGridPoints(bounds, numPoints) {
    const points = [];
    for (let i = 0; i < numPoints; i++) {
        // Generate random points within the bounds
        const lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
        const lon = bounds.minLon + Math.random() * (bounds.maxLon - bounds.minLon);
        points.push({ lat, lon });
    }
    return points;
}

function calculateSubgridBounds(parentBounds, gridSize, cellI, cellJ) {
    const latStep = (parentBounds.maxLat - parentBounds.minLat) / gridSize;
    const lonStep = (parentBounds.maxLon - parentBounds.minLon) / gridSize;

    return {
        minLat: parentBounds.minLat + cellI * latStep,
        maxLat: parentBounds.minLat + (cellI + 1) * latStep,
        minLon: parentBounds.minLon + cellJ * lonStep,
        maxLon: parentBounds.minLon + (cellJ + 1) * lonStep
    };
}

// Add logging functions
function logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ERROR - ${context}: ${error.message}\n${error.stack}\n\n`;
    fs.appendFileSync('collection_errors.log', logEntry);
    console.error(`Error logged to collection_errors.log: ${context}`);
}

function logProgress(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - INFO - ${message}\n`;
    fs.appendFileSync('collection_progress.log', logEntry);
    console.log(message);
}

// Add more detailed logging
function logDetailedProgress(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - DETAILED - ${message}\n`;
    fs.appendFileSync('collection_progress.log', logEntry);
    console.log(`Detailed: ${message}`);
}

// Replace handleRateLimit function
async function handleRateLimit(api) {
    const status = API_STATUS[api.name];
    const now = Date.now();
    
    // Reset delay if we haven't had issues for a while
    if (now - status.lastSuccess > RATE_LIMIT_CONFIG.resetAfter) {
        status.currentDelay = RATE_LIMIT_CONFIG.initialDelay;
        status.failCount = 0;
        logProgress(`Reset rate limit delay for ${api.name}`);
    }
    
    // Increase delay for next time, up to max
    status.currentDelay = Math.min(
        status.currentDelay * RATE_LIMIT_CONFIG.backoffFactor,
        RATE_LIMIT_CONFIG.maxDelay
    );
    status.failCount++;
    
    logProgress(`Rate limited by ${api.name}, fail count: ${status.failCount}, next delay: ${status.currentDelay/1000} seconds`);
}

// Modify getNextBestApi function to implement round-robin with fallback
function getNextBestApi() {
    const now = Date.now();
    
    // Try round-robin first
    for (let i = 0; i < APIS.length; i++) {
        // Get next API in sequence
        const nextIndex = (lastSuccessfulApiIndex + 1 + i) % APIS.length;
        const api = APIS[nextIndex];
        const status = API_STATUS[api.name];
        
        // Check if this API is ready
        const readyIn = Math.max(0, (status.lastTry + status.currentDelay) - now);
        if (readyIn === 0 && status.failCount < 3) {  // Allow some failures before skipping
            return api;
        }
    }
    
    // If round-robin fails (all APIs have delays/failures), fall back to availability-based selection
    return APIS.slice().sort((a, b) => {
        const aStatus = API_STATUS[a.name];
        const bStatus = API_STATUS[b.name];
        
        // Calculate when each API will be ready
        const aReadyIn = Math.max(0, (aStatus.lastTry + aStatus.currentDelay) - now);
        const bReadyIn = Math.max(0, (bStatus.lastTry + bStatus.currentDelay) - now);
        
        // If both have delays, prefer the one ready sooner
        if (aReadyIn > 0 && bReadyIn > 0) {
            return aReadyIn - bReadyIn;
        }
        
        // If one is ready and other isn't, prefer the ready one
        if (aReadyIn === 0 && bReadyIn > 0) return -1;
        if (bReadyIn === 0 && aReadyIn > 0) return 1;
        
        // If both ready, prefer the one with fewer failures
        return aStatus.failCount - bStatus.failCount;
    })[0];
}

// Modify processBatch to handle API-specific batch sizes
async function processBatch(points) {
    const startTime = Date.now();
    const maxAttempts = APIS.length * 2; // Try each API twice before giving up
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        const api = getNextBestApi();
        const status = API_STATUS[api.name];
        const now = Date.now();
        
        // Get API-specific batch size
        const batchSize = API_BATCH_SIZES[api.name] || 25;
        
        // Split points into sub-batches based on API limits
        const subBatches = [];
        for (let i = 0; i < points.length; i += batchSize) {
            subBatches.push(points.slice(i, i + batchSize));
        }
        
        try {
            status.lastTry = Date.now();
            
            // Process each sub-batch
            const allResults = [];
            for (const subBatch of subBatches) {
                logDetailedProgress(`Processing sub-batch with ${subBatch.length} points using ${api.name}`);
                const result = await fetchElevations(subBatch, api);
                allResults.push(...result);
                
                // Add delay between sub-batches if there are more
                if (subBatches.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            }
            
            // Success! Update status
            status.lastSuccess = Date.now();
            status.failCount = 0;
            status.currentDelay = RATE_LIMIT_CONFIG.initialDelay;
            lastSuccessfulApiIndex = APIS.findIndex(a => a.name === api.name);
            logProgress(`Successfully used ${api.name} for batch of ${points.length} points`);
            
            return allResults;
        } catch (error) {
            logError(error, `API ${api.name} failed for points: ${JSON.stringify(points.map(p => `${p.lat},${p.lon}`))}`);
            
            if (error.message.includes('429')) {
                await handleRateLimit(api);
            } else {
                // For other errors, add a small delay but don't increase the rate limit delay
                status.failCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        attempts++;
    }
    
    // If we get here, all APIs failed multiple times
    throw new Error(`Failed to get elevation data after ${attempts} attempts across all APIs`);
}

const RATE_LIMIT_DELAY = 1000; // 1 second delay between API calls
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds between retries

async function fetchElevations(points, api) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch(api.url(points), {
                method: 'GET',  // Changed to GET for all APIs
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Elevation-Collector/1.0'
                },
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (response.status === 429) {
                console.log(`Rate limited by ${api.name}, waiting ${RATE_LIMIT_DELAY}ms...`);
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
                retries++;
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} from ${api.name}`);
            }

            const data = await response.json();
            return api.parseResponse(data, points);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`Request to ${api.name} timed out, retrying...`);
            } else if (error.message.includes('ECONNRESET')) {
                console.log(`Connection reset by ${api.name}, retrying...`);
            } else {
                throw error;
            }
            
            retries++;
            if (retries < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            } else {
                throw error;
            }
        }
    }
}

// Modify collectHierarchicalPoints to handle different directions
async function collectHierarchicalPoints(db, level = 0, parentBounds = NM_BOUNDS, parentI = 0, parentJ = 0) {
    if (level >= GRID_LEVELS.length) {
        return;
    }

    const gridConfig = GRID_LEVELS[level];
    const levelMsg = `Processing grid level ${level + 1} (${level === 0 ? '10x10' : '10 points per cell'} grid) - Direction: ${collectionDirection}`;
    logProgress(levelMsg);
    
    try {
        const bounds = level === 0 ? parentBounds : calculateSubgridBounds(
            parentBounds, 
            10,
            parentI, 
            parentJ
        );

        // Calculate points for this grid level with specified direction
        const points = calculateGridPoints(bounds, 10, collectionDirection);
        logProgress(`Generated ${points.length} points for level ${level + 1}`);

        // Debug: Log how many points already exist in the database
        let existingCount = 0;
        for (const point of points) {
            const exists = await checkPointExists(db, point.lat, point.lon);
            if (exists) existingCount++;
        }
        logProgress(`Debug: ${existingCount} points already exist in the database for level ${level + 1}`);

        // Save progress to database with direction info
        await db.run(
            'INSERT INTO collection_progress (current_level, points_collected, bounds, collection_direction) VALUES (?, 0, ?, ?)',
            [level + 1, JSON.stringify(bounds), collectionDirection]
        );

        // Process points in larger batches
        let processed = 0;
        let currentBatch = [];

        for (const point of points) {
            try {
                const exists = await checkPointExists(db, point.lat, point.lon);
                if (!exists) {
                    currentBatch.push(point);
                }

                if (currentBatch.length >= MAX_BATCH_SIZE) {
                    try {
                        logProgress(`Processing batch ${processed + 1}-${processed + currentBatch.length} of level ${level + 1}`);
                        const newPoints = await processBatch(currentBatch);
                        await saveBatch(db, newPoints, level + 1);
                        processed += currentBatch.length;
                        
                        await db.run(
                            'UPDATE collection_progress SET points_collected = ? WHERE current_level = ? AND bounds = ? AND collection_direction = ?',
                            [processed, level + 1, JSON.stringify(bounds), collectionDirection]
                        );
                        
                        currentBatch = [];
                        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                    } catch (error) {
                        logError(error, `Failed to process batch at level ${level + 1}`);
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                }
            } catch (error) {
                logError(error, `Error processing point ${JSON.stringify(point)} at level ${level + 1}`);
            }
        }

        // Process remaining points
        if (currentBatch.length > 0) {
            try {
                logProgress(`Processing final batch of ${currentBatch.length} points for level ${level + 1}`);
                const newPoints = await processBatch(currentBatch);
                await saveBatch(db, newPoints, level + 1);
                processed += currentBatch.length;
                
                await db.run(
                    'UPDATE collection_progress SET points_collected = ? WHERE current_level = ? AND bounds = ? AND collection_direction = ?',
                    [processed, level + 1, JSON.stringify(bounds), collectionDirection]
                );
            } catch (error) {
                logError(error, `Failed to process final batch at level ${level + 1}`);
            }
        }

        logProgress(`Completed level ${level + 1}, processed ${processed} points`);

        // Process next level with the same direction pattern
        if (level < GRID_LEVELS.length - 1) {
            const iRange = collectionDirection === COLLECTION_DIRECTIONS.NORTHEAST_TO_SOUTHWEST
                ? Array.from({length: 10}, (_, i) => 9 - i)
                : Array.from({length: 10}, (_, i) => i);
            
            const jRange = collectionDirection === COLLECTION_DIRECTIONS.NORTHEAST_TO_SOUTHWEST
                ? Array.from({length: 10}, (_, j) => 9 - j)
                : Array.from({length: 10}, (_, j) => j);

            for (const i of iRange) {
                for (const j of jRange) {
                    await collectHierarchicalPoints(db, level + 1, bounds, i, j);
                }
            }
        }
    } catch (error) {
        logError(error, `Error in collectHierarchicalPoints at level ${level + 1}`);
        throw error;
    }
}

// Modify initializeDatabase to include direction in progress tracking
async function initializeDatabase(dbPath) {
    // Check if database exists
    const dbExists = fs.existsSync(dbPath);
    
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    try {
        if (!dbExists) {
            console.log('Creating new database with schema...');
            // Create tables with basic structure
            await db.exec(`
                CREATE TABLE elevation_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    elevation REAL NOT NULL,
                    source TEXT NOT NULL,
                    grid_level INTEGER NOT NULL DEFAULT 0,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(latitude, longitude)
                );
                
                CREATE TABLE collection_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    current_level INTEGER NOT NULL,
                    points_collected INTEGER NOT NULL,
                    bounds TEXT NOT NULL,
                    grid_size INTEGER NOT NULL,
                    current_i INTEGER NOT NULL,
                    current_j INTEGER NOT NULL,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX idx_points_location ON elevation_points(latitude, longitude);
                CREATE INDEX idx_points_grid_level ON elevation_points(grid_level);
            `);
        } else {
            console.log('Database exists, checking schema...');
            
            // Drop and recreate tables to ensure correct structure
            await db.exec(`
                DROP TABLE IF EXISTS elevation_points;
                DROP TABLE IF EXISTS collection_progress;
                
                CREATE TABLE elevation_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    elevation REAL NOT NULL,
                    source TEXT NOT NULL,
                    grid_level INTEGER NOT NULL DEFAULT 0,
                    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(latitude, longitude)
                );
                
                CREATE TABLE collection_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    current_level INTEGER NOT NULL,
                    points_collected INTEGER NOT NULL,
                    bounds TEXT NOT NULL,
                    grid_size INTEGER NOT NULL,
                    current_i INTEGER NOT NULL,
                    current_j INTEGER NOT NULL,
                    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX idx_points_location ON elevation_points(latitude, longitude);
                CREATE INDEX idx_points_grid_level ON elevation_points(grid_level);
            `);
        }

        return db;
    } catch (error) {
        console.error('Error initializing database:', error);
        await db.close();
        throw error;
    }
}

async function getProgress(db, gridSize) {
    const progress = await db.get(`
        SELECT current_i, current_j, points_collected 
        FROM collection_progress 
        WHERE grid_size = ? 
        ORDER BY last_updated DESC LIMIT 1
    `, gridSize);
    
    if (!progress) {
        // Start from the beginning
        await db.run(`
            INSERT INTO collection_progress (current_i, current_j, grid_size, points_collected)
            VALUES (0, 0, ?, 0)
        `, gridSize);
        return { current_i: 0, current_j: 0, points_collected: 0 };
    }
    
    return progress;
}

async function updateProgress(db, gridSize, i, j, pointsCollected) {
    // Insert new progress record
    await db.run(`
        INSERT INTO collection_progress (current_i, current_j, grid_size, points_collected)
        VALUES (?, ?, ?, ?)
    `, i, j, gridSize, pointsCollected);
    
    // Log progress for debugging
    console.log(`Progress saved - Row: ${i}, Column: ${j}, Total Points: ${pointsCollected}`);
}

async function checkPointExists(db, lat, lon) {
    const point = await db.get(
        'SELECT id FROM elevation_points WHERE latitude = ? AND longitude = ?',
        [lat, lon]
    );
    return !!point;
}

async function saveBatch(db, points, gridLevel) {
    const stmt = await db.prepare(`
        INSERT OR IGNORE INTO elevation_points (latitude, longitude, elevation, source, grid_level)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    await db.run('BEGIN TRANSACTION');
    try {
        for (const point of points) {
            await stmt.run(point.lat, point.lon, point.elevation, point.source, gridLevel);
        }
        await db.run('COMMIT');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    } finally {
        await stmt.finalize();
    }
}

async function loadEnhanceBounds() {
    const boundsFile = path.join(__dirname, 'enhance_bounds.json');
    if (fs.existsSync(boundsFile)) {
        const bounds = JSON.parse(fs.readFileSync(boundsFile));
        // Delete the file so we don't reuse it
        fs.unlinkSync(boundsFile);
        return bounds;
    }
    return null;
}

async function findMostIncompleteDatabase() {
    const gridSize = 10;
    let mostIncomplete = null;
    let lowestCompletion = 1.0; // 100%

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const dbPath = path.join(__dirname, 'grid_databases', `mountains_${i}_${j}.db`);
            if (!fs.existsSync(dbPath)) {
                return { x: i, y: j, points: 0, completion: 0 };
            }

            const db = await open({
                filename: dbPath,
                driver: sqlite3.Database
            });

            const result = await db.get('SELECT COUNT(*) as count FROM elevation_points');
            const points = result.count;
            const completion = points / 10000; // Target is 10K points

            if (completion < lowestCompletion) {
                lowestCompletion = completion;
                mostIncomplete = { x: i, y: j, points, completion };
            }

            await db.close();
        }
    }

    return mostIncomplete;
}

async function main() {
    try {
        // Find the next database to process without locking
        const db = await findMostIncompleteDatabase();
        if (!db) {
            console.log('No available databases to process.');
            return;
        }

        console.log(`Processing database: mountains_${db.x}_${db.y}.db`);
        
        // Initialize database connection
        const dbPath = path.join(__dirname, 'grid_databases', `mountains_${db.x}_${db.y}.db`);
        const database = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        try {
            // Process the database
            await collectHierarchicalPoints(database);
            console.log(`Completed processing mountains_${db.x}_${db.y}.db`);
        } finally {
            await database.close();
        }

    } catch (error) {
        console.error('Error in main:', error);
    }
}

main().catch(console.error); 