import { initializeMap, createMapMarkers } from './modules/map.js';
import { createGridVisualization, updateDataTable } from './modules/grid.js';
import { addElevationData } from './modules/elevation.js';
import { ViewerState } from './modules/state.js';
import { drawViewingArc, calculateArcPoints } from './arc_utils.js';

// New Mexico bounds
const NM_BOUNDS = {
    minLat: 31.33,
    maxLat: 37.00,
    minLon: -109.05,
    maxLon: -103.00
};

// City coordinates
const CITIES = {
    albuquerque: { lat: 35.0844, lon: -106.6504, color: '#FF0000', label: 'Albuquerque' },
    corrales: { lat: 35.2375, lon: -106.6067, color: '#00FF00', label: 'Corrales' },
    socorro: { lat: 34.0584, lon: -106.8914, color: '#0000FF', label: 'Socorro' }
};

// Initialize SVG element
const svg = document.getElementById('viewerSvg');

// Initialize map and state
const map = initializeMap();
const viewerState = new ViewerState();

// Add city markers
Object.values(CITIES).forEach(city => {
    L.circleMarker([city.lat, city.lon], {
        color: city.color,
        fillColor: city.color,
        fillOpacity: 0.5,
        radius: 8
    })
    .bindTooltip(city.label, { permanent: true, direction: 'top' })
    .addTo(map);
});

// Constants
const ELEVATION_COLORS = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];
const SVG_HEIGHT = 300;
const SVG_WIDTH = svg.clientWidth;
const SVG_PADDING = 50;
const PROFILE_POINTS = 100;

// Helper function to get elevation color
function getElevationColor(elevation, minElev, maxElev) {
    const normalizedValue = (elevation - minElev) / (maxElev - minElev);
    const colorIndex = Math.floor(normalizedValue * (ELEVATION_COLORS.length - 1));
    return ELEVATION_COLORS[Math.min(colorIndex, ELEVATION_COLORS.length - 1)];
}

// Helper function to show loading state
function setLoading(loading) {
    viewerState.loading = loading;
    document.body.style.cursor = loading ? 'wait' : 'default';
    
    // Update loading indicator in SVG
    const existingIndicator = svg.querySelector('.loading-indicator');
    if (loading && !existingIndicator) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        text.setAttribute('class', 'loading-indicator');
        text.setAttribute('x', SVG_WIDTH / 2);
        text.setAttribute('y', SVG_HEIGHT / 2);
        text.setAttribute('text-anchor', 'middle');
        text.textContent = 'Loading elevation data...';
        svg.appendChild(text);
    } else if (!loading && existingIndicator) {
        existingIndicator.remove();
    }
}

