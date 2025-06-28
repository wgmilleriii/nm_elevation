// Version information
const VERSION = '1.0.0';

class GPSLiveTracker {
    constructor() {
        this.tracking = false;
        this.trackPoints = [];
        this.map = null;
        this.currentMarker = null;
        this.trackLine = null;
        this.updateInterval = 2000; // Reduced to 2 seconds for better speed updates
        this.maxPoints = 100; // Maximum points to show in elevation profile
        this.userId = null;
        this.sessionId = null;
        this.deviceId = this.getOrCreateDeviceId();
        this.lastHeading = null;
        this.zoomLevel = 18; // Second highest zoom level
        this.maxSpeed = 120; // Maximum expected speed in km/h for the speed bar
        this.speedSamples = []; // Array to store recent speed samples
        this.maxSpeedSamples = 3; // Reduced to 3 samples for more responsive speed
        this.speedHistory = []; // Array to store speed history
        this.maxSpeedHistory = 50; // Maximum number of speed points to show
        this.timeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
        this.isMapInitialized = false;

        // Initialize UI elements
        this.elements = {
            lat: document.getElementById('lat'),
            lon: document.getElementById('lon'),
            elev: document.getElementById('elev'),
            acc: document.getElementById('acc'),
            accIndicator: document.getElementById('acc-indicator'),
            svg: document.getElementById('elevation-svg'),
            speedSvg: document.getElementById('speed-history-svg'),
            heading: document.getElementById('heading'),
            compassArrow: document.getElementById('compass-arrow'),
            speed: document.getElementById('speed'),
            speedBar: document.getElementById('speed-bar'),
            timeAxis: document.querySelector('.time-axis'),
            jsVersion: document.getElementById('js-version'),
            nodeVersion: document.getElementById('node-version')
        };

        // Show version information
        this.showVersionInfo();

        // Initialize map and tracking
        this.initializeUser()
            .then(() => {
                this.initializeMap();
                this.startTracking();
                this.startCompassTracking();
            })
            .catch(error => {
                console.error('Failed to initialize user:', error);
                alert('Failed to initialize tracking. Please try again.');
            });
    }

    async showVersionInfo() {
        // Show JavaScript version
        this.elements.jsVersion.textContent = VERSION;

        // Get Node.js version from server
        try {
            const response = await fetch('/api/version');
            if (response.ok) {
                const data = await response.json();
                this.elements.nodeVersion.textContent = data.version;
            } else {
                this.elements.nodeVersion.textContent = 'Unknown';
            }
        } catch (error) {
            console.error('Failed to get Node.js version:', error);
            this.elements.nodeVersion.textContent = 'Error';
        }
    }

    getOrCreateDeviceId() {
        let deviceId = localStorage.getItem('gps_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2);
            localStorage.setItem('gps_device_id', deviceId);
        }
        return deviceId;
    }

