/**
 * Migration Examples
 * Shows how to convert existing scattered SVG code to use the new unified library
 */

import { SVGLib } from '../lib/SVGDrawingLibrary.js';
import { ElevationVisualization, GridVisualization, MountainProfile } from '../lib/SVGDrawingExtensions.js';

// ===== EXAMPLE 1: Basic Circle Creation =====

// OLD WAY (from public/js/visualization.js)
function createCircleOldWay(x, y, radius, elevation, minElev, maxElev) {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", radius);
    
    // Manual color calculation
    const t = (elevation - minElev) / (maxElev - minElev);
    const r = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 2)));
    const g = Math.round(255 * (1 - Math.abs(t - 0.5) * 2));
    const b = Math.round(255 * Math.max(0, (0.5 - t) * 2));
    const color = `rgb(${r},${g},${b})`;
    
    circle.setAttribute("fill", color);
    circle.setAttribute("data-elevation", elevation);
    
    // Manual event handling
    circle.addEventListener('click', () => handlePointClick(circle, { elevation }));
    
    return circle;
}

// NEW WAY (using SVGDrawingLibrary)
function createCircleNewWay(x, y, radius, elevation, minElev, maxElev) {
    const color = SVGLib.getElevationColor(elevation, minElev, maxElev);
    
    return SVGLib.createCircle(x, y, radius, {
        fill: color,
        dataAttributes: { elevation },
        onClick: (e, element) => handlePointClick(element, { elevation })
    });
}

// ===== EXAMPLE 2: Tooltip Creation and Management =====

// OLD WAY (from public/js/modules/svg.js)
function createTooltipOldWay(svg) {
    const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tooltip.setAttribute('class', 'tooltip');
    tooltip.style.display = 'none';
    
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'white');
    rect.setAttribute('stroke', 'black');
    rect.setAttribute('rx', '3');
    rect.setAttribute('ry', '3');
    tooltip.appendChild(rect);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('fill', 'black');
    tooltip.appendChild(text);
    
    svg.appendChild(tooltip);
    return tooltip;
}

function updateTooltipOldWay(tooltip, content, x, y) {
    const text = tooltip.querySelector('text');
    text.textContent = content;
    
    const bbox = text.getBBox();
    const rect = tooltip.querySelector('rect');
    rect.setAttribute('x', bbox.x - 5);
    rect.setAttribute('y', bbox.y - 3);
    rect.setAttribute('width', bbox.width + 10);
    rect.setAttribute('height', bbox.height + 6);
    
    tooltip.setAttribute('transform', `translate(${x + 10},${y - 10})`);
    tooltip.style.display = '';
}

// NEW WAY (using SVGDrawingLibrary)
function createTooltipNewWay(svg) {
    return SVGLib.createTooltip(svg, {
        backgroundColor: 'white',
        borderColor: 'black',
        borderRadius: 3
    });
}

function updateTooltipNewWay(tooltip, content, x, y) {
    SVGLib.updateTooltip(tooltip, content, x, y, {
        offsetX: 10,
        offsetY: -10
    });
}

// ===== EXAMPLE 3: Complete Elevation Visualization =====

// OLD WAY (from public/js/visualization.js)
class ElevationVisualizationOldWay {
    constructor(svg) {
        this.svg = svg;
        this.points = [];
        this.width = svg.clientWidth;
        this.height = svg.clientHeight;
        this.padding = 40;
        this.pointRadius = 3;
    }

    processData(data) {
        this.points = Object.entries(data).map(([key, elevation]) => {
            const [lat, lon] = key.split(',').map(Number);
            return { lat, lon, elevation };
        });

        // Manual bounds calculation
        this.minLat = Math.min(...this.points.map(p => p.lat));
        this.maxLat = Math.max(...this.points.map(p => p.lat));
        this.minLon = Math.min(...this.points.map(p => p.lon));
        this.maxLon = Math.max(...this.points.map(p => p.lon));
        this.minElev = Math.min(...this.points.map(p => p.elevation));
        this.maxElev = Math.max(...this.points.map(p => p.elevation));
    }

    draw() {
        // Manual clearing
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }

        // Manual coordinate transformation and drawing
        this.points.forEach(point => {
            const x = ((point.lon - this.minLon) / (this.maxLon - this.minLon)) * 
                     (this.width - 2 * this.padding) + this.padding;
            const y = this.height - (((point.lat - this.minLat) / (this.maxLat - this.minLat)) * 
                     (this.height - 2 * this.padding) + this.padding);
            
            const circle = this.createCircleOldWay(x, y, this.pointRadius, 
                                                  point.elevation, this.minElev, this.maxElev);
            this.svg.appendChild(circle);
        });
    }

    getElevationColor(elevation) {
        // Manual color calculation (duplicate code)
        const t = (elevation - this.minElev) / (this.maxElev - this.minElev);
        const r = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 2)));
        const g = Math.round(255 * (1 - Math.abs(t - 0.5) * 2));
        const b = Math.round(255 * Math.max(0, (0.5 - t) * 2));
        return `rgb(${r},${g},${b})`;
    }
}

