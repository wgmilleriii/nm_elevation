import sqlite3
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from scipy.interpolate import griddata

def load_sandia_elevation_data():
    """Load elevation data from sandia_detail database."""
    try:
        conn = sqlite3.connect('sandia_detail.db')
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT latitude, longitude, elevation 
            FROM elevation_points 
            WHERE elevation IS NOT NULL
        """)
        points = cursor.fetchall()
        
        if points:
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

def create_3d_visualizations():
    # Load data
    points = load_sandia_elevation_data()
    
    if not points:
        print("No elevation data found!")
        return
    
    # Convert points to numpy arrays
    lats = np.array([p[0] for p in points])
    lons = np.array([p[1] for p in points])
    elevations = np.array([p[2] for p in points])
    
    # Create a regular grid to interpolate the data
    grid_size = 200
    lon_min, lon_max = np.min(lons), np.max(lons)
    lat_min, lat_max = np.min(lats), np.max(lats)
    
    lon_grid, lat_grid = np.meshgrid(
        np.linspace(lon_min, lon_max, grid_size),
        np.linspace(lat_min, lat_max, grid_size)
    )
    
    # Interpolate elevation data onto the regular grid
    print("\nInterpolating elevation data onto regular grid...")
    elevation_grid = griddata(
        (lons, lats), 
        elevations, 
        (lon_grid, lat_grid), 
        method='cubic'
    )
    
    # Create 3D surface plot
    print("Creating 3D surface plot...")
    fig = plt.figure(figsize=(20, 20))
    ax = fig.add_subplot(111, projection='3d')
    
    # Plot surface with terrain colormap
    surface = ax.plot_surface(
        lon_grid, lat_grid, elevation_grid,
        cmap='terrain',
        linewidth=0,
        antialiased=True,
        alpha=0.8
    )
    
    # Customize the plot
    ax.set_title('Sandia Mountains 3D Surface', fontsize=16, pad=20)
    ax.set_xlabel('Longitude', fontsize=12, labelpad=10)
    ax.set_ylabel('Latitude', fontsize=12, labelpad=10)
    ax.set_zlabel('Elevation (meters)', fontsize=12, labelpad=10)
    
    # Add colorbar
    fig.colorbar(surface, ax=ax, shrink=0.5, aspect=5, label='Elevation (meters)')
    
    # Adjust viewing angle for better visualization
    ax.view_init(elev=30, azim=225)
    
    # Save the surface plot
    print("Saving 3D surface plot...")
    plt.savefig('sandia_3d_surface.png', 
                dpi=300, 
                bbox_inches='tight',
                facecolor='white')
    plt.close()
    
    # Create wireframe plot
    print("\nCreating wireframe plot...")
    fig = plt.figure(figsize=(20, 20))
    ax = fig.add_subplot(111, projection='3d')
    
    # Plot wireframe
    wireframe = ax.plot_wireframe(
        lon_grid, lat_grid, elevation_grid,
        rstride=5,
        cstride=5,
        color='black',
        linewidth=0.5
    )
    
    # Customize the plot
    ax.set_title('Sandia Mountains Wireframe', fontsize=16, pad=20)
    ax.set_xlabel('Longitude', fontsize=12, labelpad=10)
    ax.set_ylabel('Latitude', fontsize=12, labelpad=10)
    ax.set_zlabel('Elevation (meters)', fontsize=12, labelpad=10)
    
    # Adjust viewing angle
    ax.view_init(elev=30, azim=225)
    
    # Save the wireframe plot
    print("Saving wireframe plot...")
    plt.savefig('sandia_wireframe.png', 
                dpi=300, 
                bbox_inches='tight',
                facecolor='white')
    plt.close()
    
    # Create combined visualization
    print("\nCreating combined visualization...")
    fig = plt.figure(figsize=(20, 20))
    ax = fig.add_subplot(111, projection='3d')
    
    # Plot semi-transparent surface
    surface = ax.plot_surface(
        lon_grid, lat_grid, elevation_grid,
        cmap='terrain',
        linewidth=0,
        antialiased=True,
        alpha=0.7
    )
    
    # Add wireframe overlay
    wireframe = ax.plot_wireframe(
        lon_grid, lat_grid, elevation_grid,
        rstride=10,
        cstride=10,
        color='black',
        linewidth=0.3,
        alpha=0.3
    )
    
    # Customize the plot
    ax.set_title('Sandia Mountains 3D Combined View', fontsize=16, pad=20)
    ax.set_xlabel('Longitude', fontsize=12, labelpad=10)
    ax.set_ylabel('Latitude', fontsize=12, labelpad=10)
    ax.set_zlabel('Elevation (meters)', fontsize=12, labelpad=10)
    
    # Add colorbar
    fig.colorbar(surface, ax=ax, shrink=0.5, aspect=5, label='Elevation (meters)')
    
    # Adjust viewing angle
    ax.view_init(elev=30, azim=225)
    
    # Save the combined plot
    print("Saving combined visualization...")
    plt.savefig('sandia_3d_combined.png', 
                dpi=300, 
                bbox_inches='tight',
                facecolor='white')
    plt.close()
    
    print("\nAll 3D visualizations completed!")
    print("Output files:")
    print("- sandia_3d_surface.png (Colored surface plot)")
    print("- sandia_wireframe.png (Black and white wireframe)")
    print("- sandia_3d_combined.png (Surface with wireframe overlay)")

if __name__ == "__main__":
    create_3d_visualizations() 