// Function to draw elevation profile
async function drawElevationProfile(start, end) {
    try {
        setLoading(true);
        
        // Get elevation profile data
        const response = await fetch('/api/elevation/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                start,
                end,
                numPoints: PROFILE_POINTS
            })
        });
        
        if (!response.ok) throw new Error('Failed to fetch elevation profile');
        const data = await response.json();
        
        // Clear existing profile
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        
        const { points, metadata } = data;
        const elevations = points.map(p => p.elevation);
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        const elevRange = maxElev - minElev;
        
        // Create path for elevation profile
        const pathData = points.map((point, i) => {
            const x = SVG_PADDING + (i * (SVG_WIDTH - 2 * SVG_PADDING) / (points.length - 1));
            const y = SVG_HEIGHT - SVG_PADDING - ((point.elevation - minElev) * (SVG_HEIGHT - 2 * SVG_PADDING) / elevRange);
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');
        
        // Draw profile path
        const path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('stroke', '#2196F3');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
        
        // Add elevation points
        points.forEach((point, i) => {
            const x = SVG_PADDING + (i * (SVG_WIDTH - 2 * SVG_PADDING) / (points.length - 1));
            const y = SVG_HEIGHT - SVG_PADDING - ((point.elevation - minElev) * (SVG_HEIGHT - 2 * SVG_PADDING) / elevRange);
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '3');
            circle.setAttribute('fill', getElevationColor(point.elevation, minElev, maxElev));
            
            // Add hover effect
            circle.addEventListener('mouseover', () => {
                circle.setAttribute('r', '5');
                updateTooltip(point, x, y);
            });
            circle.addEventListener('mouseout', () => {
                circle.setAttribute('r', '3');
                hideTooltip();
            });
            
            svg.appendChild(circle);
        });
        
        // Add axes
        const xAxis = document.createElementNS("http://www.w3.org/2000/svg", 'line');
        xAxis.setAttribute('x1', SVG_PADDING);
        xAxis.setAttribute('y1', SVG_HEIGHT - SVG_PADDING);
        xAxis.setAttribute('x2', SVG_WIDTH - SVG_PADDING);
        xAxis.setAttribute('y2', SVG_HEIGHT - SVG_PADDING);
        xAxis.setAttribute('stroke', 'black');
        svg.appendChild(xAxis);
        
        const yAxis = document.createElementNS("http://www.w3.org/2000/svg", 'line');
        yAxis.setAttribute('x1', SVG_PADDING);
        yAxis.setAttribute('y1', SVG_PADDING);
        yAxis.setAttribute('x2', SVG_PADDING);
        yAxis.setAttribute('y2', SVG_HEIGHT - SVG_PADDING);
        yAxis.setAttribute('stroke', 'black');
        svg.appendChild(yAxis);
        
        // Add labels
        const distanceLabel = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        distanceLabel.setAttribute('x', SVG_WIDTH / 2);
        distanceLabel.setAttribute('y', SVG_HEIGHT - 10);
        distanceLabel.setAttribute('text-anchor', 'middle');
        distanceLabel.textContent = `Distance (${(metadata.totalDistance / 1000).toFixed(1)} km)`;
        svg.appendChild(distanceLabel);
        
        const elevationLabel = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        elevationLabel.setAttribute('x', 15);
        elevationLabel.setAttribute('y', SVG_HEIGHT / 2);
        elevationLabel.setAttribute('transform', `rotate(-90, 15, ${SVG_HEIGHT / 2})`);
        elevationLabel.setAttribute('text-anchor', 'middle');
        elevationLabel.textContent = 'Elevation (m)';
        svg.appendChild(elevationLabel);
        
        // Update table
        const tbody = document.querySelector('#pointsTable tbody');
        tbody.innerHTML = '';
        points.forEach((point, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${point.lat.toFixed(6)}</td>
                <td>${point.lon.toFixed(6)}</td>
                <td>${point.elevation.toFixed(1)}</td>
                <td>${(point.distance / 1000).toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error drawing elevation profile:', error);
        // Show error in SVG
        const text = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        text.setAttribute('x', SVG_WIDTH / 2);
        text.setAttribute('y', SVG_HEIGHT / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'red');
        text.textContent = 'Error loading elevation data';
        svg.appendChild(text);
    } finally {
        setLoading(false);
    }
}

// Tooltip functions
function createTooltip() {
    const tooltip = document.createElementNS("http://www.w3.org/2000/svg", 'g');
    tooltip.setAttribute('class', 'tooltip');
    tooltip.style.display = 'none';
    
    const rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
    rect.setAttribute('fill', 'white');
    rect.setAttribute('stroke', 'black');
    rect.setAttribute('rx', '3');
    rect.setAttribute('ry', '3');
    tooltip.appendChild(rect);
    
    const text = document.createElementNS("http://www.w3.org/2000/svg", 'text');
    text.setAttribute('fill', 'black');
    tooltip.appendChild(text);
    
    svg.appendChild(tooltip);
    return tooltip;
}

function updateTooltip(point, x, y) {
    const tooltip = svg.querySelector('.tooltip') || createTooltip();
    const text = tooltip.querySelector('text');
    text.textContent = `Elevation: ${point.elevation.toFixed(1)}m`;
    
    const bbox = text.getBBox();
    const rect = tooltip.querySelector('rect');
    rect.setAttribute('x', bbox.x - 5);
    rect.setAttribute('y', bbox.y - 3);
    rect.setAttribute('width', bbox.width + 10);
    rect.setAttribute('height', bbox.height + 6);
    
    tooltip.setAttribute('transform', `translate(${x + 10},${y - 10})`);
    tooltip.style.display = '';
}

function hideTooltip() {
    const tooltip = svg.querySelector('.tooltip');
    if (tooltip) tooltip.style.display = 'none';
}

// Function to draw arc points visualization
async function drawArcPointsVisualization(center, edge) {
    try {
        setLoading(true);
        
        // Clear any existing arc point markers
        viewerState.arcPointMarkers.forEach(marker => map.removeLayer(marker));
        viewerState.arcPointMarkers = [];
        
        // Get points for multiple arcs
        const allArcPoints = calculateArcPoints(center, edge, 10);
        
        // Get elevation for each point
        const allPointsWithElevation = await Promise.all(
            allArcPoints.flat().map(async point => {
                try {
                    const response = await fetch(`/api/elevation/${point.lat}/${point.lng}`);
                    if (!response.ok) throw new Error('Failed to fetch elevation');
                    const data = await response.json();
                    return { ...point, elevation: data.elevation };
                } catch (error) {
                    console.warn(`Error fetching elevation for point:`, point, error);
                    return null;
                }
            })
        );
        
        // Filter out failed elevation requests
        const validPoints = allPointsWithElevation.filter(p => p !== null);
        
        if (validPoints.length === 0) {
            throw new Error('No valid elevation points found');
        }
        
        // Clear existing visualization
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
        
        // Calculate min/max elevation
        const elevations = validPoints.map(p => p.elevation);
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        
        // Calculate grid layout for SVG
        const gridPadding = 40;
        const availableWidth = SVG_WIDTH - (2 * gridPadding);
        const availableHeight = SVG_HEIGHT - (2 * gridPadding) - 60; // Leave space for legend
        const numRows = allArcPoints.length; // Number of arcs
        const numCols = 10; // Points per arc
        
        // Calculate spacing
        const colSpacing = availableWidth / (numCols - 1);
        const rowSpacing = availableHeight / (numRows - 1);
        
        // Create group for visualization
        const vizGroup = document.createElementNS("http://www.w3.org/2000/svg", 'g');
        vizGroup.setAttribute('transform', `translate(${gridPadding}, ${gridPadding})`);
        
        // Draw points
        validPoints.forEach(point => {
            const color = getElevationColor(point.elevation, minElev, maxElev);
            
            // Add fan pattern circle on map
            const mapCircle = L.circleMarker([point.lat, point.lng], {
                radius: 6,
                color: 'black',
                weight: 1,
                fillColor: color,
                fillOpacity: 0.8
            }).addTo(map);
            
            viewerState.arcPointMarkers.push(mapCircle);
            
            // Add circle to SVG grid
            const circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
            const x = point.pointIndex * colSpacing;
            const y = point.arcIndex * rowSpacing;
            
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', '6');
            circle.setAttribute('fill', color);
            circle.setAttribute('stroke', 'black');
            circle.setAttribute('stroke-width', '1');
            circle.setAttribute('cursor', 'pointer');
            
            // Add hover effect
            circle.addEventListener('mouseover', () => {
                circle.setAttribute('r', '8');
                updateTooltip(point, x + gridPadding, y + gridPadding);
                mapCircle.setStyle({ radius: 8 });
            });
            
            circle.addEventListener('mouseout', () => {
                circle.setAttribute('r', '6');
                hideTooltip();
                mapCircle.setStyle({ radius: 6 });
            });
            
            // Add click handler for zooming
            circle.addEventListener('click', () => {
                map.setView([point.lat, point.lng], 14, {
                    animate: true,
                    duration: 1
                });
                
                // Highlight the clicked point
                viewerState.arcPointMarkers.forEach(m => m.setStyle({ weight: 1 }));
                mapCircle.setStyle({ weight: 3 });
            });
            
            vizGroup.appendChild(circle);
        });
        
        svg.appendChild(vizGroup);
        
        // Add row labels (Arc distances)
        validPoints.forEach(point => {
            if (point.pointIndex === 0) { // Only label first point of each arc
                const label = document.createElementNS("http://www.w3.org/2000/svg", 'text');
                const y = point.arcIndex * rowSpacing;
                label.setAttribute('x', -10);
                label.setAttribute('y', y + 4); // +4 for vertical alignment
                label.setAttribute('text-anchor', 'end');
                label.setAttribute('font-size', '12');
                label.textContent = `${(point.radius / 1000).toFixed(1)}km`;
                vizGroup.appendChild(label);
            }
        });
        
        // Add legend
        const legendGroup = document.createElementNS("http://www.w3.org/2000/svg", 'g');
        legendGroup.setAttribute('transform', `translate(${gridPadding}, ${SVG_HEIGHT - 40})`);
        
        // Add color gradient
        const gradientWidth = 200;
        const gradientHeight = 20;
        
        ELEVATION_COLORS.forEach((color, i) => {
            const rect = document.createElementNS("http://www.w3.org/2000/svg", 'rect');
            const x = (i * gradientWidth) / ELEVATION_COLORS.length;
            rect.setAttribute('x', x);
            rect.setAttribute('y', 0);
            rect.setAttribute('width', gradientWidth / ELEVATION_COLORS.length);
            rect.setAttribute('height', gradientHeight);
            rect.setAttribute('fill', color);
            legendGroup.appendChild(rect);
        });
        
        // Add min/max labels
        const minLabel = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        minLabel.setAttribute('x', 0);
        minLabel.setAttribute('y', gradientHeight + 15);
        minLabel.textContent = `${minElev.toFixed(0)}m`;
        legendGroup.appendChild(minLabel);
        
        const maxLabel = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        maxLabel.setAttribute('x', gradientWidth);
        maxLabel.setAttribute('y', gradientHeight + 15);
        maxLabel.setAttribute('text-anchor', 'end');
        maxLabel.textContent = `${maxElev.toFixed(0)}m`;
        legendGroup.appendChild(maxLabel);
        
        svg.appendChild(legendGroup);
        
        // Update table
        const tbody = document.querySelector('#pointsTable tbody');
        tbody.innerHTML = '';
        validPoints.forEach((point, i) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${i + 1}</td>
                <td>${point.lat.toFixed(6)}</td>
                <td>${point.lng.toFixed(6)}</td>
                <td>${point.elevation.toFixed(1)}</td>
                <td>${(point.radius / 1000).toFixed(1)} km</td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error drawing arc points:', error);
        const text = document.createElementNS("http://www.w3.org/2000/svg", 'text');
        text.setAttribute('x', SVG_WIDTH / 2);
        text.setAttribute('y', SVG_HEIGHT / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'red');
        text.textContent = 'Error loading elevation data';
        svg.appendChild(text);
    } finally {
        setLoading(false);
    }
}

// Map click handler
map.on('click', async (e) => {
    const clickedPoint = e.latlng;
    
    if (!viewerState.standingPoint) {
        // First click - set standing point and draw black square
        viewerState.standingPoint = clickedPoint;
        
        // Create a 20x20 meter square
        const squareBounds = [
            [clickedPoint.lat - 0.0001, clickedPoint.lng - 0.0001],
            [clickedPoint.lat + 0.0001, clickedPoint.lng + 0.0001]
        ];
        viewerState.square = L.rectangle(squareBounds, {
            color: 'black',
            fillColor: 'black',
            fillOpacity: 1,
            weight: 2
        }).addTo(map);
        
    } else if (!viewerState.lookingPoint) {
        // Second click - set looking point and draw circle with arc
        viewerState.lookingPoint = clickedPoint;
        
        try {
            viewerState.setLoading(true);
            
            // Draw circle and arc
            const radius = viewerState.standingPoint.distanceTo(viewerState.lookingPoint);
            viewerState.circle = L.circle(viewerState.standingPoint, {
                color: 'black',
                fillColor: '#3388ff',
                fillOpacity: 0.1,
                radius: radius
            }).addTo(map);
            
            // Draw arc and get points
            viewerState.arc = await drawViewingArc(viewerState.standingPoint, viewerState.lookingPoint, map);
            const arcPoints = calculateArcPoints(viewerState.standingPoint, viewerState.lookingPoint, 10);
            
            // Add elevation data to points
            const pointsWithElevation = await addElevationData(arcPoints.flat());
            
            if (pointsWithElevation.length === 0) {
                throw new Error('No valid elevation points found');
            }
            
            // Create map markers and add them to points for reference
            viewerState.arcPointMarkers = createMapMarkers(pointsWithElevation, map);
            const pointsWithMarkers = pointsWithElevation.map((point, i) => ({
                ...point,
                mapMarker: viewerState.arcPointMarkers[i]
            }));
            
            // Create grid visualization
            createGridVisualization(pointsWithMarkers, svg, map);
            
            // Update data table
            updateDataTable(pointsWithMarkers);
            
        } catch (error) {
            console.error('Error processing click:', error);
            const text = document.createElementNS("http://www.w3.org/2000/svg", 'text');
            text.setAttribute('x', svg.clientWidth / 2);
            text.setAttribute('y', svg.clientHeight / 2);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'red');
            text.textContent = 'Error loading elevation data';
            svg.appendChild(text);
        } finally {
            viewerState.setLoading(false);
        }
        
    } else {
        // Reset on third click
        viewerState.clearAll(map, svg);
    }
}); 