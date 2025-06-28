// SVG Utilities for handling coordinate transformations and drawing

/**
 * Creates a coordinate transformer for mapping GPS coordinates to SVG viewport
 * @param {Object} gps - GPS bounds {minLat, maxLat, minLon, maxLon}
 * @param {Object} viewport - SVG viewport {width, height, padding}
 * @returns {Object} - Transformer functions
 */
export function createCoordinateTransformer(gps, viewport) {
    const { minLat, maxLat, minLon, maxLon } = gps;
    const { width, height, padding = 50 } = viewport;
    
    // Calculate effective dimensions accounting for padding
    const effectiveWidth = width - (2 * padding);
    const effectiveHeight = height - (2 * padding);
    
    return {
        /**
         * Transform longitude to SVG X coordinate
         */
        lonToX: (lon) => {
            return padding + ((lon - minLon) / (maxLon - minLon)) * effectiveWidth;
        },
        
        /**
         * Transform latitude to SVG Y coordinate
         * Note: SVG Y coordinates increase downward, so we invert the scale
         */
        latToY: (lat) => {
            return height - (padding + ((lat - minLat) / (maxLat - minLat)) * effectiveHeight);
        },
        
        /**
         * Transform a GPS point to SVG coordinates
         */
        pointToSVG: (point) => {
            return {
                x: padding + ((point.lon - minLon) / (maxLon - minLon)) * effectiveWidth,
                y: height - (padding + ((point.lat - minLat) / (maxLat - minLat)) * effectiveHeight)
            };
        },
        
        /**
         * Get SVG viewBox string
         */
        getViewBox: () => `0 0 ${width} ${height}`
    };
}

/**
 * Creates SVG element with proper namespace
 */
export function createSVGElement(type) {
    return document.createElementNS('http://www.w3.org/2000/svg', type);
}

/**
 * Draws a city marker with label
 * @param {Object} city - City data {name, lat, lon, population}
 * @param {Object} transformer - Coordinate transformer
 * @param {Object} style - Visual style options
 * @returns {DocumentFragment} - Fragment containing marker and label
 */
export function drawCityMarker(city, transformer, style) {
    const fragment = document.createDocumentFragment();
    const { x, y } = transformer.pointToSVG(city);
    
    // Create marker circle
    const circle = createSVGElement('circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', style.radius || 5);
    circle.setAttribute('class', 'city-marker');
    circle.setAttribute('data-city', city.name);
    fragment.appendChild(circle);
    
    // Create label with background
    const labelBg = createSVGElement('text');
    labelBg.setAttribute('x', x);
    labelBg.setAttribute('y', y - (style.radius || 5) - 5);
    labelBg.setAttribute('class', 'city-label-bg');
    labelBg.setAttribute('text-anchor', 'middle');
    labelBg.textContent = city.name;
    fragment.appendChild(labelBg);
    
    const label = createSVGElement('text');
    label.setAttribute('x', x);
    label.setAttribute('y', y - (style.radius || 5) - 5);
    label.setAttribute('class', 'city-label');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = city.name;
    fragment.appendChild(label);
    
    return fragment;
}

/**
 * Creates a D3 scale for elevation colors
 * @param {number} minElev - Minimum elevation
 * @param {number} maxElev - Maximum elevation
 * @returns {Function} - Color scale function
 */
export function createElevationColorScale(minElev, maxElev) {
    return d3.scaleSequential(d3.interpolateViridis)
        .domain([minElev, maxElev]);
}

/**
 * Draws elevation points with proper scaling
 * @param {Array} points - Array of elevation points
 * @param {Object} transformer - Coordinate transformer
 * @param {Function} colorScale - D3 color scale function
 * @returns {DocumentFragment} - Fragment containing all point elements
 */
export function drawElevationPoints(points, transformer, colorScale) {
    const fragment = document.createDocumentFragment();
    
    points.forEach(point => {
        const { x, y } = transformer.pointToSVG(point);
        const circle = createSVGElement('circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', 2);
        circle.setAttribute('fill', colorScale(point.elevation));
        circle.setAttribute('class', 'elevation-point');
        fragment.appendChild(circle);
    });
    
    return fragment;
}

/**
 * Creates a legend for elevation colors
 * @param {Object} bounds - Elevation bounds {min, max}
 * @param {Object} position - Legend position {x, y, width, height}
 * @returns {DocumentFragment} - Fragment containing legend elements
 */
export function createElevationLegend(bounds, position) {
    const fragment = document.createDocumentFragment();
    const { min, max } = bounds;
    const { x, y, width, height } = position;
    
    // Create gradient definition
    const defs = createSVGElement('defs');
    const gradient = createSVGElement('linearGradient');
    gradient.setAttribute('id', 'elevation-gradient');
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('y2', '0%');
    
    // Add gradient stops
    const stops = [
        { offset: '0%', color: d3.interpolateViridis(0) },
        { offset: '50%', color: d3.interpolateViridis(0.5) },
        { offset: '100%', color: d3.interpolateViridis(1) }
    ];
    
    stops.forEach(stop => {
        const element = createSVGElement('stop');
        element.setAttribute('offset', stop.offset);
        element.setAttribute('stop-color', stop.color);
        gradient.appendChild(element);
    });
    
    defs.appendChild(gradient);
    fragment.appendChild(defs);
    
    // Create legend rectangle
    const rect = createSVGElement('rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    rect.setAttribute('fill', 'url(#elevation-gradient)');
    fragment.appendChild(rect);
    
    // Add labels
    const labels = [
        { value: min, x: x },
        { value: (min + max) / 2, x: x + width / 2 },
        { value: max, x: x + width }
    ];
    
    labels.forEach(label => {
        const text = createSVGElement('text');
        text.setAttribute('x', label.x);
        text.setAttribute('y', y + height + 15);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('class', 'legend-label');
        text.textContent = `${Math.round(label.value)}m`;
        fragment.appendChild(text);
    });
    
    return fragment;
} 