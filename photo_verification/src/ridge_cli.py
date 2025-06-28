#!/usr/bin/env python3
"""
Ridge CLI - Command Line Interface for Ridge Analysis
Enter coordinates in format "[lat], [lon]" and facing direction 1-360 (360 = N)
Returns the 100 points along the closest visible ridge along the top
"""

import sqlite3
import math
import os
from typing import List, Dict, Tuple
from generate_background_images import BackgroundImageGenerator

class RidgeCLI:
    def __init__(self):
        """Initialize the Ridge CLI."""
        self.workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        self.generator = BackgroundImageGenerator(self.workspace_root)
        
    def parse_coordinates(self, coord_input: str) -> Tuple[float, float]:
        """Parse coordinate input in format '[lat], [lon]'."""
        # Remove brackets and split by comma
        coord_input = coord_input.strip().replace('[', '').replace(']', '')
        parts = coord_input.split(',')
        
        if len(parts) != 2:
            raise ValueError("Invalid format. Use: [lat], [lon]")
        
        try:
            lat = float(parts[0].strip())
            lon = float(parts[1].strip())
        except ValueError:
            raise ValueError("Invalid coordinates. Must be numeric values.")
        
        # Validate ranges
        if not (-90 <= lat <= 90):
            raise ValueError("Latitude must be between -90 and 90 degrees")
        if not (-180 <= lon <= 180):
            raise ValueError("Longitude must be between -180 and 180 degrees")
        
        return lat, lon
    
    def parse_direction(self, direction_input: str) -> float:
        """Parse direction input (1-360)."""
        try:
            direction = float(direction_input.strip())
        except ValueError:
            raise ValueError("Direction must be a numeric value")
        
        if not (1 <= direction <= 360):
            raise ValueError("Direction must be between 1 and 360 degrees")
        
        return direction
    
    def get_ridge_points(self, lat: float, lon: float, direction: float, 
                        max_points: int = 100) -> List[Dict]:
        """Get the top 100 visible ridge points for the given parameters."""
        print(f"Searching for terrain data around {lat:.6f}°N, {lon:.6f}°W...")
        
        # Get terrain data in a 50km window
        terrain_points = self.generator.get_terrain_data_in_window(lat, lon, 50.0)
        
        if not terrain_points:
            print("❌ No terrain data found for this location")
            return []
        
        print(f"Found {len(terrain_points)} terrain points in 50km radius")
        
        # Get visible ridge points
        ridge_points = self.generator.get_visible_ridge_points(
            terrain_points, lat, lon, 1360, direction, 60, max_points
        )
        
        if not ridge_points:
            print("❌ No visible ridge points found in this direction")
            return []
        
        # Sort by viewing angle (highest ridges first)
        ridge_points.sort(key=lambda x: x.get('viewing_angle', 0), reverse=True)
        
        return ridge_points[:max_points]
    
    def display_ridge_points(self, ridge_points: List[Dict], direction: float):
        """Display the ridge points in a formatted table."""
        if not ridge_points:
            return
        
        # Convert direction to compass
        directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        direction_index = int((direction + 11.25) / 22.5) % 16
        compass_dir = directions[direction_index]
        
        print(f"\n🏔️  TOP {len(ridge_points)} VISIBLE RIDGE POINTS")
        print(f"📍 Facing: {compass_dir} ({direction}°)")
        print("=" * 80)
        
        # Table header
        print(f"{'#':<3} {'Distance':<10} {'Elevation':<12} {'Bearing':<10} {'View Angle':<12} {'Coordinates':<20}")
        print("-" * 80)
        
        # Display each ridge point
        for i, point in enumerate(ridge_points, 1):
            distance = f"{point['distance']:.2f} km"
            elevation = f"{point['elevation']:.0f} m"
            bearing = f"{point['bearing']:.1f}°"
            view_angle = f"{point.get('viewing_angle', 0):.2f}°"
            coordinates = f"{point['lat']:.4f}, {point['lon']:.4f}"
            
            print(f"{i:<3} {distance:<10} {elevation:<12} {bearing:<10} {view_angle:<12} {coordinates:<20}")
        
        # Summary statistics
        distances = [p['distance'] for p in ridge_points]
        elevations = [p['elevation'] for p in ridge_points]
        
        print("\n📊 SUMMARY STATISTICS")
        print("-" * 40)
        print(f"Total ridge points: {len(ridge_points)}")
        print(f"Distance range: {min(distances):.2f} - {max(distances):.2f} km")
        print(f"Elevation range: {min(elevations):.0f} - {max(elevations):.0f} m")
        print(f"Average distance: {sum(distances)/len(distances):.2f} km")
        print(f"Average elevation: {sum(elevations)/len(elevations):.0f} m")
    
    def save_ridge_points(self, ridge_points: List[Dict], lat: float, lon: float, direction: float):
        """Save ridge points to a file."""
        if not ridge_points:
            return
        
        filename = f"ridge_points_{lat:.4f}_{lon:.4f}_{direction:.0f}.txt"
        output_path = os.path.join(self.workspace_root, "data", filename)
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w') as f:
            f.write(f"Ridge Points Analysis\n")
            f.write(f"Location: {lat:.6f}°N, {lon:.6f}°W\n")
            f.write(f"Direction: {direction}°\n")
            f.write(f"Generated: {len(ridge_points)} points\n")
            f.write("=" * 60 + "\n\n")
            
            f.write("Index,Distance(km),Elevation(m),Bearing(°),ViewAngle(°),Latitude,Longitude\n")
            
            for i, point in enumerate(ridge_points, 1):
                f.write(f"{i},{point['distance']:.2f},{point['elevation']:.0f},"
                       f"{point['bearing']:.1f},{point.get('viewing_angle', 0):.2f},"
                       f"{point['lat']:.6f},{point['lon']:.6f}\n")
        
        print(f"💾 Ridge points saved to: {output_path}")
    
    def run_interactive(self):
        """Run the interactive CLI."""
        print("🏔️  RIDGE ANALYSIS CLI")
        print("=" * 50)
        print("Enter coordinates and facing direction to analyze visible ridges")
        print("Format: [lat], [lon] and direction 1-360 (360 = North)")
        print("Type 'quit' or 'exit' to stop")
        print()
        
        while True:
            try:
                # Get coordinates
                coord_input = input("📍 Enter coordinates [lat], [lon]: ").strip()
                
                if coord_input.lower() in ['quit', 'exit', 'q']:
                    print("👋 Goodbye!")
                    break
                
                if not coord_input:
                    continue
                
                lat, lon = self.parse_coordinates(coord_input)
                
                # Get direction
                direction_input = input("🧭 Enter facing direction (1-360, 360=N): ").strip()
                
                if direction_input.lower() in ['quit', 'exit', 'q']:
                    print("👋 Goodbye!")
                    break
                
                direction = self.parse_direction(direction_input)
                
                print(f"\n🔍 Analyzing ridges for {lat:.6f}°N, {lon:.6f}°W facing {direction}°...")
                
                # Get ridge points
                ridge_points = self.get_ridge_points(lat, lon, direction)
                
                if ridge_points:
                    # Display results
                    self.display_ridge_points(ridge_points, direction)
                    
                    # Ask if user wants to save
                    save_input = input("\n💾 Save results to file? (y/n): ").strip().lower()
                    if save_input in ['y', 'yes']:
                        self.save_ridge_points(ridge_points, lat, lon, direction)
                    
                    # Ask if user wants to generate background image
                    bg_input = input("🖼️  Generate background image? (y/n): ").strip().lower()
                    if bg_input in ['y', 'yes']:
                        print("Generating background image...")
                        try:
                            output_path = self.generator.generate_background_for_location(
                                lat, lon, direction, 
                                filename=f"background_{lat:.4f}_{lon:.4f}_{direction:.0f}.jpg"
                            )
                            print(f"🖼️  Background image saved: {output_path}")
                        except Exception as e:
                            print(f"❌ Error generating background: {e}")
                
                print("\n" + "=" * 50)
                
            except ValueError as e:
                print(f"❌ Error: {e}")
                print("Please try again with correct format.")
                
            except KeyboardInterrupt:
                print("\n👋 Goodbye!")
                break
                
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                print("Please try again.")

def main():
    """Main function."""
    import sys
    
    cli = RidgeCLI()
    
    # Check if coordinates and direction provided as command line arguments
    if len(sys.argv) == 3:
        try:
            coord_input = sys.argv[1]
            direction_input = sys.argv[2]
            
            lat, lon = cli.parse_coordinates(coord_input)
            direction = cli.parse_direction(direction_input)
            
            print(f"🏔️  RIDGE ANALYSIS")
            print(f"📍 Location: {lat:.6f}°N, {lon:.6f}°W")
            print(f"🧭 Direction: {direction}°")
            
            ridge_points = cli.get_ridge_points(lat, lon, direction)
            
            if ridge_points:
                cli.display_ridge_points(ridge_points, direction)
                cli.save_ridge_points(ridge_points, lat, lon, direction)
            
        except ValueError as e:
            print(f"❌ Error: {e}")
            print("Usage: python ridge_cli.py '[lat], [lon]' direction")
            print("Example: python ridge_cli.py '32.9609357, -107.3267788' 45")
            
    else:
        # Run interactive mode
        cli.run_interactive()

if __name__ == "__main__":
    main() 