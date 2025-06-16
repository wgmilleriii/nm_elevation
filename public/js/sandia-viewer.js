import {
    VIEWPOINT_LAT,
    VIEWPOINT_LON,
    VIEWPOINT_HEADING,
    NUM_RIDGES,
    DISTANCE_RANGE,
    ANGLE_RANGE,
    MIN_OBSERVER_HEIGHT,
    MAX_OBSERVER_HEIGHT,
    DEFAULT_OBSERVER_HEIGHT,
    RIDGE_COLORS
} from './config.js';

// Constants
const VIEWPOINT = {
    lat: VIEWPOINT_LAT,
    lon: VIEWPOINT_LON,
    heading: VIEWPOINT_HEADING
};

async function updateStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('total-points').textContent = data.total_points.toLocaleString();
            document.getElementById('last-updated').textContent = new Date(data.last_updated).toLocaleString();
            if (data.sources && data.sources.length > 0) {
                document.getElementById('data-source').textContent = data.sources.map(s => `${s.source} (${s.count})`).join(', ');
            }
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

// Initialize stats updates
document.addEventListener('DOMContentLoaded', () => {
    updateStats();
    // Update stats every minute
    setInterval(updateStats, 60000);
});

// Add this CSS to handle highlighting
const style = document.createElement('style');
style.textContent = `
    .highlight-point {
        stroke: #ff4081;
        stroke-width: 2px;
        stroke-opacity: 1;
        animation: pulse 1s ease-in-out infinite;
    }
    .highlight-point-3d {
        fill: #ff4081;
        r: 5;
        animation: pulse 1s ease-in-out infinite;
    }
    .tooltip-text {
        fill: white;
        font-size: 12px;
        pointer-events: none;
    }
    .tooltip-bg {
        fill: rgba(0, 0, 0, 0.8);
        rx: 4;
        ry: 4;
        pointer-events: none;
    }
    @keyframes pulse {
        0% { stroke-width: 2px; }
        50% { stroke-width: 4px; }
        100% { stroke-width: 2px; }
    }
`;
document.head.appendChild(style);

class SandiaViewer {
    constructor() {
        // Initialize SVG views
        this.elevationSvg = document.getElementById('elevation-svg');
        this.wireframeCanvas = document.getElementById('wireframe-canvas');
        this.elevationMapSvg = document.getElementById('elevation-map-svg');
        this.ctx = this.wireframeCanvas.getContext('2d');

        // Initialize data ranges
        this.elevationRange = {
            min: 1500,  // Default min elevation
            max: 3000   // Default max elevation
        };

        // Initialize controls
        this.observerHeight = document.getElementById('observer-height');
        this.toggleRidges = document.getElementById('toggle-ridges');
        this.zScale = document.getElementById('z-scale');
        this.pointSize = document.getElementById('point-size');
        this.reloadButton = document.getElementById('reload-data');
        this.exportButton = document.getElementById('export-svg');

        // Set control ranges
        this.observerHeight.min = MIN_OBSERVER_HEIGHT;
        this.observerHeight.max = MAX_OBSERVER_HEIGHT;
        this.observerHeight.value = DEFAULT_OBSERVER_HEIGHT;
        document.getElementById('height-value').textContent = `${DEFAULT_OBSERVER_HEIGHT}m`;
        document.getElementById('size-value').textContent = `${this.pointSize.value}px`;

        // Bind event listeners
        this.observerHeight.addEventListener('input', this.updateObserverHeight.bind(this));
        this.toggleRidges.addEventListener('change', this.toggleRidgeLines.bind(this));
        this.zScale.addEventListener('input', this.updateZScale.bind(this));
        this.pointSize.addEventListener('input', () => {
            document.getElementById('size-value').textContent = `${this.pointSize.value}px`;
            this.renderElevationMap();
        });
        this.reloadButton.addEventListener('click', () => {
            this.loadData();
            updateStats();
        });
        this.exportButton.addEventListener('click', this.exportSvg.bind(this));

        // Initialize 3D view interaction
        this.initializeWireframeInteraction();

        // Load initial data
        this.loadData();

        // Add property to track highlighted points
        this.highlightedPoints = new Set();
        this.currentTooltip = null;
    }

