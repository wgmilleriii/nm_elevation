import cv2
import numpy as np
import os
import sqlite3
import math
from typing import List, Tuple, Dict
import matplotlib.pyplot as plt
from scipy.interpolate import interp1d
from PIL import Image, ImageDraw

class RidgeSketchGenerator:
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
    
    def get_elevation_profile_east(self, fov_degrees: float = 60, max_distance_km: float = 50) -> List[Dict]:
        """Get elevation profile facing east with line-of-sight analysis."""
        center_bearing = 90.0  # East
        half_fov = fov_degrees / 2
        
        # Find relevant database files
        db_files = []
        grid_db_dir = os.path.join(self.workspace_root, "grid_databases")
        
        if os.path.exists(grid_db_dir):
            for file in os.listdir(grid_db_dir):
                if file.startswith("mountains_") and file.endswith(".db"):
                    db_files.append(os.path.join(grid_db_dir, file))
        
        elevation_points = []
        
        for db_file in db_files:
            try:
                conn = sqlite3.connect(db_file)
                cursor = conn.cursor()
                
                # Query points in the east direction
                cursor.execute("""
                    SELECT latitude, longitude, elevation 
                    FROM elevation_points 
                    WHERE latitude BETWEEN ? AND ? 
                    AND longitude BETWEEN ? AND ?
                """, (
                    self.gps_lat - 0.5,
                    self.gps_lat + 0.5,
                    self.gps_lon - 0.5,
                    self.gps_lon + 0.5
                ))
                
                results = cursor.fetchall()
                
                for lat, lon, elev in results:
                    bearing = self.calculate_bearing(self.gps_lat, self.gps_lon, lat, lon)
                    distance = self.calculate_distance(self.gps_lat, self.gps_lon, lat, lon)
                    
                    # Check if point is in the east FOV
                    angle_diff = abs(bearing - center_bearing)
                    if angle_diff > 180:
                        angle_diff = 360 - angle_diff
                    
                    if angle_diff <= half_fov and distance <= max_distance_km:
                        distance_m = distance * 1000
                        height_diff = elev - self.gps_alt
                        viewing_angle = math.degrees(math.atan2(height_diff, distance_m))
                        
                        elevation_points.append({
                            'lat': lat,
                            'lon': lon,
                            'elevation': elev,
                            'bearing': bearing,
                            'distance': distance,
                            'viewing_angle': viewing_angle,
                            'height_diff': height_diff
                        })
                
                conn.close()
                
            except Exception as e:
                print(f"Error querying {db_file}: {e}")
                continue
        
        return elevation_points
    
    def calculate_line_of_sight(self, elevation_points: List[Dict]) -> List[Dict]:
        """Calculate which points are visible using line-of-sight analysis."""
        # Group points by bearing (angular direction)
        bearing_groups = {}
        for point in elevation_points:
            bearing_key = round(point['bearing'], 1)  # Round to 0.1 degree precision
            if bearing_key not in bearing_groups:
                bearing_groups[bearing_key] = []
            bearing_groups[bearing_key].append(point)
        
        visible_points = []
        
        # For each bearing direction, find the visible ridge
        for bearing, points in bearing_groups.items():
            # Sort by distance
            points_sorted = sorted(points, key=lambda x: x['distance'])
            
            max_viewing_angle = -90  # Start with lowest possible angle
            
            for point in points_sorted:
                if point['viewing_angle'] > max_viewing_angle:
                    # This point is visible
                    visible_points.append(point)
                    max_viewing_angle = point['viewing_angle']
                # Points with lower viewing angles are hidden
        
        return visible_points
    
    def train_ridge_profile_from_clicks(self, clicked_points: List[Tuple[int, int]], 
                                       image_width: int, image_height: int) -> Dict:
        """Train ridge profile using clicked points."""
        if not clicked_points:
            return {}
        
        # Convert clicked points to normalized coordinates
        x_coords = [p[0] / image_width for p in clicked_points]  # 0 to 1
        y_coords = [p[1] / image_height for p in clicked_points]  # 0 to 1
        
        # Convert x coordinates to bearing angles (assuming 60° FOV)
        fov = 60
        bearings = [90 + (x - 0.5) * fov for x in x_coords]  # East ± 30°
        
        # Convert y coordinates to relative heights (inverted, 0 = top of image)
        relative_heights = [1 - y for y in y_coords]  # 0 = bottom, 1 = top
        
        return {
            'bearings': bearings,
            'relative_heights': relative_heights,
            'x_coords': x_coords,
            'y_coords': y_coords
        }
    
    def generate_ridge_sketch(self, clicked_points: List[Tuple[int, int]], 
                             output_path: str, width: int = 1200, height: int = 800) -> None:
        """Generate a realistic ridge sketch using elevation data and clicked points."""
        
        # Get elevation data
        print("Querying elevation data...")
        elevation_points = self.get_elevation_profile_east()
        print(f"Found {len(elevation_points)} elevation points")
        
        # Calculate line of sight
        print("Calculating line of sight...")
        visible_points = self.calculate_line_of_sight(elevation_points)
        print(f"Found {len(visible_points)} visible points")
        
        # Train from clicked points
        print("Training from clicked points...")
        click_profile = self.train_ridge_profile_from_clicks(clicked_points, 4032, 3024)
        
        # Create image
        img = Image.new('RGB', (width, height), 'lightblue')
        draw = ImageDraw.Draw(img)
        
        # Draw sky gradient
        for y in range(height // 3):
            color_intensity = int(135 + (y / (height // 3)) * 120)
            color = (color_intensity, color_intensity + 20, 255)
            draw.line([(0, y), (width, y)], fill=color)
        
        if visible_points:
            # Sort visible points by bearing
            visible_points.sort(key=lambda x: x['bearing'])
            
            # Create ridge profile
            bearings = [p['bearing'] for p in visible_points]
            viewing_angles = [p['viewing_angle'] for p in visible_points]
            
            # Convert bearings to x coordinates (60° FOV centered on east)
            x_coords = []
            y_coords = []
            
            for bearing, view_angle in zip(bearings, viewing_angles):
                # Convert bearing to x coordinate
                angle_from_center = bearing - 90  # Offset from east
                if -30 <= angle_from_center <= 30:  # Within FOV
                    x = width * (angle_from_center + 30) / 60
                    
                    # Convert viewing angle to y coordinate
                    # Assume viewing angles from -10° to +10° map to image height
                    y_normalized = (view_angle + 10) / 20  # -10° to +10° -> 0 to 1
                    y_normalized = max(0, min(1, y_normalized))  # Clamp
                    y = height * (1 - y_normalized * 0.7)  # Use 70% of image height
                    
                    x_coords.append(x)
                    y_coords.append(y)
            
            # Smooth the ridge line
            if len(x_coords) > 3:
                # Sort by x coordinate
                sorted_pairs = sorted(zip(x_coords, y_coords))
                x_coords, y_coords = zip(*sorted_pairs)
                
                # Interpolate for smooth line
                x_smooth = np.linspace(min(x_coords), max(x_coords), width)
                if len(x_coords) > 1:
                    f = interp1d(x_coords, y_coords, kind='cubic', 
                               bounds_error=False, fill_value='extrapolate')
                    y_smooth = f(x_smooth)
                    
                    # Draw ridge line
                    ridge_points = [(int(x), int(y)) for x, y in zip(x_smooth, y_smooth)]
                    
                    # Fill below ridge (mountain)
                    for i in range(len(ridge_points) - 1):
                        x1, y1 = ridge_points[i]
                        x2, y2 = ridge_points[i + 1]
                        
                        # Create mountain polygon
                        mountain_points = [
                            (x1, y1), (x2, y2), 
                            (x2, height), (x1, height)
                        ]
                        
                        # Mountain color (brown/gray gradient)
                        mountain_color = (101, 67, 33)  # Brown
                        draw.polygon(mountain_points, fill=mountain_color)
                    
                    # Draw ridge outline
                    for i in range(len(ridge_points) - 1):
                        draw.line([ridge_points[i], ridge_points[i + 1]], 
                                fill=(139, 69, 19), width=2)  # Dark brown outline
        
        # Overlay clicked points for reference
        if click_profile and 'x_coords' in click_profile:
            for x_norm, y_norm in zip(click_profile['x_coords'], click_profile['y_coords']):
                x_pixel = int(x_norm * width)
                y_pixel = int(y_norm * height)
                
                # Draw red dots for clicked points
                draw.ellipse([x_pixel-3, y_pixel-3, x_pixel+3, y_pixel+3], 
                           fill='red', outline='darkred')
        
        # Add title
        draw.text((10, 10), f"Generated Ridge Sketch - East View (90°)", 
                 fill='black', font=None)
        draw.text((10, 30), f"Visible ridges: {len(visible_points)}, Clicked points: {len(clicked_points)}", 
                 fill='black', font=None)
        
        # Save image
        img.save(output_path)
        print(f"Ridge sketch saved to: {output_path}")

def main():
    # GPS coordinates
    gps_lat = 32.9609357
    gps_lon = -107.3267788
    gps_alt = 1360.0
    
    # Initialize generator
    generator = RidgeSketchGenerator(gps_lat, gps_lon, gps_alt)
    
    try:
        # Load clicked points from east-facing photo
        east_points = generator.load_ridge_points("selected_ridge_points_control_east.txt")
        print(f"Loaded {len(east_points)} clicked points from east photo")
        
        # Generate ridge sketch
        workspace_root = generator.workspace_root
        output_path = os.path.join(workspace_root, "data/images/generated_east_ridge_sketch.jpg")
        
        generator.generate_ridge_sketch(east_points, output_path)
        
        print(f"\n=== RIDGE SKETCH GENERATION COMPLETE ===")
        print(f"Generated sketch based on:")
        print(f"  - {len(east_points)} manually clicked ridge points")
        print(f"  - Elevation database terrain data")
        print(f"  - Line-of-sight visibility calculations")
        print(f"  - 3D to 2D projection mapping")
        print(f"\nOutput: {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 