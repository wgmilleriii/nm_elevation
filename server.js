import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { spawn } from 'child_process';
import sqlite3 from 'sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.NODE_ENV === 'test' ? 3001 : 3000;

// Basic security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 100; // requests
const RATE_WINDOW = 60 * 1000; // 1 minute in milliseconds

app.use((req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const userRequests = requestCounts.get(ip) || [];
    
    // Remove old requests outside the current window
    const recentRequests = userRequests.filter(time => time > now - RATE_WINDOW);
    
    if (recentRequests.length >= RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests, please try again later' });
    }
    
    recentRequests.push(now);
    requestCounts.set(ip, recentRequests);
    next();
});

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Initialize mother.db connection
const db = new Database('mother.db', { fileMustExist: true });

// Logging endpoint
app.post('/api/log', (req, res) => {
    const { timestamp, logger, level, message, data, error } = req.body;
    const logFile = path.join(logsDir, `${logger.toLowerCase()}.log`);
    
    let logEntry = `[${timestamp}] ${level === 'error' ? 'ERROR: ' : ''}${message}\n`;
    if (data) {
        logEntry += JSON.stringify(data, null, 2) + '\n';
    }
    if (error) {
        logEntry += error + '\n';
    }
    
    try {
        fs.appendFileSync(logFile, logEntry + '\n');
        res.sendStatus(200);
    } catch (err) {
        console.error('Error writing to log file:', err);
        res.status(500).json({ error: 'Failed to write log entry' });
    }
});

app.get('/api/elevation-data', async (req, res) => {
    try {
        console.log('Received elevation-data request:', {
            query: req.query,
            headers: req.headers
        });

        const { bounds, offset = 0 } = req.query;
        if (!bounds) {
            console.warn('Missing bounds parameter');
            return res.status(400).json({ error: 'Bounds parameter is required' });
        }

        const [south, west, north, east] = bounds.split(',').map(Number);
        if (bounds.split(',').length !== 4 || [south, west, north, east].some(isNaN)) {
            console.warn('Invalid bounds format:', bounds);
            return res.status(400).json({ error: 'Invalid bounds format. Expected: south,west,north,east' });
        }
        
        console.log('Processing elevation data request for bounds:', { south, west, north, east });
        
        // Get points for the requested bounds
        console.log('Querying points from mother.db...');
        const points = db.prepare(`
            SELECT latitude, longitude, elevation
            FROM elevation_points
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
            ORDER BY latitude, longitude
            LIMIT 1000 OFFSET ?
        `).all(south, north, west, east, parseInt(offset) || 0);
        
        // Get statistics
        console.log('Calculating statistics...');
        const stats = db.prepare(`
            SELECT 
                MIN(elevation) as min_elevation,
                MAX(elevation) as max_elevation,
                AVG(elevation) as avg_elevation,
                COUNT(*) as total_count
            FROM elevation_points
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
        `).get(south, north, west, east);
        
        console.log(`Found ${points.length} points in bounds. Stats:`, stats);
        
        const response = {
            success: true,
            points,
            stats: {
                min_elevation: stats.min_elevation,
                max_elevation: stats.max_elevation,
                avg_elevation: stats.avg_elevation,
                point_count: points.length,
                total_points: stats.total_count,
                hasMore: points.length === 1000,
                chunkSize: 1000
            }
        };
        
        console.log('Sending response:', response);
        res.json(response);
        
    } catch (error) {
        console.error('Error processing elevation data request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const stats = db.prepare(`
            SELECT 
                MIN(elevation) as min_elevation,
                MAX(elevation) as max_elevation,
                AVG(elevation) as avg_elevation,
                COUNT(*) as total_points
            FROM elevation_points
        `).get();
        
        res.json({
            success: true,
            ...stats
        });
    } catch (error) {
        console.error('Error getting database stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Close database connection on exit
process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 