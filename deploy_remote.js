#!/usr/bin/env node

import { ElevationService } from './elevation_service.js';
import { createServer } from 'http';
import fs from 'fs/promises';
import path from 'path';

// Configuration
const config = {
    remoteServerUrl: process.env.REMOTE_SERVER_URL || 'https://your-domain.com',
    localPort: process.env.LOCAL_PORT || 8020,
    logLevel: process.env.LOG_LEVEL || 'info'
};

console.log('=== Remote Deployment Configuration ===');
console.log(`Remote Server: ${config.remoteServerUrl}`);
console.log(`Local Port: ${config.localPort}`);
console.log(`Log Level: ${config.logLevel}`);
console.log('=====================================\n');

// Initialize elevation service
const elevationService = new ElevationService(config.remoteServerUrl);

// Create local HTTP server for monitoring and control
const server = createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${config.localPort}`);
    
    try {
        switch (url.pathname) {
            case '/':
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(await getStatusPage());
                break;

            case '/api/status':
                const stats = await elevationService.getStats();
                res.writeHead(200);
                res.end(JSON.stringify({
                    status: 'running',
                    remoteServer: config.remoteServerUrl,
                    stats,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                }));
                break;

            case '/api/logs':
                const logs = await getLogs();
                res.writeHead(200);
                res.end(JSON.stringify({ logs }));
                break;

            case '/api/config':
                res.writeHead(200);
                res.end(JSON.stringify(config));
                break;

            default:
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Not found' }));
                break;
        }
    } catch (error) {
        console.error('Server error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
});

async function getStatusPage() {
    const stats = await elevationService.getStats();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Elevation Service - Remote Deployment</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #2c3e50; color: white; padding: 15px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0; }
        .status { display: flex; gap: 20px; margin: 20px 0; }
        .stat-box { background: #ecf0f1; padding: 15px; border-radius: 5px; flex: 1; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .stat-label { color: #7f8c8d; font-size: 14px; }
        .config { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .log-box { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px; max-height: 300px; overflow-y: auto; }
        .refresh-btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        .refresh-btn:hover { background: #2980b9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌍 Elevation Service - Remote Deployment</h1>
            <p>Processing GPS points and updating elevation data</p>
        </div>

        <div class="status">
            <div class="stat-box">
                <div class="stat-number">${stats.pending || 0}</div>
                <div class="stat-label">Pending</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${stats.completed || 0}</div>
                <div class="stat-label">Completed</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${stats.failed || 0}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">${stats.total || 0}</div>
                <div class="stat-label">Total</div>
            </div>
        </div>

        <div class="config">
            <h3>Configuration</h3>
            <p><strong>Remote Server:</strong> ${config.remoteServerUrl}</p>
            <p><strong>Local Port:</strong> ${config.localPort}</p>
            <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
            <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Status</button>

        <h3>System Information</h3>
        <div class="log-box">
            <div>Node.js Version: ${process.version}</div>
            <div>Platform: ${process.platform}</div>
            <div>Architecture: ${process.arch}</div>
            <div>Memory Usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB</div>
            <div>Started: ${new Date(Date.now() - process.uptime() * 1000).toLocaleString()}</div>
        </div>
    </div>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
}

async function getLogs() {
    try {
        const logFiles = await fs.readdir('./data/logs');
        const logs = [];
        
        for (const file of logFiles.slice(-5)) { // Get last 5 log files
            try {
                const content = await fs.readFile(`./data/logs/${file}`, 'utf8');
                logs.push({
                    file,
                    content: content.split('\n').slice(-20).join('\n') // Last 20 lines
                });
            } catch (error) {
                console.error(`Error reading log file ${file}:`, error);
            }
        }
        
        return logs;
    } catch (error) {
        return [];
    }
}

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
});

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the services
async function start() {
    try {
        console.log('🚀 Starting Elevation Service...');
        
        // Start elevation service
        await elevationService.start();
        
        // Start HTTP server
        server.listen(config.localPort, () => {
            console.log(`✅ Local monitoring server running at http://localhost:${config.localPort}`);
            console.log(`📊 Status page: http://localhost:${config.localPort}`);
            console.log(`🔗 Remote server: ${config.remoteServerUrl}`);
            console.log('\n📡 Service is now processing GPS points from remote server...\n');
        });
        
    } catch (error) {
        console.error('❌ Failed to start services:', error);
        process.exit(1);
    }
}

start(); 