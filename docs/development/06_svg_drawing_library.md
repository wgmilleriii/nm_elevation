# SVG Drawing Library Documentation

## Overview

The SVG Drawing Library consolidates all scattered SVG utilities throughout the repository into a comprehensive, well-organized drawing system. This library provides:

- **Unified API** for all SVG operations
- **Interactive elements** (tooltips, hover effects)
- **Coordinate transformation** utilities
- **Specialized visualizations** (elevation, grids, mountain profiles)
- **Color mapping** and gradient utilities
- **Performance optimizations** with document fragments

## Quick Start

```javascript
import { SVGLib } from '../js/lib/SVGDrawingLibrary.js';
import { ElevationVisualization } from '../js/lib/SVGDrawingExtensions.js';

// Basic circle creation
const circle = SVGLib.createCircle(100, 100, 10, {
    fill: '#ff6b6b',
    onHover: (e, element) => console.log('Hovered!'),
    onClick: (e, element) => console.log('Clicked!')
});

// Elevation visualization
const svg = document.getElementById('my-svg');
const elevationViz = new ElevationVisualization(svg);
elevationViz.renderElevationPoints(elevationData);
```

## Core Library (SVGDrawingLibrary.js)

### Basic Shape Creation

#### Circles
```javascript
const circle = SVGLib.createCircle(cx, cy, radius, {
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    onHover: (event, element) => { /* hover handler */ },
    onClick: (event, element) => { /* click handler */ },
    dataAttributes: { elevation: 1500, source: 'api' }
});
```

#### Rectangles
```javascript
const rect = SVGLib.createRectangle(x, y, width, height, {
    fill: '#cccccc',
    stroke: '#000000',
    rx: 5, // rounded corners
    ry: 5
});
```

#### Lines
```javascript
const line = SVGLib.createLine(x1, y1, x2, y2, {
    stroke: '#ff0000',
    strokeWidth: 2,
    strokeDasharray: '5,5' // dashed line
});
```

#### Paths
```javascript
const pathData = 'M10,10 L50,50 L90,10 Z';
const path = SVGLib.createPath(pathData, {
    fill: 'none',
    stroke: '#0066cc',
    strokeWidth: 3
});
```

#### Text
```javascript
const text = SVGLib.createText('Hello World', 100, 50, {
    fontSize: 16,
    fontFamily: 'Arial',
    textAnchor: 'middle',
    fill: '#333'
});
```

### Coordinate Transformation

Essential for converting GPS coordinates to SVG coordinates:

```javascript
const gpsBounds = {
    minLat: 35.0, maxLat: 37.0,
    minLon: -109.0, maxLon: -103.0
};

const viewport = {
    width: 800,
    height: 600,
    padding: 50
};

const transformer = SVGLib.createCoordinateTransformer(gpsBounds, viewport);

// Convert GPS point to SVG coordinates
const svgPoint = transformer.pointToSVG({ lat: 36.0, lon: -106.0 });
// Result: { x: 425, y: 300 }

// Individual transformations
const x = transformer.lonToX(-106.0);
const y = transformer.latToY(36.0);
```

### Interactive Elements

#### Tooltips
```javascript
// Create tooltip
const tooltip = SVGLib.createTooltip(parentSvg, {
    backgroundColor: 'white',
    borderColor: 'black',
    borderRadius: 3
});

// Update tooltip content and position
SVGLib.updateTooltip(tooltip, 'Elevation: 1500m', mouseX, mouseY);

// Hide tooltip
SVGLib.hideTooltip(tooltip);
```

### Color Utilities

#### Color Scales
```javascript
// Create elevation color scale
const colorScale = SVGLib.createColorScale(1000, 3000, [
    '#000080', '#0080ff', '#00ff80', '#ffff00', '#ff0000'
]);

const color = colorScale(1500); // Returns appropriate color

// Built-in elevation color mapping
const elevColor = SVGLib.getElevationColor(1500, 1000, 3000);
// Returns: 'rgb(128, 255, 0)'
```