// NEW WAY (using SVGDrawingExtensions)
class ElevationVisualizationNewWay {
    constructor(svg) {
        this.elevationViz = new ElevationVisualization(svg, {
            pointRadius: 3,
            padding: 40,
            showTooltips: true
        });
    }

    processData(data) {
        // Convert data format if needed
        this.points = Object.entries(data).map(([key, elevation]) => {
            const [lat, lon] = key.split(',').map(Number);
            return { lat, lon, elevation };
        });
    }

    draw() {
        this.elevationViz.renderElevationPoints(this.points, {
            showLegend: true,
            interactive: true
        });
    }
}

// ===== EXAMPLE 4: Grid-based Visualization =====

// OLD WAY (from public/js/map.js)
function createGridVisualizationOldWay(svg, data, stats) {
    // Manual clearing
    while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
    }

    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const GRID_SIZE = 100;
    const circleRadius = Math.min(width, height) / (GRID_SIZE * 2.2);

    // Manual group creation
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Manual color function
    const getColor = (elevation) => {
        if (elevation === null) return '#cccccc';
        const t = (elevation - stats.min_elevation) / (stats.max_elevation - stats.min_elevation);
        const r = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 2)));
        const g = Math.round(255 * (1 - Math.abs(t - 0.5) * 2));
        const b = Math.round(255 * Math.max(0, (0.5 - t) * 2));
        return `rgb(${r},${g},${b})`;
    };

    // Manual grid creation
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            const x = (j / GRID_SIZE) * width;
            const y = (i / GRID_SIZE) * height;

            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", circleRadius);
            circle.setAttribute("fill", "#cccccc");
            circle.setAttribute("stroke", "white");
            circle.setAttribute("stroke-width", Math.max(0.5, circleRadius / 10));

            // Manual event handling
            circle.addEventListener('mouseover', (e) => {
                e.target.setAttribute("r", circleRadius * 1.2);
                // Manual tooltip creation...
            });

            group.appendChild(circle);
        }
    }

    svg.appendChild(group);
}

// NEW WAY (using SVGDrawingExtensions)
function createGridVisualizationNewWay(svg, data, stats) {
    const gridData = [];
    const GRID_SIZE = 100;

    // Convert data to grid format
    for (let i = 0; i < GRID_SIZE; i++) {
        for (let j = 0; j < GRID_SIZE; j++) {
            // Find elevation for this grid cell
            const elevation = findElevationForCell(i, j, data);
            gridData.push({
                x: j,
                y: i,
                value: elevation || 0
            });
        }
    }

    const gridViz = new GridVisualization(svg, {
        gridSize: GRID_SIZE,
        showGridLines: true
    });

    gridViz.createHeatmapGrid(gridData, {
        animateLoad: true
    });
}

// ===== EXAMPLE 5: Mountain Silhouette =====

// OLD WAY (from public/js/sandia-viewer.js)
function createMountainSilhouetteOldWay(svg, elevationPoints) {
    // Manual gradient creation
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    gradient.setAttribute("id", "sky-gradient");
    gradient.setAttribute("x1", "0%");
    gradient.setAttribute("y1", "0%");
    gradient.setAttribute("x2", "0%");
    gradient.setAttribute("y2", "100%");

    // Manual gradient stops
    const stops = [
        { offset: "0%", color: "#87CEEB" },
        { offset: "100%", color: "#E0F6FF" }
    ];

    stops.forEach(stop => {
        const stopEl = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stopEl.setAttribute("offset", stop.offset);
        stopEl.setAttribute("stop-color", stop.color);
        gradient.appendChild(stopEl);
    });

    defs.appendChild(gradient);
    svg.appendChild(defs);

    // Manual sky background
    const sky = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    sky.setAttribute("width", "100%");
    sky.setAttribute("height", "100%");
    sky.setAttribute("fill", "url(#sky-gradient)");
    svg.appendChild(sky);

    // Manual path creation
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const maxElev = Math.max(...elevationPoints.map(p => p.elevation));
    const minElev = Math.min(...elevationPoints.map(p => p.elevation));

    let pathData = `M 0 ${height}`;
    elevationPoints.forEach((point, i) => {
        const x = (i / (elevationPoints.length - 1)) * width;
        const normalizedElev = (point.elevation - minElev) / (maxElev - minElev);
        const y = height - (normalizedElev * (height - 20));
        pathData += ` L ${x} ${y}`;
    });
    pathData += ` L ${width} ${height} Z`;

    const silhouette = document.createElementNS("http://www.w3.org/2000/svg", "path");
    silhouette.setAttribute("d", pathData);
    silhouette.setAttribute("fill", "#2D3748");
    svg.appendChild(silhouette);
}

