import sqlite3
import numpy as np
import matplotlib.pyplot as plt
import os
import glob

def load_all_elevation_data():
    """Load elevation data from all grid databases."""
    all_points = []
    total_dbs = 0
    points_per_db = {}
    
    # Get all database files
    db_files = glob.glob('grid_databases/mountains_*.db')
    print(f"Found {len(db_files)} database files")
    
    for db_file in db_files:
        try:
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            # Get points from this database
            cursor.execute("SELECT lat, lon, elevation FROM points WHERE elevation IS NOT NULL")
            points = cursor.fetchall()
            
            if points:
                total_dbs += 1
                points_per_db[os.path.basename(db_file)] = len(points)
                all_points.extend(points)
            
            conn.close()
        except Exception as e:
            print(f"Error reading {db_file}: {e}")
            continue
    
    # Print statistics
    print(f"\nDatabase Statistics:")
    print(f"Total databases with data: {total_dbs}")
    print(f"Total points collected: {len(all_points)}")
    print("\nPoints per database:")
    for db, count in sorted(points_per_db.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"{db}: {count} points")
    
    if all_points:
        # Convert to numpy arrays for statistics
        elevations = np.array([p[2] for p in all_points])
        print(f"\nElevation Statistics:")
        print(f"Min elevation: {np.min(elevations):.1f}m")
        print(f"Max elevation: {np.max(elevations):.1f}m")
        print(f"Mean elevation: {np.mean(elevations):.1f}m")
    
    return all_points

def create_contour_map():
    # Load all elevation data
    points = load_all_elevation_data()
    
    if not points:
        print("No elevation data found!")
        return
    
    # Convert points to numpy arrays
    lats = np.array([p[0] for p in points])
    lons = np.array([p[1] for p in points])
    elevations = np.array([p[2] for p in points])
    
    # Create figure with high resolution
    plt.figure(figsize=(20, 20), dpi=300)
    
    # Calculate optimal number of contour levels based on elevation range
    elev_range = np.max(elevations) - np.min(elevations)
    n_levels = int(elev_range / 50)  # One contour every 50 meters
    print(f"\nUsing {n_levels} contour levels")
    
    # Create the contour plot with high resolution
    plt.tricontour(lons, lats, elevations, 
                  levels=n_levels,
                  colors='black',
                  linewidths=0.5)
    
    # Add colored contour fill with high resolution
    contour_filled = plt.tricontourf(lons, lats, elevations, 
                                    levels=n_levels,
                                    cmap='terrain')
    
    # Add colorbar
    cbar = plt.colorbar(contour_filled, label='Elevation (meters)')
    cbar.ax.tick_params(labelsize=10)
    
    # Customize the plot
    plt.title('New Mexico Elevation Contour Map', fontsize=16)
    plt.xlabel('Longitude', fontsize=12)
    plt.ylabel('Latitude', fontsize=12)
    
    # Set axis limits to New Mexico bounds
    plt.xlim(-109.05, -103.00)  # NM longitude bounds
    plt.ylim(31.33, 37.00)      # NM latitude bounds
    
    # Add grid
    plt.grid(True, linestyle='--', alpha=0.3)
    
    # Save the map with maximum quality
    print("\nSaving high-resolution contour map...")
    plt.savefig('nm_contour_map.png', 
                dpi=300, 
                bbox_inches='tight')
    plt.close()
    
    print("Contour map saved as nm_contour_map.png")

if __name__ == "__main__":
    create_contour_map() 