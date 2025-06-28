// Version information
const VERSION = '3.2.0';

class GPSLiveTracker {
    constructor() {
        // Enhanced logging for iPhone debugging
        console.log('🚀 GPS Live Tracker v3.4.5 starting...');
        console.log('📱 User Agent:', navigator.userAgent);
        console.log('🌐 Location:', window.location.href);
        console.log('⏰ Timestamp:', new Date().toISOString());
        console.log('📍 Geolocation available:', !!navigator.geolocation);
        console.log('🔒 HTTPS:', window.location.protocol === 'https:');
        
        // Log any immediate errors to server
        this.logToServer('info', 'GPS Tracker Constructor Started', {
            userAgent: navigator.userAgent,
            location: window.location.href,
            timestamp: new Date().toISOString(),
            hasGeolocation: !!navigator.geolocation,
            isHTTPS: window.location.protocol === 'https:'
        });
        
        this.tracking = false;
        this.trackPoints = [];
        this.map = null;
        this.currentMarker = null;
        this.trackLine = null;
        this.updateInterval = 1000; // Increased to 1 second for constant updates
        this.maxPoints = 200; // Increased points for better tracking
        this.userId = null;
        this.sessionId = null;
        this.sessionNumber = 0;
        this.deviceId = this.getOrCreateDeviceId();
        this.lastHeading = null;
        this.zoomLevel = 16; // Zoomed out 3 levels from max (19-3=16)
        this.maxSpeed = 120; // Maximum expected speed in km/h for the speed bar
        this.speedSamples = []; // Array to store recent speed samples
        this.maxSpeedSamples = 5; // Increased for smoother speed calculations
        this.lastPosition = null; // Store last position for direction calculation
        this.compassHeading = null; // Device compass heading
        this.gpsHeading = null; // GPS calculated heading
        this.speedHistory = []; // Array to store speed history
        this.maxSpeedHistory = 50; // Maximum number of speed points to show
        this.timeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
        this.isMapInitialized = false;
        this.locationSource = 'unknown';

        // Initialize UI elements
        this.elements = {
            userId: document.getElementById('user-id'),
            sessionNumber: document.getElementById('session-number'),
            newSessionBtn: document.getElementById('new-session-btn'),
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
            nodeVersion: document.getElementById('node-version'),
            locationSource: document.getElementById('location-source')
        };

        // Initialize popup elements with safety checks
        this.popup = {
            element: document.getElementById('version-popup'),
            gpsStatus: document.getElementById('gps-status'),
            refreshBtn: document.getElementById('refresh-gps-btn'),
            closeBtn: document.getElementById('close-popup-btn')
        };
        
        // Log missing elements for debugging
        Object.keys(this.popup).forEach(key => {
            if (!this.popup[key]) {
                console.warn(`❌ Popup element not found: ${key}`);
            }
        });

        // Add manual location control
        this.addManualLocationControl();

        // Setup popup event listeners
        this.setupPopupHandlers();

        // Setup history modal
        this.setupHistoryModal();

        // Setup checkpoint modal
        this.setupCheckpointModal();

        // Setup unload handler for session management
        this.setupUnloadHandler();

        // Setup new session button
        this.setupNewSessionButton();

        // Show version information
        this.showVersionInfo();

        // Initialize map and tracking
        this.initializeUser()
            .then(() => {
                console.log('✅ User initialization successful');
                console.log('📱 User ID:', this.userId);
                console.log('🔗 Session ID:', this.sessionId);
                console.log('📊 Session Number:', this.sessionNumber);
                
                // Update UI with user info
                this.updateUserDisplay();
                
                this.initializeMap();
                this.startTracking();
                this.startCompassTracking();
            })
            .catch(error => {
                console.error('❌ Failed to initialize user:', error);
                alert('Failed to initialize tracking. Please try again.');
            });
    }

    setupPopupHandlers() {
        // Close button - with safety check
        if (this.popup.closeBtn) {
            this.popup.closeBtn.addEventListener('click', () => {
                this.popup.element.style.display = 'none';
            });
        } else {
            console.warn('❌ Close button not found:', 'close-popup-btn');
        }

        // Refresh GPS button - with safety check
        if (this.popup.refreshBtn) {
            this.popup.refreshBtn.addEventListener('click', () => {
                this.restartGPS();
            });
        } else {
            console.warn('❌ Refresh button not found:', 'refresh-gps-btn');
        }

        // Show history button - with safety check
        const showHistoryBtn = document.getElementById('show-history-btn');
        if (showHistoryBtn) {
            showHistoryBtn.addEventListener('click', () => {
                this.showHistoryModal();
            });
        } else {
            console.warn('❌ History button not found:', 'show-history-btn');
        }

        // Create checkpoint button - with safety check
        const createCheckpointBtn = document.getElementById('create-checkpoint-btn');
        if (createCheckpointBtn) {
            createCheckpointBtn.addEventListener('click', () => {
                this.showCheckpointModal();
            });
        } else {
            console.warn('❌ Checkpoint button not found:', 'create-checkpoint-btn');
        }

        // Show popup on errors
        window.addEventListener('gps-error', () => {
            this.showPopup();
        });
    }

