// Fetch elevation data for a point
export async function fetchElevation(lat, lng) {
    try {
        const response = await fetch(`/api/elevation/${lat}/${lng}`);
        if (!response.ok) throw new Error('Failed to fetch elevation');
        const data = await response.json();
        return data.elevation;
    } catch (error) {
        console.warn(`Error fetching elevation for point:`, { lat, lng }, error);
        return null;
    }
}

// Fetch elevation profile data
export async function fetchElevationProfile(start, end, numPoints) {
    const response = await fetch('/api/elevation/profile', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            start,
            end,
            numPoints
        })
    });
    
    if (!response.ok) throw new Error('Failed to fetch elevation profile');
    return response.json();
}

// Add elevation data to points
export async function addElevationData(points) {
    const pointsWithElevation = await Promise.all(
        points.map(async point => {
            const elevation = await fetchElevation(point.lat, point.lng);
            return elevation !== null ? { ...point, elevation } : null;
        })
    );
    
    return pointsWithElevation.filter(p => p !== null);
} 