# Elevation Data Collection Algorithms

This document describes the different algorithms available for collecting elevation data points when zooming into specific regions.

## Available Algorithms

### 1. Random Distribution (Default)
- **Algorithm Type**: `random`
- **Description**: Points are randomly distributed within the specified bounds
- **Best For**: General overview of an area where specific features aren't the focus
- **Point Density**: Uniform across the region
- **Performance**: Fast, minimal computational overhead

### 2. Ridge Detection
- **Algorithm Type**: `ridge`
- **Description**: Concentrates points along mountain ridges and significant elevation changes
- **Best For**: 
  - Mapping mountain ranges
  - Identifying terrain features
  - Creating detailed topographic maps
- **Method**:
  1. Creates an elevation grid of the area
  2. Calculates elevation gradients
  3. Identifies ridge candidates based on gradient patterns
  4. Selects points ensuring good distribution along ridges
- **Parameters**:
  - `gridResolution`: Number of initial sampling points (default: 50)
  - `gradientThreshold`: Minimum elevation change to identify a ridge (default: 0.1)
  - `minDistance`: Minimum distance between selected points

## Usage

### Via API
```javascript
// Example API call
fetch('/api/collect-points', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        bounds: {
            north: 37.0,
            south: 31.33,
            east: -103.0,
            west: -109.05
        },
        zoom: 12,
        algorithm: 'ridge' // or 'random'
    })
});
```

### Response Format
```javascript
{
    points: number,        // Number of points collected
    algorithm: string,     // Algorithm used
    bounds: {             // Normalized bounds
        minLat: number,
        maxLat: number,
        minLon: number,
        maxLon: number
    },
    zoom: number          // Zoom level used
}
```

## Database Schema Updates

The collection algorithms store additional metadata about how points were collected:

```sql
CREATE TABLE elevation_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation REAL,
    collection_method TEXT NOT NULL,    -- Algorithm used
    zoom_level INTEGER NOT NULL,        -- Zoom level when collected
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(latitude, longitude, zoom_level)
);
```

## Future Algorithms

Planned future additions:
1. Edge Following: Follow terrain edges and cliffs
2. Contour Following: Follow elevation contour lines
3. Feature-Based: Concentrate points around specific terrain features

## Performance Considerations

- Ridge detection requires more initial sampling points than random distribution
- Higher zoom levels increase the grid resolution automatically
- Points are cached by zoom level to prevent redundant collection
- Elevation data is cached to reduce API calls 