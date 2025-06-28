import streamlit as st
import sqlite3
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import math
from typing import List, Dict, Tuple
import matplotlib.pyplot as plt
import pandas as pd
from generate_background_images import BackgroundImageGenerator

class RidgeViewerApp:
    def __init__(self):
        """Initialize the Ridge Viewer App."""
        self.workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        self.generator = BackgroundImageGenerator(self.workspace_root)
        
    def calculate_bearing(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate bearing between two points in degrees."""
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        dlon_rad = math.radians(lon2 - lon1)
        
        y = math.sin(dlon_rad) * math.cos(lat2_rad)
        x = math.cos(lat1_rad) * math.sin(lat2_rad) - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(dlon_rad)
        
        bearing = math.atan2(y, x)
        bearing = math.degrees(bearing)
        bearing = (bearing + 360) % 360
        
        return bearing
    
    def calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in kilometers."""
        R = 6371  # Earth's radius in km
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        dlat_rad = math.radians(lat2 - lat1)
        dlon_rad = math.radians(lon2 - lon1)
        
        a = math.sin(dlat_rad/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon_rad/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    def get_ridge_analysis(self, lat: float, lon: float, direction: float, 
                          window_size: float = 50, max_points: int = 100) -> Dict:
        """Get detailed ridge analysis for the given parameters."""
        # Get terrain data
        terrain_points = self.generator.get_terrain_data_in_window(lat, lon, window_size)
        
        if not terrain_points:
            return {"error": "No terrain data found for this location"}
        
        # Get visible ridge points
        ridge_points = self.generator.get_visible_ridge_points(
            terrain_points, lat, lon, 1360, direction, 60, max_points
        )
        
        # Calculate statistics
        if ridge_points:
            distances = [p['distance'] for p in ridge_points]
            elevations = [p['elevation'] for p in ridge_points]
            bearings = [p['bearing'] for p in ridge_points]
            
            stats = {
                'total_terrain_points': len(terrain_points),
                'visible_ridges': len(ridge_points),
                'distance_range': (min(distances), max(distances)),
                'elevation_range': (min(elevations), max(elevations)),
                'bearing_range': (min(bearings), max(bearings)),
                'avg_distance': sum(distances) / len(distances),
                'avg_elevation': sum(elevations) / len(elevations)
            }
        else:
            stats = {
                'total_terrain_points': len(terrain_points),
                'visible_ridges': 0,
                'error': 'No visible ridges found'
            }
        
        return {
            'terrain_points': terrain_points,
            'ridge_points': ridge_points,
            'stats': stats
        }
    
    def create_ridge_profile_chart(self, ridge_points: List[Dict]) -> plt.Figure:
        """Create a profile chart showing ridge elevations vs distance."""
        if not ridge_points:
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.text(0.5, 0.5, 'No ridge data available', ha='center', va='center', transform=ax.transAxes)
            ax.set_title('Ridge Profile')
            return fig
        
        distances = [p['distance'] for p in ridge_points]
        elevations = [p['elevation'] for p in ridge_points]
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        # Sort by distance for better visualization
        sorted_data = sorted(zip(distances, elevations))
        distances_sorted, elevations_sorted = zip(*sorted_data)
        
        ax.scatter(distances_sorted, elevations_sorted, c='brown', alpha=0.7, s=50)
        ax.plot(distances_sorted, elevations_sorted, 'brown', alpha=0.5, linewidth=1)
        
        ax.set_xlabel('Distance (km)')
        ax.set_ylabel('Elevation (m)')
        ax.set_title('Ridge Profile - Visible Peaks')
        ax.grid(True, alpha=0.3)
        
        # Add observer elevation line
        ax.axhline(y=1360, color='red', linestyle='--', alpha=0.7, label='Observer (1360m)')
        ax.legend()
        
        plt.tight_layout()
        return fig
    
    def run_app(self):
        """Run the Streamlit app."""
        st.set_page_config(
            page_title="Ridge Viewer - Terrain Background Generator",
            page_icon="🏔️",
            layout="wide"
        )
        
        st.title("🏔️ Ridge Viewer - Terrain Background Generator")
        st.markdown("Enter coordinates and facing direction to generate terrain background images and analyze visible ridges.")
        
        # Sidebar for input parameters
        st.sidebar.header("📍 Location Parameters")
        
        # Coordinate input
        coord_input = st.sidebar.text_input(
            "Coordinates (lat, lon)", 
            value="32.9609357, -107.3267788",
            help="Enter latitude and longitude separated by comma"
        )
        
        # Parse coordinates
        try:
            lat_str, lon_str = coord_input.split(',')
            lat = float(lat_str.strip())
            lon = float(lon_str.strip())
        except:
            st.sidebar.error("Invalid coordinate format. Use: lat, lon")
            return
        
        # Direction input
        direction = st.sidebar.slider(
            "Facing Direction (degrees)", 
            min_value=1, 
            max_value=360, 
            value=45,
            help="1-360 degrees, where 360 = North"
        )
        
        # Window size
        window_size = st.sidebar.slider(
            "Search Window (km)", 
            min_value=10, 
            max_value=100, 
            value=50,
            help="Radius to search for terrain data"
        )
        
        # Max ridge points
        max_points = st.sidebar.slider(
            "Max Ridge Points", 
            min_value=10, 
            max_value=200, 
            value=100,
            help="Maximum number of ridge points to analyze"
        )
        
        # Convert direction to compass
        directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        direction_index = int((direction + 11.25) / 22.5) % 16
        compass_dir = directions[direction_index]
        
        st.sidebar.markdown(f"**Compass Direction:** {compass_dir}")
        
        # Generate button
        if st.sidebar.button("🎯 Generate Background & Analysis", type="primary"):
            with st.spinner("Generating terrain background and analyzing ridges..."):
                
                # Create two columns for layout
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    st.subheader("🖼️ Generated Background Image")
                    
                    # Generate background image
                    try:
                        output_path = self.generator.generate_background_for_location(
                            lat, lon, direction, 
                            filename=f"temp_background_{lat:.4f}_{lon:.4f}_{direction}.jpg"
                        )
                        
                        # Display the image
                        image = Image.open(output_path)
                        st.image(image, caption=f"Terrain view facing {compass_dir} ({direction}°)")
                        
                        # Provide download link
                        with open(output_path, "rb") as file:
                            st.download_button(
                                label="📥 Download Background Image",
                                data=file.read(),
                                file_name=f"background_{lat:.4f}_{lon:.4f}_{direction}.jpg",
                                mime="image/jpeg"
                            )
                        
                    except Exception as e:
                        st.error(f"Error generating background image: {e}")
                
                with col2:
                    st.subheader("📊 Location Info")
                    
                    st.metric("Latitude", f"{lat:.6f}°")
                    st.metric("Longitude", f"{lon:.6f}°")
                    st.metric("Direction", f"{direction}° ({compass_dir})")
                    st.metric("Window Size", f"{window_size} km")
                
                # Ridge analysis section
                st.subheader("🏔️ Ridge Analysis")
                
                try:
                    analysis = self.get_ridge_analysis(lat, lon, direction, window_size, max_points)
                    
                    if 'error' in analysis:
                        st.error(analysis['error'])
                    else:
                        stats = analysis['stats']
                        ridge_points = analysis['ridge_points']
                        
                        # Display statistics
                        col1, col2, col3, col4 = st.columns(4)
                        
                        with col1:
                            st.metric("Total Terrain Points", f"{stats['total_terrain_points']:,}")
                        
                        with col2:
                            st.metric("Visible Ridges", stats['visible_ridges'])
                        
                        with col3:
                            if 'distance_range' in stats:
                                st.metric("Distance Range", f"{stats['distance_range'][0]:.1f} - {stats['distance_range'][1]:.1f} km")
                        
                        with col4:
                            if 'elevation_range' in stats:
                                st.metric("Elevation Range", f"{stats['elevation_range'][0]:.0f} - {stats['elevation_range'][1]:.0f} m")
                        
                        # Ridge profile chart
                        if ridge_points:
                            st.subheader("📈 Ridge Profile")
                            fig = self.create_ridge_profile_chart(ridge_points)
                            st.pyplot(fig)
                            
                            # Ridge points table
                            st.subheader("📋 Top Ridge Points")
                            
                            # Create DataFrame for display
                            ridge_df = pd.DataFrame([
                                {
                                    'Distance (km)': f"{p['distance']:.2f}",
                                    'Elevation (m)': f"{p['elevation']:.0f}",
                                    'Bearing (°)': f"{p['bearing']:.1f}",
                                    'Viewing Angle (°)': f"{p['viewing_angle']:.2f}"
                                }
                                for p in ridge_points[:20]  # Show top 20
                            ])
                            
                            st.dataframe(ridge_df, use_container_width=True)
                            
                            if len(ridge_points) > 20:
                                st.info(f"Showing top 20 of {len(ridge_points)} ridge points")
                        
                except Exception as e:
                    st.error(f"Error in ridge analysis: {e}")
        
        # Preset locations section
        st.sidebar.markdown("---")
        st.sidebar.subheader("📍 Preset Locations")
        
        presets = {
            "Photo Verification Site": (32.9609357, -107.3267788),
            "Albuquerque": (35.0844, -106.6504),
            "Santa Fe": (35.6870, -105.9378),
            "Las Cruces": (32.3199, -106.7637),
            "Taos": (36.4072, -105.5734)
        }
        
        for name, (preset_lat, preset_lon) in presets.items():
            if st.sidebar.button(f"📌 {name}"):
                st.sidebar.text_input(
                    "Coordinates (lat, lon)", 
                    value=f"{preset_lat}, {preset_lon}",
                    key=f"preset_{name}"
                )
        
        # Instructions
        st.markdown("---")
        st.markdown("""
        ### 📖 Instructions
        
        1. **Enter Coordinates**: Input latitude and longitude in decimal degrees format (e.g., 32.9609357, -107.3267788)
        2. **Set Direction**: Choose facing direction from 1-360 degrees (360 = North)
        3. **Adjust Parameters**: Set search window size and maximum ridge points
        4. **Generate**: Click the generate button to create background image and analysis
        
        ### 🎯 Features
        
        - **Background Images**: Realistic terrain backgrounds based on elevation data
        - **Ridge Analysis**: Line-of-sight calculations to find visible peaks
        - **Profile Charts**: Elevation vs distance visualization
        - **Detailed Statistics**: Comprehensive terrain analysis
        - **Download Options**: Save generated images locally
        
        ### 🗺️ Coordinate Examples
        
        - **New Mexico Photo Site**: 32.9609357, -107.3267788
        - **Sandia Mountains**: 35.2, -106.4
        - **Wheeler Peak**: 36.5569, -105.4169
        - **Shiprock**: 36.6875, -108.8370
        """)

def main():
    """Main function to run the Streamlit app."""
    app = RidgeViewerApp()
    app.run_app()

if __name__ == "__main__":
    main() 