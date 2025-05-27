import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_BATCH_SIZE = 25;  // Default batch size
const MAX_BATCH_SIZE = 100;  // Maximum batch size we'll ever use
const API_BATCH_SIZES = {
    'srtm30m': 100,     // OpenTopoData limit
    'aster30m': 100,    // OpenTopoData limit
    'open-meteo': 50,   // Conservative limit
    'open-elevation': 50 // Conservative limit
};
const DELAY_MS = 2000;  // 2 second delay between batches
const REQUEST_TIMEOUT = 15000;  // 15 second timeout
const POINTS_TO_COLLECT = 1000;  // Reduced to 1k points for lower resolution
const DB_FILE = 'mountains.db';

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
            const locations = points.map(p => `${p.lat},${p.lon}`).join(',');
            return `https://api.open-meteo.com/v1/elevation?latitude=${locations.split(',').filter((_, i) => i % 2 === 0).join(',')}&longitude=${locations.split(',').filter((_, i) => i % 2 === 1).join(',')}`;
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
            return `https://api.open-elevation.com/api/v1/lookup?locations=${points.map(p => `${p.lat},${p.lon}`).join('|')}`;
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

function calculateGridPoints(bounds, gridSize) {
    const points = [];
    const latStep = (bounds.maxLat - bounds.minLat) / gridSize;
    const lonStep = (bounds.maxLon - bounds.minLon) / gridSize;

    // Calculate center points of each grid cell
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const lat = bounds.minLat + (i + 0.5) * latStep;
            const lon = bounds.minLon + (j + 0.5) * lonStep;
            points.push({ lat, lon });
        }
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

// Fetch elevations for multiple points
async function fetchElevations(points, api) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    try {
        const response = await fetch(api.url(points), { 
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Elevation-Collector/1.0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} from ${api.name}`);
        }
        
        const data = await response.json();
        return api.parseResponse(data, points);
    } finally {
        clearTimeout(timeout);
    }
}

// Modify collectHierarchicalPoints to use larger batches
async function collectHierarchicalPoints(db, level = 0, parentBounds = NM_BOUNDS, parentI = 0, parentJ = 0) {
    if (level >= GRID_LEVELS.length) {
        return;
    }

    const gridConfig = GRID_LEVELS[level];
    const levelMsg = `Processing grid level ${level + 1} (${level === 0 ? '10x10' : '10 points per cell'} grid)`;
    logProgress(levelMsg);
    
    try {
        // For the first level, use the full bounds. For subsequent levels, calculate sub-bounds
        const bounds = level === 0 ? parentBounds : calculateSubgridBounds(
            parentBounds, 
            10, // Always use 10x10 grid
            parentI, 
            parentJ
        );

        // Calculate points for this grid level - always use 10x10 grid
        const points = calculateGridPoints(bounds, 10);
        logProgress(`Generated ${points.length} points for level ${level + 1}`);

        // Save progress to database
        await db.run(
            'INSERT INTO collection_progress (current_level, points_collected, bounds) VALUES (?, 0, ?)',
            [level + 1, JSON.stringify(bounds)]
        );

        // Process points in larger batches
        let processed = 0;
        let currentBatch = [];

        for (const point of points) {
            try {
                // Check if point already exists
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
                        
                        // Update progress
                        await db.run(
                            'UPDATE collection_progress SET points_collected = ? WHERE current_level = ? AND bounds = ?',
                            [processed, level + 1, JSON.stringify(bounds)]
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
                
                // Update final progress
                await db.run(
                    'UPDATE collection_progress SET points_collected = ? WHERE current_level = ? AND bounds = ?',
                    [processed, level + 1, JSON.stringify(bounds)]
                );
            } catch (error) {
                logError(error, `Failed to process final batch at level ${level + 1}`);
            }
        }

        logProgress(`Completed level ${level + 1}, processed ${processed} points`);

        // Process next level - always use 10x10 grid for each cell
        if (level < GRID_LEVELS.length - 1) {
            for (let i = 0; i < 10; i++) {
                for (let j = 0; j < 10; j++) {
                    await collectHierarchicalPoints(db, level + 1, bounds, i, j);
                }
            }
        }
    } catch (error) {
        logError(error, `Error in collectHierarchicalPoints at level ${level + 1}`);
        throw error;
    }
}

// Modify initializeDatabase to include bounds in progress tracking
async function initializeDatabase() {
    const db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    // Create tables if they don't exist
    await db.exec(`
        CREATE TABLE IF NOT EXISTS elevation_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            elevation REAL NOT NULL,
            source TEXT NOT NULL,
            grid_level INTEGER NOT NULL,
            collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(latitude, longitude)
        );
        
        CREATE TABLE IF NOT EXISTS collection_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            current_level INTEGER NOT NULL,
            points_collected INTEGER NOT NULL,
            bounds TEXT NOT NULL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_points_location ON elevation_points(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_points_grid_level ON elevation_points(grid_level);
    `);

    return db;
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
        INSERT INTO elevation_points (latitude, longitude, elevation, source, grid_level)
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

async function main() {
    const db = await initializeDatabase();
    
    try {
        // Check if we're in enhance mode
        const isEnhanceMode = process.argv.includes('--enhance');
        
        if (isEnhanceMode) {
            // Original enhance mode logic
            let bounds = await loadEnhanceBounds();
            if (!bounds) {
                console.error('No enhancement bounds found');
                return;
            }
            // ... rest of enhance mode code ...
        } else {
            // New hierarchical collection mode
            console.log('Starting hierarchical point collection');
            await collectHierarchicalPoints(db);
            
            // Print final statistics
            const stats = await db.get(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(DISTINCT source) as sources
                FROM elevation_points
            `);
            
            console.log('\nCollection complete!');
            console.log(`Total points collected: ${stats.total}`);
            console.log(`Number of data sources: ${stats.sources}`);
            
            // Print points per source
            const sourceStats = await db.all(`
                SELECT source, COUNT(*) as count 
                FROM elevation_points 
                GROUP BY source
            `);
            
            console.log('\nPoints per source:');
            sourceStats.forEach(({ source, count }) => {
                console.log(`  ${source}: ${count} points`);
            });
        }
    } finally {
        await db.close();
    }
}

main().catch(console.error); 