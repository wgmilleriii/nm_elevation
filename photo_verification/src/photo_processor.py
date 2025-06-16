import cv2
import numpy as np
from typing import Tuple, List, Optional, Dict
import sqlite3
import os
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import math

class PhotoProcessor:
    def __init__(self, image_path: str):
        """Initialize the photo processor with an image path."""
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        self.image = cv2.imread(image_path)
        if self.image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        self.height, self.width = self.image.shape[:2]
        self.skyline = None
        self.elevation_profile = None
        
        # Load EXIF data
        self.exif_data = self._get_exif_data(image_path)
        self.gps_data = self._get_gps_data(self.exif_data)

    def _get_exif_data(self, image_path: str) -> Dict:
        """Extract EXIF data from image."""
        try:
            image = Image.open(image_path)
            exif = image._getexif()
            if exif is None:
                return {}
            
            exif_data = {}
            for tag_id in exif:
                tag = TAGS.get(tag_id, tag_id)
                data = exif.get(tag_id)
                if isinstance(data, bytes):
                    data = data.decode()
                exif_data[tag] = data
            return exif_data
        except Exception as e:
            print(f"Warning: Could not extract EXIF data: {e}")
            return {}

    def _get_gps_data(self, exif_data: Dict) -> Dict:
        """Extract GPS data from EXIF data."""
        gps_data = {}
        
        # Extract GPS coordinates
        if 'GPSInfo' in exif_data:
            gps_info = exif_data['GPSInfo']
            for key in gps_info.keys():
                name = GPSTAGS.get(key, key)
                gps_data[name] = gps_info[key]
        
        # Extract orientation
        if 'Orientation' in exif_data:
            gps_data['Orientation'] = exif_data['Orientation']
        
        return gps_data

    def get_camera_position(self) -> Optional[Tuple[float, float]]:
        """Get camera position from EXIF GPS data."""
        if not self.gps_data:
            return None
        
        try:
            # Extract latitude
            lat_ref = self.gps_data.get('GPSLatitudeRef', 'N')
            lat = self.gps_data.get('GPSLatitude')
            if lat:
                lat = self._convert_to_degrees(lat)
                if lat_ref == 'S':
                    lat = -lat
            
            # Extract longitude
            lon_ref = self.gps_data.get('GPSLongitudeRef', 'E')
            lon = self.gps_data.get('GPSLongitude')
            if lon:
                lon = self._convert_to_degrees(lon)
                if lon_ref == 'W':
                    lon = -lon
            
            if lat is not None and lon is not None:
                return (lat, lon)
        except Exception as e:
            print(f"Warning: Could not extract GPS coordinates: {e}")
        
        return None

    def get_camera_direction(self) -> Optional[float]:
        """Get camera direction from EXIF data."""
        if not self.gps_data:
            return None
        
        try:
            # Try to get direction from GPS direction
            if 'GPSImgDirection' in self.gps_data:
                return float(self.gps_data['GPSImgDirection'])
            
            # Try to get direction from orientation
            if 'Orientation' in self.gps_data:
                orientation = int(self.gps_data['Orientation'])
                # Convert orientation to degrees
                # 1 = 0°, 3 = 180°, 6 = 90°, 8 = 270°
                orientation_map = {1: 0, 3: 180, 6: 90, 8: 270}
                if orientation in orientation_map:
                    return orientation_map[orientation]
        except Exception as e:
            print(f"Warning: Could not extract camera direction: {e}")
        
        return None

    def _convert_to_degrees(self, value: Tuple) -> float:
        """Convert GPS coordinate to degrees."""
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)

    def detect_skyline(self, threshold: int = 200) -> np.ndarray:
        """
        Detect the boundary between sky and mountains in the image.
        
        Args:
            threshold: Brightness threshold for sky detection (0-255)
        
        Returns:
            Array of y-coordinates representing the skyline
        """
        # Convert to grayscale
        gray = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
        
        # Initialize skyline array
        skyline = np.zeros(self.width, dtype=np.int32)
        
        # For each column, find the first pixel below threshold
        for x in range(self.width):
            column = gray[:, x]
            # Find the first pixel that's darker than threshold
            sky_pixels = np.where(column < threshold)[0]
            if len(sky_pixels) > 0:
                skyline[x] = sky_pixels[0]
            else:
                skyline[x] = 0
        
        self.skyline = skyline
        return skyline

    def get_elevation_profile(self, 
                            camera_position: Optional[Tuple[float, float]] = None,
                            camera_direction: Optional[float] = None,
                            camera_height: float = 1.7,
                            fov: float = 60.0) -> List[Tuple[float, float]]:
        """
        Convert the skyline to an elevation profile.
        
        Args:
            camera_position: (latitude, longitude) of camera
            camera_direction: Direction camera is facing (degrees from north)
            camera_height: Height of camera above ground (meters)
            fov: Camera field of view (degrees)
        
        Returns:
            List of (distance, elevation) tuples
        """
        if self.skyline is None:
            raise ValueError("Must detect skyline before getting elevation profile")
        
        # Use EXIF data if available
        if camera_position is None:
            camera_position = self.get_camera_position()
        if camera_direction is None:
            camera_direction = self.get_camera_direction()
        
        if camera_position is None or camera_direction is None:
            raise ValueError("Camera position and direction are required")
        
        # Convert skyline to angles
        angles = np.linspace(-fov/2, fov/2, self.width)
        
        # Convert angles to distances and elevations
        profile = []
        for x, angle in enumerate(angles):
            # Calculate distance based on angle and camera height
            # This is a simplified calculation - will need to be refined
            distance = camera_height / np.tan(np.radians(angle))
            
            # Calculate elevation based on skyline position
            # This is a placeholder - will need proper geometric calculations
            elevation = self.height - self.skyline[x]
            
            profile.append((distance, elevation))
        
        self.elevation_profile = profile
        return profile

    def visualize_results(self, save_path: Optional[str] = None):
        """
        Create a visualization of the detected skyline and elevation profile.
        
        Args:
            save_path: Optional path to save the visualization
        """
        if self.skyline is None:
            raise ValueError("Must detect skyline before visualization")
        
        # Create visualization image
        vis_image = self.image.copy()
        
        # Draw skyline
        for x in range(self.width):
            cv2.line(vis_image, (x, self.skyline[x]), (x, self.skyline[x]), (0, 255, 0), 1)
        
        # Add elevation profile if available
        if self.elevation_profile:
            profile_image = np.zeros((400, self.width, 3), dtype=np.uint8)
            for i, (_, elevation) in enumerate(self.elevation_profile):
                y = int(elevation * 400 / self.height)
                cv2.line(profile_image, (i, y), (i, y), (0, 0, 255), 1)
            
            # Combine images
            vis_image = np.vstack([vis_image, profile_image])
        
        if save_path:
            cv2.imwrite(save_path, vis_image)
        
        return vis_image

if __name__ == "__main__":
    # Example usage
    processor = PhotoProcessor("test_photo.jpg")
    
    # Print EXIF data
    print("EXIF Data:")
    for key, value in processor.exif_data.items():
        print(f"{key}: {value}")
    
    # Print GPS data
    print("\nGPS Data:")
    for key, value in processor.gps_data.items():
        print(f"{key}: {value}")
    
    # Get camera position and direction
    position = processor.get_camera_position()
    direction = processor.get_camera_direction()
    print(f"\nCamera Position: {position}")
    print(f"Camera Direction: {direction}")
    
    # Process image
    skyline = processor.detect_skyline()
    profile = processor.get_elevation_profile(
        camera_position=position,
        camera_direction=direction,
        camera_height=1.7
    )
    processor.visualize_results("results.jpg") 