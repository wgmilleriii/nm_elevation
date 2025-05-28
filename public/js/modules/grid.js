import { createSVGCircle, updateTooltip, hideTooltip, createLegend, createRowLabels } from './svg.js';
import { getElevationColor } from './svg.js';
import { SVG_HEIGHT, SVG_WIDTH, svgNS } from './config.js';

export function createGridVisualization(points, svg, map) {
    // Clear existing visualization
    while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
    }
    
    // Calculate min/max elevation
    const elevations = points.map(p => p.elevation);
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    
    // Calculate grid layout
    const gridPadding = 40;
    const availableWidth = SVG_WIDTH - (2 * gridPadding);
    const availableHeight = SVG_HEIGHT - (2 * gridPadding) - 60; // Leave space for legend
    const numRows = Math.max(...points.map(p => p.arcIndex)) + 1;
    const numCols = 10;
    
    // Calculate spacing
    const colSpacing = availableWidth / (numCols - 1);
    const rowSpacing = availableHeight / (numRows - 1);
    
    // Create group for visualization
    const vizGroup = document.createElementNS(svgNS, 'g');
    vizGroup.setAttribute('transform', `translate(${gridPadding}, ${gridPadding})`);
    
    // Draw points
    points.forEach(point => {
        const x = point.pointIndex * colSpacing;
        const y = point.arcIndex * rowSpacing;
        const color = getElevationColor(point.elevation, minElev, maxElev);
        
        // Create circle with hover and click handlers
        const circle = createSVGCircle(
            x,
            y,
            color,
            {
                onMouseOver: () => {
                    updateTooltip(point, x + gridPadding, y + gridPadding, svg);
                    point.mapMarker.setStyle({ radius: 8 });
                },
                onMouseOut: () => {
                    hideTooltip(svg);
                    point.mapMarker.setStyle({ radius: 6 });
                }
            },
            () => {
                map.setView([point.lat, point.lng], 14, {
                    animate: true,
                    duration: 1
                });
                points.forEach(p => p.mapMarker.setStyle({ weight: 1 }));
                point.mapMarker.setStyle({ weight: 3 });
            }
        );
        
        vizGroup.appendChild(circle);
    });
    
    // Add row labels
    const labels = createRowLabels(points, rowSpacing, gridPadding);
    vizGroup.appendChild(labels);
    
    svg.appendChild(vizGroup);
    
    // Add legend
    const legend = createLegend(minElev, maxElev, gridPadding, SVG_HEIGHT - 40);
    svg.appendChild(legend);
    
    return vizGroup;
}

export function updateDataTable(points) {
    const tbody = document.querySelector('#pointsTable tbody');
    tbody.innerHTML = '';
    points.forEach((point, i) => {
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
} 