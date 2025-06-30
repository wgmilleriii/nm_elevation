import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
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

// Get state from command line argument or environment variable
const targetState = process.argv.includes('--state=colorado') || process.argv.includes('--state=co')
    ? 'colorado'
    : process.argv.includes('--state=new-mexico') || process.argv.includes('--state=nm')
        ? 'new-mexico'
        : process.env.TARGET_STATE || 'new-mexico'; // Default to New Mexico

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

// Colorado bounds (from web search data)
const CO_BOUNDS = {
    minLat: 37.00,
    maxLat: 41.00,
    minLon: -109.07,  // W 109°07'
    maxLon: -102.00   // W 102°00'
};

// Get current bounds based on target state
const getCurrentBounds = () => {
    return targetState === 'colorado' ? CO_BOUNDS : NM_BOUNDS;
};

// Queue processing configuration
const QUEUE_PROCESSING = {
    enabled: true,
    maxQueuePoints: 100,  // Process up to 100 queue points per run
    queuePriority: 1,     // Queue points get highest priority (1 = highest)
    gridPriority: 2       // Grid points get lower priority (2 = lower)
};

// Remote server configuration for queue processing
const REMOTE_SERVER_URL = process.env.REMOTE_SERVER_URL || 'https://hanon.artsmetrics.net/elevation';

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
    { size: 20, points: 400 },    // Level 1: 20x20 grid = 400 points
    { size: 20, points: 4000 },   // Level 2: Each L1 cell -> 10 points = 4,000 total
    { size: 20, points: 40000 }   // Level 3: Each L2 cell -> 10 points = 40,000 total
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

// Queue processing functions
async function fetchQueuePoints() {
    if (!QUEUE_PROCESSING.enabled) return [];
    
    try {
        logProgress(`Fetching GPS queue points from ${REMOTE_SERVER_URL}`);
        const response = await fetch(`${REMOTE_SERVER_URL}/api/gps-queue?limit=${QUEUE_PROCESSING.maxQueuePoints}&status=pending`);
        
        if (!response.ok) {
            logError(new Error(`Queue fetch failed: ${response.status}`), 'fetchQueuePoints');
            return [];
        }
        
        const data = await response.json();
        const queuePoints = data.points || [];
        
        // Filter points to current state bounds
        const bounds = getCurrentBounds();
        const filteredPoints = queuePoints.filter(point => {
            const lat = point.lat || point.latitude;
            const lon = point.lon || point.longitude;
            
            return lat >= bounds.minLat && lat <= bounds.maxLat &&
                   lon >= bounds.minLon && lon <= bounds.maxLon;
        });
        
        logProgress(`Found ${queuePoints.length} total queue points, ${filteredPoints.length} in ${targetState} bounds`);
        
        // Convert to standard format
        return filteredPoints.map(point => ({
            lat: point.lat || point.latitude,
            lon: point.lon || point.longitude,
            priority: QUEUE_PROCESSING.queuePriority,
            source: 'gps_queue',
            userId: point.userId,
            sessionId: point.sessionId,
            pointId: point.pointId || point.id
        }));
        
    } catch (error) {
        logError(error, 'fetchQueuePoints');
        return [];
    }
}