    async initializeUser() {
        try {
            const response = await fetch('/api/user/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: this.deviceId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to initialize user');
            }

            const data = await response.json();
            this.userId = data.userId;

            // Start a new tracking session
            const sessionResponse = await fetch('/api/user/session/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.userId
                })
            });

            if (!sessionResponse.ok) {
                throw new Error('Failed to start session');
            }

            const sessionData = await sessionResponse.json();
            this.sessionId = sessionData.sessionId;

        } catch (error) {
            console.error('Error initializing user:', error);
            throw error;
        }
    }

    initializeMap() {
        // Create map centered on New Mexico
        this.map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
            maxZoom: 19,
            minZoom: 5
        });
        
        // Add dark theme map tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            minZoom: 5
        }).addTo(this.map);

        // Add zoom control to top right
        L.control.zoom({
            position: 'topright'
        }).addTo(this.map);

        // Initialize track line with color gradient
        this.trackLine = L.polyline([], {
            color: '#4a9eff',
            weight: 3,
            opacity: 0.8
        }).addTo(this.map);

        // Create custom marker with direction indicator
        const markerHtml = `
            <div class="direction-marker">
                <div class="direction-arrow"></div>
            </div>
        `;

        // Create marker with custom icon
        this.currentMarker = L.marker([0, 0], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: markerHtml,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            })
        });

        // Set initial view to New Mexico
        this.map.setView([34.5199, -105.8701], 7);
        this.isMapInitialized = true;

        // Request location immediately
        navigator.geolocation.getCurrentPosition(
            position => {
                const { latitude, longitude } = position.coords;
                this.map.setView([latitude, longitude], this.zoomLevel);
            },
            error => console.warn('Could not get initial position:', error),
            { enableHighAccuracy: true }
        );
    }

    startCompassTracking() {
        if (!window.DeviceOrientationEvent) {
            console.warn('Device orientation not supported');
            return;
        }

        // Request permission for iOS 13+ devices
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        this.enableCompass();
                    }
                })
                .catch(console.error);
        } else {
            this.enableCompass();
        }
    }

    enableCompass() {
        window.addEventListener('deviceorientationabsolute', (event) => {
            this.handleHeading(event.alpha);
        }, true);

        // Fallback to regular deviceorientation event
        window.addEventListener('deviceorientation', (event) => {
            if (event.webkitCompassHeading) {
                // iOS compass heading (inverted)
                this.handleHeading(360 - event.webkitCompassHeading);
            } else if (event.alpha) {
                this.handleHeading(event.alpha);
            }
        }, true);
    }

    handleHeading(heading) {
        if (heading !== null && !isNaN(heading)) {
            this.lastHeading = heading;
            
            // Update compass display
            this.elements.heading.textContent = Math.round(heading) + '°';
            this.elements.compassArrow.style.transform = `rotate(${heading}deg)`;

            // Update marker direction
            if (this.currentMarker && this.currentMarker.getElement()) {
                const arrow = this.currentMarker.getElement().querySelector('.direction-arrow');
                if (arrow) {
                    arrow.style.transform = `translate(-50%, -50%) rotate(${heading}deg)`;
                }
            }
        }
    }

    async startTracking() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        try {
            console.log('Requesting GPS permissions...');
            // Request permission for high accuracy location
            const result = await navigator.permissions.query({ name: 'geolocation' });
            console.log('Permission status:', result.state);
            
            if (result.state === 'denied') {
                throw new Error('Location permission denied');
            }

            // Start GPS tracking with debug info
            console.log('Starting GPS tracking...');
            this.watchId = navigator.geolocation.watchPosition(
                position => {
                    console.log('GPS Update received:', {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: new Date(position.timestamp).toLocaleTimeString()
                    });
                    this.handlePosition(position);
                },
                error => {
                    console.error('GPS Error:', {
                        code: error.code,
                        message: error.message,
                        time: new Date().toLocaleTimeString()
                    });
                    this.handleError(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 30000,
                    maximumAge: 0
                }
            );

            console.log('GPS watch started with ID:', this.watchId);

        } catch (error) {
            console.error('Error starting tracking:', error);
            alert('Failed to start tracking: ' + error.message);
        }
    }

    async handlePosition(position) {
        const { latitude, longitude, accuracy, heading } = position.coords;
        const timestamp = position.timestamp;

        // Only collect points at the specified interval
        const lastPoint = this.trackPoints[this.trackPoints.length - 1];
        if (lastPoint && (timestamp - lastPoint.timestamp) < this.updateInterval) {
            return;
        }

        try {
            // Get elevation data
            const elevation = await this.getElevation(latitude, longitude);

            // Create new track point
            const point = {
                lat: latitude,
                lon: longitude,
                elevation,
                accuracy,
                heading: heading || this.lastHeading,
                timestamp
            };

            // Calculate speed if we have previous points
            if (lastPoint) {
                const speed = this.calculateSpeed(lastPoint, point);
                this.updateSpeedDisplay(speed);
                point.speed = speed;
            } else {
                this.updateSpeedDisplay(0);
                point.speed = 0;
            }

            // Add point to track
            this.trackPoints.push(point);
            if (this.trackPoints.length > this.maxPoints) {
                this.trackPoints.shift();
            }

            // Update UI
            this.updateUI(point);
            
            // Update map
            this.updateMap(point);
            
            // Update elevation profile
            this.updateElevationProfile();

            // Save point to database with user info
            await this.savePoint(point);

        } catch (error) {
            console.error('Error handling position:', error);
        }
    }

    async getElevation(lat, lon) {
        try {
            const response = await fetch(`/api/elevation?lat=${lat}&lon=${lon}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch elevation: ${response.statusText}`);
            }
            const data = await response.json();
            return data.elevation;
        } catch (error) {
            console.warn('Using simulated elevation:', error);
            return this.simulateElevation(lat, lon);
        }
    }

    simulateElevation(lat, lon) {
        // Base elevation around 1500m (typical for New Mexico)
        let elevation = 1500;
        
        // Add variation based on latitude (higher in north)
        elevation += (lat - 34) * 100;
        
        // Add some longitude-based variation
        elevation += Math.sin(lon * 0.5) * 200;
        
        // Add some random variation (±100m)
        elevation += (Math.random() - 0.5) * 200;
        
        // Ensure elevation stays within reasonable bounds
        elevation = Math.max(1000, Math.min(4000, elevation));
        
        return elevation;
    }

    updateMap(point) {
        const latLng = [point.lat, point.lon];

        // Update track line
        this.trackLine.addLatLng(latLng);

        // Update current position marker
        if (this.currentMarker) {
            if (!this.map.hasLayer(this.currentMarker)) {
                this.currentMarker.addTo(this.map);
            }
            this.currentMarker.setLatLng(latLng);
        }

        // Set view with zoom level if not already set
        if (this.isMapInitialized) {
            if (!this.map.getBounds().contains(latLng) || this.map.getZoom() !== this.zoomLevel) {
                this.map.setView(latLng, this.zoomLevel, {
                    animate: true,
                    duration: 1
                });
            }
        }
    }

    updateUI(point) {
        // Update coordinates display
        this.elements.lat.textContent = point.lat.toFixed(6);
        this.elements.lon.textContent = point.lon.toFixed(6);
        this.elements.elev.textContent = point.elevation ? point.elevation.toFixed(1) : '--';
        this.elements.acc.textContent = point.accuracy.toFixed(1);

        // Update accuracy indicator
        if (point.accuracy <= 10) {
            this.elements.accIndicator.className = 'accuracy-indicator accuracy-high';
        } else if (point.accuracy <= 30) {
            this.elements.accIndicator.className = 'accuracy-indicator accuracy-medium';
        } else {
            this.elements.accIndicator.className = 'accuracy-indicator accuracy-low';
        }
    }

    updateElevationProfile() {
        const svg = this.elements.svg;
        const width = svg.clientWidth;
        const height = svg.clientHeight;
        const padding = 20;

        // Clear existing content
        svg.innerHTML = '';

        if (this.trackPoints.length < 2) return;

        // Calculate min/max values
        const elevations = this.trackPoints.map(p => p.elevation).filter(e => e !== null);
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        const elevRange = maxElev - minElev;

        // Create scales
        const xScale = (i) => padding + (i * (width - 2 * padding) / (this.trackPoints.length - 1));
        const yScale = (elev) => height - padding - ((elev - minElev) / elevRange) * (height - 2 * padding);

        // Create path data
        let pathData = `M ${xScale(0)} ${yScale(this.trackPoints[0].elevation)}`;
        this.trackPoints.forEach((point, i) => {
            if (i > 0) {
                pathData += ` L ${xScale(i)} ${yScale(point.elevation)}`;
            }
        });

        // Create elevation profile path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#ff4a4a');
        path.setAttribute('stroke-width', '2');
        svg.appendChild(path);

        // Add grid lines
        const gridLines = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gridLines.setAttribute('stroke', '#ffffff22');
        gridLines.setAttribute('stroke-width', '1');

        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding + (i * (height - 2 * padding) / 4);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding);
            line.setAttribute('y1', y);
            line.setAttribute('x2', width - padding);
            line.setAttribute('y2', y);
            gridLines.appendChild(line);

            // Add elevation labels
            const elev = maxElev - (i * elevRange / 4);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', padding - 5);
            text.setAttribute('y', y);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('alignment-baseline', 'middle');
            text.setAttribute('fill', '#ffffff77');
            text.setAttribute('font-size', '10');
            text.textContent = Math.round(elev) + 'm';
            gridLines.appendChild(text);
        }

        svg.appendChild(gridLines);
    }

    async savePoint(point) {
        try {
            const response = await fetch('/api/user/track-point', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.userId,
                    sessionId: this.sessionId,
                    point
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save track point');
            }

            const data = await response.json();
            // Could use stats for additional UI updates if needed
            
        } catch (error) {
            console.error('Error saving track point:', error);
        }
    }

    async endTracking() {
        if (this.sessionId) {
            try {
                const response = await fetch('/api/user/session/end', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: this.userId,
                        sessionId: this.sessionId
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to end session');
                }

                // Clear current session
                this.sessionId = null;

            } catch (error) {
                console.error('Error ending session:', error);
            }
        }
    }

    // Add window unload handler to end session
    setupUnloadHandler() {
        window.addEventListener('beforeunload', () => {
            this.endTracking();
        });
    }

    handleError(error) {
        console.error('GPS Error:', error);
        let errorMessage = '';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location access was denied. Please check your browser settings and ensure location access is enabled. Then refresh the page.';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information is currently unavailable. Please check if GPS is enabled on your device.';
                break;
            case error.TIMEOUT:
                errorMessage = 'Location request timed out. The app will automatically retry. Please ensure you have a clear view of the sky.';
                break;
            default:
                errorMessage = 'An unknown error occurred while getting location. Please check your device settings.';
                break;
        }
        alert(errorMessage);
    }

    calculateSpeed(point1, point2) {
        if (!point1 || !point2) return 0;

        // Calculate distance in meters
        const distance = this.calculateDistance(
            point1.lat,
            point1.lon,
            point2.lat,
            point2.lon
        );

        // Calculate time difference in hours
        const timeDiff = (point2.timestamp - point1.timestamp) / (1000 * 60 * 60);

        // If time difference is too small, might be unreliable
        if (timeDiff < 0.0001) { // less than 0.36 seconds
            console.log('Time difference too small for accurate speed calculation');
            return this.speedSamples.length > 0 ? 
                this.speedSamples[this.speedSamples.length - 1] : 0;
        }

        // Calculate speed in km/h
        const speed = (distance / 1000) / timeDiff;

        // Log speed calculation details
        console.log(`
Speed calculation:
- Distance: ${(distance/1000).toFixed(2)} km
- Time: ${(timeDiff * 60).toFixed(2)} minutes
- Speed: ${speed.toFixed(1)} km/h
- Points: [${point1.lat.toFixed(4)}, ${point1.lon.toFixed(4)}] -> [${point2.lat.toFixed(4)}, ${point2.lon.toFixed(4)}]
        `);

        // Filter out unrealistic speeds (e.g., GPS jumps)
        if (speed > this.maxSpeed || speed < 0) {
            console.log(`Unrealistic speed detected: ${speed.toFixed(1)} km/h - using previous speed`);
            return this.speedSamples.length > 0 ? 
                this.speedSamples[this.speedSamples.length - 1] : 0;
        }

        return speed;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    updateSpeedDisplay(speed) {
        // Add new speed sample
        this.speedSamples.push(speed);
        if (this.speedSamples.length > this.maxSpeedSamples) {
            this.speedSamples.shift();
        }

        // Calculate average speed with more weight on recent samples
        const weights = [0.5, 0.3, 0.2]; // Most recent sample has highest weight
        let avgSpeed = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < this.speedSamples.length; i++) {
            const idx = this.speedSamples.length - 1 - i;
            const weight = weights[i] || weights[weights.length - 1];
            avgSpeed += this.speedSamples[idx] * weight;
            totalWeight += weight;
        }
        
        avgSpeed = avgSpeed / totalWeight;

        // Log speed averaging details
        console.log(`
Speed averaging:
- Raw speed: ${speed.toFixed(1)} km/h
- Samples: [${this.speedSamples.map(s => s.toFixed(1)).join(', ')}]
- Weighted average: ${avgSpeed.toFixed(1)} km/h
        `);

        // Add to speed history
        this.speedHistory.push({
            speed: avgSpeed,
            timestamp: Date.now()
        });

        // Trim speed history if needed
        if (this.speedHistory.length > this.maxSpeedHistory) {
            this.speedHistory.shift();
        }

        // Update speed display
        this.elements.speed.textContent = avgSpeed.toFixed(1);

        // Update speed bar
        const percentage = Math.min((avgSpeed / this.maxSpeed) * 100, 100);
        this.elements.speedBar.style.width = `${percentage}%`;

        // Update color based on speed
        const speedClass = this.getSpeedClass(avgSpeed);
        this.elements.speedBar.style.background = this.getSpeedColor(speedClass);
        this.elements.speed.style.color = this.getSpeedColor(speedClass);

        // Update speed history visualization
        this.updateSpeedHistory();
    }

    getSpeedClass(speed) {
        if (speed < 5) return 'walking';
        if (speed < 20) return 'cycling';
        return 'driving';
    }

    getSpeedColor(speedClass) {
        const colors = {
            walking: '#9f4aff',
            cycling: '#4aff4a',
            driving: '#ff4a4a'
        };
        return colors[speedClass];
    }

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes === 0) return 'now';
        if (minutes === 1) return '1m ago';
        return `${minutes}m ago`;
    }

    formatAbsoluteTime(timestamp) {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    updateTimeAxis() {
        const now = Date.now();
        const labels = this.elements.timeAxis.querySelectorAll('.time-label');
        const totalLabels = labels.length;

        labels.forEach((label, index) => {
            const timeOffset = (totalLabels - 1 - index) * (this.timeWindow / (totalLabels - 1));
            const timestamp = now - timeOffset;

            const relativeLabel = label.querySelector('.relative');
            const absoluteLabel = label.querySelector('.absolute');

            relativeLabel.textContent = this.formatRelativeTime(timestamp);
            absoluteLabel.textContent = this.formatAbsoluteTime(timestamp);
        });
    }

    updateSpeedHistory() {
        const svg = this.elements.speedSvg;
        const width = svg.clientWidth;
        const height = svg.clientHeight - 20; // Account for time axis
        const padding = 20;

        // Clear existing content
        svg.innerHTML = '';

        if (this.speedHistory.length < 2) return;

        const now = Date.now();
        const minTime = now - this.timeWindow;
        const maxTime = now;

        // Filter out old data points
        this.speedHistory = this.speedHistory.filter(point => point.timestamp > minTime);

        // Create scales
        const xScale = (timestamp) => padding + ((timestamp - minTime) / this.timeWindow) * (width - 2 * padding);
        const yScale = (speed) => height - padding - (speed / this.maxSpeed) * (height - 2 * padding);

        // Draw grid lines and labels
        const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        for (let i = 0; i <= 5; i++) {
            const y = padding + (i * (height - 2 * padding) / 5);
            const speed = this.maxSpeed - (i * this.maxSpeed / 5);
            
            // Grid line
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding);
            line.setAttribute('y1', y);
            line.setAttribute('x2', width - padding);
            line.setAttribute('y2', y);
            line.setAttribute('class', 'grid-line');
            gridGroup.appendChild(line);

            // Speed label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', padding - 5);
            text.setAttribute('y', y);
            text.setAttribute('class', 'axis-label');
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('alignment-baseline', 'middle');
            text.textContent = Math.round(speed);
            gridGroup.appendChild(text);
        }
        svg.appendChild(gridGroup);

        // Create paths for each speed class
        const speedClasses = ['walking', 'cycling', 'driving'];
        const paths = {};
        const areas = {};

        speedClasses.forEach(className => {
            // Line path
            paths[className] = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            paths[className].setAttribute('class', `speed-path ${className}`);

            // Area path
            areas[className] = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            areas[className].setAttribute('class', `speed-path speed-area ${className}`);
        });

        // Generate path data for each speed class
        speedClasses.forEach(className => {
            let linePath = '';
            let areaPath = '';
            let started = false;

            this.speedHistory.forEach((point, i) => {
                const x = xScale(point.timestamp);
                const y = yScale(point.speed);
                const currentClass = this.getSpeedClass(point.speed);

                if (currentClass === className) {
                    if (!started) {
                        linePath += `M ${x} ${y}`;
                        areaPath += `M ${x} ${height - padding} L ${x} ${y}`;
                        started = true;
                    } else {
                        linePath += ` L ${x} ${y}`;
                        areaPath += ` L ${x} ${y}`;
                    }

                    // Close area path if it's the last point or next point is different class
                    if (i === this.speedHistory.length - 1 || 
                        this.getSpeedClass(this.speedHistory[i + 1].speed) !== className) {
                        areaPath += ` L ${x} ${height - padding} Z`;
                    }
                }
            });

            if (linePath) {
                paths[className].setAttribute('d', linePath);
                areas[className].setAttribute('d', areaPath);
                svg.appendChild(areas[className]);
                svg.appendChild(paths[className]);
            }
        });

        // Update time axis
        this.updateTimeAxis();
    }
}

// Initialize tracker when page loads
document.addEventListener('DOMContentLoaded', () => {
    const tracker = new GPSLiveTracker();
}); 