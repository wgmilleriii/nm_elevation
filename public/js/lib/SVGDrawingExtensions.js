/**
 * SVG Drawing Extensions
 * Specialized utilities for specific visualization patterns found in the repository
 */

import { SVGLib } from './SVGDrawingLibrary.js';

// ===== ELEVATION VISUALIZATION EXTENSIONS =====

export class ElevationVisualization {
    constructor(svg, options = {}) {
        this.svg = svg;
        this.lib = SVGLib;
        this.options = {
            padding: 50,
            pointRadius: 3,
            showTooltips: true,
            colorPalette: null,
            ...options
        };
        this.tooltip = null;
    }

    /**
     * Renders elevation points with automatic bounds calculation
     * @param {Array} points - Array of {lat, lon, elevation} objects
     * @param {Object} options - Rendering options
     */
    renderElevationPoints(points, options = {}) {
        const {
            showLegend = true,
            showAxes = false,
            interactive = true
        } = options;

        // Calculate bounds
        const bounds = this.calculateBounds(points);
        const viewport = {
            width: this.svg.clientWidth || 800,
            height: this.svg.clientHeight || 600,
            padding: this.options.padding
        };

        // Create coordinate transformer
        const transformer = this.lib.createCoordinateTransformer(bounds, viewport);
        
        // Create color scale
        const colorScale = this.lib.createColorScale(
            bounds.minElev, 
            bounds.maxElev, 
            this.options.colorPalette
        );

        // Clear existing content
        this.lib.clearSVG(this.svg);

        // Create main group
        const mainGroup = this.lib.createGroup({ className: 'elevation-points' });

        // Add tooltip if interactive
        if (interactive && this.options.showTooltips) {
            this.tooltip = this.lib.createTooltip(this.svg);
        }

        // Render points
        points.forEach(point => {
            const svgPoint = transformer.pointToSVG(point);
            const color = colorScale(point.elevation);

            const circle = this.lib.createCircle(
                svgPoint.x, svgPoint.y, this.options.pointRadius,
                {
                    fill: color,
                    stroke: '#000',
                    strokeWidth: 0.5,
                    dataAttributes: {
                        lat: point.lat,
                        lon: point.lon,
                        elevation: point.elevation
                    },
                    onHover: interactive ? (e) => {
                        this.showPointTooltip(point, svgPoint.x, svgPoint.y);
                    } : null,
                    onMouseOut: interactive ? () => {
                        this.lib.hideTooltip(this.tooltip);
                    } : null
                }
            );

            mainGroup.appendChild(circle);
        });

        this.svg.appendChild(mainGroup);

        // Add legend
        if (showLegend) {
            const legend = this.lib.createElevationLegend(
                bounds.minElev, bounds.maxElev,
                this.options.padding, viewport.height - 60
            );
            this.svg.appendChild(legend);
        }

        // Add axes
        if (showAxes) {
            const axes = this.lib.createAxes(viewport.width, viewport.height, {
                xLabel: "Longitude",
                yLabel: "Latitude"
            });
            this.svg.appendChild(axes);
        }
    }

    /**
     * Creates a 3D-style elevation profile
     * @param {Array} points - Elevation points along a path
     * @param {Object} options - Styling options
     */
    createElevationProfile(points, options = {}) {
        const {
            width = 800,
            height = 300,
            showFill = true,
            fillColor = '#4CAF50',
            lineColor = '#2E7D32'
        } = options;

        this.lib.clearSVG(this.svg);

        // Calculate bounds
        const maxElev = Math.max(...points.map(p => p.elevation));
        const minElev = Math.min(...points.map(p => p.elevation));
        const padding = this.options.padding;

        // Create path data
        let pathData = '';
        points.forEach((point, i) => {
            const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
            const y = height - (padding + ((point.elevation - minElev) / (maxElev - minElev)) * (height - 2 * padding));
            
            pathData += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
        });

        // Create filled area if requested
        if (showFill) {
            const fillPath = pathData + 
                ` L ${width - padding} ${height - padding}` +
                ` L ${padding} ${height - padding} Z`;
            
            const fillElement = this.lib.createPath(fillPath, {
                fill: fillColor,
                fillOpacity: 0.6,
                stroke: 'none'
            });
            this.svg.appendChild(fillElement);
        }

        // Create line
        const line = this.lib.createPath(pathData, {
            fill: 'none',
            stroke: lineColor,
            strokeWidth: 2
        });
        this.svg.appendChild(line);

        // Add axes
        const axes = this.lib.createAxes(width, height, {
            xLabel: "Distance",
            yLabel: "Elevation (m)"
        });
        this.svg.appendChild(axes);
    }

