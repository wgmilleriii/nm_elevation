// Global variables
let selectedBounds;

// Store map points layer
let mapPointsLayer = null;
let cachedData = null;

// Add these constants at the top with other globals
const NM_BOUNDS = {
    north: 37.20,
    south: 31.20,
    east: -102.80,
    west: -109.20
};

import NM_CITIES from './cities.js';
import { svgLogger, mapLogger, dataLogger } from './logger.js';
import { 
    createCoordinateTransformer, 
    drawCityMarker, 
    createElevationColorScale,
    drawElevationPoints,
    createElevationLegend 
} from './svgUtils.js';

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

// Custom circle marker for elevation points
const ElevationCircle = L.CircleMarker.extend({
    options: {
        radius: 4,
        fillOpacity: 0.8,
        weight: 1
    }
});

// Fetch data from server
async function fetchData(bounds) {
    const south = bounds.getSouth();
    const north = bounds.getNorth();
    const west = bounds.getWest();
    const east = bounds.getEast();
    
    const boundsStr = `${south},${west},${north},${east}`;
    dataLogger.log('Fetching elevation data', { bounds: { south, north, west, east } });
    
    try {
        const response = await fetch(`/api/elevation-data?bounds=${boundsStr}`);
        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            dataLogger.error('Failed to fetch elevation data', error);
            throw error;
        }
        const data = await response.json();
        dataLogger.log('Received elevation data', { 
            pointCount: data.points?.length,
            stats: data.stats,
            samplePoints: data.points?.slice(0, 3)
        });
        return data;
    } catch (error) {
        dataLogger.error('Error fetching elevation data', error);
        throw error;
    }
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

        // Update SVG visualization
        renderSVG(gridPoints.map((point, i) => ({
            ...point,
            elevation: data.points[i]?.elevation
        })), data.stats);

    } catch (error) {
        console.error('Error updating map:', error);
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
        errorDiv.textContent = `Error: ${error.message}`;
        document.body.appendChild(errorDiv);
        setTimeout(() => document.body.removeChild(errorDiv), 3000);
    }
}

