/**
 * Comprehensive SVG Drawing Library
 * Consolidates all SVG utilities scattered throughout the repository
 * 
 * Features:
 * - Basic shape creation (circles, rectangles, lines, paths, text)
 * - Coordinate transformation utilities
 * - Interactive elements (tooltips, hover effects)
 * - Visualization helpers (legends, grids, axes)
 * - Color mapping and gradient utilities
 * - Advanced drawing patterns
 */

export class SVGDrawingLibrary {
    constructor() {
        this.svgNS = "http://www.w3.org/2000/svg";
        this.defaultStyles = {
            stroke: "#000000",
            strokeWidth: 1,
            fill: "#ffffff",
            fontSize: 12,
            fontFamily: "Arial, sans-serif"
        };
    }

    // ===== CORE SVG ELEMENT CREATION =====

    /**
     * Creates any SVG element with proper namespace
     * @param {string} type - SVG element type (circle, rect, line, etc.)
     * @param {Object} attributes - Key-value pairs of attributes
     * @param {Object} styles - CSS styles to apply
     * @returns {SVGElement}
     */
    createElement(type, attributes = {}, styles = {}) {
        const element = document.createElementNS(this.svgNS, type);
        
        // Apply attributes
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
        
        // Apply styles
        const mergedStyles = { ...this.defaultStyles, ...styles };
        Object.entries(mergedStyles).forEach(([key, value]) => {
            element.style[key] = value;
        });
        
        return element;
    }

    /**
     * Creates an SVG root element
     * @param {number} width - SVG width
     * @param {number} height - SVG height
     * @param {string} viewBox - ViewBox attribute
     * @returns {SVGElement}
     */
    createSVG(width, height, viewBox = null) {
        return this.createElement('svg', {
            width: width,
            height: height,
            viewBox: viewBox || `0 0 ${width} ${height}`,
            preserveAspectRatio: "xMidYMid meet"
        });
    }

    // ===== BASIC SHAPES =====

    /**
     * Creates a circle with optional interactivity
     * @param {number} cx - Center X coordinate
     * @param {number} cy - Center Y coordinate
     * @param {number} r - Radius
     * @param {Object} options - Style and interaction options
     * @returns {SVGCircleElement}
     */
    createCircle(cx, cy, r, options = {}) {
        const {
            fill = "#ffffff",
            stroke = "#000000",
            strokeWidth = 1,
            cursor = "default",
            onHover = null,
            onClick = null,
            onMouseOut = null,
            className = "",
            dataAttributes = {}
        } = options;

        const circle = this.createElement('circle', {
            cx, cy, r,
            fill, stroke,
            'stroke-width': strokeWidth,
            cursor,
            class: className
        });

        // Add data attributes
        Object.entries(dataAttributes).forEach(([key, value]) => {
            circle.setAttribute(`data-${key}`, value);
        });

        // Add event listeners
        if (onHover) {
            circle.addEventListener('mouseover', (e) => {
                circle.setAttribute('r', r * 1.2);
                onHover(e, circle);
            });
        }

        if (onMouseOut) {
            circle.addEventListener('mouseout', (e) => {
                circle.setAttribute('r', r);
                onMouseOut(e, circle);
            });
        }

        if (onClick) {
            circle.addEventListener('click', (e) => onClick(e, circle));
        }

        return circle;
    }

    /**
     * Creates a rectangle
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {Object} options - Style options
     * @returns {SVGRectElement}
     */
    createRectangle(x, y, width, height, options = {}) {
        const {
            fill = "#ffffff",
            stroke = "#000000",
            strokeWidth = 1,
            rx = 0,
            ry = 0,
            className = ""
        } = options;

        return this.createElement('rect', {
            x, y, width, height,
            fill, stroke,
            'stroke-width': strokeWidth,
            rx, ry,
            class: className
        });
    }

    /**
     * Creates a line
     * @param {number} x1 - Start X coordinate
     * @param {number} y1 - Start Y coordinate
     * @param {number} x2 - End X coordinate
     * @param {number} y2 - End Y coordinate
     * @param {Object} options - Style options
     * @returns {SVGLineElement}
     */
    createLine(x1, y1, x2, y2, options = {}) {
        const {
            stroke = "#000000",
            strokeWidth = 1,
            strokeDasharray = "none",
            className = ""
        } = options;

        return this.createElement('line', {
            x1, y1, x2, y2,
            stroke,
            'stroke-width': strokeWidth,
            'stroke-dasharray': strokeDasharray,
            class: className
        });
    }

