#!/usr/bin/env node

// GPS Checkpoint Management System
const fs = require('fs');
const { sessionToFriendlyName } = require('./session_translator.cjs');

const CHECKPOINTS_FILE = 'gps_checkpoints.json';

class CheckpointManager {
    constructor() {
        this.checkpoints = this.loadCheckpoints();
    }

    loadCheckpoints() {
        try {
            if (fs.existsSync(CHECKPOINTS_FILE)) {
                return JSON.parse(fs.readFileSync(CHECKPOINTS_FILE, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading checkpoints:', error.message);
        }
        return {
            checkpoints: [],
            metadata: {
                created: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }
        };
    }

    saveCheckpoints() {
        this.checkpoints.metadata.lastUpdated = new Date().toISOString();
        fs.writeFileSync(CHECKPOINTS_FILE, JSON.stringify(this.checkpoints, null, 2));
    }

    createCheckpoint(name, description = '', timestamp = null) {
        const now = timestamp || Date.now();
        const checkpoint = {
            id: `checkpoint_${now}`,
            name: name,
            description: description,
            timestamp: now,
            dateTime: new Date(now).toLocaleString(),
            isoTime: new Date(now).toISOString(),
            coordinates: null, // Will be filled when GPS data is available
            sessionId: null,
            friendlySessionName: null
        };

        this.checkpoints.checkpoints.push(checkpoint);
        this.saveCheckpoints();

        console.log('📍 Checkpoint Created!');
        console.log('=====================');
        console.log(`🏷️  Name: ${name}`);
        console.log(`📝 Description: ${description || 'None'}`);
        console.log(`⏰ Time: ${checkpoint.dateTime}`);
        console.log(`🆔 ID: ${checkpoint.id}`);
        console.log('');

        return checkpoint;
    }

    createCheckpointFromTime(name, timeString, description = '') {
        let targetTime;
        
        // Parse different time formats
        if (timeString.includes(':')) {
            // Format like "2:00 PM" or "14:00"
            const today = new Date();
            const [time, period] = timeString.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            
            if (period && period.toLowerCase() === 'pm' && hours !== 12) {
                hours += 12;
            } else if (period && period.toLowerCase() === 'am' && hours === 12) {
                hours = 0;
            }
            
            targetTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hours, minutes || 0);
        } else {
            // Try to parse as ISO string or other format
            targetTime = new Date(timeString);
        }

        if (isNaN(targetTime.getTime())) {
            throw new Error(`Invalid time format: ${timeString}`);
        }

        return this.createCheckpoint(name, description, targetTime.getTime());
    }

    listCheckpoints() {
        if (this.checkpoints.checkpoints.length === 0) {
            console.log('📍 No checkpoints created yet');
            return;
        }

        console.log('📍 GPS Checkpoints');
        console.log('==================');
        this.checkpoints.checkpoints.forEach((checkpoint, index) => {
            console.log(`${index + 1}. 🏷️  ${checkpoint.name}`);
            console.log(`   ⏰ ${checkpoint.dateTime}`);
            if (checkpoint.description) {
                console.log(`   📝 ${checkpoint.description}`);
            }
            if (checkpoint.coordinates) {
                console.log(`   🌍 ${checkpoint.coordinates.lat.toFixed(6)}, ${checkpoint.coordinates.lon.toFixed(6)}`);
            }
            if (checkpoint.friendlySessionName) {
                console.log(`   🎯 Session: ${checkpoint.friendlySessionName}`);
            }
            console.log('');
        });
    }

    async enrichCheckpointsWithGPS() {
        console.log('🔍 Enriching checkpoints with GPS data...');
        
        // Load latest GPS data
        let gpsData;
        try {
            gpsData = JSON.parse(fs.readFileSync('all_gps_data.json', 'utf8'));
        } catch (error) {
            console.log('❌ No GPS data file found. Run collect_all_gps.cjs first.');
            return;
        }

        let updated = 0;
        
        this.checkpoints.checkpoints.forEach(checkpoint => {
            if (checkpoint.coordinates) return; // Already has GPS data

            // Find closest GPS point to checkpoint time
            let closestPoint = null;
            let closestTimeDiff = Infinity;

            gpsData.sessions.forEach(session => {
                session.points.forEach(point => {
                    const pointTime = point.timestamp;
                    const timeDiff = Math.abs(pointTime - checkpoint.timestamp);
                    
                    if (timeDiff < closestTimeDiff) {
                        closestTimeDiff = timeDiff;
                        closestPoint = {
                            lat: point.lat,
                            lon: point.lon,
                            sessionId: session.sessionId,
                            friendlySessionName: session.friendlyName,
                            timeDiff: timeDiff
                        };
                    }
                });
            });

            if (closestPoint && closestTimeDiff < 5 * 60 * 1000) { // Within 5 minutes
                checkpoint.coordinates = {
                    lat: closestPoint.lat,
                    lon: closestPoint.lon
                };
                checkpoint.sessionId = closestPoint.sessionId;
                checkpoint.friendlySessionName = closestPoint.friendlySessionName;
                checkpoint.timeDifferenceSeconds = Math.round(closestTimeDiff / 1000);
                updated++;
                
                console.log(`✅ ${checkpoint.name} → ${closestPoint.lat.toFixed(6)}, ${closestPoint.lon.toFixed(6)} (${closestPoint.friendlySessionName})`);
            }
        });

        if (updated > 0) {
            this.saveCheckpoints();
            console.log(`🎯 Updated ${updated} checkpoints with GPS coordinates`);
        } else {
            console.log('📍 No checkpoints could be matched with GPS data');
        }
    }

    generateMapBetweenCheckpoints(startCheckpoint, endCheckpoint, outputFile = 'checkpoint_map.svg') {
        console.log(`🗺️  Generating map from "${startCheckpoint}" to "${endCheckpoint}"`);
        
        const start = this.checkpoints.checkpoints.find(cp => cp.name === startCheckpoint || cp.id === startCheckpoint);
        const end = this.checkpoints.checkpoints.find(cp => cp.name === endCheckpoint || cp.id === endCheckpoint);
        
        if (!start || !end) {
            console.log('❌ One or both checkpoints not found');
            return;
        }

        if (!start.coordinates || !end.coordinates) {
            console.log('❌ Checkpoints need GPS coordinates. Run enrichCheckpointsWithGPS() first.');
            return;
        }

        // Load GPS data and filter points between checkpoints
        let gpsData;
        try {
            gpsData = JSON.parse(fs.readFileSync('all_gps_data.json', 'utf8'));
        } catch (error) {
            console.log('❌ No GPS data file found.');
            return;
        }

        const startTime = start.timestamp;
        const endTime = end.timestamp;
        
        const filteredPoints = [];
        gpsData.sessions.forEach(session => {
            session.points.forEach(point => {
                if (point.timestamp >= startTime && point.timestamp <= endTime) {
                    filteredPoints.push({
                        lat: point.lat,
                        lon: point.lon,
                        timestamp: point.timestamp,
                        sessionName: session.friendlyName
                    });
                }
            });
        });

        console.log(`📊 Found ${filteredPoints.length} GPS points between checkpoints`);
        
        // Generate simple map
        this.generateSimpleMap(filteredPoints, [start, end], outputFile);
    }

    generateSimpleMap(points, checkpoints, outputFile) {
        if (points.length === 0) {
            console.log('❌ No points to map');
            return;
        }

        // Calculate bounds
        const lats = points.map(p => p.lat);
        const lons = points.map(p => p.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);

        // Add padding
        const latPadding = (maxLat - minLat) * 0.1 || 0.001;
        const lonPadding = (maxLon - minLon) * 0.1 || 0.001;

        const bounds = {
            minLat: minLat - latPadding,
            maxLat: maxLat + latPadding,
            minLon: minLon - lonPadding,
            maxLon: maxLon + lonPadding
        };

        // SVG dimensions
        const width = 800;
        const height = 600;
        const padding = 50;

        // Coordinate transformation
        const xScale = (lon) => padding + ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (width - 2 * padding);
        const yScale = (lat) => height - padding - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - 2 * padding);

        // Generate SVG
        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .background { fill: #1a1a1a; }
    .grid-line { stroke: #333; stroke-width: 0.5; }
    .path { stroke: #4a9eff; stroke-width: 2; fill: none; }
    .checkpoint { fill: #ff6b6b; stroke: #fff; stroke-width: 2; }
    .point { fill: #4a9eff; opacity: 0.7; }
    .label { fill: #fff; font-family: Arial; font-size: 12px; }
    .title { fill: #fff; font-family: Arial; font-size: 16px; font-weight: bold; }
  </style>
  
  <!-- Background -->
  <rect class="background" width="${width}" height="${height}"/>
  
  <!-- Grid -->`;

        // Add grid lines
        for (let i = 0; i <= 10; i++) {
            const x = padding + (i * (width - 2 * padding) / 10);
            const y = padding + (i * (height - 2 * padding) / 10);
            svg += `\n  <line class="grid-line" x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}"/>`;
            svg += `\n  <line class="grid-line" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}"/>`;
        }

        // Add path
        if (points.length > 1) {
            const pathData = points.map((point, index) => {
                const x = xScale(point.lon);
                const y = yScale(point.lat);
                return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ');
            
            svg += `\n  <path class="path" d="${pathData}"/>`;
        }

        // Add GPS points
        points.forEach(point => {
            const x = xScale(point.lon);
            const y = yScale(point.lat);
            svg += `\n  <circle class="point" cx="${x}" cy="${y}" r="2"/>`;
        });

        // Add checkpoints
        checkpoints.forEach((checkpoint, index) => {
            if (checkpoint.coordinates) {
                const x = xScale(checkpoint.coordinates.lon);
                const y = yScale(checkpoint.coordinates.lat);
                svg += `\n  <circle class="checkpoint" cx="${x}" cy="${y}" r="6"/>`;
                svg += `\n  <text class="label" x="${x + 10}" y="${y - 10}">${checkpoint.name}</text>`;
            }
        });

        // Add title and labels
        svg += `\n  <text class="title" x="20" y="30">GPS Travel Map</text>`;
        svg += `\n  <text class="label" x="20" y="50">${points.length} GPS points</text>`;
        if (checkpoints.length > 0) {
            svg += `\n  <text class="label" x="20" y="70">${checkpoints[0].name} → ${checkpoints[checkpoints.length - 1].name}</text>`;
        }

        svg += '\n</svg>';

        // Save file
        fs.writeFileSync(outputFile, svg);
        console.log(`✅ Map saved to: ${outputFile}`);
        console.log(`🌍 Bounds: ${bounds.minLat.toFixed(6)}, ${bounds.minLon.toFixed(6)} to ${bounds.maxLat.toFixed(6)}, ${bounds.maxLon.toFixed(6)}`);
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const manager = new CheckpointManager();

    if (args.length === 0) {
        console.log('📍 GPS Checkpoint Manager');
        console.log('=========================');
        console.log('');
        console.log('Commands:');
        console.log('  create <name> [description]     - Create checkpoint right now');
        console.log('  create-at <name> <time> [desc]  - Create checkpoint at specific time');
        console.log('  list                            - List all checkpoints');
        console.log('  enrich                          - Add GPS coordinates to checkpoints');
        console.log('  map <start> <end> [output.svg]  - Generate map between checkpoints');
        console.log('');
        console.log('Examples:');
        console.log('  node checkpoint_system.cjs create "Home Base" "Starting point"');
        console.log('  node checkpoint_system.cjs create-at "Lunch Stop" "2:00 PM"');
        console.log('  node checkpoint_system.cjs map "Home Base" "Lunch Stop"');
        process.exit(0);
    }

    const command = args[0];

    switch (command) {
        case 'create':
            const name = args[1];
            const description = args.slice(2).join(' ');
            if (!name) {
                console.log('❌ Please provide a checkpoint name');
                process.exit(1);
            }
            manager.createCheckpoint(name, description);
            break;

        case 'create-at':
            const nameAt = args[1];
            const timeString = args[2];
            const descAt = args.slice(3).join(' ');
            if (!nameAt || !timeString) {
                console.log('❌ Please provide name and time');
                process.exit(1);
            }
            try {
                manager.createCheckpointFromTime(nameAt, timeString, descAt);
            } catch (error) {
                console.log('❌ Error:', error.message);
                process.exit(1);
            }
            break;

        case 'list':
            manager.listCheckpoints();
            break;

        case 'enrich':
            manager.enrichCheckpointsWithGPS().then(() => {
                console.log('✅ Checkpoint enrichment complete');
            });
            break;

        case 'map':
            const startPoint = args[1];
            const endPoint = args[2];
            const outputFile = args[3] || 'checkpoint_map.svg';
            if (!startPoint || !endPoint) {
                console.log('❌ Please provide start and end checkpoint names');
                process.exit(1);
            }
            manager.generateMapBetweenCheckpoints(startPoint, endPoint, outputFile);
            break;

        default:
            console.log('❌ Unknown command:', command);
            process.exit(1);
    }
}

module.exports = CheckpointManager; 