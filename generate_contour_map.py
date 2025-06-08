import matplotlib
matplotlib.use('Agg')
import sqlite3
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
import os
import glob
from PIL import Image, ImageDraw, ImageFont
import time
from generate_elevation_image import create_elevation_image

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

def get_elevation_data(bounds):
    """Fetch elevation data from the grid of databases for the specified bounds"""
    all_points = []
    
    # Get all database files in the grid_databases directory
    db_files = glob.glob('grid_databases/mountains_*.db')
    print(f"\nFound {len(db_files)} database files")
    
    # Test data to verify bounds
    test_point = (35.108862226829714, -104.6985408614735, 1000)  # lat, lon, elevation
    print(f"\nTest point: {test_point}")
    print(f"Bounds check: lat {bounds['minLat']} <= {test_point[0]} <= {bounds['maxLat']}")
    print(f"Bounds check: lon {bounds['minLon']} <= {test_point[1]} <= {bounds['maxLon']}")
    
    for db_file in db_files:
        try:
            print(f"\nQuerying database: {db_file}")
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            # First check if the table exists
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='elevation_points'")
            if not cursor.fetchone():
                print(f"Table 'elevation_points' not found in {db_file}")
                continue
                
            # Check table structure
            cursor.execute("PRAGMA table_info(elevation_points)")
            columns = cursor.fetchall()
            print(f"Table structure: {columns}")
            
            # Get all points within the specified bounds
            query = """
                SELECT latitude, longitude, elevation
                FROM elevation_points
                WHERE latitude BETWEEN ? AND ?
                AND longitude BETWEEN ? AND ?
                AND elevation IS NOT NULL
            """
            params = [bounds['minLat'], bounds['maxLat'], 
                     bounds['minLon'], bounds['maxLon']]
            print(f"Query bounds: lat={bounds['minLat']:.2f} to {bounds['maxLat']:.2f}, lon={bounds['minLon']:.2f} to {bounds['maxLon']:.2f}")
            
            # First check if there are any points in the database
            cursor.execute("SELECT COUNT(*) FROM elevation_points")
            total_points = cursor.fetchone()[0]
            print(f"Total points in database: {total_points}")
            
            # Get a sample point to verify data format
            cursor.execute("SELECT latitude, longitude, elevation FROM elevation_points LIMIT 1")
            sample = cursor.fetchone()
            if sample:
                print(f"Sample point from database: {sample}")
            
            # Now execute the bounded query
            cursor.execute(query, params)
            points = cursor.fetchall()
            print(f"Found {len(points)} points in {db_file}")
            
            if points:
                print("Sample point from query:", points[0])
            
            all_points.extend(points)
            conn.close()
            
        except sqlite3.Error as e:
            print(f"Error reading {db_file}: {e}")
            continue
    
    print(f"\nTotal points found across all databases: {len(all_points)}")
    if all_points:
        print("Sample point from all points:", all_points[0])
    return all_points

def create_contour_map(points, width=2000, height=2000, num_contours=30, line_width=0.5, show_cities=False, color_mode='bw'):
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
    
    # Create contour plot
    print("Creating contour plot...")
    if color_mode == 'bw':
        contour = ax.contour(grid, levels=num_contours, colors='black', linewidths=line_width)
    else:
        contour = ax.contour(grid, levels=num_contours, colors='black', linewidths=line_width)
        contourf = ax.contourf(grid, levels=num_contours, cmap='terrain', alpha=0.7)
        cbar = plt.colorbar(contourf, ax=ax, label='Elevation (meters)')
    
    # Remove axis ticks and labels
    ax.set_xticks([])
    ax.set_yticks([])
    
    # Add city markers if requested
    if show_cities:
        print("Adding city markers...")
        for city in NM_CITIES:
            x = (city["lon"] - NM_BOUNDS['minLon']) / (NM_BOUNDS['maxLon'] - NM_BOUNDS['minLon']) * (width - 1)
            y = (NM_BOUNDS['maxLat'] - city["lat"]) / (NM_BOUNDS['maxLat'] - NM_BOUNDS['minLat']) * (height - 1)
            
            # Calculate marker size based on population (logarithmic scale)
            pop_ratio = np.log(city["population"]) / np.log(max(c["population"] for c in NM_CITIES))
            marker_size = 5 + (pop_ratio * 15)  # 5-20 pixels
            
            # Plot city marker
            ax.plot(x, y, 'ro', markersize=marker_size, markeredgecolor='black', markeredgewidth=1)
            
            # Add city name
            ax.text(x, y + 20, city["name"], 
                    fontsize=8 + (pop_ratio * 8),  # 8-16pt font
                    ha='center', va='bottom',
                    bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1))
    
    # Save the figure
    print("Saving contour map...")
    os.makedirs('public/images', exist_ok=True)
    
    # Generate timestamp
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    
    # Create filename with timestamp
    output_file = f'public/images/contour_map_{color_mode}_{timestamp}.png'
    plt.savefig(output_file, 
                dpi=100, 
                bbox_inches='tight',
                pad_inches=0.1,
                facecolor='white',
                edgecolor='none')
    plt.close()
    
    # Also save a copy without timestamp for web interface
    web_file = f'public/images/contour_map_{color_mode}.png'
    plt.savefig(web_file, 
                dpi=100, 
                bbox_inches='tight',
                pad_inches=0.1,
                facecolor='white',
                edgecolor='none')
    
    print(f"Contour map created successfully: {output_file}")
    return output_file

def generate_contour_map(color_mode='bw', bounds=None):
    """Generate a contour map with the specified color mode and bounds"""
    print("\n=== Starting generate_contour_map ===")
    # Use provided bounds or default to New Mexico bounds
    if bounds is None:
        bounds = {
            'minLat': 31.20,
            'maxLat': 37.20,
            'minLon': -109.20,
            'maxLon': -102.80
        }
    print(f"Using bounds: {bounds}")
    
    # Get elevation data for the specified bounds
    print("Getting elevation data...")
    points = get_elevation_data(bounds)
    print(f"Got {len(points)} elevation points")
    
    # Create the elevation image
    print("Creating elevation image...")
    create_elevation_image(points, bounds=bounds)
    print("Elevation image created")
    
    # Generate timestamp for filename
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    print(f"Generated timestamp: {timestamp}")
    
    # Save the map with timestamp
    output_file = f'public/images/contour_map_{color_mode}_{timestamp}.png'
    temp_file = f'public/images/contour_map_{color_mode}.png'
    print(f"Renaming {temp_file} to {output_file}")
    os.rename(temp_file, output_file)
    print(f"File renamed successfully")
    
    return output_file

if __name__ == '__main__':
    points = get_elevation_data(NM_BOUNDS)
    create_contour_map(points) 