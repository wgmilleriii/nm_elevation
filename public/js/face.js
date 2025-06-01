// --- MAP ---
const map = L.map('map').setView([34.5, -106.5], 7); // Centered on New Mexico
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Store map points layer
let mapPointsLayer = null;
let cachedData = null;

// Custom circle marker for elevation points
const ElevationCircle = L.CircleMarker.extend({
    options: {
        radius: 4,
        fillOpacity: 0.8,
        weight: 1
    }
});

// --- SVG1: Elevation Points ---
async function fetchData() {
    if (cachedData) {
        return cachedData;
    }
    const response = await fetch('/api/elevation-data?resolution=low');
    cachedData = await response.json();
    return cachedData;
}

function getElevationColor(elevation, minElevation, maxElevation) {
    if (elevation === null) {
        return 'rgba(255,255,255,0.5)';
    }
    const normalized = (elevation - minElevation) / (maxElevation - minElevation);
    const r = Math.round(normalized * 255);
    const g = Math.round(normalized * 255);
    const b = Math.round(255 * (1 - normalized));
    return `rgb(${r},${g},${b})`;
}

// Convert SVG coordinates to lat/lon
function svgToLatLon(x, y, width, height, padding, minLat, maxLat, minLon, maxLon) {
    const xScale = (width - 2 * padding) / (maxLon - minLon);
    const yScale = (height - 2 * padding) / (maxLat - minLat);
    
    const lon = minLon + (x - padding) / xScale;
    const lat = maxLat - (y - padding) / yScale;
    
    return [lat, lon];
}

// Update map points based on current view
async function updateMapPoints() {
    const bounds = map.getBounds();
    const data = await fetchData();
    
    // Filter points within current map bounds
    const pointsInBounds = data.points.filter(point => 
        bounds.contains([point.latitude, point.longitude])
    );

    if (pointsInBounds.length === 0) return;

    // Create a 10x10 grid across the visible bounds
    const gridSize = 10;
    const latStep = (bounds.getNorth() - bounds.getSouth()) / gridSize;
    const lonStep = (bounds.getEast() - bounds.getWest()) / gridSize;
    
    // Initialize grid cells
    const grid = Array(gridSize).fill().map(() => Array(gridSize).fill().map(() => []));
    
    // Sort points into grid cells
    pointsInBounds.forEach(point => {
        const latIndex = Math.min(Math.floor((bounds.getNorth() - point.latitude) / latStep), gridSize - 1);
        const lonIndex = Math.min(Math.floor((point.longitude - bounds.getWest()) / lonStep), gridSize - 1);
        grid[latIndex][lonIndex].push(point);
    });

    // Sample points from each grid cell
    const sampledPoints = [];
    const pointsPerCell = Math.ceil(500 / (gridSize * gridSize));
    
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const cellPoints = grid[i][j];
            if (cellPoints.length > 0) {
                // If we have more points than needed, sample evenly
                if (cellPoints.length > pointsPerCell) {
                    const step = Math.floor(cellPoints.length / pointsPerCell);
                    for (let k = 0; k < pointsPerCell; k++) {
                        sampledPoints.push(cellPoints[k * step]);
                    }
                } else {
                    // If we have fewer points than needed, take all of them
                    sampledPoints.push(...cellPoints);
                }
            }
        }
    }

    // Remove existing points layer if it exists
    if (mapPointsLayer) {
        map.removeLayer(mapPointsLayer);
    }

    // Create new points layer
    mapPointsLayer = L.layerGroup().addTo(map);
    
    // Add points to map
    sampledPoints.forEach(point => {
        const circle = new ElevationCircle([point.latitude, point.longitude], {
            color: getElevationColor(point.elevation, data.stats.min_elevation, data.stats.max_elevation)
        });
        
        // Add popup with elevation info
        circle.bindPopup(`Elevation: ${point.elevation.toFixed(1)} meters`);
        
        circle.addTo(mapPointsLayer);
    });

    // Update stats
    document.getElementById('stats').innerHTML = `
        Points: ${data.points.length.toLocaleString()}<br>
        Elevation Range: ${data.stats.min_elevation.toFixed(1)}m to ${data.stats.max_elevation.toFixed(1)}m
    `;
}

