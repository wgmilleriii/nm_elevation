class GPSTracker {
    constructor() {
        this.tracking = false;
        this.trackPoints = [];
        this.startTime = null;
        this.watchId = null;
        this.map = null;
        this.trackLine = null;
        this.currentMarker = null;
        this.updateInterval = 10000; // 10 seconds

        // Initialize UI elements
        this.elements = {
            lat: document.getElementById('current-lat'),
            lon: document.getElementById('current-lon'),
            elevation: document.getElementById('current-elevation'),
            accuracy: document.getElementById('gps-accuracy'),
            pointsCount: document.getElementById('points-collected'),
            distance: document.getElementById('total-distance'),
            duration: document.getElementById('tracking-duration'),
            startButton: document.getElementById('start-tracking'),
            stopButton: document.getElementById('stop-tracking')
        };

        // Initialize map
        this.initializeMap();
        
        // Bind event listeners
        this.elements.startButton.addEventListener('click', () => this.startTracking());
        this.elements.stopButton.addEventListener('click', () => this.stopTracking());
    }

    initializeMap() {
        // Create map centered on New Mexico
        this.map = L.map('map').setView([34.5199, -105.8701], 7);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Initialize track line
        this.trackLine = L.polyline([], {
            color: 'blue',
            weight: 3,
            opacity: 0.7
        }).addTo(this.map);
    }

    async startTracking() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        try {
            // Request permission for high accuracy location
            await this.requestLocationPermission();

            this.tracking = true;
            this.startTime = Date.now();
            this.trackPoints = [];
            
            // Update UI
            this.elements.startButton.disabled = true;
            this.elements.stopButton.disabled = false;

            // Start GPS tracking
            this.watchId = navigator.geolocation.watchPosition(
                position => this.handlePosition(position),
                error => this.handleError(error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );

            // Start duration timer
            this.durationTimer = setInterval(() => this.updateDuration(), 1000);

        } catch (error) {
            console.error('Error starting tracking:', error);
            alert('Failed to start tracking: ' + error.message);
        }
    }

    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        this.tracking = false;
        clearInterval(this.durationTimer);
        
        // Update UI
        this.elements.startButton.disabled = false;
        this.elements.stopButton.disabled = true;

        // Save track data
        this.saveTrackData();
        
        // Update elevation profile one last time
        this.updateElevationProfile();
    }

    async handlePosition(position) {
        const { latitude, longitude, accuracy } = position.coords;
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
                timestamp
            };

            // Add point to track
            this.trackPoints.push(point);

            // Update UI
            this.updateUI(point);
            
            // Update map
            this.updateMap(point);
            
            // Save point to database
            this.savePoint(point);

        } catch (error) {
            console.error('Error handling position:', error);
        }
    }

    async getElevation(lat, lon) {
        try {
            const response = await fetch(`/api/elevation?lat=${lat}&lon=${lon}`);
            const data = await response.json();
            return data.elevation;
        } catch (error) {
            console.error('Error fetching elevation:', error);
            return null;
        }
    }

    updateMap(point) {
        // Update track line
        const latLng = [point.lat, point.lon];
        this.trackLine.addLatLng(latLng);

        // Update current position marker
        if (this.currentMarker) {
            this.currentMarker.setLatLng(latLng);
        } else {
            this.currentMarker = L.marker(latLng).addTo(this.map);
        }

        // Pan map to current location
        this.map.panTo(latLng);
    }

    updateUI(point) {
        // Update current position display
        this.elements.lat.textContent = point.lat.toFixed(6);
        this.elements.lon.textContent = point.lon.toFixed(6);
        this.elements.elevation.textContent = point.elevation ? point.elevation.toFixed(1) : '--';
        this.elements.accuracy.textContent = point.accuracy.toFixed(1);

        // Update statistics
        this.elements.pointsCount.textContent = this.trackPoints.length;
        this.elements.distance.textContent = this.calculateTotalDistance().toFixed(2);
    }

    updateDuration() {
        if (!this.startTime) return;

        const duration = Date.now() - this.startTime;
        const hours = Math.floor(duration / 3600000);
        const minutes = Math.floor((duration % 3600000) / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);

        this.elements.duration.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    calculateTotalDistance() {
        let distance = 0;
        for (let i = 1; i < this.trackPoints.length; i++) {
            distance += this.calculateDistance(
                this.trackPoints[i-1].lat, this.trackPoints[i-1].lon,
                this.trackPoints[i].lat, this.trackPoints[i].lon
            );
        }
        return distance;
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * Math.PI / 180;
    }

    updateElevationProfile() {
        if (this.trackPoints.length < 2) return;

        const distances = [0];
        let totalDistance = 0;
        
        for (let i = 1; i < this.trackPoints.length; i++) {
            totalDistance += this.calculateDistance(
                this.trackPoints[i-1].lat, this.trackPoints[i-1].lon,
                this.trackPoints[i].lat, this.trackPoints[i].lon
            );
            distances.push(totalDistance);
        }

        const elevations = this.trackPoints.map(p => p.elevation);

        const trace = {
            x: distances,
            y: elevations,
            type: 'scatter',
            mode: 'lines',
            name: 'Elevation Profile',
            line: {
                color: '#3498db',
                width: 2
            }
        };

        const layout = {
            title: 'Elevation Profile',
            xaxis: {
                title: 'Distance (km)'
            },
            yaxis: {
                title: 'Elevation (m)'
            },
            margin: { t: 30, l: 50, r: 20, b: 40 }
        };

        Plotly.newPlot('elevation-profile', [trace], layout);
    }

    async savePoint(point) {
        try {
            const response = await fetch('/api/track-point', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(point)
            });

            if (!response.ok) {
                throw new Error('Failed to save track point');
            }
        } catch (error) {
            console.error('Error saving track point:', error);
        }
    }

    async saveTrackData() {
        try {
            const trackData = {
                points: this.trackPoints,
                startTime: this.startTime,
                endTime: Date.now(),
                totalDistance: this.calculateTotalDistance()
            };

            const response = await fetch('/api/save-track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(trackData)
            });

            if (!response.ok) {
                throw new Error('Failed to save track data');
            }
        } catch (error) {
            console.error('Error saving track data:', error);
        }
    }

    async requestLocationPermission() {
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            if (result.state === 'denied') {
                throw new Error('Location permission denied');
            }
        } catch (error) {
            throw new Error('Failed to request location permission: ' + error.message);
        }
    }

    handleError(error) {
        console.error('GPS Error:', error);
        switch(error.code) {
            case error.PERMISSION_DENIED:
                alert('Location permission denied');
                break;
            case error.POSITION_UNAVAILABLE:
                alert('Location information unavailable');
                break;
            case error.TIMEOUT:
                alert('Location request timed out');
                break;
            default:
                alert('An unknown error occurred');
                break;
        }
        this.stopTracking();
    }
}

// Initialize tracker when page loads
document.addEventListener('DOMContentLoaded', () => {
    const tracker = new GPSTracker();
}); 