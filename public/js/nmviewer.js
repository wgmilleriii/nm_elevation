// Initialize map centered on Corrales
const map = L.map('map').setView([35.2378, -106.6067], 12);  // Corrales coordinates and zoom level 12
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Add loading indicator
const loadingIndicator = document.createElement('div');
loadingIndicator.id = 'loading-indicator';
loadingIndicator.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px;
    border-radius: 5px;
    z-index: 1000;
    display: none;
`;
loadingIndicator.textContent = 'Loading elevation data...';
document.body.appendChild(loadingIndicator);

// Function to show loading indicator
function showLoading() {
    loadingIndicator.style.display = 'block';
}

// Function to hide loading indicator
function hideLoading() {
    loadingIndicator.style.display = 'none';
}

// City coordinates
const cities = {
    albuquerque: { lat: 35.0844, lng: -106.6504, name: 'Albuquerque' },
    corrales: { lat: 35.2378, lng: -106.6067, name: 'Corrales' },
    socorro: { lat: 34.0584, lng: -106.8914, name: 'Socorro' }
};

// Add city markers
Object.entries(cities).forEach(([city, data]) => {
    const marker = L.circleMarker([data.lat, data.lng], {
        radius: 8,
        className: `city-marker ${city}`,
        fillOpacity: 0.8
    }).addTo(map);
});

// Variables for drawing
let firstPoint = null;
let circle = null;
let arc = null;
let isFirstClick = true;

// Load elevation data
let elevationData = null;

// Function to load elevation data
async function loadElevationData() {
    showLoading();
    try {
        console.log('Starting elevation data load...');
        
        // First try to load the elevation data generator
        const elevationScript = document.createElement('script');
        elevationScript.src = '/load_elevation_data.js';
        document.head.appendChild(elevationScript);
        
        // Wait for the script to load
        await new Promise((resolve, reject) => {
            elevationScript.onload = () => {
                console.log('Elevation data script loaded');
                resolve();
            };
            elevationScript.onerror = () => {
                console.warn('Could not load load_elevation_data.js, using default elevation data');
                resolve(); // Resolve anyway to continue with default data
            };
        });
        
        // Generate initial test data
        const startLat = 34.5;  // Southern NM
        const endLat = 37.0;    // Northern NM
        const startLng = -109.0; // Western NM
        const endLng = -103.0;   // Eastern NM
        
        if (typeof generateTestElevationData === 'function') {
            console.log('Generating test elevation data...');
            elevationData = generateTestElevationData(startLat, endLat, startLng, endLng, 0.01);
            console.log('Test elevation data generated:', {
                points: Object.keys(elevationData).length,
                sample: Object.entries(elevationData).slice(0, 5),
                bounds: { startLat, endLat, startLng, endLng }
            });
        } else {
            console.warn('generateTestElevationData not found, using default elevation data');
            elevationData = {};  // Initialize with empty object
        }
    } catch (error) {
        console.error('Error loading elevation data:', error);
        elevationData = {};  // Initialize with empty object
    } finally {
        hideLoading();
    }
}

// Function to get elevation for a point
function getElevation(lat, lng) {
    if (!elevationData || typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid coordinates or elevation data not loaded:', { lat, lng });
        return 1500; // Default elevation
    }
    
    // Round to 2 decimal places to match the data format
    const latKey = lat.toFixed(2);
    const lngKey = lng.toFixed(2);
    const key = `${latKey},${lngKey}`;
    
    // Try exact match first
    if (elevationData[key] !== undefined) {
        return elevationData[key];
    }
    
    // If no exact match, find the closest point
    let closestKey = null;
    let minDistance = Infinity;
    
    for (const dataKey in elevationData) {
        const [dataLat, dataLng] = dataKey.split(',').map(Number);
        if (isNaN(dataLat) || isNaN(dataLng)) continue;
        
        const distance = Math.sqrt(
            Math.pow(lat - dataLat, 2) + 
            Math.pow(lng - dataLng, 2)
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestKey = dataKey;
        }
    }
    
    const elevation = closestKey ? elevationData[closestKey] : 1500;
    console.log('Elevation lookup:', { lat, lng, key, found: elevationData[key] !== undefined, closestKey, elevation });
    return elevation;
}

// Function to update elevation data with higher resolution
function updateElevationData(centerLat, centerLng, radius) {
    if (!elevationData) {
        console.warn('No elevation data available for update');
        return;
    }
    
    console.log('Updating elevation data:', { centerLat, centerLng, radius });
    
    // Calculate the bounding box for the current view
    const latRange = radius / 111320; // Convert meters to degrees
    const lngRange = radius / (111320 * Math.cos(centerLat * Math.PI/180));
    
    const startLat = centerLat - latRange;
    const endLat = centerLat + latRange;
    const startLng = centerLng - lngRange;
    const endLng = centerLng + lngRange;
    
    console.log('Generating new elevation data for bounds:', { startLat, endLat, startLng, endLng });
    
    // Generate new data with higher resolution
    const newData = generateTestElevationData(startLat, endLat, startLng, endLng, 0.005);
    
    // Merge new data with existing data
    elevationData = { ...elevationData, ...newData };
    
    console.log('Elevation data updated:', {
        totalPoints: Object.keys(elevationData).length,
        newPoints: Object.keys(newData).length,
        sample: Object.entries(newData).slice(0, 5)
    });
}

// Initialize the application
async function initializeApp() {
    console.log('Initializing application...');
    await loadElevationData();
    console.log('Application initialized');
}

// Call initializeApp when the page loads
document.addEventListener('DOMContentLoaded', initializeApp);

// Function to create a 90-degree arc on the map
function createArc(center, radius, startAngle) {
    const points = [];
    const steps = 30; // Number of points in the arc
    const angleStep = Math.PI / 2 / steps; // 90 degrees divided into steps
    
    // Start 45 degrees before the line and go 90 degrees
    const startOffset = -Math.PI/4; // -45 degrees
    
    for (let i = 0; i <= steps; i++) {
        const angle = startAngle + startOffset + (angleStep * i);
        // Convert radius from meters to degrees (approximate)
        const latOffset = (radius * Math.sin(angle)) / 111320; // 111320 meters per degree
        const lngOffset = (radius * Math.cos(angle)) / (111320 * Math.cos(center.lat * Math.PI/180));
        
        points.push([
            center.lat + latOffset,
            center.lng + lngOffset
        ]);
    }
    
    console.log('Created arc with points:', points.length);
    return points;
}

// Add lazy loading variables
let currentResolution = 10; // Start with 10x10 grid
let maxResolution = 20; // Maximum resolution (20x20)
let lazyLoadInterval = null;
let isLazyLoading = false;

// Function to update grid resolution
function updateGridResolution(newResolution) {
    if (newResolution < 10 || newResolution > maxResolution) return;
    currentResolution = newResolution;
    
    // Recalculate points with new resolution
    if (firstPoint && circle) {
        const radius = circle.getRadius();
        const angle = Math.atan2(
            secondPoint.lat - firstPoint.lat,
            secondPoint.lng - firstPoint.lng
        );
        
        // Create multiple arcs at increasing distances
        const numArcs = currentResolution;
        const arcSpacing = radius * 0.2;
        const allPoints = [];
        
        for (let i = 0; i < numArcs; i++) {
            const currentRadius = radius * (1 + (i * 0.2));
            const arcPoints = createArc(firstPoint, currentRadius, angle);
            
            // Find points along this arc with current resolution
            const selectedPoints = findPointsAlongArc(arcPoints, currentResolution);
            allPoints.push(selectedPoints);
        }
        
        // Update SVGs with new resolution
        displayPointsInSVGGrid(allPoints);
    }
}

// Function to start lazy loading
function startLazyLoading() {
    if (isLazyLoading) return;
    isLazyLoading = true;
    
    lazyLoadInterval = setInterval(() => {
        if (currentResolution < maxResolution) {
            updateGridResolution(currentResolution + 1);
        } else {
            stopLazyLoading();
        }
    }, 1000); // Increase resolution every second
}

// Function to stop lazy loading
function stopLazyLoading() {
    if (lazyLoadInterval) {
        clearInterval(lazyLoadInterval);
        lazyLoadInterval = null;
    }
    isLazyLoading = false;
}

// Map click handler
map.on('click', function(e) {
    if (isFirstClick) {
        // First click - store point and draw circle
        firstPoint = e.latlng;
        if (circle) {
            map.removeLayer(circle);
        }
        if (arc) {
            map.removeLayer(arc);
        }
        circle = L.circle(firstPoint, {
            radius: 0,
            color: 'blue',
            fillColor: '#3388ff',
            fillOpacity: 0.2
        }).addTo(map);
        isFirstClick = false;
        
        // Stop any existing lazy loading
        stopLazyLoading();
    } else {
        // Second click - complete circle and draw arc
        secondPoint = e.latlng;
        const radius = firstPoint.distanceTo(secondPoint);
        
        // Update elevation data for the selected area
        updateElevationData(firstPoint.lat, firstPoint.lng, radius * 2);
        
        // Clear all previous elements
        if (circle) {
            map.removeLayer(circle);
        }
        if (arc) {
            map.removeLayer(arc);
        }
        // Clear all existing polylines (arcs)
        map.eachLayer((layer) => {
            if (layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });
        // Clear all existing circles
        mapCircles.forEach(circle => map.removeLayer(circle));
        mapCircles = [];
        
        // Update circle
        circle = L.circle(firstPoint, {
            radius: radius,
            color: 'blue',
            fillColor: '#3388ff',
            fillOpacity: 0.2
        }).addTo(map);
        
        // Calculate angle for arc
        const angle = Math.atan2(
            secondPoint.lat - firstPoint.lat,
            secondPoint.lng - firstPoint.lng
        );
        
        // Reset resolution and start lazy loading
        currentResolution = 10;
        const numArcs = currentResolution;
        const arcSpacing = radius * 0.2;
        const allPoints = [];
        
        for (let i = 0; i < numArcs; i++) {
            const currentRadius = radius * (1 + (i * 0.2));
            const arcPoints = createArc(firstPoint, currentRadius, angle);
            
            // Find points along this arc
            const selectedPoints = findPointsAlongArc(arcPoints, currentResolution);
            allPoints.push(selectedPoints);
        }
        
        // Display initial points in SVG grid
        displayPointsInSVGGrid(allPoints);
        
        // Start lazy loading
        startLazyLoading();
        
        // Reset for next pair of clicks
        isFirstClick = true;
    }
});

// Store map circles for reference
let mapCircles = [];

// Function to find evenly distributed points along the arc
function findPointsAlongArc(arcPoints, numPoints) {
    const step = Math.floor(arcPoints.length / (numPoints - 1));
    const selectedPoints = [];
    
    for (let i = 0; i < numPoints; i++) {
        const index = Math.min(i * step, arcPoints.length - 1);
        selectedPoints.push(arcPoints[index]);
    }
    
    return selectedPoints;
}

// Store control values
let depthValue = 0;
let heightValue = 0;
let scaleValue = 0;

// Add color palette definitions
const colorPalettes = {
    rainbow: {
        name: 'Rainbow (ROYGBIV)',
        colors: [
            [255, 0, 0],    // Red
            [255, 127, 0],  // Orange
            [255, 255, 0],  // Yellow
            [0, 255, 0],    // Green
            [0, 0, 255],    // Blue
            [75, 0, 130],   // Indigo
            [148, 0, 211]   // Violet
        ]
    },
    steel: {
        name: 'Steel Blue',
        colors: [
            [70, 130, 180],   // Steel Blue
            [135, 206, 235],  // Sky Blue
            [176, 224, 230],  // Powder Blue
            [173, 216, 230],  // Light Blue
            [135, 206, 250],  // Light Sky Blue
            [100, 149, 237],  // Cornflower Blue
            [65, 105, 225]    // Royal Blue
        ]
    },
    custom: {
        name: 'Custom',
        colors: [
            [70, 130, 180],   // Steel Blue
            [173, 216, 230],  // Light Blue
            [135, 206, 235],  // Sky Blue
            [176, 224, 230],  // Powder Blue
            [255, 192, 203],  // Pink
            [255, 182, 193],  // Light Pink
            [219, 112, 147]   // Pale Violet Red
        ]
    }
};

// Initialize current palette
let currentPalette = 'custom';

// Function to get color based on elevation
function getColorForElevation(elevation, minElev, maxElev) {
    // Check for invalid inputs
    if (typeof elevation !== 'number' || typeof minElev !== 'number' || typeof maxElev !== 'number') {
        console.warn('Invalid elevation values:', { elevation, minElev, maxElev });
        return '#666666';
    }

    if (!elevationData) {
        console.warn('Elevation data not loaded');
        return '#666666';
    }
    
    // Ensure we have a valid palette
    if (!colorPalettes || !colorPalettes[currentPalette] || !colorPalettes[currentPalette].colors) {
        console.warn('Invalid color palette:', currentPalette);
        return '#666666';
    }
    
    const palette = colorPalettes[currentPalette];
    
    // Calculate ratio with bounds checking
    let ratio = 0;
    if (maxElev !== minElev) {
        ratio = Math.max(0, Math.min(1, (elevation - minElev) / (maxElev - minElev)));
    }
    
    // Calculate color index with bounds checking
    const idx = ratio * (palette.colors.length - 1);
    const colorIndex = Math.min(Math.floor(idx), palette.colors.length - 2);
    const frac = idx - colorIndex;
    
    // Get colors with bounds checking
    const c0 = palette.colors[colorIndex];
    const c1 = palette.colors[colorIndex + 1];
    
    if (!Array.isArray(c0) || !Array.isArray(c1)) {
        console.warn('Invalid color arrays:', { c0, c1 });
        return '#666666';
    }
    
    // Calculate final color with error handling
    try {
        const c = c0.map((v, k) => Math.round(v + frac * (c1[k] - v)));
        return `rgb(${c.join(',')})`;
    } catch (error) {
        console.warn('Error calculating color:', error);
        return '#666666';
    }
}

// Function to create color palette selector
function createColorPaletteSelector() {
    const selector = document.createElement('div');
    selector.className = 'control-group';
    selector.innerHTML = `
        <label for="color-palette">Color Palette:</label>
        <select id="color-palette">
            ${Object.entries(colorPalettes).map(([key, palette]) => 
                `<option value="${key}">${palette.name}</option>`
            ).join('')}
        </select>
    `;
    
    const select = selector.querySelector('#color-palette');
    select.value = currentPalette;
    
    select.addEventListener('change', (e) => {
        currentPalette = e.target.value;
        if (currentPointsGrid) {
            updatePerspectiveView(false); // Regular view
            updatePerspectiveView(true);  // Hue-based view
            createElevationLegend(currentMinElev, currentMaxElev);
        }
    });
    
    return selector;
}

// Function to create controls
function createControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'controls';
    controlsDiv.innerHTML = `
        <div class="control-group">
            <label for="depth">Depth View:</label>
            <input type="range" id="depth" min="0" max="100" value="54">
            <span class="value">54%</span>
        </div>
        <div class="control-group">
            <label for="height">Camera Height:</label>
            <input type="range" id="height" min="0" max="100" value="19">
            <span class="value">19%</span>
        </div>
        <div class="control-group">
            <label for="scale">Height Scaling:</label>
            <input type="range" id="scale" min="0" max="100" value="72">
            <span class="value">72%</span>
        </div>
    `;
    
    // Add color palette selector
    controlsDiv.appendChild(createColorPaletteSelector());
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        #controls {
            padding: 10px;
            background: #f5f5f5;
            border-top: 1px solid #ddd;
        }
        .control-group {
            margin: 10px 0;
        }
        .control-group label {
            display: inline-block;
            width: 120px;
        }
        .control-group input {
            width: 200px;
            vertical-align: middle;
        }
        .control-group .value {
            display: inline-block;
            width: 50px;
            text-align: right;
        }
        #svg-container {
            display: flex;
            flex-direction: row;
            gap: 20px;
            padding: 20px;
            flex-wrap: wrap;
            justify-content: center;
            align-items: flex-start;
        }
        .svg-view {
            min-width: 400px;
            min-height: 400px;
            width: auto;
            height: auto;
            position: relative;
            border: 1px solid #ddd;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .svg-view svg {
            width: 100%;
            height: 100%;
            min-width: 400px;
            min-height: 400px;
            max-width: 100%;
            max-height: 100%;
            overflow: visible;
        }
        #elevation-legend {
            padding: 10px;
            background: #f5f5f5;
            border-top: 1px solid #ddd;
            margin-top: 20px;
            width: 100%;
        }
        @media (max-width: 900px) {
            #svg-container {
                flex-direction: column;
                align-items: center;
            }
            .svg-view {
                width: 100%;
                max-width: 600px;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Add event listeners
    const depthSlider = controlsDiv.querySelector('#depth');
    const heightSlider = controlsDiv.querySelector('#height');
    const scaleSlider = controlsDiv.querySelector('#scale');
    
    // Set initial values
    depthValue = 54;
    heightValue = 19;
    scaleValue = 72;
    
    depthSlider.addEventListener('input', (e) => {
        depthValue = e.target.value;
        e.target.nextElementSibling.textContent = depthValue + '%';
        updatePerspectiveView(false); // Regular view
        updatePerspectiveView(true);  // Hue-based view
    });
    
    heightSlider.addEventListener('input', (e) => {
        heightValue = e.target.value;
        e.target.nextElementSibling.textContent = heightValue + '%';
        updatePerspectiveView(false); // Regular view
        updatePerspectiveView(true);  // Hue-based view
    });
    
    scaleSlider.addEventListener('input', (e) => {
        scaleValue = e.target.value;
        e.target.nextElementSibling.textContent = scaleValue + '%';
        updatePerspectiveView();
    });
    
    return controlsDiv;
}

// Function to update perspective view
function updatePerspectiveView(useHueForLines = false) {
    const svg = document.getElementById(useHueForLines ? 'elevation-change-svg' : 'perspective-svg');
    if (!svg || !currentPointsGrid) return;
    
    svg.innerHTML = '';
    
    const baseSize = 12;
    const baseSpacing = 35;
    const maxRows = currentPointsGrid.length;
    const maxCols = currentPointsGrid[0].length;
    
    // Calculate center Y position for initial single row
    const centerY = 200;
    
    // Calculate min and max elevation for scaling
    const allElevations = currentPointsGrid.flatMap(row => 
        row.map(p => getElevation(p[0], p[1]))
    ).filter(e => !isNaN(e)); // Filter out any NaN values
    
    if (allElevations.length === 0) {
        console.warn('No valid elevations found');
        return;
    }
    
    const minElev = Math.min(...allElevations);
    const maxElev = Math.max(...allElevations);
    const elevRange = Math.max(1, maxElev - minElev); // Ensure non-zero range
    
    // Store circle positions for connecting lines
    const circlePositions = [];
    
    // Process rows in order (closest to furthest)
    currentPointsGrid.forEach((row, rowIndex) => {
        // Calculate opacity based on row (50% for row 1, 10% for row 10)
        const opacity = 0.5 - (rowIndex / (maxRows - 1)) * 0.4;
        
        // Calculate row width scaling based on depth (reversed to make rows wider towards row 10)
        const rowWidthFactor = 1 + (depthValue / 100) * (rowIndex / maxRows);
        
        // Store positions for this row
        const rowPositions = [];
        
        // Process points in clockwise order (left to right in SVG2)
        row.forEach((point, colIndex) => {
            if (!point || typeof point[0] !== 'number' || typeof point[1] !== 'number' || 
                isNaN(point[0]) || isNaN(point[1])) {
                console.warn('Invalid point coordinates:', point);
                return;
            }
            
            const elevation = getElevation(point[0], point[1]);
            if (isNaN(elevation)) {
                console.warn('Invalid elevation for point:', point);
                return;
            }
            
            const color = getColorForElevation(elevation, minElev, maxElev);
            
            // Calculate perspective transformations
            const depthFactor = 1 + (depthValue / 100) * (rowIndex / maxRows);
            
            // Calculate Y position based on camera height
            const rowOffset = (heightValue / 100) * ((maxRows - 1) / 2 - rowIndex) * 25;
            const y = centerY + rowOffset;
            
            // Calculate X position with row width scaling
            const centerX = 200;
            // Reverse column order for SVG2
            const reversedColIndex = maxCols - 1 - colIndex;
            const colOffset = (reversedColIndex - (maxCols - 1) / 2) * baseSpacing;
            const x = centerX + (colOffset * rowWidthFactor);
            
            // Calculate circle size based on elevation with safety checks
            const normalizedElevation = (elevation - minElev) / elevRange;
            const elevFactor = 1 + (scaleValue / 100) * normalizedElevation * 3.5;
            const circleSize = baseSize * depthFactor * elevFactor;
            
            if (isNaN(x) || isNaN(y) || isNaN(circleSize)) {
                console.warn('Invalid position or size calculated:', { 
                    x, y, circleSize, 
                    elevation, minElev, maxElev, elevRange,
                    normalizedElevation, elevFactor, depthFactor 
                });
                return;
            }
            
            // Store position for connecting lines
            rowPositions.push({ x, y: y - circleSize, size: circleSize });
            
            // Only create circles if not using hue for lines
            if (!useHueForLines) {
                // Create circle
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", x);
                circle.setAttribute("cy", y);
                circle.setAttribute("r", circleSize);
                circle.setAttribute("fill", color);
                circle.setAttribute("fill-opacity", opacity);
                circle.setAttribute("cursor", "pointer");
                
                // Add click handler
                circle.addEventListener('click', () => {
                    map.setView(point, 15);
                    const index = rowIndex * maxCols + colIndex;
                    if (mapCircles[index]) {
                        mapCircles[index].setStyle({ weight: 4, fillOpacity: 0.7 });
                        mapCircles.forEach((c, i) => {
                            if (i !== index) {
                                c.setStyle({ weight: 2, fillOpacity: 0.5 });
                            }
                        });
                    }
                });
                
                svg.appendChild(circle);
            }
        });
        
        if (rowPositions.length > 0) {
            circlePositions.push(rowPositions);
        }
    });
    
    // Draw connecting lines
    circlePositions.forEach((rowPositions, rowIndex) => {
        // Calculate line opacity and thickness based on depth
        const lineOpacity = 0.7 - (rowIndex / maxRows) * 0.6;
        const lineThickness = 2 - (depthValue / 100) * 1.5;
        
        // Create segments for each point in the row
        for (let i = 1; i < rowPositions.length; i++) {
            const prev = rowPositions[i-1];
            const curr = rowPositions[i];
            
            if (isNaN(prev.x) || isNaN(prev.y) || isNaN(curr.x) || isNaN(curr.y)) {
                console.warn('Invalid position for line segment:', { prev, curr });
                continue;
            }
            
            // Create a separate path for each segment
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const pathData = `M ${prev.x} ${prev.y} L ${curr.x} ${curr.y}`;
            path.setAttribute("d", pathData);
            
            if (useHueForLines) {
                // Calculate elevation change for this segment
                const point1 = currentPointsGrid[rowIndex][i-1];
                const point2 = currentPointsGrid[rowIndex][i];
                const elev1 = getElevation(point1[0], point1[1]);
                const elev2 = getElevation(point2[0], point2[1]);
                const change = elev2 - elev1;
                
                // Map the change to a ratio between 0 and 1
                // Center the ratio around 0.5 (no change)
                const maxAbsChange = Math.max(1, Math.abs(maxElev - minElev)); // Ensure non-zero
                const ratio = 0.5 + (change / (2 * maxAbsChange));
                
                // Use the same color palette as the elevation legend
                const palette = colorPalettes[currentPalette];
                const idx = ratio * (palette.colors.length - 1);
                const colorIndex = Math.floor(idx);
                const frac = idx - colorIndex;
                
                let color;
                if (colorIndex >= palette.colors.length - 1) {
                    color = palette.colors[palette.colors.length - 1];
                } else {
                    const c0 = palette.colors[colorIndex];
                    const c1 = palette.colors[colorIndex + 1];
                    color = c0.map((v, k) => Math.round(v + frac * (c1[k] - v)));
                }
                
                path.setAttribute("stroke", `rgb(${color.join(',')})`);
            } else {
                path.setAttribute("stroke", "#666");
            }
            
            path.setAttribute("stroke-width", lineThickness);
            path.setAttribute("fill", "none");
            path.setAttribute("opacity", lineOpacity);
            svg.appendChild(path);
        }
    });
}

// Store current points grid and elevation range
let currentPointsGrid = null;
let currentMinElev = 0;
let currentMaxElev = 0;

// Function to display points in SVG grid
function displayPointsInSVGGrid(pointsGrid) {
    // Store current points and elevation range
    currentPointsGrid = pointsGrid;
    
    // Create container for SVGs
    const container = document.getElementById('svg-container');
    container.innerHTML = '';
    
    // Create top SVG view
    const topView = document.createElement('div');
    topView.className = 'svg-view';
    const topSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    topSvg.id = 'top-svg';
    
    // Calculate SVG dimensions based on grid size
    const maxCols = pointsGrid[0].length;
    const maxRows = pointsGrid.length;
    const spacing = 35;
    const padding = 50; // Padding around the grid
    const svgWidth = (maxCols * spacing) + (padding * 2);
    const svgHeight = (maxRows * spacing) + (padding * 2);
    
    // Set SVG dimensions
    topSvg.setAttribute('width', svgWidth);
    topSvg.setAttribute('height', svgHeight);
    topSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    
    topView.appendChild(topSvg);
    container.appendChild(topView);
    
    // Create perspective SVG view
    const perspectiveView = document.createElement('div');
    perspectiveView.className = 'svg-view';
    const perspectiveSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    perspectiveSvg.id = 'perspective-svg';
    perspectiveView.appendChild(perspectiveSvg);
    container.appendChild(perspectiveView);
    
    // Create elevation change SVG view
    const elevationChangeView = document.createElement('div');
    elevationChangeView.className = 'svg-view';
    const elevationChangeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    elevationChangeSvg.id = 'elevation-change-svg';
    elevationChangeView.appendChild(elevationChangeSvg);
    container.appendChild(elevationChangeView);
    
    // Create legend container
    const legend = document.createElement('div');
    legend.id = 'elevation-legend';
    container.appendChild(legend);
    
    // Add controls
    container.appendChild(createControls());
    
    // Clear existing map circles
    mapCircles.forEach(circle => map.removeLayer(circle));
    mapCircles = [];
    
    // Calculate min and max elevation for color scaling
    const allElevations = pointsGrid.flatMap(row => 
        row.map(p => getElevation(p[0], p[1]))
    );
    currentMinElev = Math.min(...allElevations);
    currentMaxElev = Math.max(...allElevations);
    
    // Create circles for each point in grid (top view)
    // Reverse the pointsGrid array so closest arc is at top
    pointsGrid.slice().reverse().forEach((row, displayRowIndex) => {
        const actualRowIndex = pointsGrid.length - 1 - displayRowIndex;
        row.forEach((point, colIndex) => {
            const elevation = getElevation(point[0], point[1]);
            const color = getColorForElevation(elevation, currentMinElev, currentMaxElev);
            
            // Create circle in top SVG
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            // Adjust spacing and position for SVG1
            const xOffset = padding;
            const yOffset = padding;
            // Reverse x position for SVG1
            const reversedColIndex = maxCols - 1 - colIndex;
            circle.setAttribute("cx", (reversedColIndex * spacing) + xOffset);
            circle.setAttribute("cy", (displayRowIndex * spacing) + yOffset);
            circle.setAttribute("r", "12");
            circle.setAttribute("fill", color);
            circle.setAttribute("cursor", "pointer");
            
            // Add click handler
            circle.addEventListener('click', () => {
                map.setView(point, 15);
                const index = actualRowIndex * maxCols + colIndex;
                mapCircles[index].setStyle({ weight: 4, fillOpacity: 0.7 });
                mapCircles.forEach((c, i) => {
                    if (i !== index) {
                        c.setStyle({ weight: 2, fillOpacity: 0.5 });
                    }
                });
            });
            
            topSvg.appendChild(circle);
            
            // Create circle on map
            const mapCircle = L.circleMarker(point, {
                radius: 6,
                color: color,
                fillColor: color,
                fillOpacity: 0.5,
                weight: 2
            }).addTo(map);
            
            mapCircle.bindPopup(`Row: ${actualRowIndex + 1}, Col: ${colIndex + 1}<br>Elevation: ${elevation.toFixed(1)}m`);
            mapCircles.push(mapCircle);
        });
    });
    
    // Create legend
    createElevationLegend(currentMinElev, currentMaxElev);
    
    // Initialize perspective view
    updatePerspectiveView(false); // Regular view
    updatePerspectiveView(true);  // Hue-based view
}

// Function to create elevation legend
function createElevationLegend(minElev, maxElev) {
    const legend = document.getElementById('elevation-legend');
    if (!legend) return;
    
    const palette = colorPalettes[currentPalette];
    const gradientStops = palette.colors.map((color, i) => 
        `rgb(${color.join(',')}) ${(i / (palette.colors.length - 1)) * 100}%`
    ).join(', ');
    
    legend.innerHTML = `
        <h3>Elevation Legend</h3>
        <div class="legend-gradient"></div>
        <div class="legend-labels">
            <span>${maxElev.toFixed(0)}m</span>
            <span>${minElev.toFixed(0)}m</span>
        </div>
    `;
    
    // Add legend styles
    const style = document.createElement('style');
    style.textContent = `
        .legend-gradient {
            height: 20px;
            background: linear-gradient(to right, ${gradientStops});
            margin: 10px 0;
        }
        .legend-labels {
            display: flex;
            justify-content: space-between;
        }
        #elevation-legend {
            padding: 10px;
            background: #f5f5f5;
            border-top: 1px solid #ddd;
        }
        #color-palette {
            width: 200px;
            padding: 5px;
            margin: 5px 0;
        }
    `;
    document.head.appendChild(style);
}

// Add cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopLazyLoading();
}); 