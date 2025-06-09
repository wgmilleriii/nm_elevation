import { CORRALES_LAT, CORRALES_LON, PAISANO_LAT, PAISANO_LON, CHICAGO_LAT, CHICAGO_LON } from './config.js';

export class MapManager {
    constructor(mapContainer) {
        console.log('Initializing MapManager with container:', mapContainer);
        this.mapContainer = mapContainer;
        
        // Initialize debug logging
        this.initializeDebugLogging();
        
        // Initialize map centered on New Mexico
        this.map = L.map(mapContainer, {
            zoomControl: true,
            attributionControl: true
        }).setView([34.5199, -106.2845], 7);  // Center of New Mexico, zoom level 7
        
        this.markers = [];
        this.currentLine = null;
        this.shapes = [];
        this.isDrawing = false;
        this.currentShape = null;
        this.points = [];
        this.locationMarker = null;
        this.locationCircle = null;
        this.pointCountDiv = null;
        
        // Add tile layer with a more visible style
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // Add New Mexico boundary rectangle
        L.rectangle([
            [31.33, -109.05],  // Southwest corner
            [37.00, -103.00]   // Northeast corner
        ], {
            color: "#ff7800",
            weight: 2,
            fill: false,
            dashArray: '5, 10',
            opacity: 0.8
        }).addTo(this.map);
        
        // Initialize drawing controls
        this.initializeDrawingControls();
        
        // Initialize location finding
        this.initializeLocationFinding();

        // Create point count display
        this.createPointCountDisplay();
        
        // Initialize map movement tracking
        this.initializeMapMovement();
        
        console.log('Map initialized:', this.map);
    }

    initializeDebugLogging() {
        // Create debug container
        const debugContainer = document.createElement('div');
        debugContainer.className = 'debug-container';
        document.body.appendChild(debugContainer);

        // Create header
        const header = document.createElement('div');
        header.className = 'debug-header';
        header.innerHTML = '<div class="debug-title">Debug Log</div>';
        debugContainer.appendChild(header);

        // Create content area
        const content = document.createElement('div');
        content.className = 'debug-content';
        debugContainer.appendChild(content);

        // Create toggle button
        const toggle = document.createElement('button');
        toggle.id = 'debug-global-toggle';
        toggle.textContent = 'Debug Log';
        document.body.appendChild(toggle);

        // Toggle functionality
        let isHidden = false;
        toggle.addEventListener('click', () => {
            isHidden = !isHidden;
            debugContainer.classList.toggle('hidden', isHidden);
        });

        header.addEventListener('click', () => {
            isHidden = !isHidden;
            debugContainer.classList.toggle('hidden', isHidden);
        });

        // Add logging methods
        this.debug = {
            log: (message, type = '') => {
                const line = document.createElement('div');
                line.className = `debug-line ${type}`;
                const time = new Date().toLocaleTimeString();
                line.textContent = `[${time}] ${message}`;
                content.appendChild(line);
                content.scrollTop = content.scrollHeight;
                console.log(message);
            },
            error: (message) => {
                this.debug.log(message, 'error');
                console.error(message);
            }
        };
    }

    createPointCountDisplay() {
        // Create a div for point count display
        this.pointCountDiv = L.DomUtil.create('div', 'point-count-display');
        this.pointCountDiv.style.position = 'absolute';
        this.pointCountDiv.style.bottom = '20px';
        this.pointCountDiv.style.left = '20px';
        this.pointCountDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        this.pointCountDiv.style.padding = '10px';
        this.pointCountDiv.style.borderRadius = '4px';
        this.pointCountDiv.style.zIndex = '1000';
        this.pointCountDiv.style.fontSize = '14px';
        this.pointCountDiv.style.fontFamily = 'Arial, sans-serif';
        this.mapContainer.appendChild(this.pointCountDiv);
    }

