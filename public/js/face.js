// Global variables
let map;
let mapPointsLayer;
let selectedBounds;

<<<<<<< Updated upstream
<<<<<<< Updated upstream
// Store map points layer
let mapPointsLayer = null;
let cachedData = null;
=======
=======
>>>>>>> Stashed changes
// Add these constants at the top with other globals
const NM_BOUNDS = {
    north: 37.20,
    south: 31.20,
    east: -102.80,
    west: -109.20
};

import NM_CITIES from './cities.js';

// Initialize map
window.addEventListener('load', () => {
    // Create map centered on New Mexico
    map = L.map('map').setView([34.5199, -105.8701], 6);
    
    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Set initial bounds to New Mexico
    selectedBounds = L.latLngBounds(
        [31.20, -109.20], // Southwest
        [37.20, -102.80]  // Northeast
    );

    // Add New Mexico boundary rectangle
    L.rectangle([
        [NM_BOUNDS.south, NM_BOUNDS.west],
        [NM_BOUNDS.north, NM_BOUNDS.east]
    ], {
        color: "#ff7800",
        weight: 2,
        fill: false,
        dashArray: '5, 10',
        opacity: 0.8
    }).addTo(map);

    // Add city markers and labels
    const maxPop = Math.max(...NM_CITIES.map(city => city.population));
    const minPop = Math.min(...NM_CITIES.map(city => city.population));
    
    NM_CITIES.forEach(city => {
        // Calculate size based on population (logarithmic scale)
        const popRatio = (Math.log(city.population) - Math.log(minPop)) / (Math.log(maxPop) - Math.log(minPop));
        const circleRadius = 5 + (popRatio * 15); // Radius between 5 and 20 pixels
        const fontSize = 12 + (popRatio * 8); // Font size between 12 and 20 pixels
        
        // Add circle marker
        L.circleMarker([city.lat, city.lon], {
            radius: circleRadius,
            fillColor: '#3388ff',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.5
        })
        .bindPopup(`${city.name}<br>Population: ${city.population.toLocaleString()}`)
        .addTo(map);
        
        // Add city label
        const label = L.divIcon({
            className: 'city-label',
            html: `<div style="font-size: ${fontSize}px; font-weight: bold; 
                               text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, 
                                          -1px 1px 0 #fff, 1px 1px 0 #fff;">
                    ${city.name}
                   </div>`,
            iconSize: [100, 20],
            iconAnchor: [50, -10]
        });
        
        L.marker([city.lat, city.lon], {
            icon: label,
            interactive: false
        }).addTo(map);
    });
});

// Add CSS for city labels
const style = document.createElement('style');
style.textContent = `
    .city-label {
        background: transparent;
        border: none;
        text-align: center;
    }
`;
document.head.appendChild(style);

// Create grid points within bounds
function createGridPoints(bounds) {
    const gridSize = 24;
    const points = [];
    const latStep = (bounds.getNorth() - bounds.getSouth()) / (gridSize - 1);
    const lonStep = (bounds.getEast() - bounds.getWest()) / (gridSize - 1);

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const lat = bounds.getSouth() + (i * latStep);
            const lon = bounds.getWest() + (j * lonStep);
            points.push({ latitude: lat, longitude: lon });
        }
    }
    
    return points;
}
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

// Custom circle marker for elevation points
const ElevationCircle = L.CircleMarker.extend({
    options: {
        radius: 4,
        fillOpacity: 0.8,
        weight: 1
    }
});

