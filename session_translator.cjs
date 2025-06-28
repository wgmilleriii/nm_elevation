#!/usr/bin/env node

// Session ID to Human-Readable Name Translator
// Converts session UUIDs into friendly names like "Swift-Eagle-42" or "Brave-Wolf-17"

const adjectives = [
    'Swift', 'Brave', 'Clever', 'Bold', 'Bright', 'Strong', 'Quick', 'Wise', 'Sharp', 'Fast',
    'Calm', 'Free', 'Wild', 'Pure', 'Noble', 'Keen', 'Fierce', 'Proud', 'Steady', 'True',
    'Agile', 'Alert', 'Mighty', 'Silent', 'Golden', 'Silver', 'Crimson', 'Azure', 'Emerald', 'Violet'
];

const animals = [
    'Eagle', 'Wolf', 'Lion', 'Tiger', 'Bear', 'Fox', 'Hawk', 'Falcon', 'Panther', 'Jaguar',
    'Dolphin', 'Whale', 'Shark', 'Raven', 'Owl', 'Deer', 'Elk', 'Moose', 'Bison', 'Horse',
    'Cheetah', 'Leopard', 'Lynx', 'Cougar', 'Bobcat', 'Otter', 'Seal', 'Penguin', 'Albatross', 'Condor'
];

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function sessionToFriendlyName(sessionId) {
    const hash = hashString(sessionId);
    
    const adjIndex = hash % adjectives.length;
    const animalIndex = Math.floor(hash / adjectives.length) % animals.length;
    const number = (hash % 99) + 1; // 1-99
    
    const adjective = adjectives[adjIndex];
    const animal = animals[animalIndex];
    
    return `${adjective}-${animal}-${number}`;
}

function friendlyNameToPattern(sessionId) {
    const friendlyName = sessionToFriendlyName(sessionId);
    const parts = friendlyName.split('-');
    return {
        fullName: friendlyName,
        adjective: parts[0],
        animal: parts[1],
        number: parseInt(parts[2]),
        sessionId: sessionId
    };
}

// Command line usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('🏷️  Session Name Translator');
        console.log('');
        console.log('Usage:');
        console.log('  node session_translator.cjs <session-id>     # Convert session ID to friendly name');
        console.log('  node session_translator.cjs --list           # List all current sessions with names');
        console.log('  node session_translator.cjs --help           # Show this help');
        console.log('');
        console.log('Examples:');
        console.log('  node session_translator.cjs abc123def456     # → Swift-Eagle-42');
        console.log('  node session_translator.cjs --list           # Show all active sessions');
        process.exit(0);
    }
    
    if (args[0] === '--help') {
        console.log('🏷️  Session Name Translator - Help');
        console.log('');
        console.log('This tool converts UUID session IDs into memorable names like:');
        console.log('  • Swift-Eagle-42');
        console.log('  • Brave-Wolf-17');
        console.log('  • Clever-Hawk-88');
        console.log('');
        console.log('The same session ID will always generate the same friendly name.');
        console.log('Names are generated using a hash of the session ID.');
        process.exit(0);
    }
    
    if (args[0] === '--list') {
        console.log('🔍 Fetching current sessions...');
        
        const https = require('https');
        const http = require('http');
        
        function makeRequest(url) {
            return new Promise((resolve, reject) => {
                const client = url.startsWith('https:') ? https : http;
                client.get(url, (res) => {
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
        
        makeRequest('https://hanon.artsmetrics.net/elevation/api/stats')
            .then(stats => {
                console.log(`📊 Server Stats: ${stats.totalUsers} users, ${stats.totalSessions} sessions, ${stats.totalPoints} points`);
                console.log('');
                
                // Since we can't get session list without user ID, let's show how to use it
                console.log('💡 To see your specific session:');
                console.log('   1. Open GPS tracker on your phone');
                console.log('   2. Check browser console (F12) for your User ID');
                console.log('   3. Run: node session_translator.cjs --user <your-user-id>');
                console.log('');
                console.log('🎯 Or if you know your session ID:');
                console.log('   node session_translator.cjs <session-id>');
            })
            .catch(err => {
                console.error('❌ Error fetching stats:', err.message);
            });
        return;
    }
    
    if (args[0] === '--user' && args[1]) {
        const userId = args[1];
        console.log(`🔍 Fetching sessions for user: ${userId.substring(0, 8)}...`);
        
        const https = require('https');
        const querystring = require('querystring');
        
        const url = `https://hanon.artsmetrics.net/elevation/api/user-sessions?${querystring.stringify({userId})}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.error) {
                        console.error('❌ Error:', result.error);
                        return;
                    }
                    
                    console.log('');
                    console.log('🎯 Your Sessions:');
                    console.log('================');
                    
                    if (result.sessions && result.sessions.length > 0) {
                        result.sessions.forEach((session, index) => {
                            const friendlyName = sessionToFriendlyName(session.sessionId);
                            const startTime = new Date(session.startTime).toLocaleString();
                            const status = session.endTime ? 'Ended' : 'Active';
                            
                            console.log(`${index + 1}. 🏷️  ${friendlyName}`);
                            console.log(`   📱 Session: ${session.sessionId.substring(0, 8)}...`);
                            console.log(`   ⏰ Started: ${startTime}`);
                            console.log(`   📍 Status: ${status}`);
                            console.log(`   📊 Points: ${session.pointCount || 0}`);
                            console.log('');
                        });
                    } else {
                        console.log('No sessions found for this user.');
                    }
                } catch (e) {
                    console.error('❌ Error parsing response:', e.message);
                }
            });
        }).on('error', (err) => {
            console.error('❌ Error fetching sessions:', err.message);
        });
        return;
    }
    
    // Convert single session ID
    const sessionId = args[0];
    const result = friendlyNameToPattern(sessionId);
    
    console.log('🏷️  Session Name Translation');
    console.log('============================');
    console.log(`📱 Session ID: ${sessionId.substring(0, 16)}...`);
    console.log(`🎯 Friendly Name: ${result.fullName}`);
    console.log('');
    console.log('📝 Breakdown:');
    console.log(`   • Adjective: ${result.adjective}`);
    console.log(`   • Animal: ${result.animal}`);
    console.log(`   • Number: ${result.number}`);
    console.log('');
    console.log(`💬 You can say: "My session is ${result.fullName}"`);
}

module.exports = {
    sessionToFriendlyName,
    friendlyNameToPattern,
    adjectives,
    animals
}; 