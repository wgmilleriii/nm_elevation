#!/usr/bin/env node

// Collect All GPS Data - Downloads all available GPS tracking data from server
const https = require('https');
const fs = require('fs');
const { sessionToFriendlyName } = require('./session_translator.cjs');

const SERVER_URL = 'https://hanon.artsmetrics.net/elevation/api';
const OUTPUT_FILE = 'all_gps_data.json';

console.log('🌍 GPS Data Harvester - Collecting ALL GPS data from server');
console.log('===========================================================');
console.log('');

function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: 'Invalid JSON', raw: data });
                }
            });
        }).on('error', reject);
    });
}

async function getAllGPSData() {
    try {
        // Get server stats first
        console.log('📊 Checking server status...');
        const stats = await makeRequest(`${SERVER_URL}/stats`);
        console.log(`   Users: ${stats.totalUsers}, Sessions: ${stats.totalSessions}, Points: ${stats.totalPoints}`);
        console.log('');

        // Try to get all GPS queue data (this might have GPS points)
        console.log('🔍 Fetching GPS queue data...');
        const queueData = await makeRequest(`${SERVER_URL}/gps-queue`);
        
        let allData = {
            timestamp: new Date().toISOString(),
            serverStats: stats,
            sessions: [],
            gpsPoints: [],
            summary: {
                totalSessions: 0,
                totalPoints: 0,
                sessionNames: []
            }
        };

        if (queueData && queueData.points && queueData.points.length > 0) {
            console.log(`   Found ${queueData.points.length} GPS points in queue!`);
            
            // Group points by session
            const sessionMap = {};
            
            queueData.points.forEach(point => {
                if (point.sessionId) {
                    if (!sessionMap[point.sessionId]) {
                        const friendlyName = sessionToFriendlyName(point.sessionId);
                        sessionMap[point.sessionId] = {
                            sessionId: point.sessionId,
                            friendlyName: friendlyName,
                            userId: point.userId,
                            points: [],
                            stats: {
                                totalPoints: 0,
                                firstPoint: null,
                                lastPoint: null,
                                minLat: null, maxLat: null,
                                minLon: null, maxLon: null,
                                minElevation: null, maxElevation: null
                            }
                        };
                    }
                    
                    sessionMap[point.sessionId].points.push(point);
                    allData.gpsPoints.push(point);
                }
            });

            // Calculate session statistics
            Object.values(sessionMap).forEach(session => {
                session.stats.totalPoints = session.points.length;
                
                if (session.points.length > 0) {
                    // Sort points by timestamp
                    session.points.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    
                    session.stats.firstPoint = session.points[0].timestamp;
                    session.stats.lastPoint = session.points[session.points.length - 1].timestamp;
                    
                    // Calculate bounds
                    session.points.forEach(point => {
                        const lat = point.point?.latitude || point.latitude || point.lat;
                        const lon = point.point?.longitude || point.longitude || point.lon;
                        const elev = point.point?.altitude || point.altitude || point.elevation;
                        
                        if (lat !== undefined) {
                            session.stats.minLat = session.stats.minLat === null ? lat : Math.min(session.stats.minLat, lat);
                            session.stats.maxLat = session.stats.maxLat === null ? lat : Math.max(session.stats.maxLat, lat);
                        }
                        if (lon !== undefined) {
                            session.stats.minLon = session.stats.minLon === null ? lon : Math.min(session.stats.minLon, lon);
                            session.stats.maxLon = session.stats.maxLon === null ? lon : Math.max(session.stats.maxLon, lon);
                        }
                        if (elev !== undefined) {
                            session.stats.minElevation = session.stats.minElevation === null ? elev : Math.min(session.stats.minElevation, elev);
                            session.stats.maxElevation = session.stats.maxElevation === null ? elev : Math.max(session.stats.maxElevation, elev);
                        }
                    });
                }
                
                allData.sessions.push(session);
                allData.summary.sessionNames.push(session.friendlyName);
            });
            
            allData.summary.totalSessions = Object.keys(sessionMap).length;
            allData.summary.totalPoints = allData.gpsPoints.length;
            
        } else {
            console.log('   No GPS points found in queue');
        }

        // Try alternative data sources
        console.log('🔍 Checking for additional data sources...');
        
        // Try logs API
        try {
            const logs = await makeRequest(`${SERVER_URL}/logs?type=gps&limit=100`);
            if (logs.logs && logs.logs.length > 0) {
                console.log(`   Found ${logs.logs.length} GPS log entries`);
                allData.logs = logs.logs;
            }
        } catch (e) {
            console.log('   Logs API not available');
        }

        // Save all data
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2));
        
        console.log('');
        console.log('📊 Collection Summary:');
        console.log('=====================');
        console.log(`🎯 Total Sessions: ${allData.summary.totalSessions}`);
        console.log(`📍 Total GPS Points: ${allData.summary.totalPoints}`);
        console.log(`💾 Data saved to: ${OUTPUT_FILE}`);
        console.log('');
        
        if (allData.summary.sessionNames.length > 0) {
            console.log('🏷️  Session Names:');
            allData.summary.sessionNames.forEach((name, index) => {
                console.log(`   ${index + 1}. ${name}`);
            });
            console.log('');
        }

        // Show detailed session info
        if (allData.sessions.length > 0) {
            console.log('📱 Session Details:');
            console.log('==================');
            allData.sessions.forEach((session, index) => {
                console.log(`${index + 1}. 🏷️  ${session.friendlyName}`);
                console.log(`   📱 Session: ${session.sessionId.substring(0, 12)}...`);
                console.log(`   👤 User: ${session.userId.substring(0, 8)}...`);
                console.log(`   📊 Points: ${session.stats.totalPoints}`);
                
                if (session.stats.firstPoint) {
                    const duration = new Date(session.stats.lastPoint) - new Date(session.stats.firstPoint);
                    const durationMins = Math.round(duration / 1000 / 60);
                    console.log(`   ⏰ Duration: ${durationMins} minutes`);
                    console.log(`   🗓️  Started: ${new Date(session.stats.firstPoint).toLocaleString()}`);
                }
                
                if (session.stats.minLat !== null) {
                    console.log(`   🌍 Bounds: ${session.stats.minLat.toFixed(4)},${session.stats.minLon.toFixed(4)} to ${session.stats.maxLat.toFixed(4)},${session.stats.maxLon.toFixed(4)}`);
                }
                
                if (session.stats.minElevation !== null) {
                    console.log(`   ⛰️  Elevation: ${session.stats.minElevation.toFixed(0)}m - ${session.stats.maxElevation.toFixed(0)}m`);
                }
                console.log('');
            });
        }

        console.log('✅ GPS data collection complete!');
        console.log(`💬 You can now say: "I have ${allData.summary.totalPoints} GPS points from ${allData.summary.totalSessions} sessions"`);
        
        if (allData.summary.sessionNames.length > 0) {
            console.log(`💬 Your main session appears to be: "${allData.summary.sessionNames[0]}"`);
        }

        return allData;

    } catch (error) {
        console.error('❌ Error collecting GPS data:', error.message);
        return null;
    }
}

// Run the collector
getAllGPSData(); 