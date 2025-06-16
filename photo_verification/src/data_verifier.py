import sqlite3
import numpy as np
from typing import Tuple, List, Optional
import os
import glob

class DataVerifier:
    def __init__(self, db_directory: str = "../grid_databases"):
        """
        Initialize the data verifier with the database directory.
        
        Args:
            db_directory: Path to directory containing elevation databases
        """
        self.db_directory = db_directory
        if not os.path.exists(db_directory):
            raise FileNotFoundError(f"Database directory not found: {db_directory}")
        
        # Get list of database files
        self.db_files = glob.glob(os.path.join(db_directory, "mountains_*.db"))
        if not self.db_files:
            raise ValueError(f"No database files found in {db_directory}")

    def get_elevation_data(self, 
                          camera_position: Tuple[float, float],
                          direction: float,
                          fov: float = 60.0,
                          max_distance: float = 10000.0) -> List[Tuple[float, float]]:
        """
        Get elevation data from databases for comparison with photo.
        
        Args:
            camera_position: (latitude, longitude) of camera
            direction: Direction camera is facing (degrees from north)
            fov: Camera field of view (degrees)
            max_distance: Maximum distance to consider (meters)
        
        Returns:
            List of (distance, elevation) tuples
        """
        # Calculate the bounding box for the view
        lat, lon = camera_position
        direction_rad = np.radians(direction)
        fov_rad = np.radians(fov)
        
        # Find relevant database files
        relevant_dbs = []
        for db_file in self.db_files:
            # Extract lat/lon from filename
            filename = os.path.basename(db_file)
            try:
                db_lat = int(filename.split('_')[1])
                db_lon = int(filename.split('_')[2].split('.')[0])
                # Check if database is in view
                if self._is_in_view(db_lat, db_lon, lat, lon, direction, fov):
                    relevant_dbs.append(db_file)
            except (IndexError, ValueError):
                continue
        
        # Query elevation data
        elevation_data = []
        for db_file in relevant_dbs:
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            try:
                # Query elevation points
                cursor.execute("""
                    SELECT latitude, longitude, elevation
                    FROM elevation_points
                    WHERE elevation IS NOT NULL
                """)
                
                for row in cursor.fetchall():
                    point_lat, point_lon, elevation = row
                    # Calculate distance and angle from camera
                    distance, angle = self._calculate_distance_angle(
                        lat, lon, point_lat, point_lon, direction
                    )
                    
                    # Check if point is in view and within max distance
                    if (abs(angle) <= fov/2 and distance <= max_distance):
                        elevation_data.append((distance, elevation))
            
            finally:
                conn.close()
        
        # Sort by distance
        elevation_data.sort(key=lambda x: x[0])
        return elevation_data

    def compare_profiles(self,
                        photo_profile: List[Tuple[float, float]],
                        db_profile: List[Tuple[float, float]]) -> dict:
        """
        Compare photo-derived elevation profile with database profile.
        
        Args:
            photo_profile: List of (distance, elevation) tuples from photo
            db_profile: List of (distance, elevation) tuples from database
        
        Returns:
            Dictionary containing comparison metrics
        """
        # Convert to numpy arrays for easier calculation
        photo_distances = np.array([p[0] for p in photo_profile])
        photo_elevations = np.array([p[1] for p in photo_profile])
        db_distances = np.array([p[0] for p in db_profile])
        db_elevations = np.array([p[1] for p in db_profile])
        
        # Interpolate database elevations to match photo distances
        db_elevations_interp = np.interp(photo_distances, db_distances, db_elevations)
        
        # Calculate error metrics
        errors = db_elevations_interp - photo_elevations
        mae = np.mean(np.abs(errors))
        rmse = np.sqrt(np.mean(errors**2))
        max_error = np.max(np.abs(errors))
        
        return {
            'mean_absolute_error': mae,
            'root_mean_square_error': rmse,
            'max_error': max_error,
            'error_distribution': errors.tolist()
        }

    def _is_in_view(self, 
                    point_lat: float,
                    point_lon: float,
                    camera_lat: float,
                    camera_lon: float,
                    direction: float,
                    fov: float) -> bool:
        """Check if a point is within the camera's field of view."""
        # Calculate angle from camera to point
        angle = np.degrees(np.arctan2(
            point_lon - camera_lon,
            point_lat - camera_lat
        ))
        
        # Normalize angle to [-180, 180]
        angle = (angle + 180) % 360 - 180
        
        # Check if point is within FOV
        return abs(angle - direction) <= fov/2

    def _calculate_distance_angle(self,
                                lat1: float,
                                lon1: float,
                                lat2: float,
                                lon2: float,
                                camera_direction: float) -> Tuple[float, float]:
        """Calculate distance and angle between two points."""
        # Convert to radians
        lat1_rad = np.radians(lat1)
        lon1_rad = np.radians(lon1)
        lat2_rad = np.radians(lat2)
        lon2_rad = np.radians(lon2)
        
        # Calculate distance using Haversine formula
        dlon = lon2_rad - lon1_rad
        dlat = lat2_rad - lat1_rad
        a = np.sin(dlat/2)**2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon/2)**2
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))
        distance = 6371000 * c  # Earth radius in meters
        
        # Calculate angle
        angle = np.degrees(np.arctan2(
            lon2 - lon1,
            lat2 - lat1
        ))
        
        # Normalize angle relative to camera direction
        angle = (angle - camera_direction + 180) % 360 - 180
        
        return distance, angle

if __name__ == "__main__":
    # Example usage
    verifier = DataVerifier()
    
    # Example photo profile (simulated)
    photo_profile = [(1000*i, 1000 + 100*np.sin(i/10)) for i in range(100)]
    
    # Get database profile
    db_profile = verifier.get_elevation_data(
        camera_position=(35.0844, -106.6504),  # Example: Albuquerque
        direction=45,  # degrees from north
        fov=60.0
    )
    
    # Compare profiles
    results = verifier.compare_profiles(photo_profile, db_profile)
    print("Comparison Results:")
    print(f"Mean Absolute Error: {results['mean_absolute_error']:.2f} meters")
    print(f"Root Mean Square Error: {results['root_mean_square_error']:.2f} meters")
    print(f"Maximum Error: {results['max_error']:.2f} meters") 