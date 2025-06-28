#!/usr/bin/env node

const fs = require('fs');
const https = require('https');

class MyGPSCollector {
    constructor() {
        this.apiUrl = 'https://hanon.artsmetrics.net/elevation/api';
        this.dataFile = 'my_gps_session.json';
        this.pollInterval = 10000; // 10 seconds
        this.isRunning = false;
        this.knownUserIds = new Set();
        this.sessionData = {
            collectionStart: new Date().toISOString(),
            targetDuration: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
            users: {},
            allPoints: [],
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
                console.log(`📂 Loaded existing session: ${this.sessionData.totalPoints} points`);
                
                // Rebuild known user IDs
                Object.keys(this.sessionData.users).forEach(userId => {
                    this.knownUserIds.add(userId);
                });
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

    async discoverUsers() {
        // Check logs for user activity
        try {
            const logs = await this.makeRequest('/logs');
            const userIdPattern = /user_[a-f0-9]{32}/g;
            
            if (logs.logs) {
                logs.logs.forEach(logEntry => {
                    const matches = logEntry.match(userIdPattern);
                    if (matches) {
                        matches.forEach(userId => {
                            if (!this.knownUserIds.has(userId)) {
                                console.log(`🆕 Discovered new user: ${userId.substring(0, 20)}...`);
                                this.knownUserIds.add(userId);
                            }
                        });
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error discovering users from logs:', error.message);
        }
    }

    async collectUserData(userId) {
        try {
            const userPoints = await this.makeRequest(`/user/points?userId=${userId}`);
            
            if (userPoints.points && userPoints.points.length > 0) {
                const existingCount = this.sessionData.users[userId]?.points?.length || 0;
                
                if (userPoints.points.length > existingCount) {
                    // Store user data
                    this.sessionData.users[userId] = {
                        userId,
                        points: userPoints.points,
                        pointCount: userPoints.points.length,
                        lastUpdated: new Date().toISOString(),
                        firstSeen: this.sessionData.users[userId]?.firstSeen || new Date().toISOString()
                    };
                    
                    const newPoints = userPoints.points.length - existingCount;
                    console.log(`📍 User ${userId.substring(0, 12)}... has ${newPoints} new points (${userPoints.points.length} total)`);
                    
                    return newPoints;
                }
            }
            
            return 0;
        } catch (error) {
            console.error(`❌ Error collecting data for user ${userId}:`, error.message);
            return 0;
        }
    }

    updateAllPoints() {
        this.sessionData.allPoints = [];
        
        Object.values(this.sessionData.users).forEach(user => {
            if (user.points) {
                user.points.forEach(point => {
                    this.sessionData.allPoints.push({
                        ...point,
                        userId: user.userId
                    });
                });
            }
        });
        
        // Sort by timestamp
        this.sessionData.allPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        this.sessionData.totalPoints = this.sessionData.allPoints.length;
    }

    async collectData() {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n⏰ ${timestamp} - Collecting GPS data...`);
        
        // Get server stats
        try {
            const stats = await this.makeRequest('/stats');
            console.log(`📈 Server: ${stats.totalUsers} users, ${stats.totalSessions} sessions, ${stats.totalPoints} points`);
        } catch (error) {
            console.error('❌ Error getting stats:', error.message);
        }
        
        // Discover new users
        await this.discoverUsers();
        
        // Collect data from all known users
        let totalNewPoints = 0;
        for (const userId of this.knownUserIds) {
            const newPoints = await this.collectUserData(userId);
            totalNewPoints += newPoints;
        }
        
        // Update consolidated points array
        this.updateAllPoints();
        
        if (totalNewPoints > 0) {
            console.log(`✅ Collected ${totalNewPoints} new GPS points`);
            this.saveData();
        } else {
            console.log('📊 No new GPS data found');
        }
        
        // Check if we should stop (3 hours elapsed)
        const elapsed = Date.now() - new Date(this.sessionData.collectionStart).getTime();
        const remaining = this.sessionData.targetDuration - elapsed;
        
        if (remaining > 0) {
            const hoursLeft = Math.floor(remaining / (1000 * 60 * 60));
            const minutesLeft = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            console.log(`⏳ Time remaining: ${hoursLeft}h ${minutesLeft}m`);
        } else {
            console.log('🏁 3-hour collection period completed!');
            this.stop();
        }
    }

    start() {
        if (this.isRunning) {
            console.log('⚠️  Collector is already running');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting 3-hour GPS data collection...');
        console.log(`📡 Polling ${this.apiUrl} every ${this.pollInterval/1000} seconds`);
        console.log(`💾 Saving data to: ${this.dataFile}`);
        console.log(`🎯 Target: 3 hours of continuous collection`);
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
        this.showFinalSummary();
        console.log('✅ Data collection stopped and saved');
        process.exit(0);
    }

    showSummary() {
        console.log('\n📊 CURRENT COLLECTION STATUS');
        console.log('='.repeat(50));
        console.log(`Collection started: ${this.sessionData.collectionStart}`);
        console.log(`Last update: ${this.sessionData.lastUpdate || 'Never'}`);
        console.log(`Total users tracked: ${Object.keys(this.sessionData.users).length}`);
        console.log(`Total GPS points: ${this.sessionData.totalPoints}`);
        
        const elapsed = Date.now() - new Date(this.sessionData.collectionStart).getTime();
        const hoursElapsed = Math.floor(elapsed / (1000 * 60 * 60));
        const minutesElapsed = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`Time elapsed: ${hoursElapsed}h ${minutesElapsed}m`);
        
        Object.entries(this.sessionData.users).forEach(([userId, user]) => {
            console.log(`\n👤 User: ${userId.substring(0, 12)}...`);
            console.log(`   Points: ${user.pointCount}`);
            console.log(`   Last seen: ${user.lastUpdated}`);
            
            if (user.points && user.points.length > 0) {
                const latest = user.points[user.points.length - 1];
                console.log(`   Latest location: ${latest.lat.toFixed(4)}, ${latest.lon.toFixed(4)}`);
                if (latest.elevation) console.log(`   Elevation: ${latest.elevation}m`);
                if (latest.speed) console.log(`   Speed: ${latest.speed} km/h`);
            }
        });
    }

    showFinalSummary() {
        console.log('\n🎯 FINAL 3-HOUR COLLECTION SUMMARY');
        console.log('='.repeat(60));
        this.showSummary();
        
        if (this.sessionData.totalPoints > 0) {
            console.log(`\n📈 Collection Rate: ${(this.sessionData.totalPoints / 3).toFixed(1)} points per hour`);
            console.log(`📁 Data saved to: ${this.dataFile}`);
            console.log(`🎨 Ready for SVG rendering!`);
        }
    }

    // Export points for SVG rendering
    exportForSVG() {
        return {
            points: this.sessionData.allPoints,
            users: this.sessionData.users,
            summary: {
                totalPoints: this.sessionData.totalPoints,
                collectionStart: this.sessionData.collectionStart,
                lastUpdate: this.sessionData.lastUpdate,
                userCount: Object.keys(this.sessionData.users).length
            }
        };
    }
}

// CLI functionality
if (require.main === module) {
    const collector = new MyGPSCollector();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            collector.start();
            break;
            
        case 'summary':
            collector.showSummary();
            break;
            
        case 'points':
            const exportData = collector.exportForSVG();
            console.log(JSON.stringify(exportData.points, null, 2));
            break;
            
        case 'export':
            const allData = collector.exportForSVG();
            console.log(JSON.stringify(allData, null, 2));
            break;
            
        default:
            console.log('📱 My GPS Data Collector - 3 Hour Session');
            console.log('');
            console.log('Usage:');
            console.log('  node collect_my_gps.cjs start     - Start 3-hour collection');
            console.log('  node collect_my_gps.cjs summary   - Show current status');
            console.log('  node collect_my_gps.cjs points    - Export points as JSON');
            console.log('  node collect_my_gps.cjs export    - Export all data');
            console.log('');
            console.log('🎯 Goal: Collect your GPS data for 3 hours while your phone');
            console.log('    is active on the GPS tracking website');
    }
}

module.exports = MyGPSCollector; 