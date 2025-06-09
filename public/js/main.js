import { DEFAULT_SETTINGS } from './config.js';
import { MapManager } from './map.js';
import { Visualization } from './visualization.js';
import { DebugTerminal } from './debug.js';

class App {
    constructor() {
        // Initialize debug terminal first
        this.debug = new DebugTerminal();
        this.debug.info('Initializing application...');
        
        this.svg = document.getElementById('mountain-svg');
        this.tooltip = document.getElementById('tooltip');
        this.mapFrame = document.getElementById('map-frame');
        this.distanceSlider = document.getElementById('distance');
        this.depthSlider = document.getElementById('depth');
        this.cameraHeightSlider = document.getElementById('camera-height');
        this.heightScaleSlider = document.getElementById('height-scale');
        this.opacitySlider = document.getElementById('opacity');
        this.currentDistanceSpan = document.getElementById('current-distance');
        this.totalPointsSpan = document.getElementById('total-points');
        
        // Set initial values
        this.depth = 54;
        this.cameraHeight = 35;
        this.heightScale = 72;
        this.distance = 5;
        this.opacity = 50;
        
        this.debug.verbose('Initializing visualization and map manager');
        this.visualization = new Visualization(this.svg, this.tooltip);
        this.mapManager = new MapManager(this.mapFrame);
        this.debug.info('MapManager initialized');
        
        this.initializeEventListeners();
        this.loadElevationData();
        this.loadDatabaseStats();
    }

    async loadDatabaseStats() {
        try {
            this.debug.verbose('Fetching database statistics...');
            const response = await fetch('/api/stats');
            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }
            const data = await response.json();
            
            // Format the number with commas
            this.totalPointsSpan.textContent = data.total.toLocaleString();
            this.debug.info(`Database contains ${data.total.toLocaleString()} elevation points`);
        } catch (error) {
            this.debug.error('Error loading stats:', error);
            this.totalPointsSpan.textContent = 'Error loading count';
        }
    }

    async loadElevationData() {
        try {
            this.debug.verbose('Fetching elevation data...');
            const response = await fetch('data/elevation_cache_reduced.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const elevationData = await response.json();
            this.debug.info(`Loaded ${Object.keys(elevationData).length} elevation points`);
            
            this.visualization.processData(elevationData);
            
            // Set a larger initial distance to include more points
            this.distanceSlider.value = 100;
            this.draw();
            this.updateBoundsDisplay();

            // Wait for SVG elements to be created
            const waitForElements = () => {
                const points = this.visualization.points;
                if (points.length >= 2) {
                    const firstPoint = points[0];
                    const secondPoint = points[1];
                    
                    // Find the SVG elements for these points
                    const firstPointElement = this.svg.querySelector(`[data-lat="${firstPoint.lat}"][data-lon="${firstPoint.lon}"]`);
                    const secondPointElement = this.svg.querySelector(`[data-lat="${secondPoint.lat}"][data-lon="${secondPoint.lon}"]`);
                    
                    this.debug.verbose('First two points:', { firstPoint, secondPoint });
                    
                    if (firstPointElement && secondPointElement) {
                        // Simulate clicks on both points
                        this.visualization.handlePointClick(firstPointElement, firstPoint);
                        this.visualization.handlePointClick(secondPointElement, secondPoint);
                    } else {
                        // If elements aren't found, try again after a short delay
                        setTimeout(waitForElements, 100);
                    }
                }
            };

            waitForElements();
        } catch (error) {
            this.debug.error('Error loading elevation data:', error);
            this.svg.innerHTML = `
                <text x="20" y="40" fill="red">Error loading data: ${error.message}</text>
                <text x="20" y="60" fill="blue">Please ensure elevation_cache_reduced.json exists in the data directory</text>
            `;
        }
    }

    draw() {
        this.debug.verbose('Drawing visualization...');
        
        // Update control value displays
        document.querySelector('#depth + .value').textContent = `${this.depth}%`;
        document.querySelector('#camera-height + .value').textContent = `${this.cameraHeight}%`;
        document.querySelector('#height-scale + .value').textContent = `${this.heightScale}%`;
        
        // Calculate visualization parameters
        const depthFactor = this.depth / 100;
        const cameraHeightFactor = this.cameraHeight / 100;
        const heightScaleFactor = this.heightScale / 100;
        
        this.currentDistanceSpan.textContent = this.distance.toFixed(1);
        const pointsDrawn = this.visualization.draw(this.distance, this.opacity / 100, heightScaleFactor, this.mapManager);
        this.debug.info(`Drew ${pointsDrawn} points within ${this.distance} miles`);
    }

    updateBoundsDisplay() {
        const bounds = this.visualization.getBounds();
        document.getElementById('lat-bounds').textContent = `${bounds.minLat.toFixed(4)}° to ${bounds.maxLat.toFixed(4)}°`;
        document.getElementById('lon-bounds').textContent = `${bounds.minLon.toFixed(4)}° to ${bounds.maxLon.toFixed(4)}°`;
        document.getElementById('elev-bounds').textContent = `${bounds.minElev}m to ${bounds.maxElev}m`;
        this.debug.info('Updated bounds display:', bounds);
    }

    initializeEventListeners() {
        this.debug.verbose('Initializing event listeners...');
        
        this.distanceSlider.addEventListener('input', (e) => {
            this.distance = parseInt(e.target.value);
            this.draw();
        });

        this.depthSlider.addEventListener('input', (e) => {
            this.depth = parseInt(e.target.value);
            this.draw();
        });

        this.cameraHeightSlider.addEventListener('input', (e) => {
            this.cameraHeight = parseInt(e.target.value);
            this.draw();
        });

        this.heightScaleSlider.addEventListener('input', (e) => {
            this.heightScale = parseInt(e.target.value);
            this.draw();
        });

        this.opacitySlider.addEventListener('input', (e) => {
            this.opacity = parseInt(e.target.value);
            this.draw();
        });

        window.addEventListener('resize', () => {
            this.debug.verbose('Window resized, redrawing...');
            this.draw();
        });

        // Map controls
        document.querySelectorAll('.map-control-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.map-control-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.debug.info(`Map type changed to: ${btn.dataset.maptype}`);
                this.mapManager.setMapType(btn.dataset.maptype);
            });
        });

        this.debug.info('Event listeners initialized');
    }
}

// Initialize the application when the window loads
window.addEventListener('load', () => {
    if (!window.L) {
        console.error('Leaflet not loaded properly');
        return;
    }
    
    new App();
}); 