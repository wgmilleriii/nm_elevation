#!/usr/bin/env node

const fs = require('fs');
const GPSDataCollector = require('./collect_gps_data.cjs');

class GPSSVGRenderer {
    constructor(dataFile = 'gps_session_data.json') {
        this.dataFile = dataFile;
        this.data = null;
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(this.dataFile)) {
                const rawData = fs.readFileSync(this.dataFile, 'utf8');
                this.data = JSON.parse(rawData);
                console.log(`📂 Loaded GPS data: ${this.data.totalPoints} points from ${Object.keys(this.data.users).length} users`);
            } else {
                console.log('❌ No data file found. Run data collection first.');
                process.exit(1);
            }
        } catch (error) {
            console.error('❌ Error loading data:', error.message);
            process.exit(1);
        }
    }

    getAllPoints() {
        const allPoints = [];
        
        Object.values(this.data.users).forEach(user => {
            Object.values(user.sessions).forEach(session => {
                if (session.points) {
                    session.points.forEach(point => {
                        allPoints.push({
                            ...point,
                            userId: user.deviceId || 'unknown'
                        });
                    });
                }
            });
        });

        return allPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    calculateBounds(points) {
        if (!points || points.length === 0) return null;

        let minLat = points[0].lat;
        let maxLat = points[0].lat;
        let minLon = points[0].lon;
        let maxLon = points[0].lon;

        points.forEach(point => {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
        });

        // Add 10% padding to bounds
        const latPadding = (maxLat - minLat) * 0.1 || 0.001;
        const lonPadding = (maxLon - minLon) * 0.1 || 0.001;

        return {
            minLat: minLat - latPadding,
            maxLat: maxLat + latPadding,
            minLon: minLon - lonPadding,
            maxLon: maxLon + lonPadding
        };
    }

    createCoordinateTransformer(bounds, width, height, padding = 50) {
        const { minLat, maxLat, minLon, maxLon } = bounds;
        const effectiveWidth = width - (2 * padding);
        const effectiveHeight = height - (2 * padding);
        
        return {
            lonToX: (lon) => padding + ((lon - minLon) / (maxLon - minLon)) * effectiveWidth,
            latToY: (lat) => height - (padding + ((lat - minLat) / (maxLat - minLat)) * effectiveHeight),
            pointToSVG: (point) => ({
                x: padding + ((point.lon - minLon) / (maxLon - minLon)) * effectiveWidth,
                y: height - (padding + ((point.lat - minLat) / (maxLat - minLat)) * effectiveHeight)
            })
        };
    }

    generateTravelMapSVG(points, options = {}) {
        const {
            width = 800,
            height = 600,
            padding = 50,
            title = 'GPS Travel Map',
            showGrid = true,
            showPoints = true,
            showPath = true,
            colorByUser = true
        } = options;

        if (!points || points.length === 0) {
            return this.generateEmptySVG(width, height, 'No GPS data available');
        }

        const bounds = this.calculateBounds(points);
        const transformer = this.createCoordinateTransformer(bounds, width, height, padding);

        let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <style>
            .title { font: bold 16px sans-serif; fill: #333; text-anchor: middle; }
            .grid-line { stroke: #e0e0e0; stroke-width: 0.5; }
            .bounds-rect { fill: none; stroke: #ccc; stroke-width: 1; stroke-dasharray: 5,5; }
            .travel-path { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
            .travel-point { stroke: #fff; stroke-width: 1; }
            .start-point { fill: #4CAF50; r: 6; }
            .end-point { fill: #F44336; r: 6; }
            .coord-label { font: 10px monospace; fill: #666; }
            .legend { font: 12px sans-serif; fill: #333; }
            .stats-text { font: 11px monospace; fill: #555; }
        </style>
    </defs>
    
    <!-- Background -->
    <rect width="${width}" height="${height}" fill="#fafafa"/>
    
    <!-- Title -->
    <text x="${width/2}" y="30" class="title">${title}</text>`;

        // Grid
        if (showGrid) {
            svg += this.generateGrid(width, height, padding);
        }

        // Bounds rectangle
        svg += `
    <!-- Bounds -->
    <rect x="${padding}" y="${padding}" width="${width - 2*padding}" height="${height - 2*padding}" class="bounds-rect"/>`;

        // Group points by user for different colors
        const pointsByUser = {};
        points.forEach(point => {
            const userId = point.userId || 'unknown';
            if (!pointsByUser[userId]) {
                pointsByUser[userId] = [];
            }
            pointsByUser[userId].push(point);
        });

        const colors = ['#2196F3', '#FF9800', '#9C27B0', '#4CAF50', '#F44336', '#00BCD4', '#FFEB3B'];
        let colorIndex = 0;

        // Draw paths and points for each user
        Object.entries(pointsByUser).forEach(([userId, userPoints]) => {
            const color = colorByUser ? colors[colorIndex % colors.length] : '#2196F3';
            colorIndex++;

            if (showPath && userPoints.length > 1) {
                svg += this.generatePath(userPoints, transformer, color);
            }

            if (showPoints) {
                svg += this.generatePoints(userPoints, transformer, color);
            }
        });

        // Coordinate labels
        svg += this.generateCoordinateLabels(bounds, width, height, padding);

        // Statistics
        svg += this.generateStatistics(points, width, height);

        // Legend if multiple users
        if (colorByUser && Object.keys(pointsByUser).length > 1) {
            svg += this.generateLegend(pointsByUser, colors, width, height);
        }

        svg += `
</svg>`;

        return svg;
    }

    generateGrid(width, height, padding) {
        let grid = `
    <!-- Grid -->
    <g class="grid">`;

        const gridLines = 10;
        
        // Vertical lines
        for (let i = 0; i <= gridLines; i++) {
            const x = padding + (i * (width - 2 * padding) / gridLines);
            grid += `
        <line x1="${x}" y1="${padding}" x2="${x}" y2="${height - padding}" class="grid-line"/>`;
        }

        // Horizontal lines
        for (let i = 0; i <= gridLines; i++) {
            const y = padding + (i * (height - 2 * padding) / gridLines);
            grid += `
        <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="grid-line"/>`;
        }

        grid += `
    </g>`;
        return grid;
    }

    generatePath(points, transformer, color) {
        if (points.length < 2) return '';

        const pathData = points.map((point, index) => {
            const { x, y } = transformer.pointToSVG(point);
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(' ');

        return `
    <!-- Travel Path -->
    <path d="${pathData}" class="travel-path" stroke="${color}"/>`;
    }

    generatePoints(points, transformer, color) {
        if (points.length === 0) return '';

        let pointsHTML = `
    <!-- Travel Points -->
    <g class="points">`;

        // Start point
        if (points.length > 0) {
            const start = transformer.pointToSVG(points[0]);
            pointsHTML += `
        <circle cx="${start.x.toFixed(2)}" cy="${start.y.toFixed(2)}" class="travel-point start-point"/>`;
        }

        // End point (if different from start)
        if (points.length > 1) {
            const end = transformer.pointToSVG(points[points.length - 1]);
            pointsHTML += `
        <circle cx="${end.x.toFixed(2)}" cy="${end.y.toFixed(2)}" class="travel-point end-point"/>`;
        }

        // Sample points along the path
        const sampleInterval = Math.max(1, Math.floor(points.length / 20));
        for (let i = sampleInterval; i < points.length - 1; i += sampleInterval) {
            const point = transformer.pointToSVG(points[i]);
            pointsHTML += `
        <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="2" class="travel-point" fill="${color}"/>`;
        }

        pointsHTML += `
    </g>`;
        return pointsHTML;
    }

    generateCoordinateLabels(bounds, width, height, padding) {
        return `
    <!-- Coordinate Labels -->
    <g class="coordinates">
        <text x="${padding}" y="${padding - 5}" class="coord-label">${bounds.maxLat.toFixed(4)}°, ${bounds.minLon.toFixed(4)}°</text>
        <text x="${width - padding}" y="${padding - 5}" class="coord-label" text-anchor="end">${bounds.maxLat.toFixed(4)}°, ${bounds.maxLon.toFixed(4)}°</text>
        <text x="${padding}" y="${height - padding + 15}" class="coord-label">${bounds.minLat.toFixed(4)}°, ${bounds.minLon.toFixed(4)}°</text>
        <text x="${width - padding}" y="${height - padding + 15}" class="coord-label" text-anchor="end">${bounds.minLat.toFixed(4)}°, ${bounds.maxLon.toFixed(4)}°</text>
    </g>`;
    }

    generateStatistics(points, width, height) {
        const stats = this.calculateTravelStats(points);
        
        return `
    <!-- Statistics -->
    <g class="statistics">
        <text x="10" y="${height - 60}" class="stats-text">Points: ${stats.totalPoints}</text>
        <text x="10" y="${height - 45}" class="stats-text">Distance: ${stats.totalDistance.toFixed(2)} km</text>
        <text x="10" y="${height - 30}" class="stats-text">Max Speed: ${stats.maxSpeed.toFixed(1)} km/h</text>
        <text x="10" y="${height - 15}" class="stats-text">Duration: ${stats.sessionTime} min</text>
    </g>`;
    }

    generateLegend(pointsByUser, colors, width, height) {
        let legend = `
    <!-- Legend -->
    <g class="legend">`;

        let yOffset = 50;
        Object.keys(pointsByUser).forEach((userId, index) => {
            const color = colors[index % colors.length];
            const displayId = userId.length > 12 ? userId.substring(0, 12) + '...' : userId;
            
            legend += `
        <rect x="${width - 150}" y="${yOffset}" width="12" height="12" fill="${color}"/>
        <text x="${width - 130}" y="${yOffset + 9}">${displayId}</text>`;
            yOffset += 20;
        });

        legend += `
    </g>`;
        return legend;
    }

    calculateTravelStats(points) {
        if (!points || points.length === 0) {
            return {
                totalPoints: 0,
                totalDistance: 0,
                maxSpeed: 0,
                sessionTime: 0
            };
        }

        let totalDistance = 0;
        let maxSpeed = 0;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            
            const distance = this.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
            totalDistance += distance;

            if (curr.speed && curr.speed > maxSpeed) {
                maxSpeed = curr.speed;
            }
        }

        const startTime = new Date(points[0].timestamp);
        const endTime = new Date(points[points.length - 1].timestamp);
        const sessionTime = Math.round((endTime - startTime) / (1000 * 60));

        return {
            totalPoints: points.length,
            totalDistance,
            maxSpeed,
            sessionTime
        };
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    generateEmptySVG(width, height, message) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#fafafa"/>
    <text x="${width/2}" y="${height/2}" text-anchor="middle" font="16px sans-serif" fill="#666">${message}</text>
</svg>`;
    }

    renderToFile(filename = 'gps_travel_map.svg', options = {}) {
        const points = this.getAllPoints();
        const svg = this.generateTravelMapSVG(points, options);
        
        fs.writeFileSync(filename, svg);
        console.log(`✅ SVG rendered to: ${filename}`);
        console.log(`📊 Rendered ${points.length} GPS points`);
        
        return filename;
    }

    renderUserToFile(userId, filename, options = {}) {
        const collector = new GPSDataCollector();
        const userPoints = collector.getUserPoints(userId);
        
        if (userPoints.length === 0) {
            console.log(`❌ No points found for user: ${userId}`);
            return null;
        }

        const svg = this.generateTravelMapSVG(userPoints, {
            ...options,
            title: `GPS Travel Map - User ${userId.substring(0, 12)}...`,
            colorByUser: false
        });
        
        fs.writeFileSync(filename, svg);
        console.log(`✅ User SVG rendered to: ${filename}`);
        console.log(`📊 Rendered ${userPoints.length} GPS points for user`);
        
        return filename;
    }
}

// CLI functionality
if (require.main === module) {
    const renderer = new GPSSVGRenderer();
    
    const command = process.argv[2];
    const arg1 = process.argv[3];
    const arg2 = process.argv[4];
    
    switch (command) {
        case 'render':
            const filename = arg1 || 'gps_travel_map.svg';
            renderer.renderToFile(filename, {
                width: 1200,
                height: 800,
                title: 'GPS Travel Map - All Users'
            });
            break;
            
        case 'user':
            if (!arg1) {
                console.log('❌ Please specify a user ID');
                process.exit(1);
            }
            const userFilename = arg2 || `gps_user_${arg1.substring(0, 8)}.svg`;
            renderer.renderUserToFile(arg1, userFilename);
            break;
            
        case 'simple':
            const simpleFilename = arg1 || 'gps_simple.svg';
            renderer.renderToFile(simpleFilename, {
                width: 800,
                height: 600,
                showGrid: false,
                colorByUser: false
            });
            break;
            
        default:
            console.log('🎨 GPS SVG Renderer');
            console.log('');
            console.log('Usage:');
            console.log('  node render_gps_svg.js render [filename]     - Render all GPS data to SVG');
            console.log('  node render_gps_svg.js user <userId> [file]  - Render specific user data');
            console.log('  node render_gps_svg.js simple [filename]     - Render simple version');
            console.log('');
            console.log('Examples:');
            console.log('  node render_gps_svg.js render my_travels.svg');
            console.log('  node render_gps_svg.js user user_abc123 user_travel.svg');
    }
}

module.exports = GPSSVGRenderer; 