    initializeMapMovement() {
        // Debounce the update to avoid too many requests
        let timeout;
        const updatePointCount = async () => {
            const bounds = this.map.getBounds();
            this.debug.log(`Map bounds: ${bounds.getSouth()}, ${bounds.getWest()}, ${bounds.getNorth()}, ${bounds.getEast()}`, 'map-movement');
            
            try {
                this.debug.log('Sending request to /api/elevation-data', 'api-request');
                const response = await fetch(
                    `/api/elevation-data?bounds=${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`
                );
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
                }
                
                const data = await response.json();
                this.debug.log(`Received data with ${data.points?.length || 0} points`, 'api-response');
                
                if (data.stats) {
                    this.debug.log(`Stats: ${JSON.stringify(data.stats, null, 2)}`, 'api-response');
                    this.pointCountDiv.innerHTML = `
                        Points in view: ${data.stats.total_points}<br>
                        Min elevation: ${Math.round(data.stats.min_elevation)}m<br>
                        Max elevation: ${Math.round(data.stats.max_elevation)}m<br>
                        Avg elevation: ${Math.round(data.stats.avg_elevation)}m
                    `;

                    // Get the SVG element
                    const svg = document.getElementById('mountain-svg');
                    
                    // Clear existing content
                    while (svg.firstChild) {
                        svg.removeChild(svg.firstChild);
                    }

                    // Get SVG dimensions
                    const svgRect = svg.getBoundingClientRect();
                    const width = svgRect.width;
                    const height = svgRect.height;

                    // Get the map's bounds for coordinate conversion
                    const mapBounds = this.map.getBounds();
                    const mapSouth = mapBounds.getSouth();
                    const mapNorth = mapBounds.getNorth();
                    const mapWest = mapBounds.getWest();
                    const mapEast = mapBounds.getEast();

                    // Create SVG group for all points
                    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

                    // Grid configuration
                    const GRID_SIZE = 100;
                    const circleRadius = Math.min(width, height) / (GRID_SIZE * 2.2); // Slight gap between circles
                    
                    // Create lookup map for quick access to elevation data
                    const elevationMap = new Map();
                    data.points.forEach(point => {
                        elevationMap.set(`${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`, point.elevation);
                    });

                    // Function to get color based on elevation
                    const getColor = (elevation) => {
                        if (elevation === null) return '#cccccc'; // Default gray for no data
                        const t = (elevation - data.stats.min_elevation) / (data.stats.max_elevation - data.stats.min_elevation);
                        const r = Math.round(255 * Math.min(1, Math.max(0, (t - 0.5) * 2)));
                        const g = Math.round(255 * (1 - Math.abs(t - 0.5) * 2));
                        const b = Math.round(255 * Math.max(0, (0.5 - t) * 2));
                        return `rgb(${r},${g},${b})`;
                    };

                    // Function to find closest elevation point
                    const findClosestElevation = (lat, lon) => {
                        const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
                        if (elevationMap.has(key)) return elevationMap.get(key);

                        // If no exact match, find closest point
                        let closestDist = Infinity;
                        let closestElev = null;
                        
                        data.points.forEach(point => {
                            const dist = Math.pow(point.latitude - lat, 2) + Math.pow(point.longitude - lon, 2);
                            if (dist < closestDist) {
                                closestDist = dist;
                                closestElev = point.elevation;
                            }
                        });

                        return closestElev;
                    };

                    // Create 100x100 grid
                    for (let i = 0; i < GRID_SIZE; i++) {
                        for (let j = 0; j < GRID_SIZE; j++) {
                            // Calculate lat/lon for this grid position
                            const lat = mapNorth - (i / GRID_SIZE) * (mapNorth - mapSouth);
                            const lon = mapWest + (j / GRID_SIZE) * (mapEast - mapWest);
                            
                            // Calculate pixel coordinates
                            const x = (j / GRID_SIZE) * width;
                            const y = (i / GRID_SIZE) * height;

                            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                            circle.setAttribute("cx", x);
                            circle.setAttribute("cy", y);
                            circle.setAttribute("r", circleRadius);
                            
                            // Initially set to light grey
                            circle.setAttribute("fill", "#cccccc");
                            circle.setAttribute("stroke", "white");
                            circle.setAttribute("stroke-width", Math.max(0.5, circleRadius / 10));
                            
                            // Store lat/lon data
                            circle.setAttribute("data-lat", lat.toFixed(4));
                            circle.setAttribute("data-lon", lon.toFixed(4));
                            
                            // Add hover effect
                            circle.addEventListener('mouseover', (e) => {
                                const thisLat = parseFloat(e.target.getAttribute("data-lat"));
                                const thisLon = parseFloat(e.target.getAttribute("data-lon"));
                                const elevation = findClosestElevation(thisLat, thisLon);
                                
                                e.target.setAttribute("r", circleRadius * 1.2);
                                const tooltip = document.createElement("div");
                                tooltip.className = "point-tooltip";
                                tooltip.innerHTML = `Lat: ${thisLat}<br>
                                                  Lon: ${thisLon}<br>
                                                  Elevation: ${elevation !== null ? elevation + 'm' : 'No data'}`;
                                document.body.appendChild(tooltip);
                                tooltip.style.left = (e.pageX + 10) + "px";
                                tooltip.style.top = (e.pageY + 10) + "px";
                            });
                            
                            circle.addEventListener('mouseout', (e) => {
                                e.target.setAttribute("r", circleRadius);
                                const tooltips = document.getElementsByClassName("point-tooltip");
                                Array.from(tooltips).forEach(t => t.remove());
                            });

                            group.appendChild(circle);
                        }
                    }

                    // Add the group to the SVG
                    svg.appendChild(group);

                    // Now update colors based on elevation data
                    requestAnimationFrame(() => {
                        const circles = group.getElementsByTagName('circle');
                        Array.from(circles).forEach(circle => {
                            const lat = parseFloat(circle.getAttribute("data-lat"));
                            const lon = parseFloat(circle.getAttribute("data-lon"));
                            const elevation = findClosestElevation(lat, lon);
                            circle.setAttribute("fill", getColor(elevation));
                            if (elevation !== null) {
                                circle.setAttribute("data-elevation", elevation);
                            }
                        });
                    });

                    // Add count text
                    const countText = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    countText.setAttribute("x", "10");
                    countText.setAttribute("y", "20");
                    countText.setAttribute("fill", "black");
                    countText.textContent = `100x100 grid (${GRID_SIZE * GRID_SIZE} points)`;
                    svg.appendChild(countText);
                } else {
                    this.debug.log('No stats in response data', 'error');
                }
            } catch (error) {
                this.debug.error(`Error fetching point count: ${error.message}`);
                this.pointCountDiv.textContent = 'Error fetching point count';
            }
        };

