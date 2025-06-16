import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import sqlite3
import math
import os
from typing import List, Tuple, Dict
from matplotlib.widgets import Slider, Button
import matplotlib.patches as patches

class Ridge3DViewer:
    def __init__(self, gps_lat: float, gps_lon: float, gps_alt: float):
        """Initialize with GPS coordinates."""
        self.gps_lat = gps_lat
        self.gps_lon = gps_lon
        self.gps_alt = gps_alt
        self.workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        
    def load_ridge_points(self, points_file: str) -> List[Tuple[int, int]]:
        """Load ridge points from file."""
        points = []
        with open(points_file, 'r') as f:
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
        # Find relevant database files - focus on lat/lon based databases
        db_files = []
        grid_db_dir = os.path.join(self.workspace_root, "grid_databases")
        
        if os.path.exists(grid_db_dir):
            for file in os.listdir(grid_db_dir):
                if file.startswith("mountains_") and file.endswith(".db"):
                    # Skip the ones that don't have elevation_points table
                    if "_-" in file:  # lat/lon format like mountains_32_-107.db
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
            bearing_key = round(point['bearing'] * 2) / 2  # 0.5 degree precision
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
    
    def create_3d_visualization(self, save_path: str = None):
        """Create interactive 3D visualization."""
        print("Loading terrain data...")
        terrain_points = self.get_terrain_data(radius_km=25)
        print(f"Loaded {len(terrain_points)} terrain points")
        
        # Calculate line of sight for both directions
        northeast_los = self.calculate_line_of_sight_3d(terrain_points, 45.0)  # Northeast
        east_los = self.calculate_line_of_sight_3d(terrain_points, 90.0)      # East
        
        # Create figure with subplots
        fig = plt.figure(figsize=(16, 12))
        
        # Main 3D plot
        ax_3d = fig.add_subplot(221, projection='3d')
        
        # Extract coordinates for all terrain
        all_x = [p['x'] for p in terrain_points]
        all_y = [p['y'] for p in terrain_points]
        all_z = [p['z'] for p in terrain_points]
        
        # Plot all terrain points (gray)
        ax_3d.scatter(all_x, all_y, all_z, c='lightgray', alpha=0.3, s=1, label='All terrain')
        
        # Plot visible points for northeast (green)
        ne_vis_x = [p['x'] for p in northeast_los['visible']]
        ne_vis_y = [p['y'] for p in northeast_los['visible']]
        ne_vis_z = [p['z'] for p in northeast_los['visible']]
        ax_3d.scatter(ne_vis_x, ne_vis_y, ne_vis_z, c='green', alpha=0.8, s=10, label='NE visible ridges')
        
        # Plot visible points for east (blue)
        e_vis_x = [p['x'] for p in east_los['visible']]
        e_vis_y = [p['y'] for p in east_los['visible']]
        e_vis_z = [p['z'] for p in east_los['visible']]
        ax_3d.scatter(e_vis_x, e_vis_y, e_vis_z, c='blue', alpha=0.8, s=10, label='East visible ridges')
        
        # Plot observer position
        ax_3d.scatter([0], [0], [self.gps_alt], c='red', s=100, marker='^', label='Observer')
        
        # Draw viewing direction arrows
        arrow_length = 10  # km
        
        # Northeast arrow
        ne_x = arrow_length * math.sin(math.radians(45))
        ne_y = arrow_length * math.cos(math.radians(45))
        ax_3d.quiver(0, 0, self.gps_alt, ne_x, ne_y, 0, color='green', arrow_length_ratio=0.1, linewidth=3, label='NE direction')
        
        # East arrow
        e_x = arrow_length * math.sin(math.radians(90))
        e_y = arrow_length * math.cos(math.radians(90))
        ax_3d.quiver(0, 0, self.gps_alt, e_x, e_y, 0, color='blue', arrow_length_ratio=0.1, linewidth=3, label='East direction')
        
        # Set labels and title
        ax_3d.set_xlabel('East-West (km)')
        ax_3d.set_ylabel('North-South (km)')
        ax_3d.set_zlabel('Elevation (m)')
        ax_3d.set_title('3D Terrain View with Line of Sight')
        ax_3d.legend()
        
        # Set equal aspect ratio
        max_range = 25
        ax_3d.set_xlim([-max_range, max_range])
        ax_3d.set_ylim([-max_range, max_range])
        ax_3d.set_zlim([min(all_z), max(all_z)])
        
        # Top-down view (subplot 2)
        ax_top = fig.add_subplot(222)
        ax_top.scatter(all_x, all_y, c='lightgray', alpha=0.3, s=1)
        ax_top.scatter(ne_vis_x, ne_vis_y, c='green', alpha=0.8, s=5, label='NE visible')
        ax_top.scatter(e_vis_x, e_vis_y, c='blue', alpha=0.8, s=5, label='East visible')
        ax_top.scatter([0], [0], c='red', s=100, marker='^', label='Observer')
        
        # Draw FOV cones
        fov_angle = 30  # half FOV
        cone_radius = 25
        
        # Northeast FOV cone
        ne_angles = np.linspace(45 - fov_angle, 45 + fov_angle, 50)
        ne_cone_x = [0] + [cone_radius * math.sin(math.radians(a)) for a in ne_angles] + [0]
        ne_cone_y = [0] + [cone_radius * math.cos(math.radians(a)) for a in ne_angles] + [0]
        ax_top.plot(ne_cone_x, ne_cone_y, 'g--', alpha=0.5, label='NE FOV')
        
        # East FOV cone
        e_angles = np.linspace(90 - fov_angle, 90 + fov_angle, 50)
        e_cone_x = [0] + [cone_radius * math.sin(math.radians(a)) for a in e_angles] + [0]
        e_cone_y = [0] + [cone_radius * math.cos(math.radians(a)) for a in e_angles] + [0]
        ax_top.plot(e_cone_x, e_cone_y, 'b--', alpha=0.5, label='East FOV')
        
        ax_top.set_xlabel('East-West (km)')
        ax_top.set_ylabel('North-South (km)')
        ax_top.set_title('Top-Down View with Field of View')
        ax_top.legend()
        ax_top.set_aspect('equal')
        ax_top.grid(True)
        
        # Profile view - Northeast (subplot 3)
        ax_ne_profile = fig.add_subplot(223)
        if northeast_los['visible']:
            ne_distances = [p['distance'] for p in northeast_los['visible']]
            ne_elevations = [p['z'] for p in northeast_los['visible']]
            ax_ne_profile.scatter(ne_distances, ne_elevations, c='green', s=10)
            ax_ne_profile.axhline(y=self.gps_alt, color='red', linestyle='--', label='Observer elevation')
        ax_ne_profile.set_xlabel('Distance (km)')
        ax_ne_profile.set_ylabel('Elevation (m)')
        ax_ne_profile.set_title('Northeast Profile View')
        ax_ne_profile.grid(True)
        ax_ne_profile.legend()
        
        # Profile view - East (subplot 4)
        ax_e_profile = fig.add_subplot(224)
        if east_los['visible']:
            e_distances = [p['distance'] for p in east_los['visible']]
            e_elevations = [p['z'] for p in east_los['visible']]
            ax_e_profile.scatter(e_distances, e_elevations, c='blue', s=10)
            ax_e_profile.axhline(y=self.gps_alt, color='red', linestyle='--', label='Observer elevation')
        ax_e_profile.set_xlabel('Distance (km)')
        ax_e_profile.set_ylabel('Elevation (m)')
        ax_e_profile.set_title('East Profile View')
        ax_e_profile.grid(True)
        ax_e_profile.legend()
        
        plt.tight_layout()
        
        # Add statistics text
        stats_text = f"""
3D Terrain Analysis:
Observer: {self.gps_lat:.4f}°N, {self.gps_lon:.4f}°W at {self.gps_alt}m

Northeast Direction (45°):
- Visible ridges: {len(northeast_los['visible'])}
- Hidden points: {len(northeast_los['hidden'])}

East Direction (90°):
- Visible ridges: {len(east_los['visible'])}
- Hidden points: {len(east_los['hidden'])}

Total terrain points: {len(terrain_points)}
        """
        
        fig.text(0.02, 0.02, stats_text, fontsize=8, verticalalignment='bottom',
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.8))
        
        if save_path:
            plt.savefig(save_path, dpi=300, bbox_inches='tight')
            print(f"3D visualization saved to: {save_path}")
        
        plt.show()
        
        return {
            'terrain_points': terrain_points,
            'northeast_los': northeast_los,
            'east_los': east_los
        }

def main():
    # GPS coordinates
    gps_lat = 32.9609357
    gps_lon = -107.3267788
    gps_alt = 1360.0
    
    # Initialize viewer
    viewer = Ridge3DViewer(gps_lat, gps_lon, gps_alt)
    
    try:
        print("=== 3D RIDGE VIEWER ===")
        print("Creating interactive 3D visualization...")
        
        # Create 3D visualization
        workspace_root = viewer.workspace_root
        save_path = os.path.join(workspace_root, "data/images/ridge_3d_visualization.png")
        
        results = viewer.create_3d_visualization(save_path)
        
        print(f"\n=== 3D VISUALIZATION COMPLETE ===")
        print(f"Terrain points loaded: {len(results['terrain_points'])}")
        print(f"Northeast visible ridges: {len(results['northeast_los']['visible'])}")
        print(f"East visible ridges: {len(results['east_los']['visible'])}")
        print(f"\nVisualization shows:")
        print("- 3D terrain with line-of-sight analysis")
        print("- Observer position and viewing directions")
        print("- Visible vs hidden ridge points")
        print("- Top-down view with field of view cones")
        print("- Profile views for both directions")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 