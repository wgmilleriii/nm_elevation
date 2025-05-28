import { CORRALES_LAT, CORRALES_LON, PAISANO_LAT, PAISANO_LON } from './config.js';
import { getColor, getDistanceFromCorrales } from './utils.js';

export class Visualization {
    constructor(svg, tooltip) {
        this.svg = svg;
        this.tooltip = tooltip;
        this.currentSvgLine = null;
        this.lastClickedPoint = null;
        this.points = [];
        this.mapManager = null;
        this.bounds = {
            minLat: 0, maxLat: 0,
            minLon: 0, maxLon: 0,
            minElev: 0, maxElev: 0
        };
    }

    showTooltip(event, point) {
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (event.pageX + 10) + 'px';
        this.tooltip.style.top = (event.pageY + 10) + 'px';
        const distance = getDistanceFromCorrales(point.lat, point.lon);
        this.tooltip.innerHTML = `
            Lat: ${point.lat.toFixed(6)}°<br>
            Lon: ${point.lon.toFixed(6)}°<br>
            Elevation: ${Math.round(point.elevation)}m<br>
            Distance: ${distance.toFixed(1)} miles
        `;
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    drawReferencePoints(width, height, heightScale) {
        const corralesX = ((CORRALES_LON - this.bounds.minLon) / (this.bounds.maxLon - this.bounds.minLon)) * width;
        const corralesY = height - (((this.bounds.minElev - this.bounds.minElev) / (this.bounds.maxElev - this.bounds.minElev)) * height * heightScale);
        const paisanoX = ((PAISANO_LON - this.bounds.minLon) / (this.bounds.maxLon - this.bounds.minLon)) * width;
        const paisanoY = height - (((this.bounds.minElev - this.bounds.minElev) / (this.bounds.maxElev - this.bounds.minElev)) * height * heightScale);

        // Draw connecting line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', corralesX);
        line.setAttribute('y1', corralesY);
        line.setAttribute('x2', paisanoX);
        line.setAttribute('y2', paisanoY);
        line.setAttribute('stroke', 'green');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-dasharray', '5,5');
        line.setAttribute('class', 'reference-line');
        this.svg.appendChild(line);

        // Draw reference points and labels
        this.drawReferencePoint(corralesX, corralesY, 'red', 'Corrales');
        this.drawReferencePoint(paisanoX, paisanoY, 'green', '1704 Paisano');

        // Add distance label
        this.addDistanceLabel(corralesX, corralesY, paisanoX, paisanoY);
    }

    drawReferencePoint(x, y, color, label) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x - 10);
        rect.setAttribute('y', y - 10);
        rect.setAttribute('width', '20');
        rect.setAttribute('height', '20');
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', 'white');
        rect.setAttribute('stroke-width', '3');
        rect.setAttribute('class', 'reference-point');
        rect.setAttribute('title', label);
        this.svg.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x);
        text.setAttribute('y', y - 20);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', color);
        text.setAttribute('font-size', '12px');
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('stroke', 'white');
        text.setAttribute('stroke-width', '0.5');
        text.textContent = label;
        this.svg.appendChild(text);
    }

    addDistanceLabel(x1, y1, x2, y2) {
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const distance = getDistanceFromCorrales(PAISANO_LAT, PAISANO_LON);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', midX);
        label.setAttribute('y', midY - 15);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', 'green');
        label.setAttribute('font-size', '14px');
        label.setAttribute('font-weight', 'bold');
        label.setAttribute('stroke', 'white');
        label.setAttribute('stroke-width', '0.5');
        label.textContent = `${distance.toFixed(1)} miles`;
        this.svg.appendChild(label);
    }

    drawLineBetweenPoints(point1, point2) {
        if (this.currentSvgLine) {
            this.currentSvgLine.remove();
        }

        // Create a polygon path between the points
        const x1 = ((point1.lon - this.bounds.minLon) / (this.bounds.maxLon - this.bounds.minLon)) * this.svg.clientWidth;
        const y1 = this.svg.clientHeight - (((point1.elevation - this.bounds.minElev) / (this.bounds.maxElev - this.bounds.minElev)) * this.svg.clientHeight);
        const x2 = ((point2.lon - this.bounds.minLon) / (this.bounds.maxLon - this.bounds.minLon)) * this.svg.clientWidth;
        const y2 = this.svg.clientHeight - (((point2.elevation - this.bounds.minElev) / (this.bounds.maxElev - this.bounds.minElev)) * this.svg.clientHeight);
        
        // Create a polygon with some width
        const width = 10; // Width of the polygon
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const perpX = Math.sin(angle) * width;
        const perpY = -Math.cos(angle) * width;
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const points = [
            [x1 + perpX, y1 + perpY],
            [x1 - perpX, y1 - perpY],
            [x2 - perpX, y2 - perpY],
            [x2 + perpX, y2 + perpY]
        ];
        
        polygon.setAttribute('points', points.map(p => p.join(',')).join(' '));
        polygon.setAttribute('fill', '#ff0000');
        polygon.setAttribute('fill-opacity', '0.3');
        polygon.setAttribute('stroke', '#ff0000');
        polygon.setAttribute('stroke-width', '2');
        this.svg.appendChild(polygon);
        this.currentSvgLine = polygon;

        // Add debug circle at midpoint
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const debugCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        debugCircle.setAttribute('cx', midX);
        debugCircle.setAttribute('cy', midY);
        debugCircle.setAttribute('r', '5');
        debugCircle.setAttribute('fill', 'blue');
        debugCircle.setAttribute('fill-opacity', '0.5');
        this.svg.appendChild(debugCircle);
    }

    processData(elevationData) {
        this.points = Object.entries(elevationData).map(([key, elevation]) => {
            const [lat, lon] = key.split(',').map(Number);
            return { lat, lon, elevation };
        });
        this.points.sort((a, b) => a.lat === b.lat ? a.lon - b.lon : a.lat - b.lat);
        
        // Calculate bounds
        const lats = this.points.map(p => p.lat);
        const lons = this.points.map(p => p.lon);
        const elevations = this.points.map(p => p.elevation);
        this.bounds = {
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLon: Math.min(...lons),
            maxLon: Math.max(...lons),
            minElev: Math.min(...elevations),
            maxElev: Math.max(...elevations)
        };
    }

    draw(targetDistance, opacity, heightScale, mapManager) {
        console.log('Drawing with params:', { targetDistance, opacity, heightScale });
        this.svg.innerHTML = '';
        if (!this.points.length) return;

        // Store mapManager reference
        this.mapManager = mapManager;
        console.log('MapManager set in draw:', this.mapManager);

        // Clear existing markers before drawing new ones
        if (this.mapManager) {
            console.log('Clearing markers before drawing');
            this.mapManager.clearMarkers();
        } else {
            console.error('MapManager not available during draw');
        }

        const width = this.svg.clientWidth;
        const height = this.svg.clientHeight;
        console.log('SVG dimensions:', { width, height });

        // Draw reference points first
        this.drawReferencePoints(width, height, heightScale);

        let pointsDrawn = 0;
        
        // Group points by their east-west (lon) position to simulate columns
        const columns = {};
        this.points.forEach(p => {
            // Always include the first two points regardless of distance
            const isFirstTwoPoints = (p === this.points[0] || p === this.points[1]);
            const distance = getDistanceFromCorrales(p.lat, p.lon);
            if (isFirstTwoPoints || distance <= targetDistance) {
                const lonKey = p.lon.toFixed(4); // Round to 4 decimal places to group nearby points
                if (!columns[lonKey]) {
                    columns[lonKey] = [];
                }
                columns[lonKey].push(p);
            }
        });

        console.log('Points within distance:', Object.values(columns).flat().length);

        // Sort columns by longitude (east-west)
        const sortedColumns = Object.keys(columns).sort((a, b) => parseFloat(a) - parseFloat(b));

        // Draw each column
        sortedColumns.forEach((lonKey, colIndex) => {
            const points = columns[lonKey];
            points.sort((a, b) => a.lat - b.lat); // Sort points in each column by latitude (north-south)

            points.forEach((p, rowIndex) => {
                const x = ((p.lon - this.bounds.minLon) / (this.bounds.maxLon - this.bounds.minLon)) * width;
                const y = height - (((p.elevation - this.bounds.minElev) / (this.bounds.maxElev - this.bounds.minElev)) * height * heightScale);
                
                const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                point.setAttribute('cx', x);
                point.setAttribute('cy', y);
                point.setAttribute('r', '4');
                point.setAttribute('fill', getColor(p.elevation, this.bounds.minElev, this.bounds.maxElev));
                point.setAttribute('fill-opacity', opacity);
                point.setAttribute('class', 'data-point');
                point.setAttribute('data-lat', p.lat);
                point.setAttribute('data-lon', p.lon);
                point.setAttribute('data-elevation', p.elevation);
                point.setAttribute('data-distance', getDistanceFromCorrales(p.lat, p.lon));

                point.addEventListener('mouseover', (e) => this.showTooltip(e, p));
                point.addEventListener('mousemove', (e) => this.showTooltip(e, p));
                point.addEventListener('mouseout', () => this.hideTooltip());
                point.addEventListener('click', () => {
                    console.log('Circle clicked:', p);
                    this.handlePointClick(point, p);
                });

                this.svg.appendChild(point);
                pointsDrawn++;
            });
        });

        console.log('Total points drawn:', pointsDrawn);
        return pointsDrawn;
    }

    handlePointClick(point, pointData) {
        console.log('Handling point click:', pointData);
        console.log('Current mapManager:', this.mapManager);
        
        // Remove clicked-point class from all points
        document.querySelectorAll('.clicked-point').forEach(el => {
            el.classList.remove('clicked-point');
        });
        
        // Add clicked-point class to current point
        point.classList.add('clicked-point');
        
        // Add marker to map
        if (this.mapManager) {
            console.log('Adding marker to map:', pointData);
            const distance = getDistanceFromCorrales(pointData.lat, pointData.lon);
            this.mapManager.addMarker(pointData.lat, pointData.lon, 
                `Elevation: ${Math.round(pointData.elevation)}m\nDistance: ${distance.toFixed(1)} miles`);
        } else {
            console.error('MapManager not available during point click');
        }
        
        if (this.lastClickedPoint) {
            console.log('Drawing line between points:', this.lastClickedPoint, pointData);
            // Draw line in SVG
            this.drawLineBetweenPoints(this.lastClickedPoint, pointData);
            
            // Draw line on map
            if (this.mapManager) {
                this.mapManager.drawLine(this.lastClickedPoint, pointData);
            }
        }
        this.lastClickedPoint = pointData;
    }

    getBounds() {
        return this.bounds;
    }
} 