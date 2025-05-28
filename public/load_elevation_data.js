// Function to generate test elevation data
function generateTestElevationData(startLat, endLat, startLng, endLng, resolution) {
    console.log('Generating elevation data with params:', { startLat, endLat, startLng, endLng, resolution });
    
    const data = {};
    const latStep = resolution;
    const lngStep = resolution;
    
    // Generate a more interesting elevation pattern
    for (let lat = startLat; lat <= endLat; lat += latStep) {
        for (let lng = startLng; lng <= endLng; lng += lngStep) {
            // Base elevation on distance from center
            const centerLat = (startLat + endLat) / 2;
            const centerLng = (startLng + endLng) / 2;
            const distFromCenter = Math.sqrt(
                Math.pow(lat - centerLat, 2) + 
                Math.pow(lng - centerLng, 2)
            );
            
            // Create some mountain-like features
            const baseElevation = 1500; // Base elevation in meters
            const mountainHeight = 2000; // Maximum mountain height
            const mountainWidth = 0.5; // Width of mountain features
            
            // Add some random variation
            const randomFactor = Math.random() * 200 - 100; // Random variation between -100 and 100 meters
            
            // Calculate elevation with multiple peaks
            const elevation = baseElevation + 
                mountainHeight * Math.exp(-distFromCenter / mountainWidth) +
                mountainHeight * 0.5 * Math.exp(-Math.pow(lat - (startLat + 0.3), 2) / 0.1) +
                mountainHeight * 0.3 * Math.exp(-Math.pow(lng - (startLng + 0.2), 2) / 0.1) +
                randomFactor;
            
            // Round to 2 decimal places for the key
            const latKey = lat.toFixed(2);
            const lngKey = lng.toFixed(2);
            const key = `${latKey},${lngKey}`;
            
            data[key] = Math.round(elevation);
        }
    }
    
    console.log('Generated elevation data:', {
        points: Object.keys(data).length,
        sample: Object.entries(data).slice(0, 5),
        minElev: Math.min(...Object.values(data)),
        maxElev: Math.max(...Object.values(data))
    });
    
    return data;
}

// Make the function available globally
window.generateTestElevationData = generateTestElevationData; 