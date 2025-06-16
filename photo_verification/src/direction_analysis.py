import cv2
import numpy as np
import os
import sqlite3
import math
from typing import List, Tuple

class DirectionAnalyzer:
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
    
    def analyze_ridge_profile(self, image_path: str, points: List[Tuple[int, int]]) -> dict:
        """Analyze the ridge profile characteristics."""
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        height, width = image.shape[:2]
        
        # Calculate ridge statistics
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        
        # Ridge slope (positive = rising left to right)
        slope = (y_coords[-1] - y_coords[0]) / (x_coords[-1] - x_coords[0])
        
        # Ridge elevation range
        min_ridge_y = min(y_coords)
        max_ridge_y = max(y_coords)
        ridge_height_range = max_ridge_y - min_ridge_y
        
        # Average ridge height (as fraction of image height)
        avg_ridge_y = sum(y_coords) / len(y_coords)
        relative_height = avg_ridge_y / height
        
        return {
            'slope': slope,
            'height_range': ridge_height_range,
            'avg_height': avg_ridge_y,
            'relative_height': relative_height,
            'min_y': min_ridge_y,
            'max_y': max_ridge_y,
            'image_width': width,
            'image_height': height
        }
    
    def query_elevation_database(self, direction_degrees: float, max_distance_km: float = 50) -> List[Tuple[float, float, float]]:
        """Query elevation database in a specific direction."""
        # Convert direction to radians
        direction_rad = math.radians(direction_degrees)
        
        # Calculate search bounds
        lat_offset = (max_distance_km / 111.0) * math.cos(direction_rad)  # ~111 km per degree latitude
        lon_offset = (max_distance_km / (111.0 * math.cos(math.radians(self.gps_lat)))) * math.sin(direction_rad)
        
        target_lat = self.gps_lat + lat_offset
        target_lon = self.gps_lon + lon_offset
        
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
                
                # Query points in the direction of interest
                cursor.execute("""
                    SELECT latitude, longitude, elevation 
                    FROM elevation_points 
                    WHERE latitude BETWEEN ? AND ? 
                    AND longitude BETWEEN ? AND ?
                    ORDER BY elevation DESC
                    LIMIT 100
                """, (
                    min(self.gps_lat, target_lat) - 0.1,
                    max(self.gps_lat, target_lat) + 0.1,
                    min(self.gps_lon, target_lon) - 0.1,
                    max(self.gps_lon, target_lon) + 0.1
                ))
                
                results = cursor.fetchall()
                elevation_points.extend(results)
                conn.close()
                
            except Exception as e:
                print(f"Error querying {db_file}: {e}")
                continue
        
        return elevation_points
    
    def estimate_direction(self, original_photo: str, control_photo: str, ridge_points: List[Tuple[int, int]]) -> dict:
        """Estimate the direction of the original photo using the control photo."""
        
        # Analyze original photo ridge profile
        original_profile = self.analyze_ridge_profile(original_photo, ridge_points)
        
        # Load control image for comparison
        control_image = cv2.imread(control_photo)
        if control_image is None:
            raise ValueError(f"Failed to load control image: {control_photo}")
        
        # Known: control photo faces east (90 degrees)
        control_direction = 90.0
        
        # Analyze ridge characteristics to estimate direction
        # This is a simplified estimation - in reality, you'd need more sophisticated analysis
        
        # If ridge slopes upward left to right, likely facing north/northeast
        # If ridge slopes downward left to right, likely facing south/southeast
        
        estimated_direction = None
        confidence = 0.0
        
        if original_profile['slope'] > 0:  # Rising left to right
            # Likely facing north to northeast
            estimated_direction = 45.0  # Northeast
            confidence = 0.7
        elif original_profile['slope'] < 0:  # Falling left to right
            # Likely facing south to southeast  
            estimated_direction = 135.0  # Southeast
            confidence = 0.7
        else:  # Relatively flat
            # Could be facing due north or south
            estimated_direction = 0.0  # North
            confidence = 0.5
        
        return {
            'estimated_direction': estimated_direction,
            'confidence': confidence,
            'control_direction': control_direction,
            'original_profile': original_profile,
            'reasoning': f"Ridge slope: {original_profile['slope']:.3f}"
        }

def main():
    # GPS coordinates from the photo
    gps_lat = 32.9609357
    gps_lon = -107.3267788
    gps_alt = 1360.0
    
    # Initialize analyzer
    analyzer = DirectionAnalyzer(gps_lat, gps_lon, gps_alt)
    
    # File paths
    workspace_root = analyzer.workspace_root
    original_photo = os.path.join(workspace_root, "data/images/20231024_085412.jpg")
    control_photo = os.path.join(workspace_root, "data/images/control1.png")
    ridge_points_file = "selected_ridge_points.txt"
    
    try:
        # Load ridge points
        ridge_points = analyzer.load_ridge_points(ridge_points_file)
        print(f"Loaded {len(ridge_points)} ridge points")
        
        # Estimate direction
        direction_analysis = analyzer.estimate_direction(original_photo, control_photo, ridge_points)
        
        print(f"\n=== DIRECTION ANALYSIS ===")
        print(f"GPS Position: {gps_lat:.6f}°N, {gps_lon:.6f}°W")
        print(f"Altitude: {gps_alt:.0f}m")
        print(f"Control photo direction: {direction_analysis['control_direction']}° (East)")
        print(f"Estimated original photo direction: {direction_analysis['estimated_direction']}°")
        print(f"Confidence: {direction_analysis['confidence']:.1%}")
        print(f"Reasoning: {direction_analysis['reasoning']}")
        
        # Query elevation data in estimated direction
        if direction_analysis['estimated_direction'] is not None:
            print(f"\n=== ELEVATION DATA QUERY ===")
            elevation_points = analyzer.query_elevation_database(direction_analysis['estimated_direction'])
            print(f"Found {len(elevation_points)} elevation points in direction {direction_analysis['estimated_direction']}°")
            
            if elevation_points:
                # Show highest peaks
                print("\nHighest peaks in viewing direction:")
                for i, (lat, lon, elev) in enumerate(elevation_points[:5]):
                    distance = math.sqrt((lat - gps_lat)**2 + (lon - gps_lon)**2) * 111.0  # Rough km
                    print(f"  {i+1}. Elevation: {elev:.0f}m, Distance: ~{distance:.1f}km")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main() 