#### Gradients
```javascript
const gradient = SVGLib.createLinearGradient('my-gradient', [
    { offset: '0%', color: '#ff0000' },
    { offset: '50%', color: '#00ff00' },
    { offset: '100%', color: '#0000ff' }
], {
    x1: '0%', y1: '0%',
    x2: '100%', y2: '0%'
});

const defs = SVGLib.createDefs([gradient]);
svg.appendChild(defs);

// Use gradient in elements
const rect = SVGLib.createRectangle(0, 0, 200, 100, {
    fill: 'url(#my-gradient)'
});
```

### Visualization Helpers

#### Legends
```javascript
const legend = SVGLib.createElevationLegend(1000, 3000, 50, 500, {
    width: 200,
    height: 20,
    showLabels: true
});
```

#### Axes
```javascript
const axes = SVGLib.createAxes(800, 600, {
    padding: 50,
    xLabel: 'Longitude',
    yLabel: 'Latitude',
    showLabels: true
});
```

#### Grid
```javascript
const grid = SVGLib.createGrid(800, 600, {
    padding: 50,
    gridSpacing: 50,
    strokeColor: '#e0e0e0'
});
```

## Extensions Library (SVGDrawingExtensions.js)

### Elevation Visualization

Complete elevation data visualization with automatic bounds calculation and interactive features:

```javascript
import { ElevationVisualization } from '../js/lib/SVGDrawingExtensions.js';

const elevationData = [
    { lat: 35.1, lon: -106.6, elevation: 1500 },
    { lat: 35.2, lon: -106.7, elevation: 1800 },
    // ... more points
];

const svg = document.getElementById('elevation-svg');
const elevationViz = new ElevationVisualization(svg, {
    pointRadius: 4,
    showTooltips: true,
    padding: 60
});

// Render elevation points
elevationViz.renderElevationPoints(elevationData, {
    showLegend: true,
    showAxes: true,
    interactive: true
});

// Create elevation profile
elevationViz.createElevationProfile(profileData, {
    width: 800,
    height: 300,
    showFill: true,
    fillColor: '#4CAF50'
});
```

### Grid Visualization

For heatmaps and grid-based data:

```javascript
import { GridVisualization } from '../js/lib/SVGDrawingExtensions.js';

const gridData = [
    { x: 0, y: 0, value: 10 },
    { x: 1, y: 0, value: 25 },
    // ... more grid points
];

const gridViz = new GridVisualization(svg, {
    gridSize: 50,
    showGridLines: true
});

gridViz.createHeatmapGrid(gridData, {
    showValues: true,
    animateLoad: true
});
```

### Mountain Profile

For mountain silhouettes and terrain visualization:

```javascript
import { MountainProfile } from '../js/lib/SVGDrawingExtensions.js';

const mountainData = [
    { elevation: 1200 },
    { elevation: 1500 },
    { elevation: 2100 },
    // ... elevation points along profile
];

const mountainViz = new MountainProfile(svg);
mountainViz.createSilhouette(mountainData, {
    skyGradient: true,
    interactive: true
});
```

### Utility Functions

#### City Markers
```javascript
import { createCityMarker } from '../js/lib/SVGDrawingExtensions.js';

const city = {
    name: 'Albuquerque',
    lat: 35.0844,
    lon: -106.6504,
    population: 560513
};

const marker = createCityMarker(city, transformer, {
    minRadius: 5,
    maxRadius: 20,
    showLabel: true
});

svg.appendChild(marker);
```

#### Distance Lines
```javascript
import { createDistanceLine } from '../js/lib/SVGDrawingExtensions.js';

const point1 = { lat: 35.0, lon: -106.0 };
const point2 = { lat: 36.0, lon: -105.0 };

const distanceLine = createDistanceLine(point1, point2, transformer, {
    showDistance: true,
    lineStyle: 'dashed',
    color: '#ff4444'
});

svg.appendChild(distanceLine);
```

## Migration Guide

### From Existing SVG Code

#### Before (scattered utilities):
```javascript
// Old way - scattered across files
const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
circle.setAttribute('cx', x);
circle.setAttribute('cy', y);
circle.setAttribute('r', radius);
circle.setAttribute('fill', color);
circle.addEventListener('mouseover', hoverHandler);
svg.appendChild(circle);
```

