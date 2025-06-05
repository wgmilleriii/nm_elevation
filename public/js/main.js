import { DEFAULT_SETTINGS } from './config.js';
import { MapManager } from './map.js';
import { Visualization } from './visualization.js';

class App {
    constructor() {
        this.svg = document.getElementById('mountain-svg');
        this.tooltip = document.getElementById('tooltip');
        this.mapFrame = document.getElementById('map-frame');
        this.distanceSlider = document.getElementById('distance');
        this.depthSlider = document.getElementById('depth');
        this.cameraHeightSlider = document.getElementById('camera-height');
        this.heightScaleSlider = document.getElementById('height-scale');
        this.opacitySlider = document.getElementById('opacity');
        this.currentDistanceSpan = document.getElementById('current-distance');
        
        // Set initial values
        this.depth = 54;
        this.cameraHeight = 35;
        this.heightScale = 72;
        this.distance = 5;
        this.opacity = 50;
        
        console.log('Initializing visualization and map manager');
        this.visualization = new Visualization(this.svg, this.tooltip);
        this.mapManager = new MapManager(this.mapFrame);
        console.log('MapManager initialized:', this.mapManager);
        
        this.initializeEventListeners();
        this.loadElevationData();
    }

    initializeEventListeners() {
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

        window.addEventListener('resize', () => this.draw());

        // Map controls
        document.querySelectorAll('.map-control-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.map-control-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.mapManager.setMapType(btn.dataset.maptype);
            });
        });
    }

    async loadElevationData() {
        try {
            console.log('Fetching elevation data...');
            const response = await fetch('data/elevation_cache_reduced.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const elevationData = await response.json();
            console.log('Data loaded:', Object.keys(elevationData).length, 'points');
            
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
                    
                    console.log('First point:', firstPoint);
                    console.log('Second point:', secondPoint);
                    console.log('First element:', firstPointElement);
                    console.log('Second element:', secondPointElement);
                    
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

            // Start waiting for elements
            waitForElements();
        } catch (e) {
            console.error('Error loading data:', e);
            this.svg.innerHTML = `
                <text x="20" y="40" fill="red">Error loading data: ${e.message}</text>
                <text x="20" y="60" fill="blue">Please ensure elevation_cache_reduced.json exists in the data directory</text>
            `;
        }
    }

    draw() {
        // Update control value displays
        document.querySelector('#depth + .value').textContent = `${this.depth}%`;
        document.querySelector('#camera-height + .value').textContent = `${this.cameraHeight}%`;
        document.querySelector('#height-scale + .value').textContent = `${this.heightScale}%`;
        
        // Calculate visualization parameters
        const depthFactor = this.depth / 100;
        const cameraHeightFactor = this.cameraHeight / 100;
        const heightScaleFactor = this.heightScale / 100;
        
        this.currentDistanceSpan.textContent = this.distance.toFixed(1);
        console.log('Drawing with mapManager:', this.mapManager);
        const pointsDrawn = this.visualization.draw(this.distance, this.opacity / 100, heightScaleFactor, this.mapManager);
        console.log(`Drew ${pointsDrawn} points within ${this.distance} miles`);
    }

    updateBoundsDisplay() {
        const bounds = this.visualization.getBounds();
        document.getElementById('lat-bounds').textContent = `${bounds.minLat.toFixed(4)}° to ${bounds.maxLat.toFixed(4)}°`;
        document.getElementById('lon-bounds').textContent = `${bounds.minLon.toFixed(4)}° to ${bounds.maxLon.toFixed(4)}°`;
        document.getElementById('elev-bounds').textContent = `${bounds.minElev}m to ${bounds.maxElev}m`;
    }
}

// Initialize the application when the window loads
window.addEventListener('load', () => {
    new App();
}); 