    setupHistoryModal() {
        this.historyModal = {
            element: document.getElementById('history-modal'),
            closeBtn: document.getElementById('close-history-btn'),
            tabs: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            travelSvg: document.getElementById('travel-svg'),
            elevationSvg: document.getElementById('elevation-history-svg'),
            speedSvg: document.getElementById('speed-chart-svg'),
            dataTable: document.getElementById('data-table-body'),
            stats: {
                totalPoints: document.getElementById('total-points'),
                totalDistance: document.getElementById('total-distance'),
                maxSpeed: document.getElementById('max-speed'),
                sessionTime: document.getElementById('session-time')
            }
        };

        // Close modal
        this.historyModal.closeBtn.addEventListener('click', () => {
            this.historyModal.element.style.display = 'none';
        });

        // Tab switching
        this.historyModal.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchHistoryTab(tabName);
            });
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.historyModal.element.style.display !== 'none') {
                this.historyModal.element.style.display = 'none';
            }
            if (e.key === 'Escape' && this.checkpointModal && this.checkpointModal.element.style.display !== 'none') {
                this.checkpointModal.element.style.display = 'none';
            }
        });
    }

    setupCheckpointModal() {
        this.checkpointModal = {
            element: document.getElementById('checkpoint-modal'),
            closeBtn: document.getElementById('close-checkpoint-btn'),
            nameInput: document.getElementById('checkpoint-name'),
            descriptionInput: document.getElementById('checkpoint-description'),
            timeSpan: document.getElementById('checkpoint-time'),
            locationSpan: document.getElementById('checkpoint-location'),
            saveBtn: document.getElementById('save-checkpoint-btn'),
            cancelBtn: document.getElementById('cancel-checkpoint-btn')
        };

        // Add null checks for all elements
        if (!this.checkpointModal.element) {
            console.warn('⚠️ Checkpoint modal elements not found - checkpoint functionality disabled');
            return;
        }

        // Close modal
        if (this.checkpointModal.closeBtn) {
            this.checkpointModal.closeBtn.addEventListener('click', () => {
                this.hideCheckpointModal();
            });
        }

        // Cancel button
        if (this.checkpointModal.cancelBtn) {
            this.checkpointModal.cancelBtn.addEventListener('click', () => {
                this.hideCheckpointModal();
            });
        }

        // Save button
        if (this.checkpointModal.saveBtn) {
            this.checkpointModal.saveBtn.addEventListener('click', () => {
                this.saveCheckpoint();
            });
        }

        // Floating checkpoint button
        const floatingBtn = document.getElementById('floating-checkpoint-btn');
        if (floatingBtn) {
            floatingBtn.addEventListener('click', () => {
                this.showCheckpointModal();
            });
        }

        // Enter key to save
        if (this.checkpointModal.nameInput) {
            this.checkpointModal.nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.saveCheckpoint();
                }
            });
        }
    }

    async showVersionInfo() {
        // Show JavaScript version
        this.elements.jsVersion.textContent = VERSION;

        // Get server version from API
        try {
            const response = await fetch('./api/version');
            if (response.ok) {
                const data = await response.json();
                // Fix: Use node_version field for PHP version display
                this.elements.nodeVersion.textContent = data.node_version || data.version || 'Unknown';
                console.log('✅ Version info loaded:', data);
            } else {
                console.error('❌ Version API failed:', response.status);
                this.elements.nodeVersion.textContent = 'API Error';
            }
        } catch (error) {
            console.error('❌ Failed to get server version:', error);
            this.elements.nodeVersion.textContent = 'Network Error';
        }

        // Update GPS status
        this.updateGPSStatus('loading', 'Initializing...');
    }

    updateGPSStatus(state, message) {
        const statusElement = this.popup.gpsStatus;
        statusElement.textContent = message;
        statusElement.className = state;

        // Update recent changes if needed
        const changesList = document.getElementById('recent-changes-list');
        if (changesList && state === 'active') {
            const changes = [
                'GPS Active: ' + new Date().toLocaleTimeString(),
                'Session #' + this.sessionNumber + ' - ' + this.trackPoints.length + ' points',
                'Accuracy: ' + (this.lastAccuracy ? this.lastAccuracy.toFixed(1) + 'm' : 'Unknown'),
                'Location Source: ' + this.locationSource
            ];
            changesList.innerHTML = changes.map(change => `<li>${change}</li>`).join('');
        }
    }

    restartGPS() {
        // Clear existing tracking
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        // Update status
        this.updateGPSStatus('loading', 'Restarting GPS...');

        // Restart tracking
        this.startTracking().catch(error => {
            console.error('Failed to restart GPS:', error);
            this.updateGPSStatus('error', 'Failed to restart GPS');
        });
    }

    getOrCreateDeviceId() {
        let deviceId = localStorage.getItem('gps_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2);
            localStorage.setItem('gps_device_id', deviceId);
        }
        return deviceId;
    }

    setupNewSessionButton() {
        if (this.elements.newSessionBtn) {
            this.elements.newSessionBtn.addEventListener('click', async () => {
                try {
                    console.log('🔄 Starting new session manually...');
                    await this.startNewSession();
                    console.log('✅ New session started successfully');
                } catch (error) {
                    console.error('❌ Failed to start new session:', error);
                    alert('Failed to start new session. Please try again.');
                }
            });
        } else {
            console.warn('❌ New session button not found: new-session-btn');
        }
    }

    updateUserDisplay() {
        // Display user ID (first 8 characters for readability)
        if (this.elements.userId && this.userId) {
            const shortUserId = this.userId.replace('user_', '').substring(0, 8);
            this.elements.userId.textContent = shortUserId;
            this.elements.userId.title = this.userId; // Full ID on hover
        }
        
        // Display session number
        if (this.elements.sessionNumber) {
            this.elements.sessionNumber.textContent = this.sessionNumber || '--';
        }
    }

    async startNewSession() {
        // End current session if exists
        if (this.sessionId) {
            console.log('🛑 Ending current session...');
            await this.endTracking();
        }

        // Start new session
        console.log('🚀 Creating new session...');
        const sessionResponse = await fetch('./api/user/session/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: this.userId
            })
        });

        if (!sessionResponse.ok) {
            const errorText = await sessionResponse.text();
            console.error('❌ Session start failed:', sessionResponse.status, errorText);
            throw new Error(`Failed to start session: ${sessionResponse.status} ${errorText}`);
        }

        const sessionData = await sessionResponse.json();
        this.sessionId = sessionData.sessionId;
        console.log('✅ New session created:', this.sessionId);
        
        // Update session number
        await this.updateSessionNumber();
        this.updateUserDisplay();
        
        // Clear current tracking data
        this.trackPoints = [];
        this.speedHistory = [];
        this.speedSamples = [];
        
        console.log('🎯 New session ready:', this.sessionId, 'Session #:', this.sessionNumber);
    }

    checkSessionExpiry() {
        // Check if session is older than 24 hours
        if (this.sessionId) {
            const sessionTimestamp = this.sessionId.split('_').pop();
            const sessionTime = parseInt(sessionTimestamp) * 1000; // Convert to milliseconds
            const now = Date.now();
            const dayInMs = 24 * 60 * 60 * 1000;
            
            if (now - sessionTime > dayInMs) {
                console.log('⏰ Session expired (24+ hours old), starting new session...');
                this.startNewSession().catch(error => {
                    console.error('❌ Failed to start new session after expiry:', error);
                });
                return true;
            }
        }
        return false;
    }

    async initializeUser() {
        try {
            console.log('🚀 Starting user initialization...');
            console.log('📱 Device ID:', this.deviceId);
            
            // Use relative path that will work with deployed server
            console.log('📡 Calling user init API...');
            const response = await fetch('./api/user/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: this.deviceId
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ User init failed:', response.status, errorText);
                throw new Error(`Failed to initialize user: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            this.userId = data.userId;
            console.log('✅ User initialized:', this.userId);

            // Check for existing active session first
            console.log('🔍 Checking for existing sessions...');
            const existingSession = await this.getActiveSession();
            
            if (existingSession && !this.isSessionExpired(existingSession.sessionId)) {
                console.log('♻️ Resuming existing session:', existingSession.sessionId);
                this.sessionId = existingSession.sessionId;
            } else {
                // Start a new tracking session
                console.log('📡 Creating new session...');
                const sessionResponse = await fetch('./api/user/session/start', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: this.userId
                    })
                });

                if (!sessionResponse.ok) {
                    const errorText = await sessionResponse.text();
                    console.error('❌ Session start failed:', sessionResponse.status, errorText);
                    throw new Error(`Failed to start session: ${sessionResponse.status} ${errorText}`);
                }

                const sessionData = await sessionResponse.json();
                this.sessionId = sessionData.sessionId;
                console.log('✅ New session created:', this.sessionId);
            }
            
            // Get session number by counting user's sessions
            console.log('📊 Updating session number...');
            await this.updateSessionNumber();
            
            console.log('🎯 Session ready:', this.sessionId, 'Session #:', this.sessionNumber);

        } catch (error) {
            console.error('💥 Error initializing user:', error);
            throw error;
        }
    }

    async getActiveSession() {
        try {
            const response = await fetch(`./api/user-sessions?userId=${this.userId}`);
            if (response.ok) {
                const data = await response.json();
                // Find the most recent active session
                const activeSessions = data.sessions.filter(s => s.status === 'active');
                return activeSessions.length > 0 ? activeSessions[activeSessions.length - 1] : null;
            }
        } catch (error) {
            console.error('Error checking for active sessions:', error);
        }
        return null;
    }

    isSessionExpired(sessionId) {
        if (!sessionId) return true;
        
        const sessionTimestamp = sessionId.split('_').pop();
        const sessionTime = parseInt(sessionTimestamp) * 1000; // Convert to milliseconds
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        return (now - sessionTime) > dayInMs;
    }

    async updateSessionNumber() {
        try {
            // Fetch user sessions to count them
            const response = await fetch(`./api/user-sessions?userId=${this.userId}`);
            if (response.ok) {
                const data = await response.json();
                this.sessionNumber = data.sessions ? data.sessions.length : 1;
                
                // Update UI
                if (this.elements.sessionNumber) {
                    this.elements.sessionNumber.textContent = this.sessionNumber;
                }
            } else {
                this.sessionNumber = 1; // Default fallback
                if (this.elements.sessionNumber) {
                    this.elements.sessionNumber.textContent = this.sessionNumber;
                }
            }
        } catch (error) {
            console.error('Error getting session number:', error);
            this.sessionNumber = 1; // Default fallback
            if (this.elements.sessionNumber) {
                this.elements.sessionNumber.textContent = this.sessionNumber;
            }
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
            this.compassHeading = heading;
            this.lastHeading = heading;
            
            // Update compass display with enhanced information
            let headingText = `${Math.round(heading)}°`;
            if (this.gpsHeading !== null && Math.abs(this.gpsHeading - heading) > 5) {
                headingText += ` (GPS: ${Math.round(this.gpsHeading)}°)`;
            }
            this.elements.heading.textContent = headingText;
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
        console.log('🎯 Starting GPS tracking...');
        this.logToServer('info', 'Starting GPS tracking');
        
        if (!navigator.geolocation) {
            this.logToServer('error', 'Geolocation not supported');
            alert('Geolocation is not supported by your browser');
            return;
        }

        try {
            // Check if we're on a secure context
            const isSecureContext = window.isSecureContext;
            const isLocalhost = window.location.hostname === 'localhost' || 
                              window.location.hostname === '127.0.0.1' ||
                              window.location.hostname.includes('192.168.');
            
            console.log('Security Context:', {
                isSecure: isSecureContext,
                isLocalhost: isLocalhost,
                protocol: window.location.protocol,
                hostname: window.location.hostname
            });

            if (!isSecureContext && !isLocalhost) {
                throw new Error('Geolocation requires HTTPS or localhost. Please access this page via HTTPS or using localhost/IP address.');
            }

            // Check if running on mobile
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            console.log('Device type:', isMobile ? 'Mobile' : 'Desktop');
            console.log('User Agent:', navigator.userAgent);

            // Try to get more accurate position first
            console.log('📍 Getting initial position...');
            this.logToServer('info', 'Getting initial position');
            
            const initialPosition = await this.getCurrentPosition();
            console.log('✅ Initial position:', initialPosition);
            this.logToServer('info', 'Initial position acquired', {
                lat: initialPosition.coords.latitude,
                lon: initialPosition.coords.longitude,
                accuracy: initialPosition.coords.accuracy
            });

            // Start continuous tracking
            this.watchId = navigator.geolocation.watchPosition(
                position => {
                    console.log('GPS Update:', {
                        lat: position.coords.latitude,
                        lon: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: new Date(position.timestamp).toLocaleTimeString()
                    });

                    // Only use readings with good accuracy - more lenient for all devices
                    const maxAccuracy = 150; // Increased for all devices - 94m is fine for elevation mapping
                    if (position.coords.accuracy > maxAccuracy) {
                        console.log(`Skipping low accuracy reading (${position.coords.accuracy}m, max: ${maxAccuracy}m)`);
                        this.updateAccuracyDisplay(position.coords.accuracy);
                        return;
                    }

                    this.handlePosition(position);
                },
                error => {
                    console.error('GPS Error:', error);
                    
                    // Add specific handling for secure origin errors
                    if (error.message.includes('Only secure origins are allowed')) {
                        const currentUrl = window.location.href;
                        const ipUrl = currentUrl.replace('localhost', '192.168.105.126');
                        
                        this.updateGPSStatus('error', `Please access via IP address: ${ipUrl}`);
                        this.showPopup();
                        
                        // Update the recent changes list with helpful information
                        const changesList = document.getElementById('recent-changes-list');
                        if (changesList) {
                            changesList.innerHTML = `
                                <li>Error: Secure origin required</li>
                                <li>Try accessing via: ${ipUrl}</li>
                                <li>Or use direct IP address</li>
                            `;
                        }
                    }
                    
                    this.handleError(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000, // Increased from 5s to 15s for mobile
                    maximumAge: 5000 // Allow 5s old readings to reduce timeouts
                }
            );

        } catch (error) {
            console.error('Error starting tracking:', error);
            this.updateGPSStatus('error', error.message);
            this.showPopup();
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                position => resolve(position),
                error => reject(error),
                {
                    enableHighAccuracy: true,
                    timeout: 15000, // Consistent 15s timeout for all devices
                    maximumAge: 5000 // Allow 5s old readings to reduce timeouts
                }
            );
        });
    }

    // Fallback GPS polling method for when watchPosition fails
    startPollingGPS() {
        console.log('🔄 Starting GPS polling fallback...');
        this.logToServer('info', 'Starting GPS polling fallback');
        
        // Clear any existing watch
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        // Start polling every 10 seconds
        this.pollingInterval = setInterval(async () => {
            try {
                console.log('📍 Polling GPS position...');
                const position = await this.getCurrentPosition();
                console.log('✅ Polling GPS success:', position.coords);
                this.handlePosition(position);
            } catch (error) {
                console.error('❌ Polling GPS error:', error);
                // If polling also fails, try again in 30 seconds
            }
        }, 10000);
        
        this.updateGPSStatus('warning', 'GPS polling mode (fallback)');
    }

    updateAccuracyDisplay(accuracy) {
        const accElement = document.getElementById('acc');
        const accIndicator = document.getElementById('acc-indicator');
        
        accElement.textContent = accuracy.toFixed(1);
        
        // Update accuracy indicator with more granular levels
        let className = 'accuracy-indicator ';
        if (accuracy <= 10) {
            className += 'accuracy-high';
            accElement.style.color = '#4aff4a';
        } else if (accuracy <= 30) {
            className += 'accuracy-medium';
            accElement.style.color = '#ff9f4a';
        } else if (accuracy <= 100) {
            className += 'accuracy-low';
            accElement.style.color = '#ff4a4a';
        } else {
            className += 'accuracy-very-low';
            accElement.style.color = '#ff0000';
        }
        
        accIndicator.className = className;
    }

    handlePosition(position) {
        const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords;
        const timestamp = position.timestamp;

        // Update GPS status
        if (accuracy <= 30) {
            this.updateGPSStatus('active', 'GPS Active (High Accuracy)');
        } else if (accuracy <= 100) {
            this.updateGPSStatus('warning', 'GPS Active (Medium Accuracy)');
        } else {
            this.updateGPSStatus('error', 'GPS Active (Low Accuracy)');
        }

        // Calculate GPS-based heading if we have a previous position
        let calculatedHeading = null;
        let calculatedSpeed = 0;
        
        if (this.lastPosition && this.lastPosition.timestamp) {
            const timeDiff = (timestamp - this.lastPosition.timestamp) / 1000; // seconds
            const distance = this.calculateDistance(
                this.lastPosition.lat, this.lastPosition.lon,
                latitude, longitude
            );
            
            // Calculate speed in km/h
            calculatedSpeed = timeDiff > 0 ? (distance / timeDiff) * 3.6 : 0;
            
            // Calculate bearing/heading
            calculatedHeading = this.calculateBearing(
                this.lastPosition.lat, this.lastPosition.lon,
                latitude, longitude
            );
        }

        // Use GPS speed if available, otherwise use calculated speed
        const finalSpeed = speed !== null ? speed * 3.6 : calculatedSpeed;
        
        // Use GPS heading if available, otherwise use calculated heading
        const gpsHeading = heading !== null ? heading : calculatedHeading;
        this.gpsHeading = gpsHeading;

        // Log enhanced position quality metrics
        console.log('Enhanced Position Quality:', {
            accuracy: `${accuracy}m`,
            altitude: altitude ? `${altitude}m` : 'N/A',
            altitudeAccuracy: altitudeAccuracy ? `${altitudeAccuracy}m` : 'N/A',
            gpsHeading: gpsHeading ? `${gpsHeading.toFixed(1)}°` : 'N/A',
            compassHeading: this.compassHeading ? `${this.compassHeading.toFixed(1)}°` : 'N/A',
            gpsSpeed: speed ? `${(speed * 3.6).toFixed(1)} km/h` : 'N/A',
            calculatedSpeed: `${calculatedSpeed.toFixed(1)} km/h`,
            finalSpeed: `${finalSpeed.toFixed(1)} km/h`
        });

        // Update accuracy display
        this.updateAccuracyDisplay(accuracy);

        // Accept lower accuracy for better tracking - good for elevation mapping
        const maxAccuracy = 150; // Consistent threshold for all devices
        if (accuracy > maxAccuracy) {
            console.log(`Skipping low accuracy position: ${accuracy}m (max: ${maxAccuracy}m)`);
            return;
        }
        
        console.log(`GPS position accepted: ${accuracy}m accuracy`);

        // Create new track point with enhanced data
        const point = {
            lat: latitude,
            lon: longitude,
            elevation: altitude || null,
            accuracy,
            heading: gpsHeading || this.compassHeading || this.lastHeading,
            gpsHeading: gpsHeading,
            compassHeading: this.compassHeading,
            speed: finalSpeed,
            gpsSpeed: speed ? speed * 3.6 : null,
            calculatedSpeed: calculatedSpeed,
            timestamp
        };

        // Store current position for next calculation
        this.lastPosition = {
            lat: latitude,
            lon: longitude,
            timestamp: timestamp
        };

        // Update speed samples for smoothing
        this.speedSamples.push(finalSpeed);
        if (this.speedSamples.length > this.maxSpeedSamples) {
            this.speedSamples.shift();
        }

        // Calculate smoothed speed
        const smoothedSpeed = this.speedSamples.reduce((a, b) => a + b, 0) / this.speedSamples.length;
        point.smoothedSpeed = smoothedSpeed;

        // Add point to track
        this.trackPoints.push(point);
        if (this.trackPoints.length > this.maxPoints) {
            this.trackPoints.shift();
        }

        // Update heading for compass
        if (point.heading !== null) {
            this.lastHeading = point.heading;
        }

        // Update UI with enhanced data
        this.updateUI(point);
        
        // Update map with constant tracking
        this.updateMap(point);
        
        // Update elevation profile
        this.updateElevationProfile();

        // Update speed history
        this.updateSpeedHistory();

        // Save point to database
        this.savePoint(point).catch(error => {
            console.error('Error saving point:', error);
        });
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

        // Always keep the map centered and at the correct zoom level
        // This ensures constant tracking and proper zoom level
        this.map.setView(latLng, this.zoomLevel, {
            animate: true,
            duration: 0.5  // Faster animation for more responsive tracking
        });

        // Mark map as initialized after first update
        if (!this.isMapInitialized) {
            this.isMapInitialized = true;
        }
    }

    updateUI(point) {
        // Update coordinates display
        this.elements.lat.textContent = point.lat.toFixed(6);
        this.elements.lon.textContent = point.lon.toFixed(6);
        this.elements.elev.textContent = point.elevation ? point.elevation.toFixed(1) : '--';
        this.elements.acc.textContent = point.accuracy.toFixed(1);

        // Update speed display with enhanced information
        let speedText = point.smoothedSpeed ? point.smoothedSpeed.toFixed(1) : point.speed.toFixed(1);
        if (point.gpsSpeed !== null && Math.abs(point.gpsSpeed - point.calculatedSpeed) > 2) {
            speedText += ` (GPS: ${point.gpsSpeed.toFixed(1)})`;
        }
        this.elements.speed.textContent = speedText;

        // Update speed bar with smoothed speed
        const displaySpeed = point.smoothedSpeed || point.speed;
        const percentage = Math.min((displaySpeed / this.maxSpeed) * 100, 100);
        this.elements.speedBar.style.width = `${percentage}%`;

        // Update color based on speed
        const speedClass = this.getSpeedClass(displaySpeed);
        this.elements.speedBar.style.background = this.getSpeedColor(speedClass);

        // Update heading display with both compass and GPS heading
        if (point.heading !== null) {
            let headingText = `${Math.round(point.heading)}°`;
            if (point.compassHeading !== null && Math.abs(point.compassHeading - point.heading) > 5) {
                headingText += ` (C: ${Math.round(point.compassHeading)}°)`;
            }
            if (point.gpsHeading !== null && point.gpsHeading !== point.heading) {
                headingText += ` (GPS: ${Math.round(point.gpsHeading)}°)`;
            }
            this.elements.heading.textContent = headingText;
            this.elements.compassArrow.style.transform = `rotate(${point.heading}deg)`;
        }

        // Update accuracy indicator with source information
        let accuracyClass = 'accuracy-low';
        if (point.accuracy <= 10) {
            accuracyClass = 'accuracy-high';
        } else if (point.accuracy <= 30) {
            accuracyClass = 'accuracy-medium';
        } else if (point.accuracy <= 100) {
            accuracyClass = 'accuracy-low';
        } else {
            accuracyClass = 'accuracy-very-low';
        }

        this.elements.accIndicator.className = `accuracy-indicator ${accuracyClass} source-${this.locationSource}`;
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

        // Create scales with safety checks
        const xScale = (i) => padding + (i * (width - 2 * padding) / Math.max(this.trackPoints.length - 1, 1));
        const yScale = (elev) => {
            if (elevRange === 0 || isNaN(elev) || elev === null || elev === undefined) {
                return height - padding; // Flat line if no valid elevation data
            }
            return height - padding - ((elev - minElev) / elevRange) * (height - 2 * padding);
        };

        // Create path data with safety checks
        const firstPoint = this.trackPoints[0];
        if (!firstPoint || !firstPoint.elevation) {
            return; // Exit if no valid first point
        }
        
        let pathData = `M ${xScale(0)} ${yScale(firstPoint.elevation)}`;
        this.trackPoints.forEach((point, i) => {
            if (i > 0 && point && point.elevation !== null && point.elevation !== undefined) {
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
            const response = await fetch('./api/user/track-point', {
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
                const errorText = await response.text();
                console.error('Save point failed:', response.status, errorText);
                throw new Error(`Failed to save track point: ${response.status}`);
            }

            const data = await response.json();
            console.log('Point saved successfully:', data);
            
        } catch (error) {
            console.error('Error saving track point:', error);
        }
    }

    async endTracking() {
        if (this.sessionId) {
            try {
                const payload = JSON.stringify({
                    userId: this.userId,
                    sessionId: this.sessionId
                });

                // Use sendBeacon for better reliability during page unload
                if (navigator.sendBeacon) {
                    const blob = new Blob([payload], { type: 'application/json' });
                    const success = navigator.sendBeacon('./api/user/session/end', blob);
                    console.log('Session ended via beacon:', success);
                } else {
                    // Fallback to fetch with keepalive
                    const response = await fetch('./api/user/session/end', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: payload,
                        keepalive: true
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('End session failed:', response.status, errorText);
                        throw new Error(`Failed to end session: ${response.status}`);
                    }

                    console.log('Session ended successfully');
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
        // Multiple event handlers for better mobile support
        window.addEventListener('beforeunload', () => {
            this.endTracking();
        });

        // Page visibility API - works better on mobile
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.sessionId) {
                console.log('Page hidden, ending session');
                this.endTracking();
            }
        });

        // Pagehide event - works on iOS Safari
        window.addEventListener('pagehide', () => {
            this.endTracking();
        });

        // Unload event as fallback
        window.addEventListener('unload', () => {
            this.endTracking();
        });
    }

    // Log errors and info to server for debugging
    async logToServer(level, message, data = {}) {
        try {
            const logData = {
                level,
                message,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href,
                userId: this.userId,
                sessionId: this.sessionId,
                deviceId: this.deviceId,
                data
            };
            
            console.log(`📡 Logging to server [${level}]:`, message, data);
            
            await fetch('./api/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(logData)
            });
        } catch (err) {
            console.error('Failed to log to server:', err);
        }
    }

    handleError(error) {
        console.error('GPS Error:', error);
        
        let errorMessage = '';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Location access denied. Please check your browser settings and ensure location access is enabled.';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Location information unavailable. Please check if GPS is enabled.';
                break;
            case error.TIMEOUT:
                errorMessage = 'Location request timed out. Please try again.';
                break;
            default:
                if (error.message.includes('Only secure origins are allowed')) {
                    errorMessage = `Please access this page using your IP address instead of 'localhost'`;
                } else {
                    errorMessage = 'An unknown error occurred while getting location.';
                }
                break;
        }

        // Log error to server for debugging
        this.logToServer('error', 'GPS Error', {
            error: error.message,
            code: error.code,
            errorMessage: errorMessage,
            stack: error.stack
        });

        // Update status and show popup
        this.updateGPSStatus('error', errorMessage);
        this.showPopup();

        // For timeout errors, try a different approach
        if (error.code === 3) { // TIMEOUT
            console.log('⏰ GPS timeout - trying fallback approach...');
            this.logToServer('info', 'GPS timeout - trying fallback');
            
            // Try polling getCurrentPosition instead of watchPosition
            setTimeout(() => {
                this.startPollingGPS();
            }, 2000);
        } else {
            alert(errorMessage);
        }
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

    calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

        const θ = Math.atan2(y, x);
        return (θ * 180 / Math.PI + 360) % 360; // Bearing in degrees (0-360)
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

    addManualLocationControl() {
        const controlDiv = document.createElement('div');
        controlDiv.className = 'manual-location-control';
        controlDiv.innerHTML = `
            <div class="location-info">
                <div>Source: <span id="location-source">Unknown</span></div>
                <button id="set-location-btn">Set Location</button>
            </div>
        `;

        document.body.appendChild(controlDiv);

        const setLocationBtn = document.getElementById('set-location-btn');
        setLocationBtn.addEventListener('click', () => {
            const lat = prompt('Enter latitude (e.g., 35.0844 for Albuquerque):', '35.0844');
            const lon = prompt('Enter longitude (e.g., -106.6504 for Albuquerque):', '-106.6504');
            
            if (lat && lon) {
                const position = {
                    coords: {
                        latitude: parseFloat(lat),
                        longitude: parseFloat(lon),
                        accuracy: 10,
                        altitude: null,
                        altitudeAccuracy: null,
                        heading: null,
                        speed: 0
                    },
                    timestamp: Date.now()
                };
                this.locationSource = 'manual';
                this.updateLocationSource();
                this.handlePosition(position);
            }
        });
    }

    updateLocationSource() {
        const sourceElement = document.getElementById('location-source');
        if (sourceElement) {
            sourceElement.textContent = this.locationSource;
            sourceElement.className = `source-${this.locationSource}`;
        }
    }

    showPopup() {
        this.popup.element.style.display = 'block';
    }

    async showHistoryModal() {
        try {
            // Fetch all user sessions first
            const sessionsResponse = await fetch(`./api/user-sessions?userId=${this.userId}`);
            if (!sessionsResponse.ok) {
                throw new Error(`Failed to fetch user sessions: ${sessionsResponse.status}`);
            }

            const sessionsData = await sessionsResponse.json();
            const sessions = sessionsData.sessions || [];
            console.log('Sessions loaded:', sessions.length, 'sessions');

            // Combine all points from all sessions
            let allPoints = [];
            sessions.forEach(session => {
                if (session.points && session.points.length > 0) {
                    // Add session info to each point
                    const sessionPoints = session.points.map(point => ({
                        ...point,
                        sessionId: session.sessionId,
                        sessionStart: session.startTime
                    }));
                    allPoints = allPoints.concat(sessionPoints);
                }
            });

            // Sort points by timestamp
            allPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            console.log('Total history points loaded:', allPoints.length, 'points from', sessions.length, 'sessions');

            // Store data for tab switching
            this.currentHistoryData = allPoints;

            // Update statistics
            this.updateHistoryStats(allPoints);

            // Show modal
            this.historyModal.element.style.display = 'block';

            // Switch to travel tab by default and render
            this.switchHistoryTab('travel');
            this.renderHistoryContent(allPoints);

        } catch (error) {
            console.error('Failed to load history:', error);
            alert('Failed to load history data. Please try again.');
        }
    }

    switchHistoryTab(tabName) {
        // Update tab buttons
        this.historyModal.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        this.historyModal.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Re-render content for the active tab if we have data
        if (this.currentHistoryData) {
            this.renderHistoryContent(this.currentHistoryData);
        }
    }

    updateHistoryStats(points) {
        const stats = this.calculateTravelStats(points);
        
        // Count unique sessions
        const uniqueSessions = new Set(points.map(p => p.sessionId)).size;
        
        this.historyModal.stats.totalPoints.textContent = `${stats.totalPoints} (${uniqueSessions} sessions)`;
        this.historyModal.stats.totalDistance.textContent = `${stats.totalDistance.toFixed(2)} km`;
        this.historyModal.stats.maxSpeed.textContent = `${stats.maxSpeed.toFixed(1)} km/h`;
        this.historyModal.stats.sessionTime.textContent = `${stats.sessionTime} min`;
    }

    calculateTravelStats(points) {
        if (!points || points.length === 0) {
            return {
                totalPoints: 0,
                totalDistance: 0,
                maxSpeed: 0,
                sessionTime: 0
            };
        }

        let totalDistance = 0;
        let maxSpeed = 0;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            
            const distance = this.calculateDistance(prev.lat, prev.lon, curr.lat, curr.lon);
            totalDistance += distance;

            if (curr.speed && curr.speed > maxSpeed) {
                maxSpeed = curr.speed;
            }
        }

        const startTime = new Date(points[0].timestamp);
        const endTime = new Date(points[points.length - 1].timestamp);
        const sessionTime = Math.round((endTime - startTime) / (1000 * 60));

        return {
            totalPoints: points.length,
            totalDistance,
            maxSpeed,
            sessionTime
        };
    }

    renderHistoryContent(points) {
        // Render based on active tab
        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        
        switch (activeTab) {
            case 'travel':
                this.renderTravelMap(points);
                break;
            case 'elevation':
                this.renderElevationChart(points);
                break;
            case 'speed':
                this.renderSpeedChart(points);
                break;
            case 'data':
                this.renderDataTable(points);
                break;
        }
    }

    renderTravelMap(points) {
        if (!points || points.length === 0) {
            this.historyModal.travelSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="rgba(255,255,255,0.5)">No travel data available</text>';
            return;
        }

        // Calculate bounds
        const bounds = this.calculateBounds(points);
        if (!bounds) return;

        // Create SVG
        const svg = this.historyModal.travelSvg;
        const rect = svg.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;
        const padding = 50;

        // Import SVG utilities
        import('./js_svgUtils.js').then(({ createCoordinateTransformer, createSVGElement }) => {
            // Clear previous content
            svg.innerHTML = '';
            svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

            // Create coordinate transformer
            const transformer = createCoordinateTransformer(bounds, { width, height, padding });

            // Draw grid
            this.drawGrid(svg, width, height, padding);

            // Draw bounds rectangle
            const boundsRect = createSVGElement('rect');
            boundsRect.setAttribute('x', padding);
            boundsRect.setAttribute('y', padding);
            boundsRect.setAttribute('width', width - 2 * padding);
            boundsRect.setAttribute('height', height - 2 * padding);
            boundsRect.setAttribute('class', 'travel-bounds');
            svg.appendChild(boundsRect);

            // Draw travel path
            this.drawTravelPath(svg, points, transformer);

            // Draw start and end points
            this.drawTravelPoints(svg, points, transformer);

            // Add labels
            this.addTravelLabels(svg, bounds, width, height, padding);
        });
    }

    calculateBounds(points) {
        if (!points || points.length === 0) return null;

        let minLat = points[0].lat;
        let maxLat = points[0].lat;
        let minLon = points[0].lon;
        let maxLon = points[0].lon;

        points.forEach(point => {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
        });

        // Add padding to bounds
        const latPadding = (maxLat - minLat) * 0.1 || 0.001;
        const lonPadding = (maxLon - minLon) * 0.1 || 0.001;

        return {
            minLat: minLat - latPadding,
            maxLat: maxLat + latPadding,
            minLon: minLon - lonPadding,
            maxLon: maxLon + lonPadding
        };
    }

    drawGrid(svg, width, height, padding) {
        const gridLines = 10;
        
        // Vertical lines
        for (let i = 0; i <= gridLines; i++) {
            const x = padding + (i * (width - 2 * padding) / gridLines);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', padding);
            line.setAttribute('x2', x);
            line.setAttribute('y2', height - padding);
            line.setAttribute('class', 'travel-grid');
            svg.appendChild(line);
        }

        // Horizontal lines
        for (let i = 0; i <= gridLines; i++) {
            const y = padding + (i * (height - 2 * padding) / gridLines);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding);
            line.setAttribute('y1', y);
            line.setAttribute('x2', width - padding);
            line.setAttribute('y2', y);
            line.setAttribute('class', 'travel-grid');
            svg.appendChild(line);
        }
    }

    drawTravelPath(svg, points, transformer) {
        if (points.length < 2) return;

        const pathData = points.map((point, index) => {
            const { x, y } = transformer.pointToSVG(point);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('class', 'travel-path');
        svg.appendChild(path);
    }

    drawTravelPoints(svg, points, transformer) {
        if (points.length === 0) return;

        // Start point
        const start = transformer.pointToSVG(points[0]);
        const startCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        startCircle.setAttribute('cx', start.x);
        startCircle.setAttribute('cy', start.y);
        startCircle.setAttribute('r', 6);
        startCircle.setAttribute('class', 'travel-point start');
        svg.appendChild(startCircle);

        // End point (if different from start)
        if (points.length > 1) {
            const end = transformer.pointToSVG(points[points.length - 1]);
            const endCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            endCircle.setAttribute('cx', end.x);
            endCircle.setAttribute('cy', end.y);
            endCircle.setAttribute('r', 6);
            endCircle.setAttribute('class', 'travel-point end');
            svg.appendChild(endCircle);
        }

        // Sample points along the path
        const sampleInterval = Math.max(1, Math.floor(points.length / 20));
        for (let i = sampleInterval; i < points.length - 1; i += sampleInterval) {
            const point = transformer.pointToSVG(points[i]);
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('r', 2);
            circle.setAttribute('class', 'travel-point');
            svg.appendChild(circle);
        }
    }

    addTravelLabels(svg, bounds, width, height, padding) {
        // Corner coordinates
        const labels = [
            { text: `${bounds.maxLat.toFixed(4)}°, ${bounds.minLon.toFixed(4)}°`, x: padding, y: padding - 5 },
            { text: `${bounds.maxLat.toFixed(4)}°, ${bounds.maxLon.toFixed(4)}°`, x: width - padding, y: padding - 5 },
            { text: `${bounds.minLat.toFixed(4)}°, ${bounds.minLon.toFixed(4)}°`, x: padding, y: height - padding + 15 },
            { text: `${bounds.minLat.toFixed(4)}°, ${bounds.maxLon.toFixed(4)}°`, x: width - padding, y: height - padding + 15 }
        ];

        labels.forEach(label => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', label.x);
            text.setAttribute('y', label.y);
            text.setAttribute('class', 'travel-label');
            text.textContent = label.text;
            svg.appendChild(text);
        });
    }

    renderElevationChart(points) {
        if (!points || points.length === 0) {
            this.historyModal.elevationSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="rgba(255,255,255,0.5)">No elevation data available</text>';
            return;
        }

        const svg = this.historyModal.elevationSvg;
        const rect = svg.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 400;
        const padding = 50;

        svg.innerHTML = '';
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Calculate elevation range
        const elevations = points.map(p => p.elevation || 0).filter(e => e > 0);
        if (elevations.length === 0) {
            svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="rgba(255,255,255,0.5)">No valid elevation data</text>';
            return;
        }

        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        const elevRange = maxElev - minElev || 1;

        // Create scales
        const xScale = (i) => padding + (i * (width - 2 * padding) / (points.length - 1));
        const yScale = (elev) => height - padding - ((elev - minElev) / elevRange) * (height - 2 * padding);

        // Draw grid
        this.drawChartGrid(svg, width, height, padding);

        // Draw elevation line
        const pathData = points.map((point, index) => {
            const x = xScale(index);
            const y = yScale(point.elevation || 0);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#ff4a4a');
        path.setAttribute('stroke-width', '2');
        svg.appendChild(path);

        // Add axis labels
        this.addChartLabels(svg, width, height, padding, minElev, maxElev, 'Elevation (m)');
    }

    renderSpeedChart(points) {
        if (!points || points.length === 0) {
            this.historyModal.speedSvg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="rgba(255,255,255,0.5)">No speed data available</text>';
            return;
        }

        const svg = this.historyModal.speedSvg;
        const rect = svg.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 400;
        const padding = 50;

        svg.innerHTML = '';
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Calculate speed range
        const speeds = points.map(p => p.speed || 0).filter(s => s >= 0);
        if (speeds.length === 0) {
            svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="rgba(255,255,255,0.5)">No speed data available</text>';
            return;
        }

        const maxSpeed = Math.max(...speeds);
        const speedRange = maxSpeed || 1;

        // Create scales
        const xScale = (i) => padding + (i * (width - 2 * padding) / (points.length - 1));
        const yScale = (speed) => height - padding - (speed / speedRange) * (height - 2 * padding);

        // Draw grid
        this.drawChartGrid(svg, width, height, padding);

        // Draw speed line
        const pathData = points.map((point, index) => {
            const x = xScale(index);
            const y = yScale(point.speed || 0);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(' ');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#9f4aff');
        path.setAttribute('stroke-width', '2');
        svg.appendChild(path);

        // Add axis labels
        this.addChartLabels(svg, width, height, padding, 0, maxSpeed, 'Speed (km/h)');
    }

    drawChartGrid(svg, width, height, padding) {
        const gridLines = 10;
        
        // Vertical lines
        for (let i = 0; i <= gridLines; i++) {
            const x = padding + (i * (width - 2 * padding) / gridLines);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', padding);
            line.setAttribute('x2', x);
            line.setAttribute('y2', height - padding);
            line.setAttribute('stroke', 'rgba(255,255,255,0.1)');
            line.setAttribute('stroke-width', '0.5');
            svg.appendChild(line);
        }

        // Horizontal lines
        for (let i = 0; i <= gridLines; i++) {
            const y = padding + (i * (height - 2 * padding) / gridLines);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', padding);
            line.setAttribute('y1', y);
            line.setAttribute('x2', width - padding);
            line.setAttribute('y2', y);
            line.setAttribute('stroke', 'rgba(255,255,255,0.1)');
            line.setAttribute('stroke-width', '0.5');
            svg.appendChild(line);
        }
    }

    addChartLabels(svg, width, height, padding, minValue, maxValue, yLabel) {
        // Y-axis label
        const yAxisLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        yAxisLabel.setAttribute('x', 15);
        yAxisLabel.setAttribute('y', height / 2);
        yAxisLabel.setAttribute('transform', `rotate(-90, 15, ${height / 2})`);
        yAxisLabel.setAttribute('text-anchor', 'middle');
        yAxisLabel.setAttribute('fill', 'rgba(255,255,255,0.7)');
        yAxisLabel.setAttribute('font-size', '12');
        yAxisLabel.textContent = yLabel;
        svg.appendChild(yAxisLabel);

        // Y-axis values
        const yValues = [minValue, (minValue + maxValue) / 2, maxValue];
        yValues.forEach((value, index) => {
            const y = height - padding - (index * (height - 2 * padding) / 2);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', padding - 10);
            text.setAttribute('y', y + 4);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('fill', 'rgba(255,255,255,0.6)');
            text.setAttribute('font-size', '10');
            text.textContent = value.toFixed(1);
            svg.appendChild(text);
        });
    }

    renderDataTable(points) {
        if (!points || points.length === 0) {
            this.historyModal.dataTable.innerHTML = '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.5);">No data available</td></tr>';
            return;
        }

        const tbody = this.historyModal.dataTable;
        tbody.innerHTML = '';

        points.forEach(point => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(point.timestamp).toLocaleString()}</td>
                <td>${point.lat.toFixed(6)}</td>
                <td>${point.lon.toFixed(6)}</td>
                <td>${point.elevation ? point.elevation.toFixed(1) + 'm' : 'N/A'}</td>
                <td>${point.speed ? point.speed.toFixed(1) + ' km/h' : 'N/A'}</td>
                <td>${point.accuracy ? point.accuracy.toFixed(1) + 'm' : 'N/A'}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Checkpoint functionality
    showCheckpointModal() {
        if (!this.checkpointModal) return;

        // Update current location info
        this.updateCheckpointInfo();

        // Clear previous inputs
        this.checkpointModal.nameInput.value = '';
        this.checkpointModal.descriptionInput.value = '';

        // Show modal
        this.checkpointModal.element.style.display = 'flex';
        
        // Focus on name input
        setTimeout(() => {
            this.checkpointModal.nameInput.focus();
        }, 100);
    }

    hideCheckpointModal() {
        if (!this.checkpointModal) return;
        this.checkpointModal.element.style.display = 'none';
    }

    updateCheckpointInfo() {
        const now = new Date();
        this.checkpointModal.timeSpan.textContent = now.toLocaleString();

        // Get current location
        const currentPoint = this.trackPoints[this.trackPoints.length - 1];
        if (currentPoint) {
            const lat = currentPoint.latitude.toFixed(6);
            const lon = currentPoint.longitude.toFixed(6);
            const elev = currentPoint.elevation ? Math.round(currentPoint.elevation) + 'm' : 'Unknown';
            this.checkpointModal.locationSpan.textContent = `${lat}, ${lon} (${elev})`;
        } else {
            this.checkpointModal.locationSpan.textContent = 'Getting location...';
        }
    }

    async saveCheckpoint() {
        const name = this.checkpointModal.nameInput.value.trim();
        if (!name) {
            alert('Please enter a checkpoint name');
            this.checkpointModal.nameInput.focus();
            return;
        }

        const description = this.checkpointModal.descriptionInput.value.trim();
        const currentPoint = this.trackPoints[this.trackPoints.length - 1];

        if (!currentPoint) {
            alert('No GPS location available. Please wait for GPS to stabilize.');
            return;
        }

        // Create checkpoint object
        const checkpoint = {
            name: name,
            description: description,
            timestamp: new Date().toISOString(),
            latitude: currentPoint.latitude,
            longitude: currentPoint.longitude,
            elevation: currentPoint.elevation,
            accuracy: currentPoint.accuracy,
            speed: currentPoint.speed || 0,
            heading: currentPoint.heading || 0,
            userId: this.userId,
            sessionId: this.sessionId,
            deviceId: this.deviceId
        };

        try {
            // Save checkpoint to server
            const response = await fetch('./api/checkpoint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(checkpoint)
            });

            if (response.ok) {
                // Show success message
                this.showCheckpointSuccess(name);
                
                // Close modal
                this.hideCheckpointModal();
                
                console.log('Checkpoint saved:', checkpoint);
            } else {
                throw new Error('Failed to save checkpoint');
            }
        } catch (error) {
            console.error('Error saving checkpoint:', error);
            alert('Failed to save checkpoint. Please try again.');
        }
    }

    showCheckpointSuccess(name) {
        // Create temporary success notification
        const notification = document.createElement('div');
        notification.className = 'checkpoint-notification';
        notification.innerHTML = `
            <div class="checkpoint-success">
                <span class="checkpoint-icon">✅</span>
                <span class="checkpoint-text">Checkpoint "${name}" saved!</span>
            </div>
        `;
        
        // Add notification styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4aff4a, #2ecc71);
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(74, 255, 74, 0.3);
            z-index: 3000;
            font-size: 14px;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
        `;

        // Add animation keyframes
        if (!document.querySelector('#checkpoint-animations')) {
            const style = document.createElement('style');
            style.id = 'checkpoint-animations';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize tracker when page loads
document.addEventListener('DOMContentLoaded', () => {
    const tracker = new GPSLiveTracker();
}); 