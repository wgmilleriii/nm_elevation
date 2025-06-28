#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

class GPSDataCollector {
    constructor() {
        this.apiUrl = 'https://hanon.artsmetrics.net/elevation/api';
        this.dataFile = 'gps_session_data.json';
        this.pollInterval = 5000; // 5 seconds
        this.isRunning = false;
        this.sessionData = {
            collectionStart: new Date().toISOString(),
            users: {},
            totalPoints: 0,
            lastUpdate: null
        };
        
        // Load existing data if available
        this.loadExistingData();
    }

    loadExistingData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const data = fs.readFileSync(this.dataFile, 'utf8');
                this.sessionData = JSON.parse(data);
                console.log(`📂 Loaded existing data: ${this.sessionData.totalPoints} points from ${Object.keys(this.sessionData.users).length} users`);
            }
        } catch (error) {
            console.error('❌ Error loading existing data:', error.message);
        }
    }

    saveData() {
        try {
            this.sessionData.lastUpdate = new Date().toISOString();
            fs.writeFileSync(this.dataFile, JSON.stringify(this.sessionData, null, 2));
            console.log(`💾 Saved ${this.sessionData.totalPoints} total points`);
        } catch (error) {
            console.error('❌ Error saving data:', error.message);
        }
    }

    async makeRequest(endpoint) {
        return new Promise((resolve, reject) => {
            const url = `${this.apiUrl}${endpoint}`;
            
            https.get(url, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error(`Failed to parse JSON: ${error.message}`));
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    async collectUserSessions() {
        try {
            console.log('🔍 Fetching user sessions...');
            const sessions = await this.makeRequest('/user-sessions');
            
            let newPointsCount = 0;
            
            for (const session of sessions.sessions || []) {
                const userId = session.userId;
                
                // Initialize user data if not exists
                if (!this.sessionData.users[userId]) {
                    this.sessionData.users[userId] = {
                        deviceId: session.deviceId,
                        firstSeen: new Date().toISOString(),
                        sessions: {},
                        totalPoints: 0
                    };
                }

                // Get detailed points for this user
                try {
                    console.log(`📱 Fetching points for user: ${userId.substring(0, 12)}...`);
                    const userPoints = await this.makeRequest(`/user/points?userId=${userId}`);
                    
                    if (userPoints.points && userPoints.points.length > 0) {
                        // Group points by session
                        const pointsBySession = {};
                        
                        userPoints.points.forEach(point => {
                            const sessionId = point.sessionId || 'unknown';
                            if (!pointsBySession[sessionId]) {
                                pointsBySession[sessionId] = [];
                            }
                            pointsBySession[sessionId].push(point);
                        });

                        // Store session data
                        Object.keys(pointsBySession).forEach(sessionId => {
                            const points = pointsBySession[sessionId];
                            const existingPoints = this.sessionData.users[userId].sessions[sessionId]?.points?.length || 0;
                            
                            if (points.length > existingPoints) {
                                this.sessionData.users[userId].sessions[sessionId] = {
                                    sessionId,
                                    points,
                                    pointCount: points.length,
                                    startTime: points[0]?.timestamp,
                                    endTime: points[points.length - 1]?.timestamp,
                                    lastUpdated: new Date().toISOString()
                                };
                                
                                newPointsCount += (points.length - existingPoints);
                            }
                        });

                        // Update user totals
                        this.sessionData.users[userId].totalPoints = userPoints.points.length;
                    }
                } catch (error) {
                    console.error(`❌ Error fetching points for user ${userId}:`, error.message);
                }
            }

            // Update total points
            this.sessionData.totalPoints = Object.values(this.sessionData.users)
                .reduce((sum, user) => sum + user.totalPoints, 0);

            if (newPointsCount > 0) {
                console.log(`✅ Collected ${newPointsCount} new GPS points`);
                this.saveData();
            } else {
                console.log('📊 No new data found');
            }

        } catch (error) {
            console.error('❌ Error collecting user sessions:', error.message);
        }
    }

    async getStats() {
        try {
            const stats = await this.makeRequest('/stats');
            console.log(`📈 Server Stats: ${stats.totalUsers} users, ${stats.totalSessions} sessions, ${stats.totalPoints} points`);
            return stats;
        } catch (error) {
            console.error('❌ Error getting stats:', error.message);
            return null;
        }
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️  Collector is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting GPS data collector...');
        console.log(`📡 Polling ${this.apiUrl} every ${this.pollInterval/1000} seconds`);
        console.log(`💾 Saving data to: ${this.dataFile}`);
        console.log('');

        // Initial collection
        this.collectData();

        // Set up polling
        this.intervalId = setInterval(() => {
            this.collectData();
        }, this.pollInterval);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            this.stop();
        });

        process.on('SIGTERM', () => {
            this.stop();
        });
    }

    async collectData() {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n⏰ ${timestamp} - Collecting data...`);
        
        await this.getStats();
        await this.collectUserSessions();
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('\n🛑 Stopping GPS data collector...');
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        this.saveData();
        console.log('✅ Data collection stopped and saved');
        process.exit(0);
    }

    // Method to get collected data for SVG rendering
    getCollectedData() {
        return this.sessionData;
    }

    // Method to get all points from all users/sessions
    getAllPoints() {
        const allPoints = [];
        
        Object.values(this.sessionData.users).forEach(user => {
            Object.values(user.sessions).forEach(session => {
                if (session.points) {
                    session.points.forEach(point => {
                        allPoints.push({
                            ...point,
                            userId: user.deviceId || 'unknown'
                        });
                    });
                }
            });
        });

        return allPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Method to get points for a specific user
    getUserPoints(userId) {
        if (!this.sessionData.users[userId]) {
            return [];
        }

        const userPoints = [];
        Object.values(this.sessionData.users[userId].sessions).forEach(session => {
            if (session.points) {
                userPoints.push(...session.points);
            }
        });

        return userPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Display summary
    showSummary() {
        console.log('\n📊 COLLECTION SUMMARY');
        console.log('='.repeat(50));
        console.log(`Collection started: ${this.sessionData.collectionStart}`);
        console.log(`Last update: ${this.sessionData.lastUpdate || 'Never'}`);
        console.log(`Total users: ${Object.keys(this.sessionData.users).length}`);
        console.log(`Total points: ${this.sessionData.totalPoints}`);
        
        Object.entries(this.sessionData.users).forEach(([userId, user]) => {
            console.log(`\n👤 User: ${userId.substring(0, 12)}...`);
            console.log(`   Device: ${user.deviceId || 'unknown'}`);
            console.log(`   Sessions: ${Object.keys(user.sessions).length}`);
            console.log(`   Points: ${user.totalPoints}`);
        });
    }
}

// CLI functionality
if (require.main === module) {
    const collector = new GPSDataCollector();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            collector.start();
            break;
            
        case 'summary':
            collector.showSummary();
            break;
            
        case 'points':
            const allPoints = collector.getAllPoints();
            console.log(JSON.stringify(allPoints, null, 2));
            break;
            
        case 'render':
            console.log('🎨 SVG rendering will be implemented next...');
            collector.showSummary();
            break;
            
        default:
            console.log('📋 GPS Data Collector');
            console.log('');
            console.log('Usage:');
            console.log('  node collect_gps_data.js start     - Start collecting data');
            console.log('  node collect_gps_data.js summary   - Show collection summary');
            console.log('  node collect_gps_data.js points    - Export all points as JSON');
            console.log('  node collect_gps_data.js render    - Prepare for SVG rendering');
            console.log('');
            console.log('Data will be saved to: gps_session_data.json');
    }
}

module.exports = GPSDataCollector; 