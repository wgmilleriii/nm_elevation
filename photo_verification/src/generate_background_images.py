import sqlite3
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import math
from typing import List, Dict, Tuple
import argparse

class BackgroundImageGenerator:
    def __init__(self, workspace_root: str = None):
        """Initialize the background image generator."""
        if workspace_root is None:
            self.workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        else:
            self.workspace_root = workspace_root
        
        self.grid_db_dir = os.path.join(self.workspace_root, "grid_databases")
        
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
    
    def get_terrain_data_in_window(self, center_lat: float, center_lon: float, 
                                   window_size_km: float = 50) -> List[Dict]:
        """Get terrain data within a window around the center point."""
        # Convert km to approximate degrees (rough approximation)
        lat_degree_km = 111.0  # 1 degree latitude ≈ 111 km
        lon_degree_km = 111.0 * math.cos(math.radians(center_lat))  # longitude varies by latitude
        
        lat_window = window_size_km / lat_degree_km
        lon_window = window_size_km / lon_degree_km
        
        # Define bounds
        min_lat = center_lat - lat_window
        max_lat = center_lat + lat_window
        min_lon = center_lon - lon_window
        max_lon = center_lon + lon_window
        
        terrain_points = []
        
        # Find relevant database files
        db_files = []
        if os.path.exists(self.grid_db_dir):
            for file in os.listdir(self.grid_db_dir):
                if file.startswith("mountains_") and file.endswith(".db") and "_-" in file:
                    db_files.append(os.path.join(self.grid_db_dir, file))
        
        print(f"Searching {len(db_files)} databases for terrain data...")
        
        for db_file in db_files:
            try:
                conn = sqlite3.connect(db_file)
                cursor = conn.cursor()
                
                # Query points within the window
                cursor.execute("""
                    SELECT latitude, longitude, elevation 
                    FROM elevation_points 
                    WHERE latitude BETWEEN ? AND ? 
                    AND longitude BETWEEN ? AND ?
                    AND elevation IS NOT NULL
                """, (min_lat, max_lat, min_lon, max_lon))
                
                results = cursor.fetchall()
                
                for lat, lon, elev in results:
                    distance = self.calculate_distance(center_lat, center_lon, lat, lon)
                    if distance <= window_size_km:
                        bearing = self.calculate_bearing(center_lat, center_lon, lat, lon)
                        
                        terrain_points.append({
                            'lat': lat,
                            'lon': lon,
                            'elevation': elev,
                            'distance': distance,
                            'bearing': bearing
                        })
                
                conn.close()
                
            except Exception as e:
                print(f"Error querying {db_file}: {e}")
                continue
        
        print(f"Found {len(terrain_points)} terrain points in {window_size_km}km window")
        return terrain_points
    
    def get_visible_ridge_points(self, terrain_points: List[Dict], observer_lat: float, 
                                observer_lon: float, observer_alt: float, facing_direction: float, 
                                fov: float = 60, max_points: int = 100) -> List[Dict]:
        """Get the top visible ridge points in the facing direction."""
        half_fov = fov / 2
        
        # Filter points within FOV
        fov_points = []
        for point in terrain_points:
            angle_diff = abs(point['bearing'] - facing_direction)
            if angle_diff > 180:
                angle_diff = 360 - angle_diff
            if angle_diff <= half_fov:
                fov_points.append(point)
        
        print(f"Found {len(fov_points)} points within {fov}° FOV facing {facing_direction}°")
        
        # Group by bearing and find visible points using line-of-sight
        bearing_groups = {}
        for point in fov_points:
            bearing_key = round(point['bearing'] * 2) / 2  # 0.5 degree precision
            if bearing_key not in bearing_groups:
                bearing_groups[bearing_key] = []
            bearing_groups[bearing_key].append(point)
        
        visible_points = []
        
        for bearing, points in bearing_groups.items():
            points_sorted = sorted(points, key=lambda x: x['distance'])
            
            max_viewing_angle = -90
            
            for point in points_sorted:
                distance_m = point['distance'] * 1000
                height_diff = point['elevation'] - observer_alt
                viewing_angle = math.degrees(math.atan2(height_diff, distance_m))
                
                if viewing_angle > max_viewing_angle:
                    point['viewing_angle'] = viewing_angle
                    visible_points.append(point)
                    max_viewing_angle = viewing_angle
        
        # Sort by viewing angle (highest ridges first) and limit to max_points
        visible_points.sort(key=lambda x: x['viewing_angle'], reverse=True)
        top_ridges = visible_points[:max_points]
        
        print(f"Selected top {len(top_ridges)} visible ridge points")
        return top_ridges
    
    def create_terrain_background(self, center_lat: float, center_lon: float, 
                                 facing_direction: float, observer_alt: float = 1360,
                                 window_size_km: float = 50, image_width: int = 1600, 
                                 image_height: int = 1200, fov: float = 60) -> Image.Image:
        """Create a terrain background image for the given parameters."""
        print(f"Creating background image for {center_lat:.6f}, {center_lon:.6f}")
        print(f"Facing: {facing_direction}°, Window: {window_size_km}km, FOV: {fov}°")
        
        # Get terrain data
        terrain_points = self.get_terrain_data_in_window(center_lat, center_lon, window_size_km)
        
        if not terrain_points:
            print("No terrain data found, creating blank image")
            return Image.new('RGB', (image_width, image_height), color='lightblue')
        
        # Get visible ridge points
        ridge_points = self.get_visible_ridge_points(
            terrain_points, center_lat, center_lon, observer_alt, facing_direction, fov, 100
        )
        
        # Create image
        image = Image.new('RGB', (image_width, image_height), color='lightblue')
        draw = ImageDraw.Draw(image)
        
        # Draw sky gradient
        for y in range(image_height // 2):
            # Sky blue to lighter blue
            blue_intensity = int(135 + (120 * (1 - y / (image_height // 2))))
            sky_color = (135, 206, min(255, blue_intensity))
            draw.line([(0, y), (image_width, y)], fill=sky_color)
        
        if not ridge_points:
            print("No visible ridge points found")
            return image
        
        # Find elevation range for coloring
        elevations = [p['elevation'] for p in ridge_points]
        min_elev = min(elevations)
        max_elev = max(elevations)
        elev_range = max_elev - min_elev if max_elev > min_elev else 1
        
        # Convert ridge points to image coordinates
        image_points = []
        for point in ridge_points:
            # Calculate horizontal position based on bearing offset from center
            bearing_offset = point['bearing'] - facing_direction
            if bearing_offset > 180:
                bearing_offset -= 360
            elif bearing_offset < -180:
                bearing_offset += 360
            
            # Map bearing offset to x coordinate
            x = image_width // 2 + int((bearing_offset / (fov / 2)) * (image_width // 2))
            
            # Calculate vertical position based on viewing angle
            viewing_angle = point['viewing_angle']
            # Map viewing angle to y coordinate (higher angles = lower y values)
            y_factor = max(0, min(1, (viewing_angle + 10) / 20))  # Normalize viewing angle
            y = int(image_height * (0.3 + 0.4 * (1 - y_factor)))  # Ridge line in middle portion
            
            # Calculate color based on elevation
            elev_factor = (point['elevation'] - min_elev) / elev_range
            
            # Mountain colors: darker for lower, lighter for higher
            base_brown = 101
            base_green = 67
            base_blue = 33
            
            r = int(base_brown + (154 - base_brown) * elev_factor)
            g = int(base_green + (133 - base_green) * elev_factor)
            b = int(base_blue + (99 - base_blue) * elev_factor)
            
            image_points.append({
                'x': x,
                'y': y,
                'color': (r, g, b),
                'elevation': point['elevation'],
                'distance': point['distance']
            })
        
        # Sort points by x coordinate for drawing
        image_points.sort(key=lambda p: p['x'])
        
        # Draw mountain silhouette
        if len(image_points) > 1:
            # Create polygon points for mountain silhouette
            silhouette_points = [(0, image_height)]  # Start at bottom left
            
            for point in image_points:
                if 0 <= point['x'] < image_width:
                    silhouette_points.append((point['x'], point['y']))
            
            silhouette_points.append((image_width, image_height))  # End at bottom right
            
            # Fill mountain area
            if len(silhouette_points) > 2:
                draw.polygon(silhouette_points, fill=(101, 67, 33))
        
        # Draw individual ridge points
        for point in image_points:
            if 0 <= point['x'] < image_width and 0 <= point['y'] < image_height:
                # Draw point
                draw.ellipse([point['x']-2, point['y']-2, point['x']+2, point['y']+2], 
                           fill=point['color'], outline='black')
        
        # Add compass direction indicator
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        except:
            font = ImageFont.load_default()
        
        # Convert direction to compass
        directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        direction_index = int((facing_direction + 11.25) / 22.5) % 16
        compass_text = f"Facing: {directions[direction_index]} ({facing_direction}°)"
        
        # Draw compass text with outline
        text_x, text_y = 20, 20
        for offset_x in range(-1, 2):
            for offset_y in range(-1, 2):
                draw.text((text_x + offset_x, text_y + offset_y), compass_text, 
                         font=font, fill='white')
        draw.text((text_x, text_y), compass_text, font=font, fill='black')
        
        # Add coordinate info
        coord_text = f"Location: {center_lat:.4f}°N, {center_lon:.4f}°W"
        text_y = 50
        for offset_x in range(-1, 2):
            for offset_y in range(-1, 2):
                draw.text((text_x + offset_x, text_y + offset_y), coord_text, 
                         font=font, fill='white')
        draw.text((text_x, text_y), coord_text, font=font, fill='black')
        
        # Add ridge info
        if ridge_points:
            ridge_text = f"Ridges: {len(ridge_points)} visible, {min_elev:.0f}-{max_elev:.0f}m"
            text_y = 80
            for offset_x in range(-1, 2):
                for offset_y in range(-1, 2):
                    draw.text((text_x + offset_x, text_y + offset_y), ridge_text, 
                             font=font, fill='white')
            draw.text((text_x, text_y), ridge_text, font=font, fill='black')
        
        return image
    
    def generate_background_for_location(self, lat: float, lon: float, direction: float,
                                       output_dir: str = None, filename: str = None) -> str:
        """Generate a background image for a specific location and direction."""
        if output_dir is None:
            output_dir = os.path.join(self.workspace_root, "data/images")
        
        os.makedirs(output_dir, exist_ok=True)
        
        if filename is None:
            filename = f"background_{lat:.4f}_{lon:.4f}_{direction:.0f}.jpg"
        
        output_path = os.path.join(output_dir, filename)
        
        # Generate the background image
        image = self.create_terrain_background(lat, lon, direction)
        
        # Save the image
        image.save(output_path, quality=95)
        print(f"Background image saved to: {output_path}")
        
        return output_path

def main():
    parser = argparse.ArgumentParser(description='Generate terrain background images')
    parser.add_argument('--lat', type=float, required=True, help='Latitude (decimal degrees)')
    parser.add_argument('--lon', type=float, required=True, help='Longitude (decimal degrees)')
    parser.add_argument('--direction', type=float, required=True, help='Facing direction (1-360, 360=N)')
    parser.add_argument('--window', type=float, default=50, help='Window size in km (default: 50)')
    parser.add_argument('--output', type=str, help='Output directory (default: data/images)')
    parser.add_argument('--filename', type=str, help='Output filename (auto-generated if not provided)')
    
    args = parser.parse_args()
    
    # Validate direction
    if not (1 <= args.direction <= 360):
        print("Error: Direction must be between 1 and 360 degrees")
        return
    
    print("=== TERRAIN BACKGROUND GENERATOR ===")
    print(f"Location: {args.lat:.6f}°N, {args.lon:.6f}°W")
    print(f"Direction: {args.direction}° ({'N' if args.direction == 360 else 'N' if args.direction < 22.5 else 'NE' if args.direction < 67.5 else 'E' if args.direction < 112.5 else 'SE' if args.direction < 157.5 else 'S' if args.direction < 202.5 else 'SW' if args.direction < 247.5 else 'W' if args.direction < 292.5 else 'NW' if args.direction < 337.5 else 'N'})")
    print(f"Window size: {args.window}km")
    
    generator = BackgroundImageGenerator()
    
    try:
        output_path = generator.generate_background_for_location(
            args.lat, args.lon, args.direction, args.output, args.filename
        )
        print(f"\n=== SUCCESS ===")
        print(f"Background image created: {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # If no command line args, use the photo verification coordinates
    import sys
    if len(sys.argv) == 1:
        print("=== GENERATING BACKGROUND IMAGES FOR PHOTO VERIFICATION ===")
        
        generator = BackgroundImageGenerator()
        
        # Generate for northeast direction (original photo)
        print("\n1. Generating Northeast background (45°)...")
        ne_path = generator.generate_background_for_location(
            32.9609357, -107.3267788, 45.0, filename="background_northeast_45.jpg"
        )
        
        # Generate for east direction (control photo)
        print("\n2. Generating East background (90°)...")
        east_path = generator.generate_background_for_location(
            32.9609357, -107.3267788, 90.0, filename="background_east_90.jpg"
        )
        
        # Generate a few more directions for comparison
        print("\n3. Generating North background (360°)...")
        north_path = generator.generate_background_for_location(
            32.9609357, -107.3267788, 360.0, filename="background_north_360.jpg"
        )
        
        print("\n4. Generating South background (180°)...")
        south_path = generator.generate_background_for_location(
            32.9609357, -107.3267788, 180.0, filename="background_south_180.jpg"
        )
        
        print(f"\n=== ALL BACKGROUND IMAGES GENERATED ===")
        print(f"Northeast (45°): {ne_path}")
        print(f"East (90°): {east_path}")
        print(f"North (360°): {north_path}")
        print(f"South (180°): {south_path}")
        
    else:
        main() 