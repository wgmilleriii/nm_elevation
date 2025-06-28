#!/usr/bin/env node

/**
 * Live Data Reports Generator
 * Connects to production elevation API and generates comprehensive reports
 * 
 * Usage: node live_data_reports.js [report-type]
 * Report types: summary, sessions, users, gps-analysis, journey-maps, system-health
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
    PRODUCTION_API: 'https://hanon.artsmetrics.net/elevation/api',
    LOCAL_API: 'http://localhost:8020/api',
    OUTPUT_DIR: './reports_live',
    TIMESTAMP: new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
};

class LiveDataReporter {
    constructor() {
        this.baseUrl = CONFIG.PRODUCTION_API;
        this.outputDir = `${CONFIG.OUTPUT_DIR}_${CONFIG.TIMESTAMP}`;
    }

    async fetchAPI(endpoint) {
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`${this.baseUrl}/${endpoint}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`❌ Failed to fetch ${endpoint}:`, error.message);
            return null;
        }
    }

    async ensureOutputDir() {
        try {
            await fs.mkdir(this.outputDir, { recursive: true });
            console.log(`📁 Created output directory: ${this.outputDir}`);
        } catch (error) {
            console.error('❌ Failed to create output directory:', error.message);
            process.exit(1);
        }
    }

    async saveReport(filename, data, format = 'json') {
        const filepath = path.join(this.outputDir, filename);
        try {
            if (format === 'json') {
                await fs.writeFile(filepath, JSON.stringify(data, null, 2));
            } else if (format === 'markdown') {
                await fs.writeFile(filepath, data);
            } else if (format === 'csv') {
                await fs.writeFile(filepath, data);
            }
            console.log(`✅ Saved: ${filepath}`);
        } catch (error) {
            console.error(`❌ Failed to save ${filepath}:`, error.message);
        }
    }

    async generateSystemSummary() {
        console.log('\n🔍 Generating System Summary Report...');
        
        const [version, stats, queueStatus] = await Promise.all([
            this.fetchAPI('version'),
            this.fetchAPI('stats'),
            this.fetchAPI('queue/status')
        ]);

        const summary = {
            reportType: 'system_summary',
            timestamp: new Date().toISOString(),
            server: version,
            statistics: stats,
            queueStatus: queueStatus,
            healthScore: this.calculateHealthScore(stats, queueStatus)
        };

        await this.saveReport('01_system_summary.json', summary);

        // Generate markdown summary
        const markdown = this.generateSummaryMarkdown(summary);
        await this.saveReport('01_system_summary.md', markdown, 'markdown');

        return summary;
    }

    async generateSessionAnalysis() {
        console.log('\n📊 Generating Session Analysis Report...');
        
        const stats = await this.fetchAPI('stats');
        if (!stats) return null;

        const sessionAnalysis = {
            reportType: 'session_analysis',
            timestamp: new Date().toISOString(),
            totalSessions: stats.totalSessions,
            totalUsers: stats.totalUsers,
            avgSessionsPerUser: stats.totalUsers > 0 ? (stats.totalSessions / stats.totalUsers).toFixed(2) : 0,
            totalGPSPoints: stats.totalPoints,
            avgPointsPerSession: stats.totalSessions > 0 ? (stats.totalPoints / stats.totalSessions).toFixed(2) : 0,
            queueMetrics: {
                queueSize: stats.queueSize,
                pendingPoints: stats.pendingPoints,
                processingPoints: stats.processingPoints,
                completedPoints: stats.completedPoints
            }
        };

        // Try to get recent sessions data
        const recentSessions = await this.fetchAPI('sessions/recent') || [];
        sessionAnalysis.recentSessions = recentSessions;

        await this.saveReport('02_session_analysis.json', sessionAnalysis);

        // Generate CSV for session data
        const csv = this.generateSessionCSV(sessionAnalysis);
        await this.saveReport('02_session_analysis.csv', csv, 'csv');

        return sessionAnalysis;
    }

    async generateGPSAnalysis() {
        console.log('\n🗺️ Generating GPS Analysis Report...');
        
        const gpsQueue = await this.fetchAPI('gps-queue');
        if (!gpsQueue || !gpsQueue.queue) return null;

        const gpsAnalysis = {
            reportType: 'gps_analysis',
            timestamp: new Date().toISOString(),
            totalPoints: gpsQueue.queue.length,
            elevationStats: this.calculateElevationStats(gpsQueue.queue),
            geographicBounds: this.calculateGeographicBounds(gpsQueue.queue),
            accuracyStats: this.calculateAccuracyStats(gpsQueue.queue),
            timeSpanAnalysis: this.calculateTimeSpanAnalysis(gpsQueue.queue)
        };

        await this.saveReport('03_gps_analysis.json', gpsAnalysis);

        // Generate elevation profile CSV
        const elevationCSV = this.generateElevationProfileCSV(gpsQueue.queue);
        await this.saveReport('03_elevation_profile.csv', elevationCSV, 'csv');

        return gpsAnalysis;
    }

    async generateJourneyMaps() {
        console.log('\n🛣️ Generating Journey Maps Report...');
        
        const gpsQueue = await this.fetchAPI('gps-queue');
        if (!gpsQueue || !gpsQueue.queue) return null;

        // Group GPS points by user/session
        const journeys = this.groupPointsByJourney(gpsQueue.queue);
        
        const journeyAnalysis = {
            reportType: 'journey_maps',
            timestamp: new Date().toISOString(),
            totalJourneys: Object.keys(journeys).length,
            journeys: {}
        };

        // Analyze each journey
        for (const [journeyId, points] of Object.entries(journeys)) {
            journeyAnalysis.journeys[journeyId] = {
                totalPoints: points.length,
                distance: this.calculateTotalDistance(points),
                elevationGain: this.calculateElevationGain(points),
                duration: this.calculateDuration(points),
                bounds: this.calculateGeographicBounds(points),
                elevationProfile: points.map(p => ({
                    lat: p.latitude,
                    lon: p.longitude,
                    elevation: p.elevation,
                    timestamp: p.timestamp
                }))
            };
        }

        await this.saveReport('04_journey_maps.json', journeyAnalysis);

        // Generate GPX files for each journey
        await this.generateGPXFiles(journeys);

        return journeyAnalysis;
    }

    async generateSystemHealthReport() {
        console.log('\n🏥 Generating System Health Report...');
        
        const [version, stats, logs] = await Promise.all([
            this.fetchAPI('version'),
            this.fetchAPI('stats'),
            this.fetchAPI('logs')
        ]);

        const healthReport = {
            reportType: 'system_health',
            timestamp: new Date().toISOString(),
            serverInfo: version,
            performanceMetrics: {
                totalUsers: stats?.totalUsers || 0,
                totalSessions: stats?.totalSessions || 0,
                totalPoints: stats?.totalPoints || 0,
                queueEfficiency: this.calculateQueueEfficiency(stats),
                systemLoad: this.calculateSystemLoad(stats)
            },
            recentLogs: logs?.logs || [],
            healthScore: this.calculateHealthScore(stats),
            recommendations: this.generateHealthRecommendations(stats, logs)
        };

        await this.saveReport('05_system_health.json', healthReport);

        // Generate health dashboard markdown
        const healthMarkdown = this.generateHealthDashboard(healthReport);
        await this.saveReport('05_system_health_dashboard.md', healthMarkdown, 'markdown');

        return healthReport;
    }

    // Utility methods for calculations
    calculateHealthScore(stats, queueStatus = null) {
        let score = 100;
        
        if (stats) {
            // Penalize if queue is too large
            if (stats.queueSize > 100) score -= 20;
            if (stats.queueSize > 500) score -= 30;
            
            // Reward active usage
            if (stats.totalUsers > 50) score += 10;
            if (stats.totalSessions > 100) score += 10;
        }
        
        return Math.max(0, Math.min(100, score));
    }

    calculateElevationStats(points) {
        if (!points || points.length === 0) return null;
        
        const elevations = points.map(p => p.elevation).filter(e => e != null);
        if (elevations.length === 0) return null;
        
        return {
            min: Math.min(...elevations),
            max: Math.max(...elevations),
            avg: elevations.reduce((a, b) => a + b, 0) / elevations.length,
            range: Math.max(...elevations) - Math.min(...elevations)
        };
    }

    calculateGeographicBounds(points) {
        if (!points || points.length === 0) return null;
        
        const lats = points.map(p => p.latitude).filter(l => l != null);
        const lons = points.map(p => p.longitude).filter(l => l != null);
        
        if (lats.length === 0 || lons.length === 0) return null;
        
        return {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lons),
            west: Math.min(...lons),
            center: {
                lat: lats.reduce((a, b) => a + b, 0) / lats.length,
                lon: lons.reduce((a, b) => a + b, 0) / lons.length
            }
        };
    }

    calculateAccuracyStats(points) {
        if (!points || points.length === 0) return null;
        
        const accuracies = points.map(p => p.accuracy).filter(a => a != null && a > 0);
        if (accuracies.length === 0) return null;
        
        return {
            min: Math.min(...accuracies),
            max: Math.max(...accuracies),
            avg: accuracies.reduce((a, b) => a + b, 0) / accuracies.length,
            count: accuracies.length
        };
    }

    calculateTimeSpanAnalysis(points) {
        if (!points || points.length === 0) return null;
        
        const timestamps = points.map(p => new Date(p.timestamp)).filter(t => !isNaN(t));
        if (timestamps.length === 0) return null;
        
        const earliest = new Date(Math.min(...timestamps));
        const latest = new Date(Math.max(...timestamps));
        
        return {
            earliest: earliest.toISOString(),
            latest: latest.toISOString(),
            spanHours: (latest - earliest) / (1000 * 60 * 60),
            totalPoints: timestamps.length
        };
    }

    groupPointsByJourney(points) {
        const journeys = {};
        
        points.forEach(point => {
            const journeyId = point.userId || point.sessionId || `unknown_${Math.random()}`;
            if (!journeys[journeyId]) {
                journeys[journeyId] = [];
            }
            journeys[journeyId].push(point);
        });
        
        // Sort points within each journey by timestamp
        Object.keys(journeys).forEach(journeyId => {
            journeys[journeyId].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
        
        return journeys;
    }

    calculateTotalDistance(points) {
        if (points.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < points.length; i++) {
            const dist = this.haversineDistance(
                points[i-1].latitude, points[i-1].longitude,
                points[i].latitude, points[i].longitude
            );
            totalDistance += dist;
        }
        
        return totalDistance;
    }

    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    calculateElevationGain(points) {
        if (points.length < 2) return 0;
        
        let totalGain = 0;
        for (let i = 1; i < points.length; i++) {
            const elevDiff = points[i].elevation - points[i-1].elevation;
            if (elevDiff > 0) {
                totalGain += elevDiff;
            }
        }
        
        return totalGain;
    }

    calculateDuration(points) {
        if (points.length < 2) return 0;
        
        const start = new Date(points[0].timestamp);
        const end = new Date(points[points.length - 1].timestamp);
        
        return (end - start) / (1000 * 60); // Duration in minutes
    }

    // Report generation methods
    generateSummaryMarkdown(summary) {
        return `# System Summary Report
**Generated:** ${summary.timestamp}

## Server Information
- **Version:** ${summary.server?.version || 'Unknown'}
- **PHP Version:** ${summary.server?.node_version || 'Unknown'}
- **Features:** ${summary.server?.features?.join(', ') || 'None'}

## System Statistics
- **Total Users:** ${summary.statistics?.totalUsers || 0}
- **Total Sessions:** ${summary.statistics?.totalSessions || 0}
- **Total GPS Points:** ${summary.statistics?.totalPoints || 0}
- **Queue Size:** ${summary.statistics?.queueSize || 0}

## Health Score: ${summary.healthScore}/100

## Queue Status
- **Pending Points:** ${summary.statistics?.pendingPoints || 0}
- **Processing Points:** ${summary.statistics?.processingPoints || 0}
- **Completed Points:** ${summary.statistics?.completedPoints || 0}

---
*Report generated by Live Data Reporter*
`;
    }

    generateSessionCSV(sessionAnalysis) {
        const headers = [
            'Metric',
            'Value'
        ];
        
        const rows = [
            ['Total Sessions', sessionAnalysis.totalSessions],
            ['Total Users', sessionAnalysis.totalUsers],
            ['Avg Sessions Per User', sessionAnalysis.avgSessionsPerUser],
            ['Total GPS Points', sessionAnalysis.totalGPSPoints],
            ['Avg Points Per Session', sessionAnalysis.avgPointsPerSession],
            ['Queue Size', sessionAnalysis.queueMetrics.queueSize],
            ['Pending Points', sessionAnalysis.queueMetrics.pendingPoints],
            ['Processing Points', sessionAnalysis.queueMetrics.processingPoints],
            ['Completed Points', sessionAnalysis.queueMetrics.completedPoints]
        ];
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    generateElevationProfileCSV(points) {
        const headers = ['Latitude', 'Longitude', 'Elevation', 'Accuracy', 'Timestamp', 'User ID', 'Session ID'];
        const rows = points.map(point => [
            point.latitude || '',
            point.longitude || '',
            point.elevation || '',
            point.accuracy || '',
            point.timestamp || '',
            point.userId || '',
            point.sessionId || ''
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    async generateGPXFiles(journeys) {
        for (const [journeyId, points] of Object.entries(journeys)) {
            const gpx = this.createGPXContent(points, journeyId);
            await this.saveReport(`journey_${journeyId}.gpx`, gpx, 'gpx');
        }
    }

    createGPXContent(points, journeyId) {
        const trackPoints = points.map(point => 
            `    <trkpt lat="${point.latitude}" lon="${point.longitude}">
      <ele>${point.elevation || 0}</ele>
      <time>${point.timestamp}</time>
    </trkpt>`
        ).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LiveDataReporter">
  <trk>
    <name>Journey ${journeyId}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
    }

    // Additional utility methods
    calculateQueueEfficiency(stats) {
        if (!stats || stats.queueSize === 0) return 100;
        const processed = stats.completedPoints || 0;
        const total = stats.queueSize + processed;
        return total > 0 ? (processed / total * 100).toFixed(2) : 0;
    }

    calculateSystemLoad(stats) {
        if (!stats) return 'Unknown';
        const totalActivity = (stats.totalSessions || 0) + (stats.queueSize || 0);
        if (totalActivity < 10) return 'Low';
        if (totalActivity < 50) return 'Medium';
        return 'High';
    }

    generateHealthRecommendations(stats, logs) {
        const recommendations = [];
        
        if (stats?.queueSize > 100) {
            recommendations.push('Consider increasing processing capacity - queue size is large');
        }
        
        if (stats?.totalUsers > 0 && stats?.totalSessions / stats?.totalUsers < 2) {
            recommendations.push('User engagement could be improved - low sessions per user');
        }
        
        if (logs?.logs && logs.logs.length > 100) {
            recommendations.push('High log volume detected - consider log rotation');
        }
        
        return recommendations;
    }

    generateHealthDashboard(healthReport) {
        return `# System Health Dashboard
**Generated:** ${healthReport.timestamp}

## 🎯 Health Score: ${healthReport.healthScore}/100

## 📊 Performance Metrics
- **Active Users:** ${healthReport.performanceMetrics.totalUsers}
- **Total Sessions:** ${healthReport.performanceMetrics.totalSessions}
- **GPS Points Collected:** ${healthReport.performanceMetrics.totalPoints}
- **Queue Efficiency:** ${healthReport.performanceMetrics.queueEfficiency}%
- **System Load:** ${healthReport.performanceMetrics.systemLoad}

## 🔧 Recommendations
${healthReport.recommendations.map(rec => `- ${rec}`).join('\n')}

## 📝 Recent Activity
${healthReport.recentLogs.slice(0, 5).map(log => `- ${log.timestamp}: ${log.message}`).join('\n')}

---
*Dashboard updated every hour*
`;
    }

    async generateAllReports() {
        console.log('🚀 Starting Live Data Report Generation...');
        console.log(`📡 Connecting to: ${this.baseUrl}`);
        
        await this.ensureOutputDir();
        
        const reports = {};
        
        try {
            reports.summary = await this.generateSystemSummary();
            reports.sessions = await this.generateSessionAnalysis();
            reports.gps = await this.generateGPSAnalysis();
            reports.journeys = await this.generateJourneyMaps();
            reports.health = await this.generateSystemHealthReport();
            
            // Generate master index
            const masterIndex = {
                reportType: 'master_index',
                timestamp: new Date().toISOString(),
                outputDirectory: this.outputDir,
                reportsGenerated: Object.keys(reports).filter(key => reports[key] !== null),
                summary: {
                    totalUsers: reports.summary?.statistics?.totalUsers || 0,
                    totalSessions: reports.summary?.statistics?.totalSessions || 0,
                    totalGPSPoints: reports.summary?.statistics?.totalPoints || 0,
                    healthScore: reports.summary?.healthScore || 0
                }
            };
            
            await this.saveReport('00_MASTER_INDEX.json', masterIndex);
            
            const indexMarkdown = `# Live Data Reports - Master Index
**Generated:** ${masterIndex.timestamp}

## 📊 Quick Stats
- **Users:** ${masterIndex.summary.totalUsers}
- **Sessions:** ${masterIndex.summary.totalSessions}  
- **GPS Points:** ${masterIndex.summary.totalGPSPoints}
- **Health Score:** ${masterIndex.summary.healthScore}/100

## 📁 Generated Reports
${masterIndex.reportsGenerated.map(report => `- ✅ ${report.charAt(0).toUpperCase() + report.slice(1)} Report`).join('\n')}

## 📂 Output Directory
\`${masterIndex.outputDirectory}\`

---
*All reports are available in JSON, CSV, and Markdown formats*
`;
            
            await this.saveReport('00_MASTER_INDEX.md', indexMarkdown, 'markdown');
            
            console.log('\n🎉 Report generation completed!');
            console.log(`📂 Reports saved to: ${this.outputDir}`);
            console.log(`📊 Generated ${masterIndex.reportsGenerated.length} report types`);
            
        } catch (error) {
            console.error('❌ Report generation failed:', error.message);
            process.exit(1);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const reportType = args[0] || 'all';
    
    const reporter = new LiveDataReporter();
    
    switch (reportType.toLowerCase()) {
        case 'summary':
            await reporter.ensureOutputDir();
            await reporter.generateSystemSummary();
            break;
        case 'sessions':
            await reporter.ensureOutputDir();
            await reporter.generateSessionAnalysis();
            break;
        case 'gps':
        case 'gps-analysis':
            await reporter.ensureOutputDir();
            await reporter.generateGPSAnalysis();
            break;
        case 'journeys':
        case 'journey-maps':
            await reporter.ensureOutputDir();
            await reporter.generateJourneyMaps();
            break;
        case 'health':
        case 'system-health':
            await reporter.ensureOutputDir();
            await reporter.generateSystemHealthReport();
            break;
        case 'all':
        default:
            await reporter.generateAllReports();
            break;
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Application error:', error.message);
        process.exit(1);
    });
}

module.exports = LiveDataReporter; 