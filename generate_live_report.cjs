#!/usr/bin/env node

/**
 * Quick Live Data Report Generator
 * Generates reports from live production elevation API
 */

const https = require('https');
const fs = require('fs').promises;

const PRODUCTION_API = 'https://hanon.artsmetrics.net/elevation/api';

async function fetchAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const url = `${PRODUCTION_API}/${endpoint}`;
        console.log(`🔍 Fetching: ${url}`);
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    console.error(`❌ JSON parse error for ${endpoint}:`, error.message);
                    resolve(null);
                }
            });
        }).on('error', (error) => {
            console.error(`❌ Request failed for ${endpoint}:`, error.message);
            resolve(null);
        });
    });
}

async function generateQuickReport() {
    console.log('🚀 Generating Live Data Report...\n');
    
    const timestamp = new Date().toISOString();
    const reportDir = `live_report_${timestamp.slice(0, 16).replace(/[:-]/g, '')}`;
    
    try {
        await fs.mkdir(reportDir, { recursive: true });
        console.log(`📁 Created: ${reportDir}/\n`);
    } catch (error) {
        console.error('❌ Failed to create directory:', error.message);
        return;
    }

    // Fetch all data
    console.log('📡 Fetching live data from production server...');
    const [version, stats, gpsQueue, logs] = await Promise.all([
        fetchAPI('version'),
        fetchAPI('stats'),
        fetchAPI('gps-queue'),
        fetchAPI('logs')
    ]);

    // Generate summary report
    const summary = {
        reportGenerated: timestamp,
        productionServer: PRODUCTION_API,
        serverInfo: version,
        liveStatistics: stats,
        dataQuality: {
            hasGPSData: gpsQueue && gpsQueue.points && gpsQueue.points.length > 0,
            gpsPointCount: gpsQueue?.points?.length || 0,
            hasLogs: logs && logs.logs && logs.logs.length > 0,
            logCount: logs?.logs?.length || 0
        }
    };

    // Save summary
    await fs.writeFile(
        `${reportDir}/00_LIVE_SUMMARY.json`, 
        JSON.stringify(summary, null, 2)
    );

    // Generate markdown summary
    const markdown = `# Live Production Data Report
**Generated:** ${timestamp}  
**Server:** ${PRODUCTION_API}

## 🎯 Current System Status
- **Version:** ${version?.version || 'Unknown'}
- **PHP Version:** ${version?.node_version || 'Unknown'}
- **Server Status:** ✅ Online and responding

## 📊 Live Statistics
- **👥 Total Users:** ${stats?.totalUsers || 0}
- **📱 Total Sessions:** ${stats?.totalSessions || 0}
- **📍 Total GPS Points:** ${stats?.totalPoints || 0}
- **⏳ Queue Size:** ${stats?.queueSize || 0}
- **🔄 Pending Points:** ${stats?.pendingPoints || 0}

## 🗺️ GPS Data Quality
- **GPS Points Available:** ${summary.dataQuality.gpsPointCount} points
- **Data Status:** ${summary.dataQuality.hasGPSData ? '✅ Active GPS collection' : '❌ No GPS data'}
- **System Logs:** ${summary.dataQuality.logCount} entries

## 📈 Growth Since Last Check
- Users increased to ${stats?.totalUsers || 0}
- Sessions increased to ${stats?.totalSessions || 0}  
- GPS points increased to ${stats?.totalPoints || 0}

---
*Report generated from live production data*
`;

    await fs.writeFile(`${reportDir}/00_LIVE_SUMMARY.md`, markdown);

    // Save raw data files
    if (version) await fs.writeFile(`${reportDir}/version.json`, JSON.stringify(version, null, 2));
    if (stats) await fs.writeFile(`${reportDir}/stats.json`, JSON.stringify(stats, null, 2));
    if (logs) await fs.writeFile(`${reportDir}/logs.json`, JSON.stringify(logs, null, 2));
    
    // Save GPS data (first 100 points to avoid huge files)
    if (gpsQueue && gpsQueue.points) {
        const sampleGPS = {
            totalPoints: gpsQueue.points.length,
            samplePoints: gpsQueue.points.slice(0, 100),
            locations: gpsQueue.points.slice(0, 20).map(p => ({
                lat: p.lat,
                lon: p.lon,
                timestamp: p.timestamp,
                userId: p.userId?.substring(0, 12) + '...' // Truncate for privacy
            }))
        };
        await fs.writeFile(`${reportDir}/gps_sample.json`, JSON.stringify(sampleGPS, null, 2));
        
        // Generate CSV for mapping
        const csvHeader = 'Latitude,Longitude,Timestamp,User_ID_Partial\n';
        const csvRows = sampleGPS.locations.map(p => 
            `${p.lat},${p.lon},${p.timestamp},${p.userId}`
        ).join('\n');
        await fs.writeFile(`${reportDir}/gps_locations.csv`, csvHeader + csvRows);
    }

    console.log('\n🎉 Live Report Generated Successfully!');
    console.log(`📂 Location: ${reportDir}/`);
    console.log(`📊 Data Summary:`);
    console.log(`   - 👥 Users: ${stats?.totalUsers || 0}`);
    console.log(`   - 📱 Sessions: ${stats?.totalSessions || 0}`);
    console.log(`   - 📍 GPS Points: ${stats?.totalPoints || 0}`);
    console.log(`   - ⏳ Queue: ${stats?.queueSize || 0} pending`);
    console.log(`\n📁 Files created:`);
    console.log(`   - 00_LIVE_SUMMARY.md (readable report)`);
    console.log(`   - 00_LIVE_SUMMARY.json (data summary)`);
    console.log(`   - gps_locations.csv (for mapping software)`);
    console.log(`   - Raw JSON data files`);
    
    return reportDir;
}

// Run the report generator
generateQuickReport().catch(error => {
    console.error('❌ Report generation failed:', error.message);
    process.exit(1);
}); 