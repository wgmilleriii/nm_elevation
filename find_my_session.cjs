#!/usr/bin/env node

// Find My Session - Helper to identify your current GPS tracking session
const https = require('https');
const { sessionToFriendlyName } = require('./session_translator.cjs');

console.log('🔍 Finding your current session...');
console.log('');

// Check recent activity in logs to find active sessions
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function findActiveSessions() {
    try {
        // Get server stats
        const stats = await makeRequest('https://hanon.artsmetrics.net/elevation/api/stats');
        console.log(`📊 Server Status: ${stats.totalUsers} users, ${stats.totalSessions} sessions, ${stats.totalPoints} points`);
        console.log('');
        
        // Get recent logs to find active sessions
        const logs = await makeRequest('https://hanon.artsmetrics.net/elevation/api/logs?type=gps&limit=50');
        
        if (logs.logs && logs.logs.length > 0) {
            console.log('🎯 Recent GPS Activity:');
            console.log('======================');
            
            // Group by session
            const sessionActivity = {};
            
            logs.logs.forEach(log => {
                if (log.data && log.data.sessionId) {
                    const sessionId = log.data.sessionId;
                    if (!sessionActivity[sessionId]) {
                        sessionActivity[sessionId] = {
                            sessionId,
                            friendlyName: sessionToFriendlyName(sessionId),
                            userId: log.data.userId,
                            points: 0,
                            lastActivity: log.timestamp,
                            firstActivity: log.timestamp
                        };
                    }
                    sessionActivity[sessionId].points++;
                    sessionActivity[sessionId].lastActivity = log.timestamp;
                }
            });
            
            // Sort by most recent activity
            const sessions = Object.values(sessionActivity)
                .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
            
            sessions.forEach((session, index) => {
                const lastActivity = new Date(session.lastActivity);
                const timeSince = Math.round((Date.now() - lastActivity.getTime()) / 1000 / 60); // minutes
                const isRecent = timeSince < 10; // Active in last 10 minutes
                
                console.log(`${index + 1}. 🏷️  ${session.friendlyName} ${isRecent ? '🟢 ACTIVE' : '⚪'}`);
                console.log(`   📱 Session: ${session.sessionId.substring(0, 12)}...`);
                console.log(`   👤 User: ${session.userId.substring(0, 8)}...`);
                console.log(`   📊 Points: ${session.points}`);
                console.log(`   ⏰ Last Activity: ${timeSince} minutes ago`);
                console.log('');
                
                if (isRecent) {
                    console.log(`💬 You can say: "My session is ${session.friendlyName}"`);
                    console.log(`🔧 To get details: node session_translator.cjs --user ${session.userId}`);
                    console.log('');
                }
            });
            
            if (sessions.length === 0) {
                console.log('❌ No recent GPS activity found');
            }
            
        } else {
            console.log('❌ No GPS logs found');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('');
        console.log('💡 Alternative method:');
        console.log('   1. Open GPS tracker on your phone');
        console.log('   2. Open browser developer tools (F12)');
        console.log('   3. Look in Console tab for your User ID');
        console.log('   4. Run: node session_translator.cjs --user <your-user-id>');
    }
}

findActiveSessions(); 