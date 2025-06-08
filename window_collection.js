import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const POINTS_PER_CELL = 100;  // Each cell in the 10x10 grid gets 100 points
const TOTAL_POINTS = 10000;   // Total points to collect for the region
const GRID_SIZE = 10;         // 10x10 grid

class WindowCollector {
    constructor(centerPoint, windowSize, direction) {
        this.centerPoint = centerPoint;  // { lat: number, lon: number }
        this.windowSize = windowSize;    // Size in degrees
        this.direction = direction;      // { x: number, y: number } - normalized vector
        
        // Calculate window bounds
        this.bounds = this.calculateWindowBounds();
        
        // Initialize logging
        this.progressLog = [];
    }

    calculateWindowBounds() {
        const halfSize = this.windowSize / 2;
        return {
            minLat: this.centerPoint.lat - halfSize,
            maxLat: this.centerPoint.lat + halfSize,
            minLon: this.centerPoint.lon - halfSize,
            maxLon: this.centerPoint.lon + halfSize
        };
    }

    calculateGridCells() {
        const cells = [];
        const latStep = (this.bounds.maxLat - this.bounds.minLat) / GRID_SIZE;
        const lonStep = (this.bounds.maxLon - this.bounds.minLon) / GRID_SIZE;

        for (let i = 0; i < GRID_SIZE; i++) {
            for (let j = 0; j < GRID_SIZE; j++) {
                cells.push({
                    i,
                    j,
                    bounds: {
                        minLat: this.bounds.minLat + (i * latStep),
                        maxLat: this.bounds.minLat + ((i + 1) * latStep),
                        minLon: this.bounds.minLon + (j * lonStep),
                        maxLon: this.bounds.minLon + ((j + 1) * lonStep)
                    }
                });
            }
        }
        return cells;
    }

    logProgress(message, details = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            message,
            details,
            type: 'progress'
        };
        
        this.progressLog.push(logEntry);
        
        // Write to file and console
        const logStr = `${timestamp} - ${message} - ${JSON.stringify(details)}\n`;
        fs.appendFileSync('window_collection.log', logStr);
        console.log(logStr);
        