// Render elevation data in SVG
function renderSVG(points, stats) {
    svgLogger.log('Starting SVG render', { pointCount: points?.length, stats });
    
    const svg = d3.select('#svg1');
    const container = document.getElementById('svg-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    svgLogger.log('Container dimensions', { width, height });
    
    // Remove elevation points but keep cities
    svg.selectAll('.elevation-point').remove();
    svg.selectAll('.legend').remove();
    
    // Set SVG dimensions
    svg.attr('width', width)
       .attr('height', height)
       .attr('viewBox', `0 0 ${width} ${height}`);
    
    if (!points || points.length === 0) {
        svgLogger.error('No points provided for SVG rendering');
        return;
    }

    // Find bounds of the points
    const minLat = d3.min(points, d => d.latitude);
    const maxLat = d3.max(points, d => d.latitude);
    const minLon = d3.min(points, d => d.longitude);
    const maxLon = d3.max(points, d => d.longitude);
    
    svgLogger.log('Point bounds', { minLat, maxLat, minLon, maxLon });

    // Create coordinate transformer
    const transformer = createCoordinateTransformer(
        { minLat, maxLat, minLon, maxLon },
        { width, height, padding: 50 }
    );

    // Create color scale
    const colorScale = createElevationColorScale(stats.min_elevation, stats.max_elevation);
    
    try {
        // Draw elevation points
        const pointsFragment = drawElevationPoints(
            points.map(p => ({ lat: p.latitude, lon: p.longitude, elevation: p.elevation })),
            transformer,
            colorScale
        );
        svg.node().appendChild(pointsFragment);
        svgLogger.log('Points drawn successfully', { pointCount: points.length });

        // Update city positions for the new bounds
        svgLogger.log('Updating city positions');
        
        // Calculate population range for scaling
        const populations = NM_CITIES.map(city => city.population);
        const minPop = Math.min(...populations);
        const maxPop = Math.max(...populations);
        
        // Remove existing cities
        svg.selectAll('.city-marker, .city-label, .city-label-bg').remove();
        
        // Add city markers and labels with new positions
        NM_CITIES.forEach(city => {
            const popRatio = (Math.log(city.population) - Math.log(minPop)) / (Math.log(maxPop) - Math.log(minPop));
            const cityFragment = drawCityMarker(city, transformer, {
                radius: 5 + (popRatio * 15),
                fontSize: 12 + (popRatio * 8)
            });
            svg.node().appendChild(cityFragment);
        });
        
        svgLogger.log('Cities updated successfully');

        // Add legend
        const legendFragment = createElevationLegend(
            { min: stats.min_elevation, max: stats.max_elevation },
            { x: width - 220, y: height - 40, width: 200, height: 20 }
        );
        svg.node().appendChild(legendFragment);
        
    } catch (error) {
        svgLogger.error('Error drawing SVG elements', error);
    }

    // Log final render state
    svgLogger.log('SVG render complete', {
        dimensions: { width, height },
        bounds: { minLat, maxLat, minLon, maxLon },
        pointCount: points.length,
        cityCount: NM_CITIES.length,
        elements: {
            points: svg.selectAll('.elevation-point').size(),
            cityMarkers: svg.selectAll('.city-marker').size(),
            cityLabels: svg.selectAll('.city-label').size()
        }
    });
}

function setupRectangleSelection(map) {
    const canvas = document.getElementById('selection-canvas');
    const mapContainer = map.getContainer();
    
    // Set canvas size to match map container
    function resizeCanvas() {
        canvas.width = mapContainer.clientWidth;
        canvas.height = mapContainer.clientHeight;
    }
    
    // Initial resize
    resizeCanvas();
    
    // Resize canvas when map container size changes
    map.on('resize', resizeCanvas);
    
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let start = { x: 0, y: 0 };
    let end = { x: 0, y: 0 };

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
        start = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !start) return;
        
        const rect = canvas.getBoundingClientRect();
        const current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Clear canvas and draw selection rectangle
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 123, 255, 0.2)';
        ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
        ctx.lineWidth = 2;

        const x = Math.min(start.x, current.x);
        const y = Math.min(start.y, current.y);
        const width = Math.abs(current.x - start.x);
        const height = Math.abs(current.y - start.y);

        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
    });

    canvas.addEventListener('mouseup', (e) => {
        if (!isDrawing || !start) return;
        
        const rect = canvas.getBoundingClientRect();
        const end = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };

        // Convert selection corners to lat/lon
        const [startLat, startLon] = canvasToLatLon(start.x, start.y);
        const [endLat, endLon] = canvasToLatLon(end.x, end.y);

        selectedBounds = L.latLngBounds(
            [Math.min(startLat, endLat), Math.min(startLon, endLon)],
            [Math.max(startLat, endLat), Math.max(startLon, endLon)]
        );

        // Update map with grid
        map.fitBounds(selectedBounds);
        updateMapWithGrid(selectedBounds);

        // Clean up
        isDrawing = false;
        start = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Clear selection on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            isDrawing = false;
            start = null;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
}

// Major cities in New Mexico
const MAJOR_CITIES = [
    { name: 'Santa Fe', lat: 35.6870, lon: -105.9378 },
    { name: 'Las Cruces', lat: 32.3199, lon: -106.7637 },
    { name: 'Albuquerque', lat: 35.0844, lon: -106.6504 },
    { name: 'Rio Rancho', lat: 35.2328, lon: -106.6630 },
    { name: 'Roswell', lat: 33.3943, lon: -104.5230 },
    { name: 'Farmington', lat: 36.7281, lon: -108.2087 },
    { name: 'Clovis', lat: 34.4048, lon: -103.2052 },
    { name: 'Hobbs', lat: 32.7026, lon: -103.1360 },
    { name: 'Alamogordo', lat: 32.8995, lon: -105.9603 },
    { name: 'Carlsbad', lat: 32.4207, lon: -104.2288 }
];

