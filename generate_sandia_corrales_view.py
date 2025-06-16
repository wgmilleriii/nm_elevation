import sqlite3
import numpy as np
from scipy.interpolate import griddata
import plotly.graph_objects as go
import webbrowser
import os

# Corrales viewpoint coordinates
CORRALES_LAT = 35.2372
CORRALES_LON = -106.6228
CORRALES_ELEVATION = 1524  # meters (approximately 5000 feet)

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
            print(f"\nViewing from Corrales:")
            print(f"Latitude: {CORRALES_LAT}°N")
            print(f"Longitude: {CORRALES_LON}°W")
            print(f"Elevation: {CORRALES_ELEVATION}m")
        
        conn.close()
        return points
        
    except Exception as e:
        print(f"Error reading sandia_detail.db: {e}")
        return []

def create_corrales_visualization():
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
    grid_size = 300  # Increased for better detail
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
    print("Creating Corrales viewpoint visualization...")
    
    # Calculate camera position relative to the mountain
    # Position slightly above Corrales elevation for better view
    camera_elevation = (CORRALES_ELEVATION - np.min(elevations)) / (np.max(elevations) - np.min(elevations))
    
    # Create the main surface
    surface = go.Surface(
        x=lon_grid,
        y=lat_grid,
        z=elevation_grid,
        colorscale='earth',
        lighting=dict(
            ambient=0.7,  # Increased for better visibility
            diffuse=0.6,
            fresnel=0.1,
            specular=0.3,
            roughness=0.4
        ),
        lightposition=dict(
            x=-1,  # Light from the west (Corrales side)
            y=0,
            z=2
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
    
    # Calculate the viewing distance and angle
    # We want to be west of the mountains (negative x) and slightly elevated
    eye_x = (CORRALES_LON - np.mean([lon_min, lon_max])) * 3.0  # Increased distance for wider view
    eye_y = (CORRALES_LAT - np.mean([lat_min, lat_max])) * 1.0  # Adjusted for better centering
    eye_z = 1.2  # Higher elevation for better overview
    
    # Update the layout
    fig.update_layout(
        title=dict(
            text='Sandia Mountains - View from Corrales (Wide View)',
            y=0.95,
            x=0.5,
            xanchor='center',
            yanchor='top',
            font=dict(size=24)
        ),
        scene=dict(
            camera=dict(
                eye=dict(x=eye_x, y=eye_y, z=eye_z),
                center=dict(x=0, y=0, z=-0.1),  # Adjusted center point
                up=dict(x=0, y=0, z=1)  # Keep vertical orientation
            ),
            xaxis_title='Longitude',
            yaxis_title='Latitude',
            zaxis_title='Elevation (meters)',
            aspectratio=dict(x=1.5, y=1.5, z=0.5),  # Adjusted ratio for wider view
            xaxis=dict(gridcolor='gray', showgrid=True),
            yaxis=dict(gridcolor='gray', showgrid=True),
            zaxis=dict(gridcolor='gray', showgrid=True)
        ),
        width=1800,  # Even wider view
        height=1000,  # Taller view
        margin=dict(l=0, r=0, b=0, t=30)
    )
    
    # Add hover information
    fig.update_traces(
        hovertemplate="Longitude: %{x:.4f}<br>Latitude: %{y:.4f}<br>Elevation: %{z:.1f}m<extra></extra>"
    )
    
    # Add Corrales marker
    fig.add_trace(go.Scatter3d(
        x=[CORRALES_LON],
        y=[CORRALES_LAT],
        z=[CORRALES_ELEVATION],
        mode='markers+text',
        marker=dict(
            size=8,
            color='red',
            symbol='diamond'
        ),
        text=['Corrales'],
        textposition='top center',
        name='Viewing Position'
    ))
    
    # Create directory for the output if it doesn't exist
    os.makedirs('interactive', exist_ok=True)
    
    # Save as interactive HTML
    output_file = 'interactive/sandia_from_corrales.html'
    fig.write_html(
        output_file,
        include_plotlyjs=True,
        full_html=True,
        include_mathjax=False,
        config={
            'displayModeBar': True,
            'displaylogo': False,
            'modeBarButtonsToAdd': ['drawline', 'drawopenpath', 'eraseshape'],
            'toImageButtonOptions': {'height': 900, 'width': 1500}
        }
    )
    
    print(f"\nInteractive visualization saved as {output_file}")
    print("\nFeatures available in the interactive view:")
    print("- Initial view is from Corrales (marked with red diamond)")
    print("- Left click + drag: Rotate the view")
    print("- Right click + drag: Pan the view")
    print("- Mouse wheel: Zoom in/out")
    print("- Double click: Reset to Corrales viewpoint")
    print("- Hover over surface: See exact coordinates and elevation")
    print("- Camera controls: Additional viewing angles and options")
    print("- Download: Save current view as PNG")
    
    # Open the visualization in the default web browser
    webbrowser.open('file://' + os.path.abspath(output_file))

if __name__ == "__main__":
    create_corrales_visualization() 