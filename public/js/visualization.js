import { CORRALES_LAT, CORRALES_LON, PAISANO_LAT, PAISANO_LON } from './config.js';
import { getColor, getDistanceFromCorrales } from './utils.js';

export class Visualization {
    constructor(svg) {
        this.svg = svg;
        this.points = [];
        this.selectedPoints = [];
        this.width = svg.clientWidth;
        this.height = svg.clientHeight;
        this.padding = 40;
        this.pointRadius = 3;
        this.minLat = Infinity;
        this.maxLat = -Infinity;
        this.minLon = Infinity;
        this.maxLon = -Infinity;
        this.minElev = Infinity;
        this.maxElev = -Infinity;
    }

    processData(data) {
        this.points = Object.entries(data).map(([key, elevation]) => {
            const [lat, lon] = key.split(',').map(Number);
            return { lat, lon, elevation };
        });

        // Update bounds
        this.minLat = Math.min(...this.points.map(p => p.lat));
        this.maxLat = Math.max(...this.points.map(p => p.lat));
        this.minLon = Math.min(...this.points.map(p => p.lon));
        this.maxLon = Math.max(...this.points.map(p => p.lon));
        this.minElev = Math.min(...this.points.map(p => p.elevation));
        this.maxElev = Math.max(...this.points.map(p => p.elevation));

        // Sort points by latitude and longitude
        this.points.sort((a, b) => {
            if (a.lat !== b.lat) return a.lat - b.lat;
            return a.lon - b.lon;
        });
    }

    draw() {
        // Clear existing content
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }

        // Draw points
        this.points.forEach(point => {
            const x = ((point.lon - this.minLon) / (this.maxLon - this.minLon)) * (this.width - 2 * this.padding) + this.padding;
            const y = this.height - (((point.lat - this.minLat) / (this.maxLat - this.minLat)) * (this.height - 2 * this.padding) + this.padding);
            
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", this.pointRadius);
            circle.setAttribute("fill", this.getElevationColor(point.elevation));
            circle.setAttribute("data-lat", point.lat);
            circle.setAttribute("data-lon", point.lon);
            circle.setAttribute("data-elevation", point.elevation);
            
            circle.addEventListener('click', () => this.handlePointClick(circle, point));
            
            this.svg.appendChild(circle);
        });

        // Draw selected points and line
        if (this.selectedPoints.length === 2) {
            this.drawSelectedPoints();
        }
    }

    getElevationColor(elevation) {
        const t = (elevation - this.minElev) / (this.maxElev - this.minElev);
        const r = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 2)));
        const g = Math.round(255 * (1 - Math.abs(t - 0.5) * 2));
        const b = Math.round(255 * Math.max(0, (0.5 - t) * 2));
        return `rgb(${r},${g},${b})`;
    }

    handlePointClick(element, point) {
        if (this.selectedPoints.length === 2) {
            this.selectedPoints = [];
        }
        
        this.selectedPoints.push(point);
        element.setAttribute("stroke", "black");
        element.setAttribute("stroke-width", "2");
        
        if (this.selectedPoints.length === 2) {
            this.drawSelectedPoints();
        }
    }

    drawSelectedPoints() {
        const [point1, point2] = this.selectedPoints;
        
        // Draw line between points
        const x1 = ((point1.lon - this.minLon) / (this.maxLon - this.minLon)) * (this.width - 2 * this.padding) + this.padding;
        const y1 = this.height - (((point1.lat - this.minLat) / (this.maxLat - this.minLat)) * (this.height - 2 * this.padding) + this.padding);
        const x2 = ((point2.lon - this.minLon) / (this.maxLon - this.minLon)) * (this.width - 2 * this.padding) + this.padding;
        const y2 = this.height - (((point2.lat - this.minLat) / (this.maxLat - this.minLat)) * (this.height - 2 * this.padding) + this.padding);
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1);
        line.setAttribute("y1", y1);
        line.setAttribute("x2", x2);
        line.setAttribute("y2", y2);
        line.setAttribute("stroke", "black");
        line.setAttribute("stroke-width", "2");
        line.setAttribute("stroke-dasharray", "5,5");
        
        this.svg.appendChild(line);
    }
} 