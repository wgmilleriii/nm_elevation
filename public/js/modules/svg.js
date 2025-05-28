import { svgNS, ELEVATION_COLORS, SVG_HEIGHT } from './config.js';

// Get color based on elevation
export function getElevationColor(elevation, minElev, maxElev) {
    const normalizedValue = (elevation - minElev) / (maxElev - minElev);
    const colorIndex = Math.floor(normalizedValue * (ELEVATION_COLORS.length - 1));
    return ELEVATION_COLORS[Math.min(colorIndex, ELEVATION_COLORS.length - 1)];
}

// Create SVG circle element
export function createSVGCircle(x, y, color, onHover, onClick) {
    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '6');
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', 'black');
    circle.setAttribute('stroke-width', '1');
    circle.setAttribute('cursor', 'pointer');
    
    if (onHover) {
        circle.addEventListener('mouseover', () => {
            circle.setAttribute('r', '8');
            onHover.onMouseOver();
        });
        circle.addEventListener('mouseout', () => {
            circle.setAttribute('r', '6');
            onHover.onMouseOut();
        });
    }
    
    if (onClick) {
        circle.addEventListener('click', onClick);
    }
    
    return circle;
}

// Create tooltip
export function createTooltip(svg) {
    const tooltip = document.createElementNS(svgNS, 'g');
    tooltip.setAttribute('class', 'tooltip');
    tooltip.style.display = 'none';
    
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('fill', 'white');
    rect.setAttribute('stroke', 'black');
    rect.setAttribute('rx', '3');
    rect.setAttribute('ry', '3');
    tooltip.appendChild(rect);
    
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('fill', 'black');
    tooltip.appendChild(text);
    
    svg.appendChild(tooltip);
    return tooltip;
}

// Update tooltip
export function updateTooltip(point, x, y, svg) {
    const tooltip = svg.querySelector('.tooltip') || createTooltip(svg);
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

// Hide tooltip
export function hideTooltip(svg) {
    const tooltip = svg.querySelector('.tooltip');
    if (tooltip) tooltip.style.display = 'none';
}

// Create elevation legend
export function createLegend(minElev, maxElev, x, y) {
    const legendGroup = document.createElementNS(svgNS, 'g');
    legendGroup.setAttribute('transform', `translate(${x}, ${y})`);
    
    // Add color gradient
    const gradientWidth = 200;
    const gradientHeight = 20;
    
    ELEVATION_COLORS.forEach((color, i) => {
        const rect = document.createElementNS(svgNS, 'rect');
        const rectX = (i * gradientWidth) / ELEVATION_COLORS.length;
        rect.setAttribute('x', rectX);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', gradientWidth / ELEVATION_COLORS.length);
        rect.setAttribute('height', gradientHeight);
        rect.setAttribute('fill', color);
        legendGroup.appendChild(rect);
    });
    
    // Add min/max labels
    const minLabel = document.createElementNS(svgNS, 'text');
    minLabel.setAttribute('x', 0);
    minLabel.setAttribute('y', gradientHeight + 15);
    minLabel.textContent = `${minElev.toFixed(0)}m`;
    legendGroup.appendChild(minLabel);
    
    const maxLabel = document.createElementNS(svgNS, 'text');
    maxLabel.setAttribute('x', gradientWidth);
    maxLabel.setAttribute('y', gradientHeight + 15);
    maxLabel.setAttribute('text-anchor', 'end');
    maxLabel.textContent = `${maxElev.toFixed(0)}m`;
    legendGroup.appendChild(maxLabel);
    
    return legendGroup;
}

// Create row labels
export function createRowLabels(points, rowSpacing, gridPadding) {
    const labels = document.createElementNS(svgNS, 'g');
    
    points.forEach(point => {
        if (point.pointIndex === 0) {
            const label = document.createElementNS(svgNS, 'text');
            const y = point.arcIndex * rowSpacing;
            label.setAttribute('x', -10);
            label.setAttribute('y', y + 4);
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('font-size', '12');
            label.textContent = `${(point.radius / 1000).toFixed(1)}km`;
            labels.appendChild(label);
        }
    });
    
    return labels;
} 