import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import sqlite3
import math
import os
from typing import List, Tuple, Dict
from matplotlib.widgets import Slider, Button
import matplotlib.patches as patches
from matplotlib.animation import FuncAnimation

class Interactive3DViewer:
    def __init__(self, gps_lat: float, gps_lon: float, gps_alt: float):
        """Initialize with GPS coordinates."""
        self.gps_lat = gps_lat
        self.gps_lon = gps_lon
        self.gps_alt = gps_alt
        self.workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        
        # Animation parameters
        self.current_azimuth = 45
        self.current_elevation = 20
        self.animation_running = False
        
    def load_ridge_points(self, points_file: str) -> List[Tuple[int, int]]:
        """Load ridge points from file."""
        points = []
        points_path = os.path.join(self.workspace_root, "data", points_file)
        if os.path.exists(points_path):
            with open(points_path, 'r') as f:
                for line in f:
                    if line.strip():
                        x, y = map(int, line.strip().split(','))
                        points.append((x, y))
        return sorted(points, key=lambda p: p[0])
    
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
    
    def get_terrain_data(self, radius_km: float = 25) -> List[Dict]:
        """Get terrain data around the observer position."""
        # Find relevant database files
        db_files = []
        grid_db_dir = os.path.join(self.workspace_root, "grid_databases")
        
        if os.path.exists(grid_db_dir):
            for file in os.listdir(grid_db_dir):
                if file.startswith("mountains_") and file.endswith(".db"):
                    db_files.append(os.path.join(grid_db_dir, file))
        
        terrain_points = []
        
        for db_file in db_files:
            try:
                conn = sqlite3.connect(db_file)
                cursor = conn.cursor()
                
                # Query points around the observer
                cursor.execute("""
                    SELECT latitude, longitude, elevation 
                    FROM elevation_points 
                    WHERE latitude BETWEEN ? AND ? 
                    AND longitude BETWEEN ? AND ?
                """, (
                    self.gps_lat - 0.3,
                    self.gps_lat + 0.3,
                    self.gps_lon - 0.3,
                    self.gps_lon + 0.3
                ))
                
                results = cursor.fetchall()
                
                for lat, lon, elev in results:
                    distance = self.calculate_distance(self.gps_lat, self.gps_lon, lat, lon)
                    if distance <= radius_km:
                        bearing = self.calculate_bearing(self.gps_lat, self.gps_lon, lat, lon)
                        
                        # Convert to local coordinates (km from observer)
                        x = distance * math.sin(math.radians(bearing))
                        y = distance * math.cos(math.radians(bearing))
                        
                        terrain_points.append({
                            'x': x,
                            'y': y,
                            'z': elev,
                            'lat': lat,
                            'lon': lon,
                            'bearing': bearing,
                            'distance': distance
                        })
                
                conn.close()
                
            except Exception as e:
                print(f"Error querying {db_file}: {e}")
                continue
        
        return terrain_points
    
    def calculate_line_of_sight_3d(self, terrain_points: List[Dict], direction: float, fov: float = 60) -> Dict:
        """Calculate line of sight in 3D for a specific direction."""
        half_fov = fov / 2
        visible_points = []
        hidden_points = []
        
        # Filter points within FOV
        fov_points = []
        for point in terrain_points:
            angle_diff = abs(point['bearing'] - direction)
            if angle_diff > 180:
                angle_diff = 360 - angle_diff
            if angle_diff <= half_fov:
                fov_points.append(point)
        
        # Group by bearing and find visible points
        bearing_groups = {}
        for point in fov_points:
            bearing_key = round(point['bearing'], 0.5)  # 0.5 degree precision
            if bearing_key not in bearing_groups:
                bearing_groups[bearing_key] = []
            bearing_groups[bearing_key].append(point)
        
        for bearing, points in bearing_groups.items():
            points_sorted = sorted(points, key=lambda x: x['distance'])
            
            max_viewing_angle = -90
            
            for point in points_sorted:
                distance_m = point['distance'] * 1000
                height_diff = point['z'] - self.gps_alt
                viewing_angle = math.degrees(math.atan2(height_diff, distance_m))
                
                if viewing_angle > max_viewing_angle:
                    visible_points.append(point)
                    max_viewing_angle = viewing_angle
                else:
                    hidden_points.append(point)
        
        return {
            'visible': visible_points,
            'hidden': hidden_points,
            'direction': direction,
            'fov': fov
        }
    
    def project_ridge_points_to_3d(self, ridge_points: List[Tuple[int, int]], direction: float, 
                                   terrain_points: List[Dict], image_width: int = 1600, 
                                   image_height: int = 1200, fov: float = 60) -> List[Dict]:
        """Project 2D ridge points to 3D terrain coordinates."""
        projected_points = []
        
        # Get visible terrain points for this direction
        los_data = self.calculate_line_of_sight_3d(terrain_points, direction, fov)
        visible_points = los_data['visible']
        
        if not visible_points:
            return projected_points
        
        # Sort visible points by bearing
        visible_points.sort(key=lambda p: p['bearing'])
        
        # For each ridge point, find the closest terrain point
        for px, py in ridge_points:
            # Convert pixel coordinates to bearing (simplified)
            # Assume image center corresponds to the viewing direction
            center_x = image_width / 2
            pixel_offset = px - center_x
            
            # Convert pixel offset to bearing offset (rough approximation)
            bearing_offset = (pixel_offset / image_width) * fov
            target_bearing = (direction + bearing_offset) % 360
            
            # Find closest visible terrain point by bearing
            closest_point = None
            min_bearing_diff = float('inf')
            
            for point in visible_points:
                bearing_diff = abs(point['bearing'] - target_bearing)
                if bearing_diff > 180:
                    bearing_diff = 360 - bearing_diff
                
                if bearing_diff < min_bearing_diff:
                    min_bearing_diff = bearing_diff
                    closest_point = point
            
            if closest_point:
                projected_points.append({
                    'pixel_x': px,
                    'pixel_y': py,
                    'terrain_x': closest_point['x'],
                    'terrain_y': closest_point['y'],
                    'terrain_z': closest_point['z'],
                    'bearing': closest_point['bearing'],
                    'distance': closest_point['distance']
                })
        
        return projected_points
    
    def create_interactive_3d_viewer(self, save_path: str = None):
        """Create interactive 3D viewer with controls."""
        print("Loading terrain data...")
        terrain_points = self.get_terrain_data(radius_km=25)
        print(f"Loaded {len(terrain_points)} terrain points")
        
        # Load manual ridge points
        ne_ridge_points = self.load_ridge_points("selected_ridge_points.txt")
        east_ridge_points = self.load_ridge_points("selected_ridge_points_control_east.txt")
        
        print(f"Loaded {len(ne_ridge_points)} northeast ridge points")
        print(f"Loaded {len(east_ridge_points)} east ridge points")
        
        # Calculate line of sight for both directions
        northeast_los = self.calculate_line_of_sight_3d(terrain_points, 45.0)
        east_los = self.calculate_line_of_sight_3d(terrain_points, 90.0)
        
        # Project ridge points to 3D
        ne_projected = self.project_ridge_points_to_3d(ne_ridge_points, 45.0, terrain_points)
        east_projected = self.project_ridge_points_to_3d(east_ridge_points, 90.0, terrain_points)
        
        # Create figure
        fig = plt.figure(figsize=(20, 12))
        
        # Main 3D plot (larger)
        ax_3d = fig.add_subplot(121, projection='3d')
        
        # Extract coordinates for all terrain
        all_x = [p['x'] for p in terrain_points]
        all_y = [p['y'] for p in terrain_points]
        all_z = [p['z'] for p in terrain_points]
        
        # Plot all terrain points (gray, very small)
        terrain_scatter = ax_3d.scatter(all_x, all_y, all_z, c='lightgray', alpha=0.2, s=0.5, label='All terrain')
        
        # Plot visible points for northeast (green)
        ne_vis_x = [p['x'] for p in northeast_los['visible']]
        ne_vis_y = [p['y'] for p in northeast_los['visible']]
        ne_vis_z = [p['z'] for p in northeast_los['visible']]
        ne_visible_scatter = ax_3d.scatter(ne_vis_x, ne_vis_y, ne_vis_z, c='green', alpha=0.7, s=8, label='NE visible ridges')
        
        # Plot visible points for east (blue)
        e_vis_x = [p['x'] for p in east_los['visible']]
        e_vis_y = [p['y'] for p in east_los['visible']]
        e_vis_z = [p['z'] for p in east_los['visible']]
        east_visible_scatter = ax_3d.scatter(e_vis_x, e_vis_y, e_vis_z, c='blue', alpha=0.7, s=8, label='East visible ridges')
        
        # Plot manual ridge selections (larger, distinct colors)
        if ne_projected:
            ne_manual_x = [p['terrain_x'] for p in ne_projected]
            ne_manual_y = [p['terrain_y'] for p in ne_projected]
            ne_manual_z = [p['terrain_z'] for p in ne_projected]
            ne_manual_scatter = ax_3d.scatter(ne_manual_x, ne_manual_y, ne_manual_z, 
                                            c='red', s=50, marker='o', alpha=0.9, 
                                            label='NE manual selections', edgecolors='black')
            
            # Connect manual points with line
            ax_3d.plot(ne_manual_x, ne_manual_y, ne_manual_z, 'r-', linewidth=2, alpha=0.7)
        
        if east_projected:
            east_manual_x = [p['terrain_x'] for p in east_projected]
            east_manual_y = [p['terrain_y'] for p in east_projected]
            east_manual_z = [p['terrain_z'] for p in east_projected]
            east_manual_scatter = ax_3d.scatter(east_manual_x, east_manual_y, east_manual_z, 
                                              c='orange', s=50, marker='s', alpha=0.9, 
                                              label='East manual selections', edgecolors='black')
            
            # Connect manual points with line
            ax_3d.plot(east_manual_x, east_manual_y, east_manual_z, 'orange', linewidth=2, alpha=0.7)
        
        # Plot observer position
        observer_scatter = ax_3d.scatter([0], [0], [self.gps_alt], c='red', s=200, marker='^', 
                                       label='Observer', edgecolors='black', linewidth=2)
        
        # Draw viewing direction arrows
        arrow_length = 15  # km
        
        # Northeast arrow
        ne_x = arrow_length * math.sin(math.radians(45))
        ne_y = arrow_length * math.cos(math.radians(45))
        ne_arrow = ax_3d.quiver(0, 0, self.gps_alt, ne_x, ne_y, 0, color='green', 
                               arrow_length_ratio=0.1, linewidth=4, alpha=0.8, label='NE direction')
        
        # East arrow
        e_x = arrow_length * math.sin(math.radians(90))
        e_y = arrow_length * math.cos(math.radians(90))
        east_arrow = ax_3d.quiver(0, 0, self.gps_alt, e_x, e_y, 0, color='blue', 
                                 arrow_length_ratio=0.1, linewidth=4, alpha=0.8, label='East direction')
        
        # Set labels and title
        ax_3d.set_xlabel('East-West (km)', fontsize=12)
        ax_3d.set_ylabel('North-South (km)', fontsize=12)
        ax_3d.set_zlabel('Elevation (m)', fontsize=12)
        ax_3d.set_title('Interactive 3D Terrain Viewer\n(Click and drag to rotate)', fontsize=14, fontweight='bold')
        ax_3d.legend(loc='upper left', bbox_to_anchor=(0, 1))
        
        # Set equal aspect ratio
        max_range = 25
        ax_3d.set_xlim([-max_range, max_range])
        ax_3d.set_ylim([-max_range, max_range])
        ax_3d.set_zlim([min(all_z) if all_z else 1000, max(all_z) if all_z else 2000])
        
        # Set initial view angle
        ax_3d.view_init(elev=20, azim=45)
        
        # Statistics panel (right side)
        ax_stats = fig.add_subplot(122)
        ax_stats.axis('off')
        
        # Create statistics text
        stats_text = f"""
3D TERRAIN ANALYSIS
{'='*50}

Observer Position:
• Latitude: {self.gps_lat:.6f}°N
• Longitude: {self.gps_lon:.6f}°W  
• Elevation: {self.gps_alt}m

Terrain Data:
• Total points loaded: {len(terrain_points):,}
• Search radius: 25 km

Northeast Direction (45°):
• Visible ridges: {len(northeast_los['visible']):,}
• Hidden points: {len(northeast_los['hidden']):,}
• Manual selections: {len(ne_projected)}

East Direction (90°):
• Visible ridges: {len(east_los['visible']):,}
• Hidden points: {len(east_los['hidden']):,}
• Manual selections: {len(east_projected)}

Manual Ridge Analysis:
"""
        
        if ne_projected:
            stats_text += f"\nNortheast Manual Points:\n"
            for i, point in enumerate(ne_projected[:5]):  # Show first 5
                stats_text += f"  {i+1}. Distance: {point['distance']:.1f}km, "
                stats_text += f"Elevation: {point['terrain_z']:.0f}m\n"
            if len(ne_projected) > 5:
                stats_text += f"  ... and {len(ne_projected)-5} more points\n"
        
        if east_projected:
            stats_text += f"\nEast Manual Points:\n"
            for i, point in enumerate(east_projected[:5]):  # Show first 5
                stats_text += f"  {i+1}. Distance: {point['distance']:.1f}km, "
                stats_text += f"Elevation: {point['terrain_z']:.0f}m\n"
            if len(east_projected) > 5:
                stats_text += f"  ... and {len(east_projected)-5} more points\n"
        
        stats_text += f"""
{'='*50}
CONTROLS:
• Click and drag to rotate 3D view
• Scroll to zoom in/out
• Use toolbar buttons for pan/zoom

LEGEND:
• Gray dots: All terrain points
• Green dots: Northeast visible ridges  
• Blue dots: East visible ridges
• Red circles: Northeast manual selections
• Orange squares: East manual selections
• Red triangle: Observer position
• Arrows: Viewing directions
        """
        
        ax_stats.text(0.05, 0.95, stats_text, transform=ax_stats.transAxes, 
                     fontsize=10, verticalalignment='top', fontfamily='monospace',
                     bbox=dict(boxstyle='round,pad=1', facecolor='lightblue', alpha=0.8))
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"3D visualization saved to: {save_path}")
        
        plt.show()
        
        return {
            'terrain_points': terrain_points,
            'northeast_los': northeast_los,
            'east_los': east_los,
            'ne_projected': ne_projected,
            'east_projected': east_projected
        }

def main():
    # GPS coordinates
    gps_lat = 32.9609357
    gps_lon = -107.3267788
    gps_alt = 1360.0
    
    # Initialize viewer
    viewer = Interactive3DViewer(gps_lat, gps_lon, gps_alt)
    
    try:
        print("=== INTERACTIVE 3D RIDGE VIEWER ===")
        print("Loading data and creating visualization...")
        
        # Create interactive 3D visualization
        workspace_root = viewer.workspace_root
        save_path = os.path.join(workspace_root, "data/images/interactive_3d_visualization.png")
        
        results = viewer.create_interactive_3d_viewer(save_path)
        
        print(f"\n=== INTERACTIVE 3D VIEWER COMPLETE ===")
        print(f"Features:")
        print("- Interactive 3D terrain visualization")
        print("- Manual ridge point overlay")
        print("- Line-of-sight analysis")
        print("- Detailed statistics panel")
        print("- Click and drag to rotate view")
        print("- Scroll to zoom")
        
        print(f"\nData loaded:")
        print(f"- Terrain points: {len(results['terrain_points']):,}")
        print(f"- NE manual selections: {len(results['ne_projected'])}")
        print(f"- East manual selections: {len(results['east_projected'])}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 