<<<<<<< Updated upstream
<<<<<<< Updated upstream
// --- SVG1: Elevation Points ---
async function fetchData() {
    if (cachedData) {
        return cachedData;
    }
    const response = await fetch('/api/elevation-data?resolution=low');
    cachedData = await response.json();
    return cachedData;
=======
=======
>>>>>>> Stashed changes
// Fetch data from server
async function fetchData(bounds) {
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    
    const boundsStr = `${south},${west},${north},${east}`;
    const response = await fetch(`/api/elevation-data?bounds=${boundsStr}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
>>>>>>> Stashed changes
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

// Add loading indicator
function showLoading() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.style.position = 'fixed';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.padding = '20px';
    loadingDiv.style.background = 'rgba(0,0,0,0.7)';
    loadingDiv.style.color = 'white';
    loadingDiv.style.borderRadius = '5px';
    loadingDiv.style.zIndex = '1000';
    loadingDiv.textContent = 'Loading elevation data...';
    document.body.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.getElementById('loading-indicator');
    if (loadingDiv) {
        document.body.removeChild(loadingDiv);
    }
}

// Update map with grid points
async function updateMapWithGrid(bounds) {
    try {
        // Check if bounds are within New Mexico
        if (bounds.getNorth() > NM_BOUNDS.north || 
            bounds.getSouth() < NM_BOUNDS.south ||
            bounds.getEast() > NM_BOUNDS.east ||
            bounds.getWest() < NM_BOUNDS.west) {
            
            // Show error message to user
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '20px';
            errorDiv.style.left = '50%';
            errorDiv.style.transform = 'translateX(-50%)';
            errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
            errorDiv.style.color = 'white';
            errorDiv.style.padding = '10px 20px';
            errorDiv.style.borderRadius = '5px';
            errorDiv.style.zIndex = '1000';
            errorDiv.textContent = 'Selection outside New Mexico boundaries. Please select within New Mexico.';
            document.body.appendChild(errorDiv);
            
            // Remove error message after 3 seconds
            setTimeout(() => document.body.removeChild(errorDiv), 3000);
            
            // Reset to New Mexico bounds
            bounds = L.latLngBounds(
                [NM_BOUNDS.south, NM_BOUNDS.west],
                [NM_BOUNDS.north, NM_BOUNDS.east]
            );
        }

        // First zoom the map to the selected bounds
        map.fitBounds(bounds);
        
        // Clear existing points
        if (mapPointsLayer) {
            map.removeLayer(mapPointsLayer);
        }

        // Create the exact 24x24 grid we want
        const gridPoints = createGridPoints(bounds);
        
        // Create new points layer
        mapPointsLayer = L.layerGroup().addTo(map);
        
        // Add all points with temporary gray color
        const circles = gridPoints.map(point => {
            const circle = new ElevationCircle([point.latitude, point.longitude], {
                color: 'rgba(200,200,200,0.5)',
                fillColor: 'rgba(200,200,200,0.5)'
            }).addTo(mapPointsLayer);
            return circle;
        });

        // Now fetch elevation data for exactly these points
        const data = await fetchData(bounds);
        if (!data.points || data.points.length === 0) return;

        // Update colors based on elevation data
        gridPoints.forEach((point, i) => {
            const elevation = data.points[i]?.elevation;
            if (elevation !== undefined) {
                const color = getElevationColor(elevation, data.stats.min_elevation, data.stats.max_elevation);
                circles[i].setStyle({
                    color: color,
                    fillColor: color
                });
                circles[i].bindPopup(`Elevation: ${elevation.toFixed(1)} meters`);
            }
        });

        // Update stats
        document.getElementById('stats').innerHTML = `
            Grid Points: ${gridPoints.length}<br>
            Elevation Range: ${data.stats.min_elevation.toFixed(1)}m to ${data.stats.max_elevation.toFixed(1)}m
        `;

        // Update SVG2 with the same points
        renderSVG2(gridPoints.map((point, i) => ({
            ...point,
            elevation: data.points[i]?.elevation
        })), data.stats);

    } catch (error) {
        console.error('Error updating map:', error);
    }
}

function setupRectangleSelection() {
    const canvas = document.getElementById('selection-canvas');
    const ctx = canvas.getContext('2d');
    const img = document.getElementById('elevation-img');
    let isDrawing = false;
    let startPoint = null;

    // Set canvas size to match container
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Convert canvas coordinates to lat/lon
    function canvasToLatLon(x, y) {
        const bounds = map.getBounds();
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();
        const minLon = bounds.getWest();
        const maxLon = bounds.getEast();

        const lat = maxLat - (y / canvas.height) * (maxLat - minLat);
        const lon = minLon + (x / canvas.width) * (maxLon - minLon);
        return [lat, lon];
    }

    canvas.addEventListener('mousedown', (e) => {
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        startPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !startPoint) return;
        
        const rect = canvas.getBoundingClientRect();
        const currentPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Clear canvas and draw selection rectangle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 123, 255, 0.2)';
        ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
        ctx.lineWidth = 2;

        const x = Math.min(startPoint.x, currentPoint.x);
        const y = Math.min(startPoint.y, currentPoint.y);
        const width = Math.abs(currentPoint.x - startPoint.x);
        const height = Math.abs(currentPoint.y - startPoint.y);

        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!isDrawing || !startPoint) return;
        
        const rect = canvas.getBoundingClientRect();
        const endPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Convert selection corners to lat/lon
        const [startLat, startLon] = canvasToLatLon(startPoint.x, startPoint.y);
        const [endLat, endLon] = canvasToLatLon(endPoint.x, endPoint.y);

        selectedBounds = L.latLngBounds(
            [Math.min(startLat, endLat), Math.min(startLon, endLon)],
            [Math.max(startLat, endLat), Math.max(startLon, endLon)]
        );

        // Update map with grid
        map.fitBounds(selectedBounds);
        updateMapWithGrid(selectedBounds);

        // Clean up
        isDrawing = false;
        startPoint = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Clear selection on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            isDrawing = false;
            startPoint = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
}

// --- SVG2: Display map points ---
function renderSVG2(points, stats) {
    const svg = document.getElementById('svg2');
    svg.innerHTML = '';
    svg.setAttribute('width', svg.clientWidth);
    svg.setAttribute('height', svg.clientHeight);
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const padding = 20;

    if (!points || points.length === 0) return;

    // Find bounds of the points
    let minLat = points[0].latitude, maxLat = points[0].latitude;
    let minLon = points[0].longitude, maxLon = points[0].longitude;
    for (let i = 1; i < points.length; i++) {
        const p = points[i];
        if (p.latitude < minLat) minLat = p.latitude;
        if (p.latitude > maxLat) maxLat = p.latitude;
        if (p.longitude < minLon) minLon = p.longitude;
        if (p.longitude > maxLon) maxLon = p.longitude;
    }

    // Draw points
    points.forEach(point => {
        const x = (point.longitude - minLon) * ((width - 2 * padding) / (maxLon - minLon)) + padding;
        const y = height - ((point.latitude - minLat) * ((height - 2 * padding) / (maxLat - minLat)) + padding);
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 3);
        circle.setAttribute('fill', getElevationColor(point.elevation, stats.min_elevation, stats.max_elevation));
        
        // Add hover effect
        circle.addEventListener('mouseover', () => {
            circle.setAttribute('r', 5);
            circle.style.cursor = 'pointer';
        });
        circle.addEventListener('mouseout', () => {
            circle.setAttribute('r', 3);
        });
        
        // Add popup with elevation info
        circle.addEventListener('click', () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.style.position = 'absolute';
            tooltip.style.left = (x + svg.getBoundingClientRect().left) + 'px';
            tooltip.style.top = (y + svg.getBoundingClientRect().top - 30) + 'px';
            tooltip.innerHTML = `Elevation: ${point.elevation.toFixed(1)}m`;
            document.body.appendChild(tooltip);
            setTimeout(() => document.body.removeChild(tooltip), 2000);
        });
        
        svg.appendChild(circle);
    });
}

window.addEventListener('DOMContentLoaded', () => {
    setupRectangleSelection();
}); 