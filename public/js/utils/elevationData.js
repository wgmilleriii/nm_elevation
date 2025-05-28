// Function to generate test elevation data with configurable resolution
export function generateTestElevationData(startLat, endLat, startLng, endLng, resolution = 0.01) {
    const data = {};
    const latStep = (endLat - startLat) / (resolution * 100);
    const lngStep = (endLng - startLng) / (resolution * 100);
    
    for (let lat = startLat; lat <= endLat; lat += latStep) {
        for (let lng = startLng; lng <= endLng; lng += lngStep) {
            const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
            // Generate a more realistic elevation pattern
            const baseElevation = 1500; // Base elevation in meters
            const latFactor = Math.sin((lat - 35) * 10) * 500; // Variation based on latitude
            const lngFactor = Math.cos((lng + 106) * 10) * 300; // Variation based on longitude
            const noise = Math.random() * 100; // Random noise
            data[key] = Math.round(baseElevation + latFactor + lngFactor + noise);
        }
    }
    return data;
}

// For browser environment
if (typeof window !== 'undefined') {
    window.generateTestElevationData = generateTestElevationData;
} 