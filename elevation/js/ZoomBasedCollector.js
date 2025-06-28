class ZoomBasedCollector {
    constructor() {
        this.POINTS_PER_DB = 10000;
        this.MAX_DBS_PER_ZOOM = 100;
    }

    async startCollection(bounds, zoom) {
        console.log('Starting collection for:', {
            zoom,
            bounds
        });

        try {
            // Make API call to server to collect points
            const response = await fetch('/api/collect-points', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bounds,
                    zoom,
                    pointsPerDb: this.POINTS_PER_DB,
                    maxDbsPerZoom: this.MAX_DBS_PER_ZOOM
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Collection completed:', data);
            return data;

        } catch (error) {
            console.error('Error during collection:', error);
            throw error;
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
        
        // Ensure elevation stays within reasonable bounds for New Mexico
        elevation = Math.max(1000, Math.min(4000, elevation));
        
        return elevation;
    }
}

export default ZoomBasedCollector; 