async function renderSVG1() {
    const data = await fetchData();
    const svg = document.getElementById('svg1');
    svg.innerHTML = '';
    svg.setAttribute('width', svg.clientWidth);
    svg.setAttribute('height', svg.clientHeight);
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const padding = 20;
    const points = data.points;
    if (!points || points.length === 0) return;

    // Use all points for high resolution
    const sampledPoints = points;

    let minLat = sampledPoints[0].latitude, maxLat = sampledPoints[0].latitude;
    let minLon = sampledPoints[0].longitude, maxLon = sampledPoints[0].longitude;
    for (let i = 1; i < sampledPoints.length; i++) {
        const p = sampledPoints[i];
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLon) minLon = p.longitude;
        if (p.longitude > maxLon) maxLon = p.longitude;
    }

    // Calculate scales for point rendering
    const xScale = (width - 2 * padding) / (maxLon - minLon);
    const yScale = (height - 2 * padding) / (maxLat - minLat);

    // Add rectangle selection functionality
    let isDrawing = false;
    let startPoint = null;
    let selectionRect = null;

    svg.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = svg.getBoundingClientRect();
        startPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Create selection rectangle
        selectionRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        selectionRect.setAttribute('fill', 'rgba(0, 123, 255, 0.2)');
        selectionRect.setAttribute('stroke', 'rgba(0, 123, 255, 0.8)');
        selectionRect.setAttribute('stroke-width', '2');
        svg.appendChild(selectionRect);
    });

    svg.addEventListener('mousemove', (e) => {
        if (!isDrawing || !startPoint) return;
        
        const rect = svg.getBoundingClientRect();
        const currentPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Update selection rectangle
        const x = Math.min(startPoint.x, currentPoint.x);
        const y = Math.min(startPoint.y, currentPoint.y);
        const width = Math.abs(currentPoint.x - startPoint.x);
        const height = Math.abs(currentPoint.y - startPoint.y);

        selectionRect.setAttribute('x', x);
        selectionRect.setAttribute('y', y);
        selectionRect.setAttribute('width', width);
        selectionRect.setAttribute('height', height);
    });

    svg.addEventListener('mouseup', (e) => {
        if (!isDrawing || !startPoint) return;
        
        const rect = svg.getBoundingClientRect();
        const endPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Convert selection corners to lat/lon
        const [startLat, startLon] = svgToLatLon(
            startPoint.x, startPoint.y,
            width, height, padding,
            minLat, maxLat, minLon, maxLon
        );
        const [endLat, endLon] = svgToLatLon(
            endPoint.x, endPoint.y,
            width, height, padding,
            minLat, maxLat, minLon, maxLon
        );

        // Create bounds for the map
        const bounds = L.latLngBounds(
            [Math.min(startLat, endLat), Math.min(startLon, endLon)],
            [Math.max(startLat, endLat), Math.max(startLon, endLon)]
        );

        // Zoom map to selection
        map.fitBounds(bounds);

        // Clean up
        isDrawing = false;
        startPoint = null;
        if (selectionRect) {
            svg.removeChild(selectionRect);
            selectionRect = null;
        }
    });

    // Draw points
    sampledPoints.forEach(point => {
        const x = (point.longitude - minLon) * xScale + padding;
        const y = height - ((point.latitude - minLat) * yScale + padding);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 2);
        circle.setAttribute('fill', getElevationColor(point.elevation, data.stats.min_elevation, data.stats.max_elevation));
        
        // Add click event listener to center map on this point
        circle.addEventListener('click', () => {
            map.setView([point.latitude, point.longitude], 12);
            // Add a temporary marker at the clicked location
            const marker = L.marker([point.latitude, point.longitude]).addTo(map);
            // Remove the marker after 2 seconds
            setTimeout(() => {
                map.removeLayer(marker);
            }, 2000);
        });
        
        // Add hover effect
        circle.addEventListener('mouseover', () => {
            circle.setAttribute('r', 4);
            circle.style.cursor = 'pointer';
        });
        circle.addEventListener('mouseout', () => {
            circle.setAttribute('r', 2);
        });
        
        svg.appendChild(circle);
    });
}

// --- SVG2: Placeholder ---
function renderSVG2() {
    const svg = document.getElementById('svg2');
    svg.innerHTML = '';
    svg.setAttribute('width', svg.clientWidth);
    svg.setAttribute('height', svg.clientHeight);
    // Placeholder: simple text
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', svg.clientWidth / 2);
    text.setAttribute('y', svg.clientHeight / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', '32');
    text.setAttribute('fill', '#bbb');
    text.textContent = 'SVG2 Placeholder';
    svg.appendChild(text);
}

// Add map event listeners
map.on('moveend', updateMapPoints);
map.on('zoomend', updateMapPoints);

window.addEventListener('DOMContentLoaded', () => {
    renderSVG1();
    renderSVG2();
    updateMapPoints(); // Initial points load
}); 