#!/usr/bin/env node

const https = require('https');

const API_BASE = 'https://hanon.artsmetrics.net/elevation/api';

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

async function findUserData() {
    console.log('🔍 Searching for user GPS data...\n');
    
    // Common user ID patterns based on device IDs
    const testUserIds = [];
    
    // Generate some common user ID patterns
    for (let i = 0; i < 20; i++) {
        testUserIds.push(`user_${i}`);
        testUserIds.push(`user_test_${i}`);
    }
    
    // Add some hash-based patterns (common from device IDs)
    const commonDeviceHashes = [
        'a1b2c3d4e5f6', 'mobile_device', 'phone_gps', 'iphone_tracker',
        'android_gps', 'device_123', 'gps_tracker', 'test_device'
    ];
    
    commonDeviceHashes.forEach(device => {
        const hash = require('crypto').createHash('md5').update(device + '_' + Date.now()).digest('hex').substring(0, 8);
        testUserIds.push(`user_${hash}`);
    });
    
    console.log(`Testing ${testUserIds.length} potential user IDs...\n`);
    
    const results = [];
    
    for (const userId of testUserIds) {
        try {
            const sessions = await makeRequest(`${API_BASE}/user-sessions?userId=${userId}`);
            
            if (sessions.sessions && sessions.sessions.length > 0) {
                let totalPoints = 0;
                sessions.sessions.forEach(session => {
                    if (session.points) {
                        totalPoints += session.points.length;
                    }
                });
                
                if (totalPoints > 0) {
                    results.push({
                        userId,
                        sessions: sessions.sessions.length,
                        totalPoints,
                        latestSession: sessions.sessions[sessions.sessions.length - 1]
                    });
                    
                    console.log(`✅ Found user: ${userId}`);
                    console.log(`   Sessions: ${sessions.sessions.length}`);
                    console.log(`   Total Points: ${totalPoints}`);
                    console.log(`   Latest Activity: ${sessions.sessions[sessions.sessions.length - 1].startTime}`);
                    console.log('');
                }
            }
        } catch (error) {
            // Silent fail for non-existent users
        }
        
        // Small delay to avoid overwhelming server
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Also try to find users through the logs
    console.log('🔍 Checking server logs for user activity...\n');
    
    try {
        const logs = await makeRequest(`${API_BASE}/logs?type=gps&lines=200`);
        if (logs.logs) {
            const userPattern = /User: (user_[a-f0-9]+)/g;
            const foundUsers = new Set();
            
            logs.logs.forEach(log => {
                const matches = log.matchAll ? Array.from(log.matchAll(userPattern)) : [];
                matches.forEach(match => foundUsers.add(match[1]));
            });
            
            console.log(`Found ${foundUsers.size} users in logs:`, Array.from(foundUsers));
            
            // Test these users
            for (const userId of foundUsers) {
                if (!results.find(r => r.userId === userId)) {
                    try {
                        const sessions = await makeRequest(`${API_BASE}/user-sessions?userId=${userId}`);
                        
                        if (sessions.sessions && sessions.sessions.length > 0) {
                            let totalPoints = 0;
                            sessions.sessions.forEach(session => {
                                if (session.points) {
                                    totalPoints += session.points.length;
                                }
                            });
                            
                            results.push({
                                userId,
                                sessions: sessions.sessions.length,
                                totalPoints,
                                latestSession: sessions.sessions[sessions.sessions.length - 1]
                            });
                            
                            console.log(`✅ Found user from logs: ${userId}`);
                            console.log(`   Sessions: ${sessions.sessions.length}`);
                            console.log(`   Total Points: ${totalPoints}`);
                            console.log('');
                        }
                    } catch (error) {
                        console.log(`❌ Error checking user ${userId}:`, error.message);
                    }
                }
            }
        }
    } catch (error) {
        console.log('❌ Could not check logs:', error.message);
    }
    
    // Sort by total points
    results.sort((a, b) => b.totalPoints - a.totalPoints);
    
    console.log('\n📊 SUMMARY - Users with GPS data:');
    console.log('='.repeat(50));
    
    if (results.length === 0) {
        console.log('❌ No users found with GPS data');
        return;
    }
    
    results.forEach((result, index) => {
        console.log(`${index + 1}. User ID: ${result.userId}`);
        console.log(`   Sessions: ${result.sessions}`);
        console.log(`   Total Points: ${result.totalPoints}`);
        console.log(`   Latest: ${result.latestSession.startTime}`);
        console.log('');
    });
    
    // Test the user with most points
    const topUser = results[0];
    console.log(`\n🧪 Testing API with top user: ${topUser.userId}`);
    console.log('='.repeat(50));
    
    try {
        const sessionsData = await makeRequest(`${API_BASE}/user-sessions?userId=${topUser.userId}`);
        console.log(`✅ Sessions API: ${sessionsData.sessions.length} sessions`);
        
        // Test user points API
        const pointsData = await makeRequest(`${API_BASE}/user/points?userId=${topUser.userId}`);
        console.log(`✅ Points API: ${pointsData.points ? pointsData.points.length : 'No points'} points`);
        
        if (pointsData.points && pointsData.points.length > 100) {
            console.log(`🎉 SUCCESS: Found ${pointsData.points.length} points for user ${topUser.userId}`);
            
            // Show sample of recent points
            console.log('\n📍 Sample recent points:');
            pointsData.points.slice(-5).forEach((point, i) => {
                console.log(`   ${i + 1}. ${point.timestamp} - ${point.lat.toFixed(6)}, ${point.lon.toFixed(6)} (${point.elevation || 'no elev'}m)`);
            });
        }
        
    } catch (error) {
        console.log(`❌ Error testing APIs: ${error.message}`);
    }
}

findUserData().catch(console.error); 