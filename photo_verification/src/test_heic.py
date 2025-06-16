import os
from PIL import Image
import pillow_heif
from photo_processor import PhotoProcessor

def convert_heic_to_jpg(heic_path: str, jpg_path: str):
    """Convert HEIC image to JPEG format."""
    heif_file = pillow_heif.read_heif(heic_path)
    image = Image.frombytes(
        heif_file.mode, 
        heif_file.size, 
        heif_file.data,
        "raw",
    )
    image.save(jpg_path, "JPEG")
    return jpg_path

def main():
    # Get workspace root directory
    workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    
    # Paths
    heic_path = os.path.join(workspace_root, "data/images/IMG_1327.HEIC")
    jpg_path = os.path.join(workspace_root, "data/images/IMG_1327.jpg")
    results_path = os.path.join(workspace_root, "data/images/results.jpg")
    
    # Convert HEIC to JPEG
    print("Converting HEIC to JPEG...")
    convert_heic_to_jpg(heic_path, jpg_path)
    
    # Process the image
    print("\nProcessing image...")
    processor = PhotoProcessor(jpg_path)
    
    # Print EXIF data
    print("\nEXIF Data:")
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
    print("\nDetecting skyline...")
    skyline = processor.detect_skyline()
    
    print("\nGenerating elevation profile...")
    profile = processor.get_elevation_profile(
        camera_position=position,
        camera_direction=direction,
        camera_height=1.7
    )
    
    print("\nCreating visualization...")
    processor.visualize_results(results_path)
    print(f"Results saved to {results_path}")

if __name__ == "__main__":
    main() 