    async loadData() {
        try {
            // Fetch data with tighter bounds around the Sandia ridgeline
            // This focuses on the main ridge from Sandia Peak down to the northern end
            const response = await fetch(`/api/elevation-data?bounds=35.18,-106.45,35.25,-106.38&points=100000`);
            if (!response.ok) throw new Error('Failed to fetch elevation data');
            
            const data = await response.json();
            if (!data.points || !data.points.length) {
                throw new Error('No elevation data received');
            }

            console.log('Initial API response:', {
                points: data.points.length,
                source: data.source,
                bounds: data.bounds,
                samplePoint: data.points[0]
            });

            // Calculate elevation range from actual data
            const elevations = data.points.map(p => p.elevation);
            this.elevationRange = {
                min: Math.floor(Math.min(...elevations)),
                max: Math.ceil(Math.max(...elevations))
            };

            console.log('Elevation range:', this.elevationRange);

            // Update total points display
            document.getElementById('total-points').textContent = data.points.length.toLocaleString();
            document.getElementById('data-source').textContent = data.source || 'SRTM30m';
            document.getElementById('last-updated').textContent = new Date().toLocaleString();

            // Filter points to focus on higher elevations
            const medianElevation = elevations.sort((a, b) => a - b)[Math.floor(elevations.length / 2)];
            console.log('Median elevation:', medianElevation);
            
            this.points = data.points.filter(p => p.elevation > medianElevation);
            console.log('Points after median elevation filter:', {
                count: this.points.length,
                medianElevation,
                samplePoint: this.points[0]
            });

            // Update elevation range in legend
            document.getElementById('min-elevation').textContent = `${this.elevationRange.min}m`;
            document.getElementById('max-elevation').textContent = `${this.elevationRange.max}m`;

            // Process and render the data
            this.processData(this.points);
        } catch (error) {
            console.error('Error loading elevation data:', error);
            this.points = [];
            this.showErrorMessage('Failed to load elevation data. Please try again.');
        }
    }