#### After (unified library):
```javascript
// New way - clean and consistent
const circle = SVGLib.createCircle(x, y, radius, {
    fill: color,
    onHover: hoverHandler
});
svg.appendChild(circle);
```

### Migrating Specific Files

#### public/js/modules/svg.js → SVGDrawingLibrary.js
```javascript
// Old
import { createSVGCircle, updateTooltip } from './modules/svg.js';

// New
import { SVGLib } from './lib/SVGDrawingLibrary.js';
const circle = SVGLib.createCircle(x, y, r, options);
SVGLib.updateTooltip(tooltip, content, x, y);
```

#### public/js/visualization.js → ElevationVisualization
```javascript
// Old
const viz = new Visualization(svg);
viz.processData(data);
viz.draw();

// New
import { ElevationVisualization } from './lib/SVGDrawingExtensions.js';
const viz = new ElevationVisualization(svg);
viz.renderElevationPoints(data);
```

## Performance Tips

1. **Use Document Fragments** for multiple elements:
```javascript
const fragment = SVGLib.createFragment();
SVGLib.addToFragment(fragment, [circle1, circle2, circle3]);
svg.appendChild(fragment);
```

2. **Batch DOM Operations**:
```javascript
// Clear once, then add all elements
SVGLib.clearSVG(svg);
const mainGroup = SVGLib.createGroup();
// Add all elements to group first
svg.appendChild(mainGroup);
```

3. **Use CSS Classes** for styling when possible:
```javascript
const circle = SVGLib.createCircle(x, y, r, {
    className: 'elevation-point-high'
});
```

## Examples Repository

### Basic Elevation Map
```javascript
// Complete example for elevation visualization
import { SVGLib } from './lib/SVGDrawingLibrary.js';
import { ElevationVisualization } from './lib/SVGDrawingExtensions.js';

async function createElevationMap() {
    const svg = document.getElementById('map');
    const data = await fetch('/api/elevation-data').then(r => r.json());
    
    const viz = new ElevationVisualization(svg, {
        pointRadius: 3,
        showTooltips: true
    });
    
    viz.renderElevationPoints(data.points, {
        showLegend: true,
        interactive: true
    });
}
```

### Interactive Grid Heatmap
```javascript
import { GridVisualization } from './lib/SVGDrawingExtensions.js';

function createHeatmap(data) {
    const svg = document.getElementById('heatmap');
    const gridViz = new GridVisualization(svg);
    
    gridViz.createHeatmapGrid(data, {
        showValues: true,
        animateLoad: true
    });
}
```

### Mountain Silhouette with Sky
```javascript
import { MountainProfile } from './lib/SVGDrawingExtensions.js';

function createMountainView(elevationProfile) {
    const svg = document.getElementById('mountain-view');
    const mountain = new MountainProfile(svg);
    
    mountain.createSilhouette(elevationProfile, {
        skyGradient: true,
        interactive: true
    });
}
```

## API Reference

See the JSDoc comments in the source files for complete API documentation:
- `SVGDrawingLibrary.js` - Core functionality
- `SVGDrawingExtensions.js` - Specialized visualizations

## Best Practices

1. **Always use the library** instead of direct `createElementNS` calls
2. **Leverage coordinate transformers** for GPS data
3. **Use extensions** for common visualization patterns
4. **Batch DOM operations** for better performance
5. **Prefer CSS classes** over inline styles when possible
6. **Use data attributes** for storing metadata
7. **Implement proper cleanup** when updating visualizations

## Testing

Test your SVG elements with:
```javascript
// Verify element creation
const circle = SVGLib.createCircle(50, 50, 10);
console.assert(circle.tagName === 'circle');
console.assert(circle.getAttribute('cx') === '50');

// Test coordinate transformation
const transformer = SVGLib.createCoordinateTransformer(bounds, viewport);
const point = transformer.pointToSVG({ lat: 36, lon: -106 });
console.assert(typeof point.x === 'number');
console.assert(typeof point.y === 'number');
```