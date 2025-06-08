import sqlite3
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import os
import glob
from PIL import Image, ImageDraw, ImageFont

# New Mexico bounds
NM_BOUNDS = {
    'minLat': 31.20,
    'maxLat': 37.20,
    'minLon': -109.20,
    'maxLon': -102.80
}

# Top 10 New Mexico cities
NM_CITIES = [
    {"name": "Albuquerque", "lat": 35.0844, "lon": -106.6504, "population": 564559},
    {"name": "Las Cruces", "lat": 32.3199, "lon": -106.7637, "population": 111385},
    {"name": "Rio Rancho", "lat": 35.2328, "lon": -106.6630, "population": 104046},
    {"name": "Santa Fe", "lat": 35.6870, "lon": -105.9378, "population": 87505},
    {"name": "Roswell", "lat": 33.3943, "lon": -104.5230, "population": 48386},
    {"name": "Farmington", "lat": 36.7281, "lon": -108.2087, "population": 46624},
    {"name": "Clovis", "lat": 34.4048, "lon": -103.2052, "population": 39860},
    {"name": "Hobbs", "lat": 32.7026, "lon": -103.1360, "population": 39141},
    {"name": "Alamogordo", "lat": 32.8995, "lon": -105.9603, "population": 31384},
    {"name": "Carlsbad", "lat": 32.4207, "lon": -104.2288, "population": 32238},
    {"name": "Taos", "lat": 36.4072, "lon": -105.5734, "population": 5716}
]

def get_elevation_data():
    """Fetch all elevation data from the grid of databases"""
    all_points = []
    
    # Get all database files in the grid_databases directory
    db_files = glob.glob('grid_databases/mountains_*.db')
    
    for db_file in db_files:
        try:
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            # Get all points within New Mexico bounds
            cursor.execute("""
                SELECT latitude, longitude, elevation
                FROM elevation_points
                WHERE latitude BETWEEN ? AND ?
                AND longitude BETWEEN ? AND ?
                AND elevation IS NOT NULL
            """, [NM_BOUNDS['minLat'], NM_BOUNDS['maxLat'], 
                  NM_BOUNDS['minLon'], NM_BOUNDS['maxLon']])
            
            points = cursor.fetchall()
            all_points.extend(points)
            conn.close()
            
        except sqlite3.Error as e:
            print(f"Error reading {db_file}: {e}")
            continue
    
    print(f"Read elevation data from {len(db_files)} databases")
    return all_points

def create_contour_map(points, width=2000, height=2000):
    """Create a contour map from elevation points"""
    print("Starting contour map creation...")
    
    # Create empty grid
    grid = np.zeros((height, width), dtype=np.float32)
    counts = np.zeros((height, width), dtype=np.int32)
    
    # Convert points to grid coordinates
    print("Converting points to grid...")
    total_points = len(points)
    for i, (lat, lon, elev) in enumerate(points):
        if i % 10000 == 0:
            print(f"Processing points: {i}/{total_points} ({(i/total_points*100):.1f}%)")
        x = int((lon - NM_BOUNDS['minLon']) / (NM_BOUNDS['maxLon'] - NM_BOUNDS['minLon']) * (width - 1))
        y = int((NM_BOUNDS['maxLat'] - lat) / (NM_BOUNDS['maxLat'] - NM_BOUNDS['minLat']) * (height - 1))
        if 0 <= x < width and 0 <= y < height:
            grid[y, x] += elev
            counts[y, x] += 1
    
    # Average points in same cell
    mask = counts > 0
    grid[mask] /= counts[mask]
    
    # Fill empty cells using nearest neighbor interpolation
    print("Filling empty cells...")
    from scipy.ndimage import distance_transform_edt
    mask = counts == 0
    if mask.any():
        valid_points = np.argwhere(~mask)
        points_to_fill = np.argwhere(mask)
        from scipy.spatial import cKDTree
        tree = cKDTree(valid_points)
        distances, indices = tree.query(points_to_fill)
        grid[points_to_fill[:, 0], points_to_fill[:, 1]] = grid[valid_points[indices, 0], valid_points[indices, 1]]
    
    # Create figure and axis
    plt.figure(figsize=(20, 20), dpi=100)
    ax = plt.gca()
    
    # Create contour plot with more levels for better detail
    print("Creating contour plot...")
    contour = ax.contour(grid, levels=30, colors='black', linewidths=0.5)
    
    # Remove axis ticks and labels
    ax.set_xticks([])
    ax.set_yticks([])
    
    # Save the figure
    print("Saving contour map...")
    os.makedirs('public/images', exist_ok=True)
    plt.savefig('public/images/contour_map_bw.png', 
                dpi=100, 
                bbox_inches='tight',
                pad_inches=0.1,
                facecolor='white',
                edgecolor='none')
    plt.close()
    
    print("Black and white contour map created successfully!")

if __name__ == '__main__':
    points = get_elevation_data()
    create_contour_map(points) 