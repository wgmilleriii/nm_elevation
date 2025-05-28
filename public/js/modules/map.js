import { CITIES } from './config.js';
import { getElevationColor } from './svg.js';

// Initialize and configure the map
export function initializeMap() {
    const map = L.map('map').setView([35.0844, -106.6504], 7);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
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
    
    return map;
}

// Create map markers for points
export function createMapMarkers(points, map, onMarkerClick) {
    // Calculate min/max elevation for color scaling
    const elevations = points.map(p => p.elevation);
    const minElev = Math.min(...elevations);
    const maxElev = Math.max(...elevations);
    
    return points.map(point => {
        const color = getElevationColor(point.elevation, minElev, maxElev);
        const mapCircle = L.circleMarker([point.lat, point.lng], {
            radius: 6,
            color: 'black',
            weight: 1,
            fillColor: color,
            fillOpacity: 0.8
        }).addTo(map);
        
        if (onMarkerClick) {
            mapCircle.on('click', () => onMarkerClick(point, mapCircle));
        }
        
        return mapCircle;
    });
} 