    showErrorMessage(message) {
        const svgs = [this.elevationSvg, this.elevationMapSvg];
        svgs.forEach(svg => {
            // Clear SVG
            while (svg.firstChild) {
                svg.removeChild(svg.firstChild);
            }

            // Add error message
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute('x', '50%');
            text.setAttribute('y', '50%');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'red');
            text.textContent = message;
            svg.appendChild(text);
        });

        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.wireframeCanvas.width, this.wireframeCanvas.height);
            this.ctx.font = '14px Arial';
            this.ctx.fillStyle = 'red';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(message, this.wireframeCanvas.width / 2, this.wireframeCanvas.height / 2);
        }
    }

    processData(points) {
        // Store raw points for elevation map
        this.rawPoints = points;
        console.log('Points at start of processData:', {
            count: points.length,
            samplePoint: points[0]
        });
        
        // Convert points to relative coordinates from viewpoint
        this.points = points.map(point => {
            const dx = this.calculateDistance(VIEWPOINT.lat, VIEWPOINT.lon, point.latitude, point.longitude);
            const bearing = this.calculateBearing(VIEWPOINT.lat, VIEWPOINT.lon, point.latitude, point.longitude);
            // Normalize angle to be between -180 and 180 degrees
            const relativeAngle = ((((bearing - VIEWPOINT_HEADING + 180) % 360) + 360) % 360) - 180;
            
            return {
                x: dx * Math.cos(relativeAngle * Math.PI / 180),
                y: point.elevation,
                z: dx * Math.sin(relativeAngle * Math.PI / 180),
                elevation: point.elevation,
                distance: dx,
                angle: relativeAngle,
                latitude: point.latitude,
                longitude: point.longitude
            };
        });

        // Filter points within view range
        const viewPoints = this.points.filter(p => {
            const inRange = p.distance <= DISTANCE_RANGE && Math.abs(p.angle) <= (ANGLE_RANGE/2);
            if (!inRange) {
                console.log('Point filtered out:', {
                    distance: p.distance,
                    maxDistance: DISTANCE_RANGE,
                    angle: p.angle,
                    maxAngle: ANGLE_RANGE/2,
                    normalizedAngle: ((p.angle + 180) % 360) - 180
                });
            }
            return inRange;
        });
        console.log('Points after view range filter:', {
            count: viewPoints.length,
            DISTANCE_RANGE,
            ANGLE_RANGE,
            samplePoint: viewPoints[0]
        });

        // Generate ridgelines
        this.generateRidgeLines(viewPoints);
        
        // Render all views
        this.render2DView();
        this.render3DView();
        this.renderElevationMap();
    }

    generateRidgeLines(points) {
        // Sort points by distance
        const sortedPoints = [...points].sort((a, b) => a.distance - b.distance);
        
        // Group points into ridges based on distance
        this.ridges = Array(NUM_RIDGES).fill().map(() => []);
        const distanceStep = DISTANCE_RANGE / NUM_RIDGES;
        
        sortedPoints.forEach(point => {
            const ridgeIndex = Math.min(NUM_RIDGES - 1, Math.floor(point.distance / distanceStep));
            this.ridges[ridgeIndex].push(point);
        });

        // For each ridge, calculate visible points (not occluded by closer ridges)
        this.ridges = this.ridges.map((ridge, i) => {
            if (i === 0) return ridge; // First ridge is always visible
            
            const closerPoints = this.ridges.slice(0, i).flat();
            return ridge.filter(point => {
                // Check if point is visible above all closer points
                return !closerPoints.some(closer => 
                    Math.abs(closer.angle - point.angle) < 0.1 && // Similar angle
                    this.calculateApparentHeight(closer) > this.calculateApparentHeight(point) // Closer point appears higher
                );
            });
        });
    }

    calculateApparentHeight(point) {
        const observerHeight = parseFloat(this.observerHeight.value);
        return Math.atan2(point.elevation - observerHeight, point.distance);
    }

    render2DView() {
        // Clear SVG
        while (this.elevationSvg.firstChild) {
            this.elevationSvg.removeChild(this.elevationSvg.firstChild);
        }

        const svgWidth = this.elevationSvg.clientWidth;
        const svgHeight = this.elevationSvg.clientHeight;
        
        // Add sky gradient
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        gradient.setAttribute("id", "skyGradient");
        gradient.setAttribute("x1", "0%");
        gradient.setAttribute("y1", "0%");
        gradient.setAttribute("x2", "0%");
        gradient.setAttribute("y2", "100%");

        const stops = [
            { offset: "0%", color: "#87CEEB" },    // Sky blue at top
            { offset: "60%", color: "#B0E0E6" },   // Lighter blue at horizon
            { offset: "100%", color: "#F0F8FF" }   // Almost white at bottom
        ];

        stops.forEach(stop => {
            const stopEl = document.createElementNS("http://www.w3.org/2000/svg", "stop");
            stopEl.setAttribute("offset", stop.offset);
            stopEl.setAttribute("stop-color", stop.color);
            gradient.appendChild(stopEl);
        });

        defs.appendChild(gradient);
        this.elevationSvg.appendChild(defs);

        // Add sky background
        const sky = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        sky.setAttribute("x", "0");
        sky.setAttribute("y", "0");
        sky.setAttribute("width", svgWidth);
        sky.setAttribute("height", svgHeight);
        sky.setAttribute("fill", "url(#skyGradient)");
        this.elevationSvg.appendChild(sky);

        // Find the highest points at each angle
        const angleStep = 0.5; // Half degree steps for smooth outline
        const anglePoints = {};
        
        this.points.forEach(point => {
            if (Math.abs(point.angle) <= ANGLE_RANGE/2) {
                const discreteAngle = Math.round(point.angle / angleStep) * angleStep;
                if (!anglePoints[discreteAngle] || point.elevation > anglePoints[discreteAngle].elevation) {
                    anglePoints[discreteAngle] = point;
                }
            }
        });

        // Create the mountain silhouette
        const silhouette = document.createElementNS("http://www.w3.org/2000/svg", "path");
        let pathData = "";
        
        // Start from the ground on the left
        pathData = `M 0 ${svgHeight} `;
        
        // Sort angles for consistent left-to-right drawing
        const sortedAngles = Object.keys(anglePoints)
            .map(Number)
            .sort((a, b) => a - b);

        // Draw the mountain outline
        sortedAngles.forEach((angle, i) => {
            const point = anglePoints[angle];
            const x = ((angle + ANGLE_RANGE/2) / ANGLE_RANGE) * svgWidth;
            const y = svgHeight - (this.calculateApparentHeight(point) + Math.PI/4) * svgHeight / (Math.PI/2);
            
            if (i === 0) {
                pathData += `L ${x} ${y} `;
            } else {
                // Use quadratic curves for smoother outline
                const prevAngle = sortedAngles[i-1];
                const prevPoint = anglePoints[prevAngle];
                const prevX = ((prevAngle + ANGLE_RANGE/2) / ANGLE_RANGE) * svgWidth;
                const prevY = svgHeight - (this.calculateApparentHeight(prevPoint) + Math.PI/4) * svgHeight / (Math.PI/2);
                
                const cpX = (prevX + x) / 2;
                pathData += `Q ${cpX} ${prevY} ${x} ${y} `;
            }
        });

        // Complete the path back to ground
        pathData += `L ${svgWidth} ${svgHeight} Z`;

        silhouette.setAttribute('d', pathData);
        silhouette.setAttribute('fill', '#2F4F4F'); // Dark slate gray
        silhouette.setAttribute('stroke', '#000000');
        silhouette.setAttribute('stroke-width', '1');
        
        this.elevationSvg.appendChild(silhouette);

        // Add hover detection areas
        Object.values(anglePoints).forEach(point => {
            const x = ((point.angle + ANGLE_RANGE/2) / ANGLE_RANGE) * svgWidth;
            const y = svgHeight - (this.calculateApparentHeight(point) + Math.PI/4) * svgHeight / (Math.PI/2);
            
            const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            hitArea.setAttribute('cx', x);
            hitArea.setAttribute('cy', y);
            hitArea.setAttribute('r', '5');
            hitArea.setAttribute('fill', 'transparent');
            hitArea.setAttribute('data-point-id', `${point.latitude},${point.longitude}`);
            
            hitArea.addEventListener('mouseover', () => {
                this.highlightPoint(point, 'profile');
            });
            hitArea.addEventListener('mouseout', () => {
                this.clearHighlights();
            });
            
            this.elevationSvg.appendChild(hitArea);
        });
    }

    render3DView() {
        const canvas = this.wireframeCanvas;
        const ctx = this.ctx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Set up pseudo-3D projection
        const zScale = parseFloat(this.zScale.value);
        const d = 1000; // perspective distance
        
        // Draw points
        this.points.forEach(point => {
            const projectedX = width/2 + (point.x / (point.z/zScale + d)) * width/4;
            const projectedY = height/2 - (point.y / (point.z/zScale + d)) * height/4;
            
            ctx.beginPath();
            ctx.arc(projectedX, projectedY, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,0,0,${1 - point.distance/DISTANCE_RANGE})`;
            ctx.fill();
        });

        // Add hit detection for 3D points
        this.wireframeCanvas.addEventListener('mousemove', (e) => {
            const rect = this.wireframeCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Find closest point
            const zScale = parseFloat(this.zScale.value);
            const d = 1000;
            let closestPoint = null;
            let minDistance = 10; // Threshold for hit detection

            this.points.forEach(point => {
                const px = this.wireframeCanvas.width/2 + (point.x / (point.z/zScale + d)) * this.wireframeCanvas.width/4;
                const py = this.wireframeCanvas.height/2 - (point.y / (point.z/zScale + d)) * this.wireframeCanvas.height/4;
                
                const distance = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
                if (distance < minDistance) {
                    closestPoint = point;
                    minDistance = distance;
                }
            });

            if (closestPoint) {
                this.highlightPoint(closestPoint, '3d');
            } else {
                this.clearHighlights();
            }
        });
    }

    getRidgeColor(index) {
        return RIDGE_COLORS[index] || RIDGE_COLORS[RIDGE_COLORS.length - 1];
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) -
                Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        const θ = Math.atan2(y, x);

        return (θ * 180/Math.PI + 360) % 360;
    }

    initializeWireframeInteraction() {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        let rotation = { x: 0, y: 0 };

        this.wireframeCanvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            
            rotation.x += deltaY * 0.01;
            rotation.y += deltaX * 0.01;
            
            lastX = e.clientX;
            lastY = e.clientY;
            
            this.render3DView(rotation);
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    updateObserverHeight() {
        document.getElementById('height-value').textContent = `${this.observerHeight.value}m`;
        this.render2DView();
    }

    toggleRidgeLines() {
        this.render2DView();
    }

    updateZScale() {
        document.getElementById('scale-value').textContent = `${this.zScale.value}x`;
        this.render3DView();
    }

    exportSvg() {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(this.elevationSvg);
        const blob = new Blob([svgString], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sandia-elevation.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getElevationColor(elevation) {
        if (!this.elevationRange || typeof elevation !== 'number') {
            return 'gray'; // Default color if no range or invalid elevation
        }
        const range = this.elevationRange.max - this.elevationRange.min;
        if (range === 0) return 'blue'; // Handle edge case where min equals max
        
        const normalized = (elevation - this.elevationRange.min) / range;
        const hue = 240 - (normalized * 240); // Blue (240) to Red (0)
        return `hsl(${hue}, 100%, 50%)`;
    }

    findCorrespondingProfilePoint(mapPoint) {
        // Find the point in the ridges that matches the lat/lon
        for (let ridge of this.ridges) {
            const point = ridge.find(p => 
                Math.abs(p.latitude - mapPoint.latitude) < 0.0001 && 
                Math.abs(p.longitude - mapPoint.longitude) < 0.0001
            );
            if (point) return point;
        }
        return null;
    }

    createTooltip(x, y, point, parent) {
        // Remove existing tooltip if any
        if (this.currentTooltip) {
            this.currentTooltip.remove();
        }

        // Create tooltip group
        const tooltip = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        // Create tooltip text
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute('class', 'tooltip-text');
        text.setAttribute('x', x);
        text.setAttribute('y', y);
        text.textContent = `Elevation: ${Math.round(point.elevation)}m
Lat: ${point.latitude.toFixed(4)}
Lon: ${point.longitude.toFixed(4)}`;

        // Split text into multiple lines
        const lines = text.textContent.split('\n');
        text.textContent = '';
        lines.forEach((line, i) => {
            const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            tspan.textContent = line;
            tspan.setAttribute('x', x);
            tspan.setAttribute('y', y + (i * 15));
            text.appendChild(tspan);
        });

        // Calculate background size
        const bbox = text.getBBox();
        
        // Create background
        const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        bg.setAttribute('class', 'tooltip-bg');
        bg.setAttribute('x', bbox.x - 5);
        bg.setAttribute('y', bbox.y - 5);
        bg.setAttribute('width', bbox.width + 10);
        bg.setAttribute('height', bbox.height + 10);

        tooltip.appendChild(bg);
        tooltip.appendChild(text);
        parent.appendChild(tooltip);
        
        this.currentTooltip = tooltip;
        return tooltip;
    }

    highlightPoint(point, sourceView = 'map') {
        const pointId = `${point.latitude},${point.longitude}`;
        
        // Highlight in elevation map
        const mapPoint = this.elevationMapSvg.querySelector(`circle[data-point-id="${pointId}"]`);
        if (mapPoint) {
            mapPoint.classList.add('highlight-point');
            if (sourceView !== 'map') {
                this.createTooltip(
                    parseFloat(mapPoint.getAttribute('cx')) + 10,
                    parseFloat(mapPoint.getAttribute('cy')) - 10,
                    point,
                    this.elevationMapSvg
                );
            }
        }

        // Highlight in profile view
        const profilePoint = this.findCorrespondingProfilePoint(point);
        if (profilePoint) {
            const x = ((profilePoint.angle + ANGLE_RANGE/2) / ANGLE_RANGE) * this.elevationSvg.clientWidth;
            const y = this.elevationSvg.clientHeight - 
                     (this.calculateApparentHeight(profilePoint) + Math.PI/4) * 
                     this.elevationSvg.clientHeight / (Math.PI/2);

            let highlightCircle = this.elevationSvg.querySelector(`circle[data-point-id="${pointId}"]`);
            if (!highlightCircle) {
                highlightCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                highlightCircle.setAttribute('data-point-id', pointId);
                highlightCircle.setAttribute('r', '5');
                highlightCircle.classList.add('highlight-point');
                this.elevationSvg.appendChild(highlightCircle);
            }
            highlightCircle.setAttribute('cx', x);
            highlightCircle.setAttribute('cy', y);

            if (sourceView !== 'profile') {
                this.createTooltip(x + 10, y - 10, point, this.elevationSvg);
            }
        }

        // Highlight in 3D wireframe
        this.highlight3DPoint(point);

        this.highlightedPoints.add(pointId);
    }

    highlight3DPoint(point) {
        // Convert to wireframe coordinates
        const zScale = parseFloat(this.zScale.value);
        const width = this.wireframeCanvas.width;
        const height = this.wireframeCanvas.height;
        const d = 1000; // perspective distance

        const projectedX = width/2 + (point.x / (point.z/zScale + d)) * width/4;
        const projectedY = height/2 - (point.y / (point.z/zScale + d)) * height/4;

        // Clear previous highlight
        this.ctx.clearRect(0, 0, width, height);
        
        // Redraw all points
        this.points.forEach(p => {
            const px = width/2 + (p.x / (p.z/zScale + d)) * width/4;
            const py = height/2 - (p.y / (p.z/zScale + d)) * height/4;
            
            this.ctx.beginPath();
            this.ctx.arc(px, py, 2, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0,0,0,${1 - p.distance/DISTANCE_RANGE})`;
            this.ctx.fill();
        });

        // Draw highlight
        this.ctx.beginPath();
        this.ctx.arc(projectedX, projectedY, 5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ff4081';
        this.ctx.fill();

        // Add tooltip near the point
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(projectedX + 10, projectedY - 50, 150, 60);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Elevation: ${Math.round(point.elevation)}m`, projectedX + 15, projectedY - 35);
        this.ctx.fillText(`Lat: ${point.latitude.toFixed(4)}`, projectedX + 15, projectedY - 20);
        this.ctx.fillText(`Lon: ${point.longitude.toFixed(4)}`, projectedX + 15, projectedY - 5);
    }

    clearHighlights() {
        // Clear map highlights
        this.elevationMapSvg.querySelectorAll('.highlight-point').forEach(el => {
            el.classList.remove('highlight-point');
        });

        // Clear profile highlights
        this.elevationSvg.querySelectorAll('.highlight-point').forEach(el => {
            el.remove();
        });

        // Clear tooltips
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }

        // Redraw wireframe without highlights
        this.render3DView();

        this.highlightedPoints.clear();
    }

    renderElevationMap() {
        if (!this.points || !this.points.length) {
            this.showErrorMessage('No data to display');
            return;
        }

        // Clear SVG
        while (this.elevationMapSvg.firstChild) {
            this.elevationMapSvg.removeChild(this.elevationMapSvg.firstChild);
        }

        const svgWidth = this.elevationMapSvg.clientWidth;
        const svgHeight = this.elevationMapSvg.clientHeight;
        const padding = 40;

        try {
            // Calculate bounds
            const bounds = {
                minLat: Math.min(...this.points.map(p => p.latitude)),
                maxLat: Math.max(...this.points.map(p => p.latitude)),
                minLon: Math.min(...this.points.map(p => p.longitude)),
                maxLon: Math.max(...this.points.map(p => p.longitude))
            };

            // Create points
            const pointRadius = parseFloat(this.pointSize.value);

            this.points.forEach(point => {
                const x = ((point.longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (svgWidth - 2 * padding) + padding;
                const y = svgHeight - (((point.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (svgHeight - 2 * padding) + padding);

                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', pointRadius);
                circle.setAttribute('fill', this.getElevationColor(point.elevation));
                circle.setAttribute('data-point-id', `${point.latitude},${point.longitude}`);

                // Update mouseover event
                circle.addEventListener('mouseover', () => {
                    this.highlightPoint(point, 'map');
                });
                circle.addEventListener('mouseout', () => {
                    this.clearHighlights();
                });

                this.elevationMapSvg.appendChild(circle);
            });

            // Add axes
            const xAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
            xAxis.setAttribute('x1', padding);
            xAxis.setAttribute('y1', svgHeight - padding);
            xAxis.setAttribute('x2', svgWidth - padding);
            xAxis.setAttribute('y2', svgHeight - padding);
            xAxis.setAttribute('stroke', '#666');
            xAxis.setAttribute('stroke-width', '1');
            this.elevationMapSvg.appendChild(xAxis);
            
            const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
            yAxis.setAttribute('x1', padding);
            yAxis.setAttribute('y1', padding);
            yAxis.setAttribute('x2', padding);
            yAxis.setAttribute('y2', svgHeight - padding);
            yAxis.setAttribute('stroke', '#666');
            yAxis.setAttribute('stroke-width', '1');
            this.elevationMapSvg.appendChild(yAxis);
            
            // Add axis labels
            const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            xLabel.setAttribute('x', svgWidth / 2);
            xLabel.setAttribute('y', svgHeight - 10);
            xLabel.setAttribute('text-anchor', 'middle');
            xLabel.textContent = 'Longitude';
            this.elevationMapSvg.appendChild(xLabel);
            
            const yLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
            yLabel.setAttribute('x', 15);
            yLabel.setAttribute('y', svgHeight / 2);
            yLabel.setAttribute('transform', `rotate(-90, 15, ${svgHeight / 2})`);
            yLabel.setAttribute('text-anchor', 'middle');
            yLabel.textContent = 'Latitude';
            this.elevationMapSvg.appendChild(yLabel);
        } catch (error) {
            console.error('Error rendering elevation map:', error);
            this.showErrorMessage('Error rendering elevation map');
        }
    }
}

// Initialize the viewer when the page loads
window.addEventListener('load', () => {
    new SandiaViewer();
}); 