    /**
     * Creates a path element
     * @param {string} d - Path data
     * @param {Object} options - Style options
     * @returns {SVGPathElement}
     */
    createPath(d, options = {}) {
        const {
            fill = "none",
            stroke = "#000000",
            strokeWidth = 1,
            className = ""
        } = options;

        return this.createElement('path', {
            d,
            fill, stroke,
            'stroke-width': strokeWidth,
            class: className
        });
    }

    /**
     * Creates a text element
     * @param {string} text - Text content
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} options - Style options
     * @returns {SVGTextElement}
     */
    createText(text, x, y, options = {}) {
        const {
            fontSize = 12,
            fontFamily = "Arial, sans-serif",
            fill = "#000000",
            textAnchor = "start",
            className = ""
        } = options;

        const textElement = this.createElement('text', {
            x, y,
            'font-size': fontSize,
            'font-family': fontFamily,
            fill,
            'text-anchor': textAnchor,
            class: className
        });

        textElement.textContent = text;
        return textElement;
    }

    /**
     * Creates a group (g) element
     * @param {Object} options - Style and transform options
     * @returns {SVGGElement}
     */
    createGroup(options = {}) {
        const {
            transform = "",
            className = ""
        } = options;

        return this.createElement('g', {
            transform,
            class: className
        });
    }

    // ===== COORDINATE TRANSFORMATION =====

    /**
     * Creates a coordinate transformer for GPS to SVG conversion
     * @param {Object} gpsBounds - {minLat, maxLat, minLon, maxLon}
     * @param {Object} viewport - {width, height, padding}
     * @returns {Object} Transformer functions
     */
    createCoordinateTransformer(gpsBounds, viewport) {
        const { minLat, maxLat, minLon, maxLon } = gpsBounds;
        const { width, height, padding = 50 } = viewport;
        
        const effectiveWidth = width - (2 * padding);
        const effectiveHeight = height - (2 * padding);
        
        return {
            lonToX: (lon) => padding + ((lon - minLon) / (maxLon - minLon)) * effectiveWidth,
            latToY: (lat) => height - (padding + ((lat - minLat) / (maxLat - minLat)) * effectiveHeight),
            pointToSVG: (point) => ({
                x: padding + ((point.lon - minLon) / (maxLon - minLon)) * effectiveWidth,
                y: height - (padding + ((point.lat - minLat) / (maxLat - minLat)) * effectiveHeight)
            }),
            getViewBox: () => `0 0 ${width} ${height}`,
            gpsBounds,
            viewport
        };
    }

    // ===== INTERACTIVE ELEMENTS =====

    /**
     * Creates a tooltip group
     * @param {SVGElement} parentSvg - Parent SVG element
     * @param {Object} options - Tooltip options
     * @returns {SVGGElement}
     */
    createTooltip(parentSvg, options = {}) {
        const {
            className = "tooltip",
            backgroundColor = "white",
            borderColor = "black",
            borderRadius = 3,
            padding = 5
        } = options;

        const tooltip = this.createGroup({ className });
        tooltip.style.display = 'none';
        
        const rect = this.createRectangle(0, 0, 0, 0, {
            fill: backgroundColor,
            stroke: borderColor,
            rx: borderRadius,
            ry: borderRadius
        });
        
        const text = this.createText("", 0, 0);
        
        tooltip.appendChild(rect);
        tooltip.appendChild(text);
        parentSvg.appendChild(tooltip);
        
        return tooltip;
    }

    /**
     * Updates tooltip content and position
     * @param {SVGGElement} tooltip - Tooltip element
     * @param {string} content - Tooltip content
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Display options
     */
    updateTooltip(tooltip, content, x, y, options = {}) {
        const {
            offsetX = 10,
            offsetY = -10,
            padding = 5
        } = options;

        const text = tooltip.querySelector('text');
        const rect = tooltip.querySelector('rect');
        
        text.textContent = content;
        
        // Update rectangle size based on text
        const bbox = text.getBBox();
        rect.setAttribute('x', bbox.x - padding);
        rect.setAttribute('y', bbox.y - padding);
        rect.setAttribute('width', bbox.width + (2 * padding));
        rect.setAttribute('height', bbox.height + (2 * padding));
        
        tooltip.setAttribute('transform', `translate(${x + offsetX}, ${y + offsetY})`);
        tooltip.style.display = '';
    }

