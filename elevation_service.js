import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import elevation processing APIs from collect_sparse_points.js
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

const API_BATCH_SIZES = {
    'srtm30m': 100,
    'aster30m': 100,
    'open-meteo': 50,
    'open-elevation': 50
};

const DELAY_MS = 2000;
const RATE_LIMIT_CONFIG = {
    initialDelay: 2000,
    maxDelay: 60000,
    backoffFactor: 2,
    resetAfter: 300000
};

const API_STATUS = {};
APIS.forEach(api => {
    API_STATUS[api.name] = {
        currentDelay: RATE_LIMIT_CONFIG.initialDelay,
        lastSuccess: Date.now(),
        lastTry: Date.now(),
        failCount: 0
    };
});

class ElevationService {
    constructor(remoteServerUrl = null) {
        this.remoteServerUrl = remoteServerUrl;
        this.lastSuccessfulApiIndex = -1;
        this.isProcessing = false;
        this.lastProcessedId = 0;
        this.dataDir = './data';
        this.queueDir = path.join(this.dataDir, 'local_queue');
        this.initializeDirectories();
    }

    async initializeDirectories() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.mkdir(this.queueDir, { recursive: true });
        } catch (error) {
            console.error('Error creating directories:', error);
        }
    }

    async start() {
        console.log('Starting Elevation Service...');
        console.log(`Remote server: ${this.remoteServerUrl || 'Not configured'}`);
        
        // Start processing loop
        this.processLoop();
    }

    async processLoop() {
        while (true) {
            try {
                if (this.remoteServerUrl) {
                    // Fetch GPS points from remote server
                    await this.fetchFromRemoteServer();
                }

                // Process local queue
                await this.processLocalQueue();

            } catch (error) {
                console.error('Error in processing loop:', error);
            }

            // Wait before next iteration
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    async fetchFromRemoteServer() {
        try {
            const response = await fetch(`${this.remoteServerUrl}/api/gps-queue?lastProcessedId=${this.lastProcessedId}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch queue: ${response.status}`);
            }

            const data = await response.json();
            const points = data.points || [];

            if (points.length > 0) {
                console.log(`Fetched ${points.length} points from remote server`);
                
                // Add to local processing queue
                for (const point of points) {
                    await this.addToLocalQueue(point);
                    this.lastProcessedId = Math.max(this.lastProcessedId, point.id);
                }
            }

        } catch (error) {
            console.error('Error fetching from remote server:', error);
        }
    }

    async addToLocalQueue(point) {
        const queueFile = path.join(this.queueDir, 'elevation_queue.json');
        
        let queueData = { points: [] };
        try {
            const data = await fs.readFile(queueFile, 'utf8');
            queueData = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is invalid, start fresh
        }

        queueData.points.push({
            ...point,
            addedToLocalQueue: new Date().toISOString(),
            status: 'pending'
        });

        await fs.writeFile(queueFile, JSON.stringify(queueData, null, 2));
    }

    async processLocalQueue() {
        const queueFile = path.join(this.queueDir, 'elevation_queue.json');
        
        try {
            const data = await fs.readFile(queueFile, 'utf8');
            const queueData = JSON.parse(data);
            
            const pendingPoints = queueData.points.filter(p => p.status === 'pending');
            
            if (pendingPoints.length === 0) {
                return;
            }

            console.log(`Processing ${pendingPoints.length} points for elevation lookup`);

            // Process in batches of 25
            const batchSize = 25;
            for (let i = 0; i < pendingPoints.length; i += batchSize) {
                const batch = pendingPoints.slice(i, i + batchSize);
                
                try {
                    const results = await this.processBatch(batch);
                    
                    // Update queue with results
                    for (const result of results) {
                        const point = queueData.points.find(p => 
                            Math.abs(p.lat - result.lat) < 0.000001 && 
                            Math.abs(p.lon - result.lon) < 0.000001
                        );
                        if (point) {
                            point.elevation = result.elevation;
                            point.elevationSource = result.source;
                            point.status = 'completed';
                            point.processedAt = new Date().toISOString();
                        }
                    }

                    // Update remote server
                    if (this.remoteServerUrl) {
                        for (const result of results) {
                            await this.updateRemoteServer(result);
                        }
                    }

                    // Save updated queue
                    await fs.writeFile(queueFile, JSON.stringify(queueData, null, 2));

                    // Add delay between batches
                    if (i + batchSize < pendingPoints.length) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                    }

                } catch (error) {
                    console.error('Error processing batch:', error);
                    // Mark batch as failed
                    for (const point of batch) {
                        const queuePoint = queueData.points.find(p => 
                            Math.abs(p.lat - point.lat) < 0.000001 && 
                            Math.abs(p.lon - point.lon) < 0.000001
                        );
                        if (queuePoint) {
                            queuePoint.status = 'failed';
                            queuePoint.error = error.message;
                            queuePoint.failedAt = new Date().toISOString();
                        }
                    }
                    await fs.writeFile(queueFile, JSON.stringify(queueData, null, 2));
                }
            }

        } catch (error) {
            console.error('Error reading queue file:', error);
        }
    }

    async processBatch(points) {
        const maxAttempts = APIS.length * 2;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const api = this.getNextBestApi();
            const batchSize = API_BATCH_SIZES[api.name] || 25;

            try {
                // Split into sub-batches based on API limits
                const subBatches = [];
                for (let i = 0; i < points.length; i += batchSize) {
                    subBatches.push(points.slice(i, i + batchSize));
                }

                const allResults = [];
                for (const subBatch of subBatches) {
                    const result = await this.fetchElevations(subBatch, api);
                    allResults.push(...result);

                    if (subBatches.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                    }
                }

                // Success!
                const status = API_STATUS[api.name];
                status.lastSuccess = Date.now();
                status.failCount = 0;
                status.currentDelay = RATE_LIMIT_CONFIG.initialDelay;
                this.lastSuccessfulApiIndex = APIS.findIndex(a => a.name === api.name);

                console.log(`Successfully processed ${points.length} points using ${api.name}`);
                return allResults;

            } catch (error) {
                console.error(`API ${api.name} failed:`, error.message);
                
                if (error.message.includes('429')) {
                    await this.handleRateLimit(api);
                } else {
                    API_STATUS[api.name].failCount++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            attempts++;
        }

        throw new Error(`Failed to get elevation data after ${attempts} attempts`);
    }

    async fetchElevations(points, api) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
            API_STATUS[api.name].lastTry = Date.now();

            const response = await fetch(api.url(points), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'GPS-Elevation-Service/1.0'
                },
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (response.status === 429) {
                throw new Error('Rate limited');
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} from ${api.name}`);
            }

            const data = await response.json();
            return api.parseResponse(data, points);

        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }

    getNextBestApi() {
        const now = Date.now();

        // Try round-robin first
        for (let i = 0; i < APIS.length; i++) {
            const nextIndex = (this.lastSuccessfulApiIndex + 1 + i) % APIS.length;
            const api = APIS[nextIndex];
            const status = API_STATUS[api.name];

            const readyIn = Math.max(0, (status.lastTry + status.currentDelay) - now);
            if (readyIn === 0 && status.failCount < 3) {
                return api;
            }
        }

        // Fallback to best available
        return APIS.slice().sort((a, b) => {
            const aStatus = API_STATUS[a.name];
            const bStatus = API_STATUS[b.name];
            return aStatus.failCount - bStatus.failCount;
        })[0];
    }

    async handleRateLimit(api) {
        const status = API_STATUS[api.name];
        status.currentDelay = Math.min(
            status.currentDelay * RATE_LIMIT_CONFIG.backoffFactor,
            RATE_LIMIT_CONFIG.maxDelay
        );
        status.failCount++;
        console.log(`Rate limited by ${api.name}, next delay: ${status.currentDelay/1000}s`);
    }

    async updateRemoteServer(result) {
        if (!this.remoteServerUrl) return;

        try {
            const response = await fetch(`${this.remoteServerUrl}/api/elevation-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: result.lat,
                    lon: result.lon,
                    elevation: result.elevation,
                    source: result.source,
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to update remote server: ${response.status}`);
            }

            console.log(`Updated remote server for ${result.lat}, ${result.lon}: ${result.elevation}m (${result.source})`);

        } catch (error) {
            console.error('Failed to update remote server:', error);
            // Don't throw - we'll retry on next cycle
        }
    }

    async getStats() {
        const queueFile = path.join(this.queueDir, 'elevation_queue.json');
        
        try {
            const data = await fs.readFile(queueFile, 'utf8');
            const queueData = JSON.parse(data);
            
            const stats = {
                pending: 0,
                completed: 0,
                failed: 0,
                total: queueData.points.length
            };

            queueData.points.forEach(point => {
                stats[point.status] = (stats[point.status] || 0) + 1;
            });

            return stats;

        } catch (error) {
            return { pending: 0, completed: 0, failed: 0, total: 0 };
        }
    }
}

export { ElevationService }; 