// NEW WAY (using SVGDrawingExtensions)
function createMountainSilhouetteNewWay(svg, elevationPoints) {
    const mountain = new MountainProfile(svg);
    mountain.createSilhouette(elevationPoints, {
        skyGradient: true,
        interactive: true
    });
}

// ===== EXAMPLE 6: Coordinate Transformation =====

// OLD WAY (manual transformation scattered throughout files)
function transformCoordinatesOldWay(lat, lon, bounds, viewport) {
    const { minLat, maxLat, minLon, maxLon } = bounds;
    const { width, height, padding } = viewport;

    const effectiveWidth = width - (2 * padding);
    const effectiveHeight = height - (2 * padding);

    const x = padding + ((lon - minLon) / (maxLon - minLon)) * effectiveWidth;
    const y = height - (padding + ((lat - minLat) / (maxLat - minLat)) * effectiveHeight);

    return { x, y };
}

// NEW WAY (using SVGDrawingLibrary)
function transformCoordinatesNewWay(lat, lon, bounds, viewport) {
    const transformer = SVGLib.createCoordinateTransformer(bounds, viewport);
    return transformer.pointToSVG({ lat, lon });
}

// ===== EXAMPLE 7: Complete Migration Example =====

// Before: Multiple scattered files and manual SVG handling
function createElevationMapOldWay(containerId, data) {
    const container = document.getElementById(containerId);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "800");
    svg.setAttribute("height", "600");
    container.appendChild(svg);

    // Process data manually
    const points = Object.entries(data).map(([key, elevation]) => {
        const [lat, lon] = key.split(',').map(Number);
        return { lat, lon, elevation };
    });

    // Calculate bounds manually
    const bounds = {
        minLat: Math.min(...points.map(p => p.lat)),
        maxLat: Math.max(...points.map(p => p.lat)),
        minLon: Math.min(...points.map(p => p.lon)),
        maxLon: Math.max(...points.map(p => p.lon)),
        minElev: Math.min(...points.map(p => p.elevation)),
        maxElev: Math.max(...points.map(p => p.elevation))
    };

    // Create visualization manually
    const viz = new ElevationVisualizationOldWay(svg);
    viz.processData(data);
    viz.draw();

    // Add legend manually
    // ... hundreds of lines of manual SVG creation
}

// After: Clean, unified approach
function createElevationMapNewWay(containerId, data) {
    const container = document.getElementById(containerId);
    const svg = SVGLib.createSVG(800, 600);
    container.appendChild(svg);

    // Process data
    const points = Object.entries(data).map(([key, elevation]) => {
        const [lat, lon] = key.split(',').map(Number);
        return { lat, lon, elevation };
    });

    // Create visualization with one line
    const elevationViz = new ElevationVisualization(svg);
    elevationViz.renderElevationPoints(points, {
        showLegend: true,
        showAxes: true,
        interactive: true
    });
}

// ===== UTILITY FUNCTIONS FOR MIGRATION =====

/**
 * Helper function to find elevation for a grid cell
 * (used in grid visualization example)
 */
function findElevationForCell(gridX, gridY, data) {
    // Implementation depends on your data structure
    // This is just an example
    return data.find(point => 
        Math.floor(point.x) === gridX && Math.floor(point.y) === gridY
    )?.elevation;
}

/**
 * Helper function to handle point clicks
 * (used in circle creation examples)
 */
function handlePointClick(element, pointData) {
    console.log(`Clicked point with elevation: ${pointData.elevation}m`);
    // Add your click handling logic here
}

/**
 * Migration helper: Convert old-style data to new format
 */
function convertDataFormat(oldData) {
    if (Array.isArray(oldData)) {
        // Already in correct format
        return oldData;
    }

    if (typeof oldData === 'object') {
        // Convert from key-value format
        return Object.entries(oldData).map(([key, value]) => {
            if (key.includes(',')) {
                const [lat, lon] = key.split(',').map(Number);
                return { lat, lon, elevation: value };
            }
            return { ...value, elevation: value.elevation || value.elev || value.z };
        });
    }

    throw new Error('Unsupported data format');
}

// Export examples for testing and reference
export {
    createCircleOldWay,
    createCircleNewWay,
    createTooltipOldWay,
    createTooltipNewWay,
    updateTooltipOldWay,
    updateTooltipNewWay,
    ElevationVisualizationOldWay,
    ElevationVisualizationNewWay,
    createGridVisualizationOldWay,
    createGridVisualizationNewWay,
    createMountainSilhouetteOldWay,
    createMountainSilhouetteNewWay,
    transformCoordinatesOldWay,
    transformCoordinatesNewWay,
    createElevationMapOldWay,
    createElevationMapNewWay,
    convertDataFormat
};