        return logEntry;
    }

    getProgressLog() {
        return this.progressLog;
    }

    async initializeDatabase(dbPath) {
        const schema = `
            CREATE TABLE IF NOT EXISTS points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lat REAL NOT NULL,
                lon REAL NOT NULL,
                elevation REAL,
                source TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                collection_phase TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_lat_lon ON points(lat, lon);
            CREATE INDEX IF NOT EXISTS idx_collection_phase ON points(collection_phase);
            
            CREATE TABLE IF NOT EXISTS grid_cells (
                cell_i INTEGER,
                cell_j INTEGER,
                points_collected INTEGER DEFAULT 0,
                last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (cell_i, cell_j)
            );
            
            CREATE TABLE IF NOT EXISTS collection_metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `;
        
        const db = new Database(dbPath);
        db.exec(schema);
        
        // Store window configuration
        const metadata = {
            center_lat: this.centerPoint.lat,
            center_lon: this.centerPoint.lon,
            window_size: this.windowSize,
            direction_x: this.direction.x,
            direction_y: this.direction.y,
            created_at: new Date().toISOString()
        };
        
        const insertMeta = db.prepare('INSERT OR REPLACE INTO collection_metadata (key, value) VALUES (?, ?)');
        for (const [key, value] of Object.entries(metadata)) {
            insertMeta.run(key, value.toString());
        }
        
        return db;
    }

    async findExistingPoints(db, bounds) {
        const query = `
            SELECT lat, lon, elevation, source
            FROM points
            WHERE lat BETWEEN ? AND ?
            AND lon BETWEEN ? AND ?
        `;
        
        const points = db.prepare(query).all(
            bounds.minLat,
            bounds.maxLat,
            bounds.minLon,
            bounds.maxLon
        );
        
        this.logProgress('Found existing points', {
            count: points.length,
            bounds: bounds
        });
        
        return points;
    }

    generateRandomPointsInCell(cell, count) {
        const points = [];
        for (let i = 0; i < count; i++) {
            const lat = cell.bounds.minLat + (Math.random() * (cell.bounds.maxLat - cell.bounds.minLat));
            const lon = cell.bounds.minLon + (Math.random() * (cell.bounds.maxLon - cell.bounds.minLon));
            points.push({ lat, lon });
        }
        return points;
    }

    async initialPhaseCollection(db) {
        const cells = this.calculateGridCells();
        const results = [];
        
        for (const cell of cells) {
            // Check existing points in this cell
            const existingPoints = await this.findExistingPoints(db, cell.bounds);
            const neededPoints = POINTS_PER_CELL - existingPoints.length;
            
            if (neededPoints <= 0) {
                this.logProgress('Cell already has enough points', {
                    cell: `${cell.i},${cell.j}`,
                    existing: existingPoints.length
                });
                continue;
            }
            
            // Generate new random points for this cell
            const newPoints = this.generateRandomPointsInCell(cell, neededPoints);
            
            this.logProgress('Generated points for cell', {
                cell: `${cell.i},${cell.j}`,
                new: newPoints.length,
                existing: existingPoints.length
            });
            
            results.push({
                cell,
                points: newPoints,
                phase: 'initial'
            });
        }
        
        return results;
    }

    calculateGaps(db) {
        const cells = this.calculateGridCells();
        const gaps = [];
        
        for (const cell of cells) {
            const query = `
                SELECT 
                    COUNT(*) as count,
                    MIN(lat) as min_lat,
                    MAX(lat) as max_lat,
                    MIN(lon) as min_lon,
                    MAX(lon) as max_lon,
                    AVG(lat) as avg_lat,
                    AVG(lon) as avg_lon
                FROM points
                WHERE lat BETWEEN ? AND ?
                AND lon BETWEEN ? AND ?
            `;
            
            const stats = db.prepare(query).get(
                cell.bounds.minLat,
                cell.bounds.maxLat,
                cell.bounds.minLon,
                cell.bounds.maxLon
            );
            
            // Calculate coverage and identify gaps
            const coverage = stats.count / POINTS_PER_CELL;
            const hasGaps = coverage < 1;
            
            if (hasGaps) {
                gaps.push({
                    cell,
                    coverage,
                    stats,
                    priority: this.calculateGapPriority(cell, stats, coverage)
                });
            }
        }
        
        // Sort gaps by priority
        gaps.sort((a, b) => b.priority - a.priority);
        
        this.logProgress('Identified gaps', {
            totalGaps: gaps.length,
            priorityRange: gaps.length > 0 ? 
                { min: gaps[gaps.length - 1].priority, max: gaps[0].priority } : 
                null
        });
        
        return gaps;
    }

    calculateGapPriority(cell, stats, coverage) {
        // Priority factors:
        // 1. Distance from center point (closer = higher priority)
        // 2. Direction alignment with specified vector
        // 3. Current coverage (lower = higher priority)
        // 4. Distribution of existing points
        
        const cellCenter = {
            lat: (cell.bounds.minLat + cell.bounds.maxLat) / 2,
            lon: (cell.bounds.minLon + cell.bounds.maxLon) / 2
        };
        
        // Calculate distance from center (normalized 0-1)
        const maxDistance = this.windowSize;
        const distance = Math.sqrt(
            Math.pow(cellCenter.lat - this.centerPoint.lat, 2) +
            Math.pow(cellCenter.lon - this.centerPoint.lon, 2)
        ) / maxDistance;
        
        // Calculate alignment with direction vector (-1 to 1)
        const cellVector = {
            x: cellCenter.lon - this.centerPoint.lon,
            y: cellCenter.lat - this.centerPoint.lat
        };
        const magnitude = Math.sqrt(cellVector.x * cellVector.x + cellVector.y * cellVector.y);
        const alignment = magnitude === 0 ? 0 : 
            (cellVector.x * this.direction.x + cellVector.y * this.direction.y) / magnitude;
        
        // Calculate priority score (0-100)
        const distanceScore = (1 - distance) * 30;  // 0-30 points
        const alignmentScore = ((alignment + 1) / 2) * 30;  // 0-30 points
        const coverageScore = (1 - coverage) * 40;  // 0-40 points
        
        const priority = distanceScore + alignmentScore + coverageScore;
        
        return priority;
    }

    async collectPoints(dbPath) {
        // Initialize database
        const db = await this.initializeDatabase(dbPath);
        
        try {
            // Phase 1: Initial Collection
            this.logProgress('Starting initial collection phase');
            const initialPoints = await this.initialPhaseCollection(db);
            
            if (initialPoints.length > 0) {
                this.logProgress('Initial points to collect', {
                    cells: initialPoints.length,
                    totalPoints: initialPoints.reduce((sum, cell) => sum + cell.points.length, 0)
                });
            } else {
                this.logProgress('No initial points needed, all cells have minimum coverage');
            }
            
            // Phase 2: Gap Analysis and Filling
            this.logProgress('Starting gap analysis phase');
            const gaps = this.calculateGaps(db);
            
            if (gaps.length > 0) {
                this.logProgress('Found gaps to fill', {
                    gapCount: gaps.length,
                    highestPriority: Math.round(gaps[0].priority * 100) / 100,
                    lowestPriority: Math.round(gaps[gaps.length - 1].priority * 100) / 100
                });
                
                // Process gaps in priority order
                for (const gap of gaps) {
                    const pointsNeeded = POINTS_PER_CELL - gap.stats.count;
                    
                    // Only log every 10th gap to reduce noise
                    if (gaps.indexOf(gap) % 10 === 0) {
                        this.logProgress('Processing gaps', {
                            processed: gaps.indexOf(gap),
                            remaining: gaps.length - gaps.indexOf(gap),
                            currentPriority: Math.round(gap.priority * 100) / 100
                        });
                    }
                    
                    // Generate points for this gap
                    const newPoints = this.generateRandomPointsInCell(gap.cell, pointsNeeded);
                    
                    // Add to collection queue
                    initialPoints.push({
                        cell: gap.cell,
                        points: newPoints,
                        phase: 'gap_filling',
                        priority: gap.priority
                    });
                }
            } else {
                this.logProgress('No gaps found, collection complete');
            }
            
            const totalPoints = initialPoints.reduce((sum, cell) => sum + cell.points.length, 0);
            this.logProgress('Collection complete', {
                totalPoints,
                phases: {
                    initial: initialPoints.filter(p => p.phase === 'initial').length,
                    gapFilling: initialPoints.filter(p => p.phase === 'gap_filling').length
                }
            });
            
            return {
                pointsToCollect: initialPoints,
                metadata: {
                    centerPoint: this.centerPoint,
                    windowSize: this.windowSize,
                    direction: this.direction,
                    totalPoints
                },
                progressLog: this.getProgressLog()
            };
            
        } finally {
            await db.close();
        }
    }
}

export default WindowCollector; 