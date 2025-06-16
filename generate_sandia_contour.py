import sqlite3
import numpy as np
import matplotlib.pyplot as plt
import os

def load_sandia_elevation_data():
    """Load elevation data from sandia_detail database."""
    try:
        conn = sqlite3.connect('sandia_detail.db')
        cursor = conn.cursor()
        
        # Get points from the database
        cursor.execute("""
            SELECT latitude, longitude, elevation 
            FROM elevation_points 
            WHERE elevation IS NOT NULL
        """)
        points = cursor.fetchall()
        
        if points:
            # Convert to numpy arrays for statistics
            elevations = np.array([p[2] for p in points])
            print(f"\nElevation Statistics:")
            print(f"Total points: {len(points):,}")
            print(f"Min elevation: {np.min(elevations):.1f}m")
            print(f"Max elevation: {np.max(elevations):.1f}m")
            print(f"Mean elevation: {np.mean(elevations):.1f}m")
        
        conn.close()
        return points
        
    except Exception as e:
        print(f"Error reading sandia_detail.db: {e}")
        return []

def create_bw_contour_map():
    # Load Sandia elevation data
    points = load_sandia_elevation_data()
    
    if not points:
        print("No elevation data found!")
        return
    
    # Convert points to numpy arrays
    lats = np.array([p[0] for p in points])
    lons = np.array([p[1] for p in points])
    elevations = np.array([p[2] for p in points])
    
    # Create figure with high resolution
    plt.figure(figsize=(20, 20), dpi=300, facecolor='white')
    
    # Calculate optimal number of contour levels
    elev_range = np.max(elevations) - np.min(elevations)
    n_levels = int(elev_range / 25)  # One contour every 25 meters for more detail
    print(f"\nUsing {n_levels} contour levels")
    
    # Create the main contour plot with black lines
    plt.tricontour(lons, lats, elevations,
                  levels=n_levels,
                  colors='black',
                  linewidths=0.5)
    
    # Add filled contours in grayscale
    contour_filled = plt.tricontourf(lons, lats, elevations,
                                    levels=n_levels,
                                    cmap='gray')
    
    # Add colorbar
    cbar = plt.colorbar(contour_filled, label='Elevation (meters)')
    cbar.ax.tick_params(labelsize=10)
    
    # Customize the plot
    plt.title('Sandia Mountains Elevation Contour Map', fontsize=16)
    plt.xlabel('Longitude', fontsize=12)
    plt.ylabel('Latitude', fontsize=12)
    
    # Calculate bounds with some padding
    lon_padding = 0.05
    lat_padding = 0.05
    plt.xlim(np.min(lons) - lon_padding, np.max(lons) + lon_padding)
    plt.ylim(np.min(lats) - lat_padding, np.max(lats) + lat_padding)
    
    # Add grid
    plt.grid(True, linestyle='--', alpha=0.3, color='gray')
    
    # Save the map with maximum quality
    print("\nSaving high-resolution black and white contour map...")
    plt.savefig('sandia_contour_bw.png',
                dpi=300,
                bbox_inches='tight',
                facecolor='white')
    plt.close()
    
    print("Black and white contour map saved as sandia_contour_bw.png")

if __name__ == "__main__":
    create_bw_contour_map() 