async function markQueuePointProcessed(pointId) {
    if (!pointId) return;
    
    try {
        const response = await fetch(`${REMOTE_SERVER_URL}/api/gps-queue/mark-processed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pointId })
        });
        
        if (!response.ok) {
            logError(new Error(`Failed to mark point ${pointId} as processed: ${response.status}`), 'markQueuePointProcessed');
        }
    } catch (error) {
        logError(error, `markQueuePointProcessed for ${pointId}`);
    }
}

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

function logDatabaseStatus(dbPath, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - DB: ${dbPath} - ${message} - ${JSON.stringify(data)}\n`;
    fs.appendFileSync('collection_progress.log', logEntry);
    console.log(logEntry);
}

function logSourceDistribution(db, dbPath) {
    const result = db.prepare('SELECT source, COUNT(*) as count FROM points GROUP BY source').all();
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - DB: ${dbPath} - Source distribution: ${JSON.stringify(result)}\n`;
    fs.appendFileSync('collection_progress.log', logEntry);
    console.log(logEntry);
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
async function collectHierarchicalPoints(db, level = 0, parentBounds = null, parentI = 0, parentJ = 0) {
    // Use current bounds if none provided
    if (!parentBounds) {
        parentBounds = getCurrentBounds();
    }
    if (level >= GRID_LEVELS.length) {
        return;
    }

    // Check current point count
    const result = db.prepare('SELECT COUNT(*) as count FROM points').get();
    logDatabaseStatus(dbPath, `Level ${level} check`, {
        currentPoints: result.count,
        remaining: 10000 - result.count
    });

    if (result.count >= 10000) {
        logDatabaseStatus(dbPath, 'Collection complete', {
            points: result.count
        });
        return;
    }

    const gridConfig = GRID_LEVELS[level];
    const levelMsg = `Processing grid level ${level + 1} (${level === 0 ? '20x20' : '10 points per cell'} grid) - Direction: ${collectionDirection}`;
    logProgress(levelMsg);
    
    try {
        const bounds = level === 0 ? parentBounds : calculateSubgridBounds(
            parentBounds, 
            20,
            parentI, 
            parentJ
        );

        // Calculate points for this grid level with specified direction
        const points = calculateGridPoints(bounds, 10, collectionDirection);
        logProgress(`Generated ${points.length} points for level ${level + 1}`);

        // Debug: Log how many points already exist in the database
        let existingCount = 0;
        for (const point of points) {
            const exists = checkPointExists(db, point.lat, point.lon);
            if (exists) existingCount++;
        }
        logProgress(`Debug: ${existingCount} points already exist in the database for level ${level + 1}`);

        // Save progress to database with direction info using UPSERT
        const upsertProgress = db.prepare(
            'INSERT INTO grid_progress (grid_size, cell_i, cell_j, points_collected) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT(grid_size, cell_i, cell_j) DO UPDATE SET points_collected = points_collected + excluded.points_collected'
        );
        upsertProgress.run(level + 1, parentI, parentJ, 0);

        // Process points in larger batches
        let processed = 0;
        let currentBatch = [];

        for (const point of points) {
            const exists = checkPointExists(db, point.lat, point.lon);
            if (!exists) {
                currentBatch.push(point);
            }

            if (currentBatch.length >= MAX_BATCH_SIZE) {
                try {
                    logDatabaseStatus(dbPath, `Processing batch at level ${level}`, {
                        batchSize: currentBatch.length,
                        processed: processed
                    });
                    
                    const newPoints = await processBatch(currentBatch);
                    await saveBatch(db, newPoints, dbPath);
                    processed += currentBatch.length;
                    
                    // Update progress using UPSERT
                    upsertProgress.run(level + 1, parentI, parentJ, currentBatch.length);
                    
                    // Log progress after batch
                    logDatabaseStatus(dbPath, `Batch complete at level ${level}`, {
                        totalProcessed: processed,
                        remaining: 10000 - (processed + result.count)
                    });
                    
                    currentBatch = [];
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                } catch (error) {
                    logError(error, `Failed to process batch at level ${level + 1}`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }

        // Process remaining points
        if (currentBatch.length > 0) {
            try {
                logDatabaseStatus(dbPath, `Processing final batch of ${currentBatch.length} points for level ${level + 1}`);
                const newPoints = await processBatch(currentBatch);
                await saveBatch(db, newPoints, dbPath);
                processed += currentBatch.length;
                
                // Update progress using UPSERT
                upsertProgress.run(level + 1, parentI, parentJ, currentBatch.length);
            } catch (error) {
                logError(error, `Failed to process final batch at level ${level + 1}`);
            }
        }

        logProgress(`Completed level ${level + 1}, processed ${processed} points`);

        // Process next level with the same direction pattern
        if (level < GRID_LEVELS.length - 1) {
            const iRange = collectionDirection === COLLECTION_DIRECTIONS.NORTHEAST_TO_SOUTHWEST
                ? Array.from({length: 20}, (_, i) => 19 - i)
                : Array.from({length: 20}, (_, i) => i);
            
            const jRange = collectionDirection === COLLECTION_DIRECTIONS.NORTHEAST_TO_SOUTHWEST
                ? Array.from({length: 20}, (_, j) => 19 - j)
                : Array.from({length: 20}, (_, j) => j);

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

// Standardize database schema
const DB_SCHEMA = `
    CREATE TABLE IF NOT EXISTS points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        elevation REAL,
        source TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_lat_lon ON points(lat, lon);
    
    CREATE TABLE IF NOT EXISTS grid_progress (
        grid_size INTEGER,
        cell_i INTEGER,
        cell_j INTEGER,
        points_collected INTEGER DEFAULT 0,
        PRIMARY KEY (grid_size, cell_i, cell_j)
    );
`;

// Update initializeDatabase function
async function initializeDatabase(dbPath) {
    const db = new Database(dbPath);
    db.exec(DB_SCHEMA);
    return db;
}

async function getProgress(db, gridSize) {
    const stmt = db.prepare('SELECT SUM(points_collected) as total FROM grid_progress WHERE grid_size = ?');
    const result = stmt.get(gridSize);
    return result.total || 0;
}

async function updateProgress(db, gridSize, i, j, pointsCollected) {
    const stmt = db.prepare(`
        INSERT INTO grid_progress (grid_size, cell_i, cell_j, points_collected)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (grid_size, cell_i, cell_j)
        DO UPDATE SET points_collected = points_collected + ?
    `);
    stmt.run(gridSize, i, j, pointsCollected, pointsCollected);
}

function checkPointExists(db, lat, lon) {
    // Use ROUND to handle floating-point precision issues
    const stmt = db.prepare('SELECT COUNT(*) as count FROM points WHERE ROUND(lat, 6) = ROUND(?, 6) AND ROUND(lon, 6) = ROUND(?, 6)');
    const result = stmt.get(lat, lon);
    return result.count > 0;
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

// Create necessary directories
const GRID_DB_DIR = path.join(__dirname, 'grid_databases');
const LOGS_DIR = path.join(__dirname, 'logs');

[GRID_DB_DIR, LOGS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Update findMostIncompleteDatabase function
async function findMostIncompleteDatabase() {
    const gridSize = 20;
    let mostIncomplete = null;
    let lowestCompletion = 1.0; // 100%

    // Create grid_databases directory if it doesn't exist
    if (!fs.existsSync(GRID_DB_DIR)) {
        fs.mkdirSync(GRID_DB_DIR, { recursive: true });
    }

    // First, try to find an existing incomplete database
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const dbPath = path.join(GRID_DB_DIR, `${targetState === 'colorado' ? 'colorado' : 'mountains'}_${i}_${j}.db`);
            
            try {
                if (!fs.existsSync(dbPath)) {
                    // Found a spot for a new database
                    const db = new Database(dbPath);
                    db.exec(DB_SCHEMA);
                    db.close();
                    return { x: i, y: j, points: 0, completion: 0 };
                }

                const db = new Database(dbPath);
                db.exec(DB_SCHEMA); // Ensure tables exist
                const result = db.prepare('SELECT COUNT(*) as count FROM points').get();
                const points = result.count;
                const completion = points / 40000; // Target is 40K points
                db.close();

                if (completion < lowestCompletion) {
                    lowestCompletion = completion;
                    mostIncomplete = { x: i, y: j, points, completion };
                }
            } catch (error) {
                console.error(`Error checking database ${dbPath}:`, error);
                continue;
            }
        }
    }

    // If we found an incomplete database, return it
    if (mostIncomplete) {
        return mostIncomplete;
    }

    // If all databases are complete or there was an error, start a new one at 0,0
    const newDbPath = path.join(GRID_DB_DIR, `${targetState === 'colorado' ? 'colorado' : 'mountains'}_0_0.db`);
    const db = new Database(newDbPath);
    db.exec(DB_SCHEMA);
    db.close();
    return { x: 0, y: 0, points: 0, completion: 0 };
}

// Enhanced main function with queue processing priority
async function main() {
    try {
        logProgress(`Starting collection for ${targetState.toUpperCase()} with bounds: ${JSON.stringify(getCurrentBounds())}`);
        
        // PRIORITY 1: Process GPS queue points first
        const queuePoints = await fetchQueuePoints();
        if (queuePoints.length > 0) {
            logProgress(`Processing ${queuePoints.length} GPS queue points with PRIORITY 1`);
            
            // Process queue points in batches
            for (let i = 0; i < queuePoints.length; i += DEFAULT_BATCH_SIZE) {
                const batch = queuePoints.slice(i, i + DEFAULT_BATCH_SIZE);
                logProgress(`Processing queue batch ${Math.floor(i/DEFAULT_BATCH_SIZE) + 1}/${Math.ceil(queuePoints.length/DEFAULT_BATCH_SIZE)}`);
                
                try {
                    const elevationResults = await processBatch(batch);
                    
                    // Store results and mark as processed
                    for (let j = 0; j < elevationResults.length; j++) {
                        const point = elevationResults[j];
                        const originalPoint = batch[j];
                        
                        if (point && point.elevation !== null) {
                            // Store in appropriate database
                            await storeQueuePoint(point, originalPoint);
                            
                            // Mark as processed in queue
                            if (originalPoint.pointId) {
                                await markQueuePointProcessed(originalPoint.pointId);
                            }
                        }
                    }
                    
                    // Delay between batches
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                    
                } catch (error) {
                    logError(error, `Processing queue batch ${Math.floor(i/DEFAULT_BATCH_SIZE) + 1}`);
                }
            }
            
            logProgress(`Completed processing ${queuePoints.length} GPS queue points`);
        }
        
        // PRIORITY 2: Continue with grid-based collection
        const db = await findMostIncompleteDatabase();
        if (!db) {
            console.log('No available databases to process for grid collection.');
            return;
        }

        const dbPath = path.join(GRID_DB_DIR, `${targetState === 'colorado' ? 'colorado' : 'mountains'}_${db.x}_${db.y}.db`);
        logDatabaseStatus(dbPath, `Starting ${targetState} grid processing`);
        
        // Initialize database connection
        const database = new Database(dbPath);

        try {
            // Check current point count
            const result = database.prepare('SELECT COUNT(*) as count FROM points').get();
            const currentPoints = result.count;
            
            logDatabaseStatus(dbPath, 'Initial state', {
                currentPoints,
                remaining: 10000 - currentPoints,
                state: targetState
            });
            
            if (currentPoints >= 10000) {
                logDatabaseStatus(dbPath, 'Database complete', {
                    points: currentPoints,
                    state: targetState
                });
                return;
            }

            // Log initial source distribution
            logSourceDistribution(database, dbPath);
            
            // Process the database with current bounds
            await collectHierarchicalPoints(database, 0, getCurrentBounds(), db.x, db.y);
            
            // Final check and logging
            const finalResult = database.prepare('SELECT COUNT(*) as count FROM points').get();
            logDatabaseStatus(dbPath, 'Processing complete', {
                finalPoints: finalResult.count,
                targetMet: finalResult.count >= 10000 ? 'Yes' : 'No',
                state: targetState
            });
            
            // Log final source distribution
            logSourceDistribution(database, dbPath);
            
        } finally {
            await database.close();
            logDatabaseStatus(dbPath, 'Database connection closed');
        }

    } catch (error) {
        console.error('Error in main:', error);
        logError(error, 'Error in main process');
    }
}

// Store queue point in appropriate database
async function storeQueuePoint(elevationPoint, originalPoint) {
    try {
        // Determine which grid cell this point belongs to
        const bounds = getCurrentBounds();
        const gridSize = 20; // Using 20x20 grid like the original system
        
        const latStep = (bounds.maxLat - bounds.minLat) / gridSize;
        const lonStep = (bounds.maxLon - bounds.minLon) / gridSize;
        
        const cellI = Math.floor((elevationPoint.lat - bounds.minLat) / latStep);
        const cellJ = Math.floor((elevationPoint.lon - bounds.minLon) / lonStep);
        
        // Clamp to valid range
        const clampedI = Math.max(0, Math.min(gridSize - 1, cellI));
        const clampedJ = Math.max(0, Math.min(gridSize - 1, cellJ));
        
        const dbPath = path.join(GRID_DB_DIR, `${targetState === 'colorado' ? 'colorado' : 'mountains'}_${clampedI}_${clampedJ}.db`);
        
        // Create database if it doesn't exist
        if (!fs.existsSync(dbPath)) {
            const db = new Database(dbPath);
            db.exec(DB_SCHEMA);
            db.close();
        }
        
        const db = new Database(dbPath);
        try {
            // Check if point already exists
            if (!checkPointExists(db, elevationPoint.lat, elevationPoint.lon)) {
                const stmt = db.prepare(`
                    INSERT INTO points (lat, lon, elevation, source, timestamp)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                `);
                stmt.run(elevationPoint.lat, elevationPoint.lon, elevationPoint.elevation, elevationPoint.source);
                
                logProgress(`Stored queue point in ${dbPath}: ${elevationPoint.lat.toFixed(6)}, ${elevationPoint.lon.toFixed(6)}, ${elevationPoint.elevation}m`);
            }
        } finally {
            db.close();
        }
        
    } catch (error) {
        logError(error, 'storeQueuePoint');
    }
}

main().catch(console.error); 