    /**
     * Hides a tooltip
     * @param {SVGGElement} tooltip - Tooltip element
     */
    hideTooltip(tooltip) {
        if (tooltip) tooltip.style.display = 'none';
    }

    // ===== COLOR UTILITIES =====

    /**
     * Creates a color scale for elevation data
     * @param {number} minValue - Minimum value
     * @param {number} maxValue - Maximum value
     * @param {Array} colorPalette - Array of color values
     * @returns {Function} Color mapping function
     */
    createColorScale(minValue, maxValue, colorPalette = null) {
        const defaultPalette = [
            '#000080', '#0000FF', '#0080FF', '#00FFFF',
            '#00FF80', '#00FF00', '#80FF00', '#FFFF00',
            '#FF8000', '#FF0000', '#800000'
        ];
        
        const palette = colorPalette || defaultPalette;
        
        return (value) => {
            if (value < minValue || value > maxValue) return '#cccccc';
            
            const normalizedValue = (value - minValue) / (maxValue - minValue);
            const colorIndex = Math.floor(normalizedValue * (palette.length - 1));
            return palette[Math.min(colorIndex, palette.length - 1)];
        };
    }

    /**
     * Creates an RGB color from elevation using a smooth gradient
     * @param {number} elevation - Elevation value
     * @param {number} minElev - Minimum elevation
     * @param {number} maxElev - Maximum elevation
     * @returns {string} RGB color string
     */
    getElevationColor(elevation, minElev, maxElev) {
        const t = (elevation - minElev) / (maxElev - minElev);
        const r = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 2)));
        const g = Math.round(255 * (1 - Math.abs(t - 0.5) * 2));
        const b = Math.round(255 * Math.max(0, (0.5 - t) * 2));
        return `rgb(${r},${g},${b})`;
    }

    // ===== GRADIENTS AND PATTERNS =====

    /**
     * Creates a linear gradient definition
     * @param {string} id - Gradient ID
     * @param {Array} stops - Array of {offset, color} objects
     * @param {Object} options - Gradient options
     * @returns {SVGLinearGradientElement}
     */
    createLinearGradient(id, stops, options = {}) {
        const {
            x1 = "0%", y1 = "0%",
            x2 = "100%", y2 = "0%"
        } = options;

        const gradient = this.createElement('linearGradient', {
            id, x1, y1, x2, y2
        });

        stops.forEach(stop => {
            const stopElement = this.createElement('stop', {
                offset: stop.offset,
                'stop-color': stop.color
            });
            gradient.appendChild(stopElement);
        });

        return gradient;
    }

    /**
     * Creates a defs section with gradients and patterns
     * @param {Array} gradients - Array of gradient definitions
     * @returns {SVGDefsElement}
     */
    createDefs(gradients = []) {
        const defs = this.createElement('defs');
        gradients.forEach(gradient => defs.appendChild(gradient));
        return defs;
    }

    // ===== VISUALIZATION HELPERS =====

    /**
     * Creates an elevation legend
     * @param {number} minElev - Minimum elevation
     * @param {number} maxElev - Maximum elevation
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Legend options
     * @returns {SVGGElement}
     */
    createElevationLegend(minElev, maxElev, x, y, options = {}) {
        const {
            width = 200,
            height = 20,
            colorPalette = null,
            showLabels = true,
            labelOffset = 15
        } = options;

        const legendGroup = this.createGroup({
            transform: `translate(${x}, ${y})`
        });

        const colorScale = this.createColorScale(minElev, maxElev, colorPalette);
        const segments = colorPalette ? colorPalette.length : 11;

        // Create color segments
        for (let i = 0; i < segments; i++) {
            const segmentWidth = width / segments;
            const elevation = minElev + (i / (segments - 1)) * (maxElev - minElev);
            
            const rect = this.createRectangle(
                i * segmentWidth, 0, segmentWidth, height, {
                    fill: colorScale(elevation),
                    stroke: "none"
                }
            );
            
            legendGroup.appendChild(rect);
        }

        if (showLabels) {
            // Min label
            const minLabel = this.createText(`${minElev.toFixed(0)}m`, 0, height + labelOffset, {
                textAnchor: "start",
                fontSize: 11
            });
            legendGroup.appendChild(minLabel);

            // Max label
            const maxLabel = this.createText(`${maxElev.toFixed(0)}m`, width, height + labelOffset, {
                textAnchor: "end",
                fontSize: 11
            });
            legendGroup.appendChild(maxLabel);
        }

        return legendGroup;
    }

    /**
     * Creates coordinate axes
     * @param {number} width - SVG width
     * @param {number} height - SVG height
     * @param {Object} options - Axis options
     * @returns {SVGGElement}
     */
    createAxes(width, height, options = {}) {
        const {
            padding = 50,
            showLabels = true,
            xLabel = "X Axis",
            yLabel = "Y Axis",
            tickSize = 5,
            tickCount = 5
        } = options;

        const axesGroup = this.createGroup({ className: "axes" });

        // X axis
        const xAxis = this.createLine(
            padding, height - padding,
            width - padding, height - padding,
            { stroke: "#000", strokeWidth: 2 }
        );
        axesGroup.appendChild(xAxis);

        // Y axis
        const yAxis = this.createLine(
            padding, padding,
            padding, height - padding,
            { stroke: "#000", strokeWidth: 2 }
        );
        axesGroup.appendChild(yAxis);

        if (showLabels) {
            // X axis label
            const xLabelElement = this.createText(
                xLabel,
                width / 2,
                height - padding + 35,
                { textAnchor: "middle", fontSize: 14 }
            );
            axesGroup.appendChild(xLabelElement);

            // Y axis label
            const yLabelElement = this.createText(
                yLabel,
                padding - 35,
                height / 2,
                { textAnchor: "middle", fontSize: 14 }
            );
            yLabelElement.setAttribute('transform', `rotate(-90, ${padding - 35}, ${height / 2})`);
            axesGroup.appendChild(yLabelElement);
        }

        return axesGroup;
    }

    /**
     * Creates a grid background
     * @param {number} width - SVG width
     * @param {number} height - SVG height
     * @param {Object} options - Grid options
     * @returns {SVGGElement}
     */
    createGrid(width, height, options = {}) {
        const {
            padding = 50,
            gridSpacing = 50,
            strokeColor = "#e0e0e0",
            strokeWidth = 1
        } = options;

        const gridGroup = this.createGroup({ className: "grid" });

        // Vertical lines
        for (let x = padding; x <= width - padding; x += gridSpacing) {
            const line = this.createLine(x, padding, x, height - padding, {
                stroke: strokeColor,
                strokeWidth
            });
            gridGroup.appendChild(line);
        }

        // Horizontal lines
        for (let y = padding; y <= height - padding; y += gridSpacing) {
            const line = this.createLine(padding, y, width - padding, y, {
                stroke: strokeColor,
                strokeWidth
            });
            gridGroup.appendChild(line);
        }

        return gridGroup;
    }

    // ===== UTILITY METHODS =====

    /**
     * Clears all children from an SVG element
     * @param {SVGElement} svg - SVG element to clear
     */
    clearSVG(svg) {
        while (svg.firstChild) {
            svg.removeChild(svg.firstChild);
        }
    }

    /**
     * Creates a document fragment for efficient DOM manipulation
     * @returns {DocumentFragment}
     */
    createFragment() {
        return document.createDocumentFragment();
    }

    /**
     * Adds multiple elements to a fragment
     * @param {DocumentFragment} fragment - Fragment to add to
     * @param {Array} elements - Array of SVG elements
     */
    addToFragment(fragment, elements) {
        elements.forEach(element => fragment.appendChild(element));
    }

    /**
     * Gets the bounding box of an SVG element
     * @param {SVGElement} element - SVG element
     * @returns {DOMRect} Bounding box
     */
    getBBox(element) {
        return element.getBBox();
    }

    /**
     * Animates an SVG element
     * @param {SVGElement} element - Element to animate
     * @param {Object} properties - Properties to animate
     * @param {number} duration - Animation duration in ms
     * @returns {Animation} Web Animation API animation
     */
    animate(element, properties, duration = 1000) {
        return element.animate(properties, {
            duration,
            easing: 'ease-in-out',
            fill: 'forwards'
        });
    }
}

// Create and export a singleton instance
export const SVGLib = new SVGDrawingLibrary();

// Also export the class for custom instances
export default SVGDrawingLibrary;