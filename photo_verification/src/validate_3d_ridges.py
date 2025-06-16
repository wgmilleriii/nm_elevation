import cv2
import numpy as np
import os
import sqlite3
import math
from typing import List, Tuple, Dict
import matplotlib.pyplot as plt

class Ridge3DValidator:
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
    
    def query_elevation_in_direction(self, direction_degrees: float, max_distance_km: float = 50) -> List[Dict]:
        """Query elevation points in a specific direction with detailed info."""
        # Calculate search area
        direction_rad = math.radians(direction_degrees)
        search_width = 30  # degrees on either side
        
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
                
                # Query all points in the general area
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
                    # Calculate bearing and distance
                    bearing = self.calculate_bearing(self.gps_lat, self.gps_lon, lat, lon)
                    distance = self.calculate_distance(self.gps_lat, self.gps_lon, lat, lon)
                    
                    # Check if point is in the direction of interest
                    angle_diff = abs(bearing - direction_degrees)
                    if angle_diff > 180:
                        angle_diff = 360 - angle_diff
                    
                    if angle_diff <= search_width and distance <= max_distance_km:
                        elevation_points.append({
                            'lat': lat,
                            'lon': lon,
                            'elevation': elev,
                            'bearing': bearing,
                            'distance': distance,
                            'angle_diff': angle_diff
                        })
                
                conn.close()
                
            except Exception as e:
                print(f"Error querying {db_file}: {e}")
                continue
        
        return sorted(elevation_points, key=lambda x: x['distance'])
    
    def analyze_line_of_sight(self, direction_degrees: float, elevation_points: List[Dict]) -> Dict:
        """Analyze line of sight and identify visible vs hidden ridges."""
        visible_ridges = []
        hidden_ridges = []
        
        # Sort by distance
        points_by_distance = sorted(elevation_points, key=lambda x: x['distance'])
        
        # Calculate viewing angles for each point
        for point in points_by_distance:
            distance_m = point['distance'] * 1000  # Convert to meters
            height_diff = point['elevation'] - self.gps_alt
            
            # Calculate vertical viewing angle
            viewing_angle = math.degrees(math.atan2(height_diff, distance_m))
            point['viewing_angle'] = viewing_angle
            point['height_above_observer'] = height_diff
        
        # Determine visibility based on line of sight
        max_viewing_angle = -90  # Start with lowest possible angle
        
        for point in points_by_distance:
            if point['viewing_angle'] > max_viewing_angle:
                # This point is visible
                visible_ridges.append(point)
                max_viewing_angle = point['viewing_angle']
            else:
                # This point is hidden behind a closer ridge
                hidden_ridges.append(point)
        
        return {
            'visible_ridges': visible_ridges,
            'hidden_ridges': hidden_ridges,
            'total_points': len(elevation_points)
        }
    
    def validate_clicked_ridges(self, ridge_points: List[Tuple[int, int]], 
                               direction_degrees: float, image_width: int) -> Dict:
        """Validate clicked ridge points against 3D terrain data."""
        # Get elevation data in this direction
        elevation_points = self.query_elevation_in_direction(direction_degrees)
        
        # Analyze line of sight
        los_analysis = self.analyze_line_of_sight(direction_degrees, elevation_points)
        
        # Map clicked points to potential terrain features
        validation_results = []
        
        for i, (x, y) in enumerate(ridge_points):
            # Calculate which direction this pixel represents
            pixel_angle_offset = ((x / image_width) - 0.5) * 60  # Assume 60° FOV
            pixel_direction = direction_degrees + pixel_angle_offset
            
            # Find nearby elevation points in this specific direction
            nearby_points = []
            for point in los_analysis['visible_ridges']:
                angle_diff = abs(point['bearing'] - pixel_direction)
                if angle_diff > 180:
                    angle_diff = 360 - angle_diff
                if angle_diff <= 5:  # Within 5 degrees
                    nearby_points.append(point)
            
            # Sort by distance and elevation
            nearby_points.sort(key=lambda x: (x['distance'], -x['elevation']))
            
            validation_results.append({
                'click_point': (x, y),
                'pixel_direction': pixel_direction,
                'nearby_terrain': nearby_points[:3],  # Top 3 candidates
                'likely_foreground': nearby_points[0] if nearby_points else None
            })
        
        return {
            'validation_results': validation_results,
            'line_of_sight': los_analysis,
            'direction': direction_degrees
        }
    
    def compare_two_directions(self, northeast_points: List[Tuple[int, int]], 
                              east_points: List[Tuple[int, int]]) -> Dict:
        """Compare ridge selections from two different viewing directions."""
        
        # Validate northeast direction (45°)
        ne_validation = self.validate_clicked_ridges(northeast_points, 45.0, 4032)
        
        # Validate east direction (90°)
        east_validation = self.validate_clicked_ridges(east_points, 90.0, 4032)
        
        # Cross-validate: check if terrain features are consistent
        consistency_analysis = {
            'northeast_visible_peaks': len(ne_validation['line_of_sight']['visible_ridges']),
            'east_visible_peaks': len(east_validation['line_of_sight']['visible_ridges']),
            'northeast_hidden_peaks': len(ne_validation['line_of_sight']['hidden_ridges']),
            'east_hidden_peaks': len(east_validation['line_of_sight']['hidden_ridges'])
        }
        
        return {
            'northeast_analysis': ne_validation,
            'east_analysis': east_validation,
            'consistency': consistency_analysis
        }

