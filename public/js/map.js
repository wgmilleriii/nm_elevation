import { CORRALES_LAT, CORRALES_LON, PAISANO_LAT, PAISANO_LON } from './config.js';

export class MapManager {
    constructor(mapContainer) {
        console.log('Initializing MapManager with container:', mapContainer);
        this.mapContainer = mapContainer;
        
        // Initialize map centered on US with a more zoomed out view
        this.map = L.map(mapContainer, {
            zoomControl: true,
            attributionControl: true
        }).setView([39.8283, -98.5795], 3);
        
        this.markers = [];
        this.currentLine = null;
        this.shapes = [];
        this.isDrawing = false;
        this.currentShape = null;
        this.points = [];
        
        // Add tile layer with a more visible style
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // Initialize drawing controls
        this.initializeDrawingControls();
        
        console.log('Map initialized:', this.map);
    }

    initializeDrawingControls() {
        document.getElementById('draw-polygon').addEventListener('click', () => {
            console.log('Starting polygon drawing mode');
            this.isDrawing = true;
            this.points = [];
            this.map.once('click', this.startDrawing.bind(this));
        });

        document.getElementById('draw-circle').addEventListener('click', () => {
            console.log('Starting circle drawing mode');
            this.isDrawing = true;
            this.points = [];
            this.map.once('click', this.startCircle.bind(this));
        });

        document.getElementById('clear').addEventListener('click', () => {
            console.log('Clearing all shapes');
            this.shapes.forEach(shape => {
                if (shape) {
                    this.map.removeLayer(shape);
                }
            });
            this.shapes = [];
            if (this.currentShape) {
                this.map.removeLayer(this.currentShape);
                this.currentShape = null;
            }
            this.points = [];
            this.isDrawing = false;
        });
    }

    startDrawing(e) {
        if (!this.isDrawing) {
            console.log('Drawing mode not active');
            return;
        }
        
        console.log(`Adding point at ${e.latlng.lat}, ${e.latlng.lng}`);
        this.points.push([e.latlng.lat, e.latlng.lng]);
        
        if (this.currentShape) {
            this.map.removeLayer(this.currentShape);
        }

        this.currentShape = L.polygon(this.points, {
            color: 'red',
            weight: 3,
            fillOpacity: 0.2,
            fillColor: 'red'
        }).addTo(this.map);

        console.log(`Created polygon with ${this.points.length} points`);

        this.map.on('click', this.continueDrawing.bind(this));
        this.map.once('dblclick', this.finishDrawing.bind(this));
    }

    continueDrawing(e) {
        if (!this.isDrawing) {
            console.log('Drawing mode not active');
            return;
        }
        
        console.log(`Adding point at ${e.latlng.lat}, ${e.latlng.lng}`);
        this.points.push([e.latlng.lat, e.latlng.lng]);
        
        if (this.currentShape) {
            this.map.removeLayer(this.currentShape);
        }

        this.currentShape = L.polygon(this.points, {
            color: 'red',
            weight: 3,
            fillOpacity: 0.2,
            fillColor: 'red'
        }).addTo(this.map);

        console.log(`Updated polygon with ${this.points.length} points`);
    }

    finishDrawing() {
        console.log('Finishing polygon drawing');
        this.isDrawing = false;
        this.map.off('click', this.continueDrawing.bind(this));
        
        if (this.currentShape) {
            this.shapes.push(this.currentShape);
            this.currentShape = null;
        }
        
        this.points = [];
    }

    startCircle(e) {
        if (!this.isDrawing) {
            console.log('Drawing mode not active');
            return;
        }
        
        const center = e.latlng;
        console.log(`Starting circle at ${center.lat}, ${center.lng}`);
        
        if (this.currentShape) {
            this.map.removeLayer(this.currentShape);
        }

        this.currentShape = L.circle(center, {
            radius: 0,
            color: 'blue',
            weight: 3,
            fillOpacity: 0.2,
            fillColor: 'blue'
        }).addTo(this.map);

        this.map.on('mousemove', (e) => {
            const radius = center.distanceTo(e.latlng);
            this.currentShape.setRadius(radius);
        });

        this.map.once('click', () => {
            console.log('Finishing circle drawing');
            this.isDrawing = false;
            this.map.off('mousemove');
            
            if (this.currentShape) {
                this.shapes.push(this.currentShape);
                this.currentShape = null;
            }
        });
    }

    updateView() {
        // Clear existing markers
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
        
        // Add reference markers
        this.addMarker(CORRALES_LAT, CORRALES_LON, 'Corrales', 'red');
        this.addMarker(PAISANO_LAT, PAISANO_LON, '1704 Paisano', 'green');
    }

    addMarker(lat, lon, title = '', color = 'blue') {
        // Remove oldest marker if we already have 2
        if (this.markers.length >= 2) {
            const oldestMarker = this.markers.shift();
            oldestMarker.remove();
        }

        const marker = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.map);
        
        if (title) {
            marker.bindPopup(title);
        }
        
        this.markers.push(marker);
        return marker;
    }

    clearMarkers() {
        // Remove all markers
        this.markers.forEach(marker => marker.remove());
        this.markers = [];
        
        // Clear the line if it exists
        if (this.currentLine) {
            this.currentLine.remove();
            this.currentLine = null;
        }
    }

    drawLine(point1, point2) {
        console.log('Drawing line between points:', point1, point2);
        
        // Remove existing line if any
        if (this.currentLine) {
            console.log('Removing existing line');
            this.currentLine.remove();
        }

        // Create a polygon between the points
        const latlngs = [
            [point1.lat, point1.lon],
            [point2.lat, point2.lon]
        ];

        // Calculate perpendicular points to create width
        const width = 0.01; // Width in degrees
        const midLat = (point1.lat + point2.lat) / 2;
        const midLon = (point1.lon + point2.lon) / 2;
        
        // Create a polygon with width
        const polygon = L.polygon([
            [point1.lat + width, point1.lon],
            [point1.lat - width, point1.lon],
            [point2.lat - width, point2.lon],
            [point2.lat + width, point2.lon]
        ], {
            color: 'red',
            fillColor: 'red',
            fillOpacity: 0.3,
            weight: 2
        }).addTo(this.map);

        // Add debug circle at midpoint
        const debugCircle = L.circle([midLat, midLon], {
            radius: 100, // meters
            color: 'blue',
            fillColor: 'blue',
            fillOpacity: 0.5
        }).addTo(this.map);

        this.currentLine = polygon;
        console.log('Polygon added to map:', polygon);

        // Fit map to show both points
        const bounds = L.latLngBounds(latlngs);
        this.map.fitBounds(bounds, { padding: [50, 50] });
        console.log('Fitting map to bounds:', bounds);
    }

    clearLine() {
        if (this.currentLine) {
            this.currentLine.remove();
            this.currentLine = null;
        }
    }

    setMapType(type) {
        if (type === 'satellite') {
            this.map.removeLayer(this.map.getLayers()[0]);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            }).addTo(this.map);
        } else {
            this.map.removeLayer(this.map.getLayers()[0]);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
        }
    }
} 