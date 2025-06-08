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

// Add elevation constants
const ELEVATION_BOUNDS = {
    min: 1000,  // Lowest point in NM ~1000m (Red Bluff Reservoir)
    max: 4000   // Highest point in NM ~4000m (Wheeler Peak)
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
import ZoomBasedCollector from './ZoomBasedCollector.js';

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

// Add progress indicator styles at the top
const progressStyle = document.createElement('style');
progressStyle.textContent = `
    .progress-indicator {
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 14px;
        z-index: 1000;
        display: none;
    }
    
    .progress-bar {
        width: 200px;
        height: 5px;
        background: #444;
        border-radius: 3px;
        margin-top: 5px;
    }
    
    .progress-bar-fill {
        height: 100%;
        background: #4CAF50;
        border-radius: 3px;
        transition: width 0.3s ease;
    }

    .progress-details {
        font-size: 12px;
        color: #ccc;
        margin-top: 5px;
    }
`;
document.head.appendChild(progressStyle);

// Add progress indicator element
const progressIndicator = document.createElement('div');
progressIndicator.className = 'progress-indicator';
progressIndicator.innerHTML = `
    <div class="progress-text">Loading elevation data...</div>
    <div class="progress-bar">
        <div class="progress-bar-fill" style="width: 0%"></div>
    </div>
    <div class="progress-details"></div>
`;
document.body.appendChild(progressIndicator);

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

// Create color scale function
function getElevationColor(elevation) {
    if (elevation === null || elevation === undefined) {
        return 'rgba(200,200,200,0.5)'; // Gray for unknown elevation
    }
    const normalizedElevation = (elevation - ELEVATION_BOUNDS.min) / (ELEVATION_BOUNDS.max - ELEVATION_BOUNDS.min);
    const r = Math.round(255 * (1 - normalizedElevation)); // Blue component decreases
    const g = Math.round(255 * normalizedElevation);      // Green increases
    const b = Math.round(255 * (1 - normalizedElevation)); // Blue component decreases
    return `rgb(${r},${g},${b})`;
}

// Add a class to manage elevation data gathering
class ElevationDataManager {
    constructor(map) {
        this.map = map;
        this.elevationData = new Map(); // Store elevation data points
        this.isGathering = false;
        this.currentBounds = null;
        this.gatherInterval = 5000; // 5 seconds between updates
        this.currentOffset = 0;
        this.isLoadingChunk = false;
        this.progressCallback = null;
        this.totalPoints = 0;
        this.loadedPoints = 0;
        this.startTime = null;
        this.lastChunkTime = null;
        this.chunkRates = [];
        
        // Initialize progress UI elements
        this.progressElement = document.querySelector('.progress-indicator');
        this.progressBarFill = this.progressElement.querySelector('.progress-bar-fill');
        this.progressText = this.progressElement.querySelector('.progress-text');
        this.progressDetails = this.progressElement.querySelector('.progress-details');
    }

    // Add method to set progress callback
    onProgress(callback) {
        this.progressCallback = callback;
    }

    // Add method to validate and clip bounds
    validateAndClipBounds(bounds) {
        // Return a new bounds object clipped to NM boundaries
        const clippedBounds = L.latLngBounds(
            [
                Math.max(bounds.getSouth(), NM_BOUNDS.south),
                Math.max(bounds.getWest(), NM_BOUNDS.west)
            ],
            [
                Math.min(bounds.getNorth(), NM_BOUNDS.north),
                Math.min(bounds.getEast(), NM_BOUNDS.east)
            ]
        );

        // Check if the clipped bounds are valid (have non-zero area)
        if (clippedBounds.getSouth() >= clippedBounds.getNorth() ||
            clippedBounds.getWest() >= clippedBounds.getEast()) {
            return null;
        }

        return clippedBounds;
    }

    updateProgressUI(stats) {
        // Initialize timing on first chunk
        if (!this.startTime) {
            this.startTime = Date.now();
            this.lastChunkTime = Date.now();
            this.loadedPoints = 0;
            this.totalPoints = stats.count || stats.point_count;
        }

        const currentTime = Date.now();
        const chunkTime = (currentTime - this.lastChunkTime) / 1000;
        const totalTime = (currentTime - this.startTime) / 1000;

        // Update points count
        this.loadedPoints = stats.point_count;
        if (stats.count > this.totalPoints) {
            this.totalPoints = stats.count;
        }

        // Calculate rates
        const chunkRate = stats.point_count / Math.max(chunkTime, 0.1);
        this.chunkRates.push(chunkRate);
        if (this.chunkRates.length > 5) this.chunkRates.shift(); // Keep last 5 rates
        const avgRate = this.chunkRates.reduce((a, b) => a + b, 0) / this.chunkRates.length;

        // Calculate progress
        const percentComplete = Math.min(100, Math.round((this.loadedPoints / this.totalPoints) * 100));

        // Update progress bar
        this.progressBarFill.style.width = `${percentComplete}%`;
        
        // Update text
        this.progressText.textContent = `Loading elevation data: ${percentComplete}%`;
        this.progressDetails.innerHTML = `
            Points: ${this.loadedPoints.toLocaleString()} / ${this.totalPoints.toLocaleString()}<br>
            Rate: ${Math.round(avgRate)} points/sec<br>
            Time: ${totalTime.toFixed(1)}s<br>
            Elevation: ${stats.min_elevation}m to ${stats.max_elevation}m
        `;

        // Show/hide progress indicator
        this.progressElement.style.display = percentComplete < 100 ? 'block' : 'none';

        // Log to console
        console.log(`Elevation data progress:
            - Completed: ${percentComplete}%
            - Points: ${this.loadedPoints.toLocaleString()} / ${this.totalPoints.toLocaleString()}
            - Rate: ${Math.round(avgRate)} points/sec
            - Time: ${totalTime.toFixed(1)}s
            - Elevation range: ${stats.min_elevation}m to ${stats.max_elevation}m
            - Chunk time: ${chunkTime.toFixed(1)}s
        `);

        // Update last chunk time
        this.lastChunkTime = currentTime;
    }

    startGathering(bounds) {
        const validBounds = this.validateAndClipBounds(bounds);
        if (!validBounds) {
            console.log('Bounds completely outside New Mexico - skipping data gathering');
            return;
        }
        
        // Reset state when new bounds are set
        if (!this.currentBounds || 
            validBounds.getSouth() !== this.currentBounds.getSouth() ||
            validBounds.getNorth() !== this.currentBounds.getNorth() ||
            validBounds.getWest() !== this.currentBounds.getWest() ||
            validBounds.getEast() !== this.currentBounds.getEast()) {
            
            this.elevationData.clear();
            this.currentOffset = 0;
            this.startTime = null;
            this.lastChunkTime = null;
            this.chunkRates = [];
            this.loadedPoints = 0;
            this.totalPoints = 0;
        }
        
        this.currentBounds = validBounds;
        if (!this.isGathering) {
            this.isGathering = true;
            this.gatherData();
        }
    }

    stopGathering() {
        this.isGathering = false;
    }

    async gatherData() {
        while (this.isGathering) {
            try {
                if (!this.currentBounds || this.isLoadingChunk) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                this.isLoadingChunk = true;
                const response = await fetch(
                    `/api/elevation-data?bounds=${this.currentBounds.getSouth()},${this.currentBounds.getWest()},` +
                    `${this.currentBounds.getNorth()},${this.currentBounds.getEast()}&offset=${this.currentOffset}`
                );

                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                const data = await response.json();
                if (data.points) {
                    // Add new points to our data store
                    data.points.forEach(point => {
                        const key = `${point.latitude},${point.longitude}`;
                        this.elevationData.set(key, point.elevation);
                    });

                    // Update progress UI
                    this.updateProgressUI(data.stats);
                    
                    // Trigger visualization update
                    this.updateVisualization();

                    // Check if we need to load more
                    if (data.stats.hasMore) {
                        this.currentOffset += data.stats.chunkSize;
                        this.isLoadingChunk = false;
                        // Continue immediately to next chunk
                        continue;
                    } else {
                        // All data loaded
                        this.isLoadingChunk = false;
                        this.startTime = null; // Reset timer for next data gathering
                        await new Promise(resolve => setTimeout(resolve, this.gatherInterval));
                    }
                }
            } catch (error) {
                console.error('Error gathering elevation data:', error);
                // Show error in progress indicator
                this.progressText.textContent = `Error: ${error.message}`;
                this.progressElement.style.display = 'block';
                this.progressElement.style.background = 'rgba(255, 0, 0, 0.8)';
                
                this.isLoadingChunk = false;
                await new Promise(resolve => setTimeout(resolve, this.gatherInterval));
            }
        }
    }

    updateVisualization() {
        const svg = d3.select('#svg1');
        const container = document.getElementById('svg-container');
        
        // Check if elements exist before proceeding
        if (!svg.node() || !container || !this.map) {
            console.warn('Required DOM elements or map not found for visualization update');
            return;
        }
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Get current map bounds
        const bounds = this.map.getBounds();
        const mapBounds = {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        };

        // Log viewport information
        console.log('Map Viewport:', {
            dimensions: { width, height },
            bounds: mapBounds,
            center: this.map.getCenter(),
            zoom: this.map.getZoom()
        });

        try {
            // Clear existing elevation points group
            svg.selectAll('.elevation-points').remove();

            // Filter points to only those within the current map bounds
            const points = Array.from(this.elevationData.entries())
                .map(([key, elevation]) => {
                    const [lat, lon] = key.split(',').map(Number);
                    return { latitude: lat, longitude: lon, elevation };
                })
                .filter(point => 
                    point.latitude >= mapBounds.south &&
                    point.latitude <= mapBounds.north &&
                    point.longitude >= mapBounds.west &&
                    point.longitude <= mapBounds.east
                );

            console.log(`Rendering ${points.length} points within current map bounds`);

            // Create color scale
            const colorScale = d3.scaleLinear()
                .domain([ELEVATION_BOUNDS.min, ELEVATION_BOUNDS.max])
                .range(['blue', 'yellow']);

            // Create transformation scales based on current map bounds
            const xScale = d3.scaleLinear()
                .domain([mapBounds.west, mapBounds.east])
                .range([50, width - 50]);

            const yScale = d3.scaleLinear()
                .domain([mapBounds.south, mapBounds.north])
                .range([height - 50, 50]);

            // Create elevation points group
            const pointsGroup = svg.append('g')
                .attr('class', 'elevation-points');

            // Draw points
            pointsGroup.selectAll('circle')
                .data(points)
                .enter()
                .append('circle')
                .attr('cx', d => xScale(d.longitude))
                .attr('cy', d => yScale(d.latitude))
                .attr('r', 3)
                .attr('fill', d => colorScale(d.elevation))
                .attr('class', 'elevation-point')
                .attr('data-elevation', d => d.elevation)
                .append('title')
                .text(d => `Elevation: ${d.elevation.toFixed(1)}m`);

            // Update legend
            this.updateLegend(svg, width, height);

            // Update cities within bounds
            this.updateCities(svg, xScale, yScale, mapBounds);

            console.log('Visualization updated:', {
                pointCount: points.length,
                visibleArea: {
                    width: mapBounds.east - mapBounds.west,
                    height: mapBounds.north - mapBounds.south,
                    center: {
                        lat: (mapBounds.north + mapBounds.south) / 2,
                        lon: (mapBounds.east + mapBounds.west) / 2
                    }
                }
            });
        } catch (error) {
            console.error('Error updating visualization:', error);
        }
    }

    updateLegend(svg, width, height) {
        // Remove existing legend
        svg.selectAll('.legend').remove();

        // Create legend group
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 220}, ${height - 40})`);

        // Create gradient
        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'elevation-gradient')
            .attr('x1', '0%')
            .attr('x2', '100%');

        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', 'blue');

        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', 'yellow');

        // Draw legend rectangle
        legend.append('rect')
            .attr('width', 200)
            .attr('height', 20)
            .style('fill', 'url(#elevation-gradient)');

        // Add legend labels
        legend.append('text')
            .attr('x', 0)
            .attr('y', 35)
            .attr('text-anchor', 'start')
            .text(`${ELEVATION_BOUNDS.min}m`);

        legend.append('text')
            .attr('x', 200)
            .attr('y', 35)
            .attr('text-anchor', 'end')
            .text(`${ELEVATION_BOUNDS.max}m`);
    }

    updateCities(svg, xScale, yScale, mapBounds) {
        // Remove existing cities
        svg.selectAll('.cities').remove();

        // Filter cities within bounds
        const visibleCities = NM_CITIES.filter(city => 
            city.lat >= mapBounds.south &&
            city.lat <= mapBounds.north &&
            city.lon >= mapBounds.west &&
            city.lon <= mapBounds.east
        );

        if (visibleCities.length === 0) return;

        // Calculate population range for scaling
        const populations = visibleCities.map(city => city.population);
        const minPop = Math.min(...populations);
        const maxPop = Math.max(...populations);

        // Create cities group
        const citiesGroup = svg.append('g')
            .attr('class', 'cities');

        visibleCities.forEach(city => {
            const popRatio = (Math.log(city.population) - Math.log(minPop)) / (Math.log(maxPop) - Math.log(minPop));
            const radius = 5 + (popRatio * 15);
            const fontSize = 12 + (popRatio * 8);

            // Draw city marker
            citiesGroup.append('circle')
                .attr('cx', xScale(city.lon))
                .attr('cy', yScale(city.lat))
                .attr('r', radius)
                .attr('class', 'city-marker')
                .attr('fill', '#3388ff')
                .attr('fill-opacity', 0.5)
                .attr('stroke', 'white')
                .attr('stroke-width', 2);

            // Add city label
            citiesGroup.append('text')
                .attr('x', xScale(city.lon))
                .attr('y', yScale(city.lat) - radius - 5)
                .attr('text-anchor', 'middle')
                .attr('class', 'city-label')
                .attr('font-size', fontSize)
                .attr('font-weight', 'bold')
                .attr('stroke', 'white')
                .attr('stroke-width', 3)
                .attr('stroke-linejoin', 'round')
                .attr('paint-order', 'stroke')
                .text(city.name);
        });

        console.log('Cities updated:', {
            totalCities: NM_CITIES.length,
            visibleCities: visibleCities.length,
            bounds: mapBounds
        });
    }
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
                const color = getElevationColor(elevation);
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
    const colorScale = createElevationColorScale(ELEVATION_BOUNDS.min, ELEVATION_BOUNDS.max);
    
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
            { min: ELEVATION_BOUNDS.min, max: ELEVATION_BOUNDS.max },
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
        this.initMap();
        this.elevationManager = new ElevationDataManager(this.map);
        this.zoomCollector = new ZoomBasedCollector();
        
        // Set up progress callback
        this.elevationManager.onProgress(this.updateProgress.bind(this));
        
        // Initialize SVG container
        const container = document.getElementById('svg-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.svg.attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);
            
        // Draw initial cities
        this.drawInitialCities();
    }

    updateProgress(stats) {
        const indicator = document.querySelector('.progress-indicator');
        const progressBar = indicator.querySelector('.progress-bar-fill');
        const progressText = indicator.querySelector('.progress-text');
        
        if (stats.percentComplete < 100) {
            indicator.style.display = 'block';
            progressBar.style.width = `${stats.percentComplete}%`;
            progressText.textContent = `Loading elevation data: ${stats.percentComplete}% (${stats.point_count} of ${stats.totalPoints} points)`;
        } else {
            // Hide after a short delay
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 1000);
        }
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
                this.map = L.map('map');

                mapLogger.log('Map initialized');

                // Add tile layer (OpenStreetMap)
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(this.map);

                // Set initial view to specified location
                const targetLat = 35.11791663567986;
                const targetLon = -106.54626426361224;
                const zoomLevel = 14; // Higher zoom level for ~10 mile radius
                this.map.setView([targetLat, targetLon], zoomLevel);

                mapLogger.log('Set initial view', { lat: targetLat, lon: targetLon, zoom: zoomLevel });

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

                // Initialize gather elevation button
                const gatherButton = document.getElementById('gather-elevation');
                gatherButton.addEventListener('click', async () => {
                    if (gatherButton.classList.contains('gathering')) return;
                    await this.gatherElevationData();
                });

                // Add city markers and labels
                this.addCityMarkers();

                // Initialize the selection canvas after map is ready
                this.map.whenReady(() => {
                    setupRectangleSelection(this.map);
                    mapLogger.log('Rectangle selection initialized');
                    
                    // Automatically trigger data gathering after map is ready
                    setTimeout(() => {
                        this.gatherElevationData();
                    }, 1000);
                });

            } catch (error) {
                mapLogger.error('Error initializing map', error);
                throw error;
            }
        } else {
            mapLogger.log('Map already initialized');
        }
    }

    // Add new method to handle elevation data gathering
    async gatherElevationData() {
        const gatherButton = document.getElementById('gather-elevation');
        if (gatherButton.classList.contains('gathering')) return;
        
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();
        const center = this.map.getCenter();
        
        // Update button state
        gatherButton.classList.add('gathering');
        const buttonText = gatherButton.querySelector('.button-text');
        const originalText = buttonText.textContent;
        buttonText.textContent = 'Gathering Data...';
        
        try {
            // Convert bounds to our format
            const boundingBox = {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest(),
                center: {
                    lat: center.lat,
                    lon: center.lng
                }
            };
            
            // Start zoom-based collection if zoom level is high enough
            if (zoom >= 8) {
                await this.zoomCollector.startCollection(boundingBox, zoom);
            }
            
            // Update elevation data gathering bounds
            await this.elevationManager.startGathering(bounds);
            
            // Update SVG with new bounds
            this.updateSVGWithMapBounds(bounds);
            
            // Show success state briefly
            buttonText.textContent = 'Data Gathered!';
            gatherButton.style.background = '#4CAF50';
            setTimeout(() => {
                buttonText.textContent = originalText;
                gatherButton.classList.remove('gathering');
            }, 2000);
            
        } catch (error) {
            console.error('Error gathering elevation data:', error);
            // Show error state
            buttonText.textContent = 'Error - Try Again';
            gatherButton.style.background = '#f44336';
            setTimeout(() => {
                buttonText.textContent = originalText;
                gatherButton.classList.remove('gathering');
                gatherButton.style.background = '';
            }, 3000);
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

    // Add city markers and labels
    addCityMarkers() {
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
    }
}

// Initialize the viewer only once when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.viewer = new ElevationViewer();
}); 