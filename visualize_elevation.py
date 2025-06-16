import sqlite3
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import plotly.express as px
import plotly.graph_objects as go
from tqdm import tqdm

def get_all_points():
    """Get all elevation points from all databases"""
    all_points = []
    db_dir = Path('grid_databases')
    
    # Get all database files
    db_files = list(db_dir.glob('mountains_*.db'))
    print(f"Found {len(db_files)} database files")
    
    for db_file in tqdm(db_files, desc="Reading databases"):
        try:
            conn = sqlite3.connect(db_file)
            
            # Try elevation_points table first
            try:
                df = pd.read_sql_query("""
                    SELECT latitude, longitude, elevation, source, grid_level, collected_at
                    FROM elevation_points
                """, conn)
                if not df.empty:
                    all_points.append(df)
            except:
                pass
            
            # Then try points table
            try:
                df = pd.read_sql_query("""
                    SELECT lat as latitude, lon as longitude, elevation, source, timestamp as collected_at
                    FROM points
                """, conn)
                if not df.empty:
                    all_points.append(df)
            except:
                pass
            
            conn.close()
            
        except Exception as e:
            print(f"Error reading {db_file}: {e}")
            continue
    
    if not all_points:
        raise ValueError("No points found in any database")
    
    # Combine all points
    combined_df = pd.concat(all_points, ignore_index=True)
    print(f"\nTotal points collected: {len(combined_df):,}")
    print("\nPoints by source:")
    print(combined_df['source'].value_counts())
    
    return combined_df

def create_static_plot(df):
    """Create a static heatmap using matplotlib/seaborn"""
    plt.figure(figsize=(15, 10))
    
    # Create a 2D histogram of points
    plt.hist2d(df['longitude'], df['latitude'], 
              bins=100, 
              cmap='viridis',
              weights=df['elevation'])
    
    plt.colorbar(label='Elevation (m)')
    plt.title('New Mexico Elevation Data')
    plt.xlabel('Longitude')
    plt.ylabel('Latitude')
    
    # Save the plot
    plt.savefig('public/images/elevation_heatmap.png', dpi=300, bbox_inches='tight')
    plt.close()
    print("Created static heatmap: public/images/elevation_heatmap.png")

def create_interactive_plot(df):
    """Create an interactive 3D scatter plot using plotly"""
    # Sample points if there are too many
    if len(df) > 100000:
        df = df.sample(n=100000, random_state=42)
        print("Sampled 100,000 points for interactive visualization")
    
    fig = px.scatter_3d(df, 
                        x='longitude', 
                        y='latitude', 
                        z='elevation',
                        color='elevation',
                        color_continuous_scale='viridis',
                        title='New Mexico Elevation Data (Interactive)')
    
    fig.update_layout(
        scene = dict(
            xaxis_title='Longitude',
            yaxis_title='Latitude',
            zaxis_title='Elevation (m)'
        ),
        width=1200,
        height=800
    )
    
    # Save as HTML
    fig.write_html('public/images/elevation_interactive.html')
    print("Created interactive plot: public/images/elevation_interactive.html")

def main():
    # Create output directory
    Path('public/images').mkdir(parents=True, exist_ok=True)
    
    # Get all points
    df = get_all_points()
    
    # Create visualizations
    create_static_plot(df)
    create_interactive_plot(df)
    
    print("\nVisualization complete! Check the public/images directory for the output files.")

if __name__ == '__main__':
    main() 