def main():
    # GPS coordinates
    gps_lat = 32.9609357
    gps_lon = -107.3267788
    gps_alt = 1360.0
    
    # Initialize validator
    validator = Ridge3DValidator(gps_lat, gps_lon, gps_alt)
    
    try:
        # Load both ridge datasets
        northeast_points = validator.load_ridge_points("selected_ridge_points.txt")
        east_points = validator.load_ridge_points("selected_ridge_points_control_east.txt")
        
        print(f"=== 3D RIDGE VALIDATION ANALYSIS ===")
        print(f"Observer position: {gps_lat:.6f}°N, {gps_lon:.6f}°W at {gps_alt}m")
        print(f"Northeast photo: {len(northeast_points)} ridge points")
        print(f"East photo: {len(east_points)} ridge points")
        
        # Perform comprehensive analysis
        analysis = validator.compare_two_directions(northeast_points, east_points)
        
        print(f"\n=== VISIBILITY ANALYSIS ===")
        print(f"Northeast direction (45°):")
        print(f"  - Visible ridges: {analysis['consistency']['northeast_visible_peaks']}")
        print(f"  - Hidden ridges: {analysis['consistency']['northeast_hidden_peaks']}")
        
        print(f"East direction (90°):")
        print(f"  - Visible ridges: {analysis['consistency']['east_visible_peaks']}")
        print(f"  - Hidden ridges: {analysis['consistency']['east_hidden_peaks']}")
        
        # Analyze specific clicked points
        print(f"\n=== RIDGE POINT VALIDATION ===")
        
        print(f"\nNortheast photo analysis:")
        for i, result in enumerate(analysis['northeast_analysis']['validation_results'][:5]):
            x, y = result['click_point']
            direction = result['pixel_direction']
            terrain = result['likely_foreground']
            
            if terrain:
                print(f"  Point {i+1} ({x}, {y}): Direction {direction:.1f}°")
                print(f"    Likely terrain: {terrain['elevation']:.0f}m at {terrain['distance']:.1f}km")
                print(f"    Viewing angle: {terrain['viewing_angle']:.1f}°")
            else:
                print(f"  Point {i+1} ({x}, {y}): No matching terrain found")
        
        print(f"\nEast photo analysis:")
        for i, result in enumerate(analysis['east_analysis']['validation_results'][:5]):
            x, y = result['click_point']
            direction = result['pixel_direction']
            terrain = result['likely_foreground']
            
            if terrain:
                print(f"  Point {i+1} ({x}, {y}): Direction {direction:.1f}°")
                print(f"    Likely terrain: {terrain['elevation']:.0f}m at {terrain['distance']:.1f}km")
                print(f"    Viewing angle: {terrain['viewing_angle']:.1f}°")
            else:
                print(f"  Point {i+1} ({x}, {y}): No matching terrain found")
        
        print(f"\n=== 3D PROJECTION INSIGHTS ===")
        print("Key findings:")
        print("1. You may be clicking on foreground ridges that hide taller peaks behind them")
        print("2. The 2D photo flattens 3D terrain, making distance judgment difficult")
        print("3. Multiple ridge layers exist at different distances in the same viewing direction")
        print("4. Line-of-sight analysis reveals which peaks are actually visible vs hidden")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 