        // Log map events
        this.map.on('movestart', () => {
            this.debug.log('Map movement started', 'map-movement');
        });

        this.map.on('zoomstart', () => {
            this.debug.log('Map zoom started', 'map-movement');
        });

        this.map.on('moveend', () => {
            this.debug.log('Map movement ended, scheduling update', 'map-movement');
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.debug.log('Executing delayed update', 'map-movement');
                updatePointCount();
            }, 300);
        });

        // Initial update
        this.debug.log('Performing initial point count update', 'map-movement');
        updatePointCount();
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

    initializeLocationFinding() {
        const locateButton = document.getElementById('locate-me');
        if (locateButton) {
            locateButton.addEventListener('click', () => this.findUserLocation());
        }

        const chicagoButton = document.getElementById('chicago-button');
        if (chicagoButton) {
            chicagoButton.addEventListener('click', () => this.goToChicago());
        }
    }

    findUserLocation() {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by your browser');
            return;
        }

        // Remove existing location markers
        if (this.locationMarker) {
            this.map.removeLayer(this.locationMarker);
        }
        if (this.locationCircle) {
            this.map.removeLayer(this.locationCircle);
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                // Create a marker at the user's location
                this.locationMarker = L.marker([lat, lng])
                    .addTo(this.map)
                    .bindPopup('You are here')
                    .openPopup();

                // Create an accuracy circle
                this.locationCircle = L.circle([lat, lng], {
                    radius: accuracy,
                    color: '#4CAF50',
                    fillColor: '#4CAF50',
                    fillOpacity: 0.1
                }).addTo(this.map);

                // Zoom to fit both the marker and the accuracy circle
                const bounds = L.latLngBounds([
                    [lat - accuracy/111320, lng - accuracy/111320], // 111320 meters per degree
                    [lat + accuracy/111320, lng + accuracy/111320]
                ]);
                this.map.fitBounds(bounds);

                // If accuracy is very good (less than 100 meters), zoom in closer
                if (accuracy < 100) {
                    this.map.setZoom(17);
                }

                console.log(`Location found: ${lat}, ${lng} (accuracy: ${accuracy}m)`);
            },
            (error) => {
                console.error('Error getting location:', error.message);
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        alert('Please enable location services to use this feature.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        alert('Location information is unavailable.');
                        break;
                    case error.TIMEOUT:
                        alert('Location request timed out.');
                        break;
                    default:
                        alert('An unknown error occurred while finding your location.');
                        break;
                }
            },
            {
                enableHighAccuracy: true, // Request high accuracy
                timeout: 10000,          // Time out after 10 seconds
                maximumAge: 0            // Always get fresh location
            }
        );
    }

    goToChicago() {
        console.log('Going to Chicago');
        this.map.setView([CHICAGO_LAT, CHICAGO_LON], 12);
        
        // Remove any existing Chicago marker
        this.markers = this.markers.filter(marker => {
            if (marker.getLatLng().lat === CHICAGO_LAT && marker.getLatLng().lng === CHICAGO_LON) {
                marker.remove();
                return false;
            }
            return true;
        });
        
        // Add marker for Chicago
        const marker = L.circleMarker([CHICAGO_LAT, CHICAGO_LON], {
            radius: 8,
            fillColor: 'purple',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.map);
        
        marker.bindPopup('Chicago').openPopup();
        this.markers.push(marker);
    }
} 