#!/usr/bin/env python3
"""
Test Case: Google Maps Location - 35°14'24.8"N 106°38'09.2"W facing east
Source: https://maps.app.goo.gl/TqfenfnWVWAEzcxr8

This test case validates ridge analysis for a specific location in New Mexico
facing east (90 degrees).
"""

import os
import sys
import unittest
from typing import List, Dict

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from ridge_cli import RidgeCLI
from generate_background_images import BackgroundImageGenerator

class TestGoogleMapsLocation(unittest.TestCase):
    """Test case for Google Maps location facing east."""
    
    def setUp(self):
        """Set up test parameters."""
        # Convert DMS to decimal degrees
        # 35°14'24.8"N = 35 + 14/60 + 24.8/3600 = 35.240222°N
        # 106°38'09.2"W = -(106 + 38/60 + 9.2/3600) = -106.635889°W
        self.latitude = 35.240222
        self.longitude = -106.635889
        self.direction = 90  # East
        self.location_name = "Google Maps Location"
        self.source_url = "https://maps.app.goo.gl/TqfenfnWVWAEzcxr8"
        
        # Initialize CLI
        self.ridge_cli = RidgeCLI()
        
        # Expected results (to be updated after running the test)
        self.expected_min_points = 10  # Minimum expected ridge points
        self.expected_max_distance = 60  # Maximum expected distance in km
        
    def test_coordinate_parsing(self):
        """Test that coordinates are parsed correctly."""
        coord_string = f"[{self.latitude}], [{self.longitude}]"
        lat, lon = self.ridge_cli.parse_coordinates(coord_string)
        
        self.assertAlmostEqual(lat, self.latitude, places=6)
        self.assertAlmostEqual(lon, self.longitude, places=6)
        
    def test_direction_parsing(self):
        """Test that direction is parsed correctly."""
        direction = self.ridge_cli.parse_direction(str(self.direction))
        self.assertEqual(direction, self.direction)
        
    def test_ridge_analysis(self):
        """Test ridge analysis for the location."""
        print(f"\n🏔️  Testing ridge analysis for {self.location_name}")
        print(f"📍 Location: {self.latitude:.6f}°N, {self.longitude:.6f}°W")
        print(f"🧭 Direction: {self.direction}° (East)")
        print(f"🔗 Source: {self.source_url}")
        
        # Get ridge points
        ridge_points = self.ridge_cli.get_ridge_points(
            self.latitude, self.longitude, self.direction
        )
        
        # Validate results
        self.assertIsInstance(ridge_points, list)
        self.assertGreaterEqual(len(ridge_points), self.expected_min_points,
                               f"Expected at least {self.expected_min_points} ridge points")
        
        if ridge_points:
            # Check data structure
            first_point = ridge_points[0]
            required_keys = ['lat', 'lon', 'elevation', 'distance', 'bearing']
            for key in required_keys:
                self.assertIn(key, first_point, f"Missing key: {key}")
            
            # Check distance constraints
            max_distance = max(point['distance'] for point in ridge_points)
            self.assertLessEqual(max_distance, self.expected_max_distance,
                               f"Maximum distance {max_distance:.2f}km exceeds expected {self.expected_max_distance}km")
            
            # Display results
            self.ridge_cli.display_ridge_points(ridge_points, self.direction)
            
            # Save results
            self.ridge_cli.save_ridge_points(ridge_points, self.latitude, self.longitude, self.direction)
            
            return ridge_points
        else:
            self.fail("No ridge points found for the test location")
            
    def test_background_image_generation(self):
        """Test background image generation for the location."""
        print(f"\n🖼️  Testing background image generation")
        
        workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        generator = BackgroundImageGenerator(workspace_root)
        
        # Generate background image
        try:
            filename = f"test_case_google_maps_{self.latitude:.4f}_{self.longitude:.4f}_{self.direction}.jpg"
            image_path = generator.generate_background_for_location(
                self.latitude, self.longitude, self.direction,
                filename=filename
            )
            
            self.assertIsNotNone(image_path, "Background image generation failed")
            self.assertTrue(os.path.exists(image_path), f"Generated image not found: {image_path}")
            
            print(f"✅ Background image generated: {image_path}")
            
        except Exception as e:
            self.fail(f"Background image generation failed: {str(e)}")
            
    def test_comprehensive_analysis(self):
        """Run comprehensive analysis and generate report."""
        print(f"\n📊 COMPREHENSIVE TEST REPORT")
        print("=" * 60)
        print(f"Location: {self.location_name}")
        print(f"Coordinates: {self.latitude:.6f}°N, {self.longitude:.6f}°W")
        print(f"Direction: {self.direction}° (East)")
        print(f"Source: {self.source_url}")
        print(f"DMS Coordinates: 35°14'24.8\"N 106°38'09.2\"W")
        print("=" * 60)
        
        # Run ridge analysis
        ridge_points = self.test_ridge_analysis()
        
        # Generate background image
        self.test_background_image_generation()
        
        # Generate summary report
        if ridge_points:
            distances = [p['distance'] for p in ridge_points]
            elevations = [p['elevation'] for p in ridge_points]
            
            report_path = os.path.join(
                os.path.dirname(__file__), 
                f"test_report_{self.latitude:.4f}_{self.longitude:.4f}_{self.direction}.txt"
            )
            
            with open(report_path, 'w') as f:
                f.write(f"TEST CASE REPORT: {self.location_name}\n")
                f.write("=" * 60 + "\n")
                f.write(f"Source URL: {self.source_url}\n")
                f.write(f"Coordinates: {self.latitude:.6f}°N, {self.longitude:.6f}°W\n")
                f.write(f"DMS Format: 35°14'24.8\"N 106°38'09.2\"W\n")
                f.write(f"Direction: {self.direction}° (East)\n")
                f.write(f"Test Date: {__import__('datetime').datetime.now().isoformat()}\n\n")
                
                f.write("RIDGE ANALYSIS RESULTS:\n")
                f.write(f"- Total ridge points found: {len(ridge_points)}\n")
                f.write(f"- Distance range: {min(distances):.2f} - {max(distances):.2f} km\n")
                f.write(f"- Elevation range: {min(elevations):.0f} - {max(elevations):.0f} m\n")
                f.write(f"- Average distance: {sum(distances)/len(distances):.2f} km\n")
                f.write(f"- Average elevation: {sum(elevations)/len(elevations):.0f} m\n\n")
                
                f.write("TOP 10 RIDGE POINTS:\n")
                f.write("Rank | Distance | Elevation | Bearing | Coordinates\n")
                f.write("-" * 55 + "\n")
                
                for i, point in enumerate(ridge_points[:10], 1):
                    f.write(f"{i:4d} | {point['distance']:8.2f} | {point['elevation']:9.0f} | "
                           f"{point['bearing']:7.1f} | {point['lat']:.4f}, {point['lon']:.4f}\n")
            
            print(f"📄 Test report saved: {report_path}")


if __name__ == '__main__':
    # Run the comprehensive test
    test_case = TestGoogleMapsLocation()
    test_case.setUp()
    
    try:
        test_case.test_comprehensive_analysis()
        print("\n✅ Test case completed successfully!")
    except Exception as e:
        print(f"\n❌ Test case failed: {str(e)}")
        raise 