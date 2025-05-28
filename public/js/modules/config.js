// SVG Constants
export const SVG_HEIGHT = 300;
export const SVG_WIDTH = document.getElementById('viewerSvg').clientWidth;
export const SVG_PADDING = 50;
export const PROFILE_POINTS = 100;

// Map Constants
export const NM_BOUNDS = {
    minLat: 31.33,
    maxLat: 37.00,
    minLon: -109.05,
    maxLon: -103.00
};

// City coordinates
export const CITIES = {
    albuquerque: { lat: 35.0844, lon: -106.6504, color: '#FF0000', label: 'Albuquerque' },
    corrales: { lat: 35.2375, lon: -106.6067, color: '#00FF00', label: 'Corrales' },
    socorro: { lat: 34.0584, lon: -106.8914, color: '#0000FF', label: 'Socorro' }
};

// Visualization Constants
export const ELEVATION_COLORS = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'];

// SVG Namespace
export const svgNS = "http://www.w3.org/2000/svg"; 