    calculateBounds(points) {
        return {
            minLat: Math.min(...points.map(p => p.lat)),
            maxLat: Math.max(...points.map(p => p.lat)),
            minLon: Math.min(...points.map(p => p.lon)),
            maxLon: Math.max(...points.map(p => p.lon)),
            minElev: Math.min(...points.map(p => p.elevation)),
            maxElev: Math.max(...points.map(p => p.elevation))
        };
    }

    showPointTooltip(point, x, y) {
        if (this.tooltip) {
            const content = `Lat: ${point.lat.toFixed(4)}\nLon: ${point.lon.toFixed(4)}\nElevation: ${point.elevation.toFixed(1)}m`;
            this.lib.updateTooltip(this.tooltip, content, x, y);
        }
    }
}

// ===== GRID VISUALIZATION EXTENSIONS =====

export class GridVisualization {
    constructor(svg, options = {}) {
        this.svg = svg;
        this.lib = SVGLib;
        this.options = {
            gridSize: 100,
            cellPadding: 2,
            showGridLines: true,
            ...options
        };
    }

    /**
     * Creates a grid-based heatmap
     * @param {Array} data - Array of data points with x, y, value
     * @param {Object} options - Rendering options
     */
    createHeatmapGrid(data, options = {}) {
        const {
            colorScale = null,
            showValues = false,
            animateLoad = false
        } = options;

        const viewport = {
            width: this.svg.clientWidth || 800,
            height: this.svg.clientHeight || 600
        };

        this.lib.clearSVG(this.svg);

        // Calculate grid dimensions
        const cellWidth = (viewport.width - 2 * this.options.cellPadding) / this.options.gridSize;
        const cellHeight = (viewport.height - 2 * this.options.cellPadding) / this.options.gridSize;

        // Create color scale if not provided
        const valueRange = {
            min: Math.min(...data.map(d => d.value)),
            max: Math.max(...data.map(d => d.value))
        };
        
        const colors = colorScale || this.lib.createColorScale(valueRange.min, valueRange.max);

        // Create main group
        const gridGroup = this.lib.createGroup({ className: 'heatmap-grid' });

        // Create grid cells
        data.forEach((item, index) => {
            const x = (item.x * cellWidth) + this.options.cellPadding;
            const y = (item.y * cellHeight) + this.options.cellPadding;

            const cell = this.lib.createRectangle(
                x, y, cellWidth - 1, cellHeight - 1,
                {
                    fill: colors(item.value),
                    stroke: this.options.showGridLines ? '#fff' : 'none',
                    strokeWidth: 0.5,
                    className: 'grid-cell'
                }
            );

            // Add value text if requested
            if (showValues) {
                const text = this.lib.createText(
                    item.value.toFixed(1),
                    x + cellWidth / 2,
                    y + cellHeight / 2,
                    {
                        textAnchor: 'middle',
                        fontSize: Math.min(cellWidth, cellHeight) * 0.3,
                        fill: item.value > (valueRange.max - valueRange.min) / 2 ? '#fff' : '#000'
                    }
                );
                gridGroup.appendChild(text);
            }

            // Add animation if requested
            if (animateLoad) {
                cell.style.opacity = '0';
                setTimeout(() => {
                    this.lib.animate(cell, { opacity: '1' }, 500);
                }, index * 10);
            }

            gridGroup.appendChild(cell);
        });

        this.svg.appendChild(gridGroup);
    }
}

// ===== MOUNTAIN PROFILE EXTENSIONS =====

export class MountainProfile {
    constructor(svg, options = {}) {
        this.svg = svg;
        this.lib = SVGLib;
        this.options = {
            showSilhouette: true,
            showDetails: true,
            ...options
        };
    }

    /**
     * Creates a mountain silhouette from elevation data
     * @param {Array} elevationPoints - Points along the mountain profile
     * @param {Object} options - Styling options
     */
    createSilhouette(elevationPoints, options = {}) {
        const {
            skyGradient = true,
            detailLevel = 'high',
            interactive = false
        } = options;

        const viewport = {
            width: this.svg.clientWidth || 800,
            height: this.svg.clientHeight || 400
        };

        this.lib.clearSVG(this.svg);

        // Create sky gradient if requested
        if (skyGradient) {
            const gradient = this.lib.createLinearGradient('sky-gradient', [
                { offset: '0%', color: '#87CEEB' },
                { offset: '100%', color: '#E0F6FF' }
            ], { x1: '0%', y1: '0%', x2: '0%', y2: '100%' });

            const defs = this.lib.createDefs([gradient]);
            this.svg.appendChild(defs);

            // Sky background
            const sky = this.lib.createRectangle(0, 0, viewport.width, viewport.height, {
                fill: 'url(#sky-gradient)'
            });
            this.svg.appendChild(sky);
        }

        // Create mountain silhouette path
        const pathData = this.createMountainPath(elevationPoints, viewport);
        
        const silhouette = this.lib.createPath(pathData, {
            fill: '#2D3748',
            stroke: 'none',
            className: 'mountain-silhouette'
        });

        this.svg.appendChild(silhouette);

        // Add interactive hit areas if requested
        if (interactive) {
            this.addInteractiveAreas(elevationPoints, viewport);
        }
    }

