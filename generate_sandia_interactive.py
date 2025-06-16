import sqlite3
import numpy as np
from scipy.interpolate import griddata
import plotly.graph_objects as go
import webbrowser
import os

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

def create_interactive_visualization():
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
    
    # Create interactive surface plot
    print("Creating interactive 3D visualization...")
    
    # Create the main surface
    surface = go.Surface(
        x=lon_grid,
        y=lat_grid,
        z=elevation_grid,
        colorscale='earth',
        lighting=dict(
            ambient=0.6,
            diffuse=0.5,
            fresnel=0.1,
            specular=0.2,
            roughness=0.5
        ),
        lightposition=dict(
            x=0,
            y=0,
            z=1000
        ),
        contours=dict(
            z=dict(
                show=True,
                usecolormap=True,
                highlightcolor="lightblue",
                project_z=True
            )
        )
    )
    
    # Create the figure
    fig = go.Figure(data=[surface])
    
    # Update the layout
    fig.update_layout(
        title=dict(
            text='Sandia Mountains Interactive 3D Visualization',
            y=0.95,
            x=0.5,
            xanchor='center',
            yanchor='top',
            font=dict(size=24)
        ),
        scene=dict(
            camera=dict(
                eye=dict(x=1.5, y=1.5, z=1.2),
                center=dict(x=0, y=0, z=-0.3)
            ),
            xaxis_title='Longitude',
            yaxis_title='Latitude',
            zaxis_title='Elevation (meters)',
            aspectratio=dict(x=1, y=1, z=0.5),
            xaxis=dict(gridcolor='gray', showgrid=True),
            yaxis=dict(gridcolor='gray', showgrid=True),
            zaxis=dict(gridcolor='gray', showgrid=True)
        ),
        width=1200,
        height=800,
        margin=dict(l=0, r=0, b=0, t=30)
    )
    
    # Add hover information
    fig.update_traces(
        hovertemplate="Longitude: %{x:.4f}<br>Latitude: %{y:.4f}<br>Elevation: %{z:.1f}m<extra></extra>"
    )
    
    # Create directory for the output if it doesn't exist
    os.makedirs('interactive', exist_ok=True)
    
    # Save as interactive HTML
    output_file = 'interactive/sandia_3d_interactive.html'
    fig.write_html(
        output_file,
        include_plotlyjs=True,
        full_html=True,
        include_mathjax=False,
        config={
            'displayModeBar': True,
            'displaylogo': False,
            'modeBarButtonsToAdd': ['drawline', 'drawopenpath', 'eraseshape'],
            'toImageButtonOptions': {'height': 800, 'width': 1200}
        }
    )
    
    print(f"\nInteractive visualization saved as {output_file}")
    print("\nFeatures available in the interactive view:")
    print("- Left click + drag: Rotate the view")
    print("- Right click + drag: Pan the view")
    print("- Mouse wheel: Zoom in/out")
    print("- Double click: Reset view")
    print("- Hover over surface: See exact coordinates and elevation")
    print("- Camera controls: Additional viewing angles and options")
    print("- Download: Save current view as PNG")
    
    # Open the visualization in the default web browser
    webbrowser.open('file://' + os.path.abspath(output_file))

if __name__ == "__main__":
    create_interactive_visualization() 