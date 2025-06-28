import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import { UserDatabaseManager } from './user_adaptive_database_system.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_BASE = 'https://hanon.artsmetrics.net/elevation/api';
const POLLING_INTERVAL = 5000; // Check for new API requests every 5 seconds
const COLLECTION_TRIGGER_DISTANCE = 0.1; // Miles - start collecting when user moves this far
const MAX_CONCURRENT_COLLECTIONS = 3; // Limit simultaneous collection processes

class ReactiveElevationQueue {
    constructor() {
        this.dbManager = new UserDatabaseManager();
        this.activeCollections = new Map(); // Track active collection processes
        this.userLastPositions = new Map(); // Track user movement
        this.queueDir = path.join(__dirname, '..', 'reactive_queues');
        this.logFile = path.join(__dirname, 'reactive_queue.log');
        
        this.ensureDirectoryExists(this.queueDir);
        this.isRunning = false;
    }

    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} - ${message}${data ? ' - ' + JSON.stringify(data) : ''}\n`;
        fs.appendFileSync(this.logFile, logEntry);
        console.log(`[ReactiveQueue] ${message}`, data || '');
    }

    /**
     * Start monitoring the public API for new requests
     */
    async startMonitoring() {
        if (this.isRunning) {
            this.log('Already monitoring API requests');
            return;
        }

        this.isRunning = true;
        this.log('Starting reactive elevation queue monitoring');

        while (this.isRunning) {
            try {
                await this.checkForNewAPIRequests();
                await this.processActiveCollections();
                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
            } catch (error) {
                this.log('Error in monitoring loop', { error: error.message });
                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL * 2));
            }
        }
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        this.isRunning = false;
        this.log('Stopping reactive elevation queue monitoring');
    }

    /**
     * Check the public API for new GPS tracking requests
     */
    async checkForNewAPIRequests() {
        try {
            // Get recent GPS queue activity (last 30 seconds)
            const response = await fetch(`${API_BASE}/gps-queue`);
            const queueData = await response.json();

            if (!queueData.points || queueData.points.length === 0) {
                return;
            }

            // Group points by user and session
            const userSessions = this.groupPointsByUserSession(queueData.points);

            // Check each user session for new activity
            for (const [userSessionKey, points] of userSessions.entries()) {
                await this.handleUserSessionActivity(userSessionKey, points);
            }

        } catch (error) {
            this.log('Error checking API requests', { error: error.message });
        }
    }

    /**
     * Group GPS points by user and session
     */
    groupPointsByUserSession(points) {
        const sessions = new Map();
        
        for (const point of points) {
            const key = `${point.userId}_${point.sessionId}`;
            if (!sessions.has(key)) {
                sessions.set(key, []);
            }
            sessions.get(key).push(point);
        }
        
        return sessions;
    }

    /**
     * Handle activity for a specific user session
     */
    async handleUserSessionActivity(userSessionKey, points) {
        const [userId, sessionId] = userSessionKey.split('_', 2);
        
        // Get the most recent point for this user
        const recentPoint = points.sort((a, b) => b.timestamp - a.timestamp)[0];
        const currentLat = recentPoint.lat;
        const currentLon = recentPoint.lon;

        // Check if this is a new user or if they've moved significantly
        const lastPosition = this.userLastPositions.get(userId);
        const hasMovedSignificantly = !lastPosition || 
            this.calculateDistance(lastPosition.lat, lastPosition.lon, currentLat, currentLon) > COLLECTION_TRIGGER_DISTANCE;

        if (hasMovedSignificantly) {
            this.log('User movement detected, triggering collection', {
                userId,
                sessionId,
                position: { lat: currentLat, lon: currentLon },
                pointCount: points.length
            });

            // Update last known position
            this.userLastPositions.set(userId, { lat: currentLat, lon: currentLon, timestamp: Date.now() });

            // Start adaptive collection for this user
            await this.startAdaptiveCollection(userId, sessionId, currentLat, currentLon);
        }
    }

    /**
     * Start adaptive elevation collection around user's position
     */
    async startAdaptiveCollection(userId, sessionId, lat, lon) {
        const collectionKey = `${userId}_${sessionId}`;
        
        // Check if we're already collecting for this user/session
        if (this.activeCollections.has(collectionKey)) {
            this.log('Collection already active for user session', { userId, sessionId });
            return;
        }

        // Check concurrent collection limit
        if (this.activeCollections.size >= MAX_CONCURRENT_COLLECTIONS) {
            this.log('Max concurrent collections reached, queuing for later', { userId, sessionId });
            return;
        }

        this.log('Starting adaptive collection', { userId, sessionId, lat, lon });

        // Create collection process
        const collection = {
            userId,
            sessionId,
            centerLat: lat,
            centerLon: lon,
            startTime: Date.now(),
            status: 'initializing',
            radiusZones: [10, 5, 1, 0.5], // Miles - outer to inner
            currentZone: 0,
            pointsCollected: 0,
            anomaliesFound: 0
        };

        this.activeCollections.set(collectionKey, collection);

        // Start the collection process
        this.processUserCollection(collectionKey).catch(error => {
            this.log('Error in user collection process', { 
                userId, 
                sessionId, 
                error: error.message 
            });
            this.activeCollections.delete(collectionKey);
        });
    }

    /**
     * Process elevation collection for a specific user
     */
    async processUserCollection(collectionKey) {
        const collection = this.activeCollections.get(collectionKey);
        if (!collection) return;

        collection.status = 'collecting';
        this.log('Processing user collection', { 
            userId: collection.userId, 
            sessionId: collection.sessionId 
        });

        try {
            // Process each radius zone (10mi -> 5mi -> 1mi -> 0.5mi)
            for (let zoneIndex = 0; zoneIndex < collection.radiusZones.length; zoneIndex++) {
                const radiusMiles = collection.radiusZones[zoneIndex];
                collection.currentZone = zoneIndex;

                this.log(`Collecting zone ${zoneIndex + 1}: ${radiusMiles} mile radius`, {
                    userId: collection.userId
                });

                // Get or create database for this radius zone
                const dbInfo = this.dbManager.getUserDatabase(
                    collection.userId,
                    collection.sessionId,
                    collection.centerLat,
                    collection.centerLon,
                    radiusMiles
                );

                // Check if database is already full
                const status = this.dbManager.getDatabaseStatus(dbInfo.dbPath);
                if (status && status.isFull) {
                    this.log(`Database full for ${radiusMiles}mi radius, skipping`, {
                        userId: collection.userId,
                        pointCount: status.pointCount
                    });
                    dbInfo.db.close();
                    continue;
                }

                // Collect elevation data using ridge detection in this zone
                const collectedPoints = await this.collectElevationDataInZone(
                    dbInfo,
                    collection.centerLat,
                    collection.centerLon,
                    radiusMiles
                );

                collection.pointsCollected += collectedPoints.total;
                collection.anomaliesFound += collectedPoints.anomalies;

                // Update collection progress in database
                const updateProgress = dbInfo.db.prepare(`
                    UPDATE collection_progress 
                    SET points_collected = points_collected + ?, 
                        anomalies_found = anomalies_found + ?,
                        last_collection = CURRENT_TIMESTAMP
                    WHERE radius_zone = ?
                `);
                updateProgress.run(collectedPoints.total, collectedPoints.anomalies, radiusMiles);

                dbInfo.db.close();

                this.log(`Zone ${zoneIndex + 1} complete`, {
                    userId: collection.userId,
                    radiusMiles,
                    pointsCollected: collectedPoints.total,
                    anomaliesFound: collectedPoints.anomalies
                });

                // Small delay between zones
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            collection.status = 'completed';
            this.log('User collection completed', {
                userId: collection.userId,
                sessionId: collection.sessionId,
                totalPoints: collection.pointsCollected,
                totalAnomalies: collection.anomaliesFound,
                duration: Date.now() - collection.startTime
            });

        } catch (error) {
            collection.status = 'error';
            this.log('Error in user collection', {
                userId: collection.userId,
                error: error.message
            });
        } finally {
            // Clean up completed collection
            setTimeout(() => {
                this.activeCollections.delete(collectionKey);
            }, 60000); // Keep for 1 minute for status checking
        }
    }

    /**
     * Collect elevation data in a specific zone using ridge detection
     */
    async collectElevationDataInZone(dbInfo, centerLat, centerLon, radiusMiles) {
        const bounds = dbInfo.bounds;
        const pointsToCollect = Math.min(1000, Math.floor(radiusMiles * 200)); // Scale with radius
        
        // Use ridge detection to find elevation anomalies
        const ridgePoints = await this.detectRidgeAnomalies(bounds, pointsToCollect);
        
        // Store points in database
        let totalStored = 0;
        let anomaliesStored = 0;

        const insertPoint = dbInfo.db.prepare(`
            INSERT INTO points (lat, lon, elevation, source, collection_type, priority_score, 
                              distance_from_user, elevation_anomaly_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const point of ridgePoints) {
            const distanceFromUser = this.calculateDistance(
                centerLat, centerLon, point.lat, point.lon
            );

            try {
                insertPoint.run(
                    point.lat,
                    point.lon,
                    point.elevation,
                    point.source || 'adaptive_ridge',
                    'adaptive_ridge',
                    point.priority || 0,
                    distanceFromUser,
                    point.anomalyScore || 0
                );
                totalStored++;
                
                if (point.anomalyScore > 0.5) {
                    anomaliesStored++;
                }
            } catch (error) {
                // Point might already exist, skip
                continue;
            }
        }

        return {
            total: totalStored,
            anomalies: anomaliesStored
        };
    }

    /**
     * Detect ridge and elevation anomalies in bounds
     */
    async detectRidgeAnomalies(bounds, targetPoints) {
        // This would integrate with your existing RidgeDetector
        // For now, return sample data structure
        const points = [];
        const gridSize = Math.ceil(Math.sqrt(targetPoints));
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize && points.length < targetPoints; j++) {
                const lat = bounds.minLat + (i / gridSize) * (bounds.maxLat - bounds.minLat);
                const lon = bounds.minLon + (j / gridSize) * (bounds.maxLon - bounds.minLon);
                
                // Simulate elevation data (would fetch from your APIs)
                const elevation = 1500 + Math.random() * 1000; // Sample elevation
                const anomalyScore = Math.random(); // Sample anomaly score
                
                points.push({
                    lat,
                    lon,
                    elevation,
                    source: 'adaptive_ridge',
                    priority: anomalyScore,
                    anomalyScore
                });
            }
        }
        
        return points.sort((a, b) => b.anomalyScore - a.anomalyScore);
    }

    /**
     * Process and clean up active collections
     */
    async processActiveCollections() {
        for (const [key, collection] of this.activeCollections.entries()) {
            // Remove old completed/error collections
            if (['completed', 'error'].includes(collection.status) && 
                Date.now() - collection.startTime > 300000) { // 5 minutes
                this.activeCollections.delete(key);
            }
        }
    }

    /**
     * Calculate distance between two points in miles
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3959; // Earth's radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Get status of all active collections
     */
    getActiveCollectionStatus() {
        const status = [];
        for (const [key, collection] of this.activeCollections.entries()) {
            status.push({
                key,
                userId: collection.userId,
                sessionId: collection.sessionId,
                status: collection.status,
                currentZone: collection.currentZone + 1,
                totalZones: collection.radiusZones.length,
                pointsCollected: collection.pointsCollected,
                anomaliesFound: collection.anomaliesFound,
                runtime: Date.now() - collection.startTime
            });
        }
        return status;
    }
}

export { ReactiveElevationQueue };

// CLI interface for running the reactive queue
if (import.meta.url === `file://${process.argv[1]}`) {
    const queue = new ReactiveElevationQueue();
    
    console.log('🚀 Starting Reactive Elevation Queue System');
    console.log('==========================================');
    console.log('Monitoring public API for GPS tracking requests...');
    console.log('Press Ctrl+C to stop');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n�� Shutting down reactive queue...');
        queue.stopMonitoring();
        process.exit(0);
    });
    
    // Start monitoring
    queue.startMonitoring().catch(error => {
        console.error('Failed to start monitoring:', error);
        process.exit(1);
    });
}