    createMountainPath(points, viewport) {
        const padding = 20;
        const maxElev = Math.max(...points.map(p => p.elevation));
        const minElev = Math.min(...points.map(p => p.elevation));

        let pathData = `M 0 ${viewport.height}`;

        points.forEach((point, i) => {
            const x = (i / (points.length - 1)) * viewport.width;
            const normalizedElev = (point.elevation - minElev) / (maxElev - minElev);
            const y = viewport.height - (normalizedElev * (viewport.height - padding));
            
            pathData += ` L ${x} ${y}`;
        });

        pathData += ` L ${viewport.width} ${viewport.height} Z`;
        return pathData;
    }

    addInteractiveAreas(points, viewport) {
        points.forEach((point, i) => {
            const x = (i / (points.length - 1)) * viewport.width;
            const y = viewport.height - ((point.elevation - Math.min(...points.map(p => p.elevation))) / 
                     (Math.max(...points.map(p => p.elevation)) - Math.min(...points.map(p => p.elevation)))) * (viewport.height - 20);

            const hitArea = this.lib.createCircle(x, y, 8, {
                fill: 'transparent',
                stroke: 'none',
                cursor: 'pointer',
                onHover: (e) => {
                    // Create temporary tooltip
                    const tooltip = this.lib.createTooltip(this.svg);
                    this.lib.updateTooltip(tooltip, `Elevation: ${point.elevation}m`, x, y);
                },
                onClick: (e) => {
                    console.log(`Clicked point: ${point.elevation}m at position ${i}`);
                }
            });

            this.svg.appendChild(hitArea);
        });
    }
}

// ===== UTILITY FUNCTIONS =====

/**
 * Creates a city marker with population-based sizing
 * @param {Object} city - City data {name, lat, lon, population}
 * @param {Object} transformer - Coordinate transformer
 * @param {Object} options - Styling options
 */
export function createCityMarker(city, transformer, options = {}) {
    const {
        minRadius = 3,
        maxRadius = 15,
        maxPopulation = 1000000,
        showLabel = true
    } = options;

    const { x, y } = transformer.pointToSVG(city);
    const radius = minRadius + ((city.population / maxPopulation) * (maxRadius - minRadius));

    const fragment = SVGLib.createFragment();

    // Marker circle
    const circle = SVGLib.createCircle(x, y, radius, {
        fill: '#FF6B6B',
        stroke: '#fff',
        strokeWidth: 2,
        className: 'city-marker',
        dataAttributes: {
            city: city.name,
            population: city.population
        }
    });

    fragment.appendChild(circle);

    // Label
    if (showLabel) {
        const label = SVGLib.createText(city.name, x, y - radius - 8, {
            textAnchor: 'middle',
            fontSize: Math.max(10, radius * 0.8),
            fill: '#333',
            className: 'city-label'
        });
        fragment.appendChild(label);
    }

    return fragment;
}

/**
 * Creates a distance measurement line between two points
 * @param {Object} point1 - {lat, lon}
 * @param {Object} point2 - {lat, lon}
 * @param {Object} transformer - Coordinate transformer
 * @param {Object} options - Styling options
 */
export function createDistanceLine(point1, point2, transformer, options = {}) {
    const {
        showDistance = true,
        lineStyle = 'dashed',
        color = '#FF4444'
    } = options;

    const p1 = transformer.pointToSVG(point1);
    const p2 = transformer.pointToSVG(point2);

    const fragment = SVGLib.createFragment();

    // Distance line
    const line = SVGLib.createLine(p1.x, p1.y, p2.x, p2.y, {
        stroke: color,
        strokeWidth: 2,
        strokeDasharray: lineStyle === 'dashed' ? '5,5' : 'none'
    });

    fragment.appendChild(line);

    // Distance label
    if (showDistance) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const distance = calculateDistance(point1, point2);

        const label = SVGLib.createText(
            `${distance.toFixed(1)} km`,
            midX, midY - 5,
            {
                textAnchor: 'middle',
                fontSize: 12,
                fill: color,
                className: 'distance-label'
            }
        );

        fragment.appendChild(label);
    }

    return fragment;
}

// Helper function to calculate distance between two GPS points
function calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lon - point1.lon) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export { SVGLib };