class ElevationViewer {
    constructor() {
        this.map = null;
        this.svg = d3.select('#svg1');
        this.tooltip = d3.select('.tooltip');
        this.loading = d3.select('.loading');
        
        // Initialize SVG container
        const container = document.getElementById('svg-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.svg.attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);
            
        // Draw initial cities
        this.drawInitialCities();
        
        // Initialize map
        this.initMap();
    }

    drawInitialCities() {
        svgLogger.log('Drawing initial cities');
        
        const container = document.getElementById('svg-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Create transformer using New Mexico bounds
        const transformer = createCoordinateTransformer(
            {
                minLat: NM_BOUNDS.south,
                maxLat: NM_BOUNDS.north,
                minLon: NM_BOUNDS.west,
                maxLon: NM_BOUNDS.east
            },
            { width, height, padding: 50 }
        );
        
        // Calculate population range for scaling
        const populations = NM_CITIES.map(city => city.population);
        const minPop = Math.min(...populations);
        const maxPop = Math.max(...populations);
        
        try {
            // Add city markers and labels
            NM_CITIES.forEach(city => {
                const popRatio = (Math.log(city.population) - Math.log(minPop)) / (Math.log(maxPop) - Math.log(minPop));
                const cityFragment = drawCityMarker(city, transformer, {
                    radius: 5 + (popRatio * 15),
                    fontSize: 12 + (popRatio * 8)
                });
                this.svg.node().appendChild(cityFragment);
            });
            
            svgLogger.log('Initial cities drawn successfully');
        } catch (error) {
            svgLogger.error('Error drawing initial cities', error);
        }
    }

    initMap() {
        // Only initialize if map doesn't exist
        if (!this.map) {
            mapLogger.log('Initializing map');
            try {
                this.map = L.map('map', {
                    center: [34.5199, -105.8701],
                    zoom: 6,
                    minZoom: 6,
                    maxZoom: 13
                });

                mapLogger.log('Map initialized', {
                    center: [34.5199, -105.8701],
                    zoom: 6
                });

                // Add tile layer (OpenStreetMap)
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);

                // Set initial bounds to New Mexico
                selectedBounds = L.latLngBounds(
                    [NM_BOUNDS.south, NM_BOUNDS.west],  // Southwest
                    [NM_BOUNDS.north, NM_BOUNDS.east]   // Northeast
                );

                mapLogger.log('Set initial bounds', NM_BOUNDS);

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
                }).addTo(this.map);

                // Add map move event listeners
                this.map.on('moveend', () => {
                    const bounds = this.map.getBounds();
                    mapLogger.log('Map moved', {
                        bounds: bounds.toBBoxString(),
                        zoom: this.map.getZoom()
                    });
                    
                    // Update SVG with new bounds
                    this.updateSVGWithMapBounds(bounds);
                });

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
                    .addTo(this.map);
                    
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
                    }).addTo(this.map);
                });

                mapLogger.log('Added city markers', { cityCount: NM_CITIES.length });

                // Initialize the selection canvas after map is ready
                this.map.whenReady(() => {
                    setupRectangleSelection(this.map);
                    mapLogger.log('Rectangle selection initialized');
                });
            } catch (error) {
                mapLogger.error('Error initializing map', error);
                throw error;
            }
        } else {
            mapLogger.log('Map already initialized');
        }
    }

    async updateSVGWithMapBounds(bounds) {
        const container = document.getElementById('svg-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Create transformer using current map bounds
        const transformer = createCoordinateTransformer(
            {
                minLat: bounds.getSouth(),
                maxLat: bounds.getNorth(),
                minLon: bounds.getWest(),
                maxLon: bounds.getEast()
            },
            { width, height, padding: 50 }
        );
        
        // Remove existing cities
        this.svg.selectAll('.city-marker, .city-label, .city-label-bg').remove();
        
        // Calculate population range for scaling
        const populations = NM_CITIES.map(city => city.population);
        const minPop = Math.min(...populations);
        const maxPop = Math.max(...populations);
        
        try {
            // Add city markers and labels with new positions
            NM_CITIES.forEach(city => {
                if (bounds.contains([city.lat, city.lon])) {
                    const popRatio = (Math.log(city.population) - Math.log(minPop)) / (Math.log(maxPop) - Math.log(minPop));
                    const cityFragment = drawCityMarker(city, transformer, {
                        radius: 5 + (popRatio * 15),
                        fontSize: 12 + (popRatio * 8)
                    });
                    this.svg.node().appendChild(cityFragment);
                }
            });
            
            svgLogger.log('SVG updated with new map bounds', {
                bounds: bounds.toBBoxString(),
                visibleCities: this.svg.selectAll('.city-marker').size()
            });
        } catch (error) {
            svgLogger.error('Error updating SVG with map bounds', error);
        }
    }
}

// Initialize the viewer only once when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.viewer = new ElevationViewer();
}); 