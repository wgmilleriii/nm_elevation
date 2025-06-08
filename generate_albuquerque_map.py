import os
import time
from generate_contour_map import generate_contour_map

# Albuquerque and Sandia Mountains bounds
ALBUQUERQUE_BOUNDS = {
    'minLat': 35.0,    # South of Albuquerque
    'maxLat': 35.3,    # North of Sandia Mountains
    'minLon': -106.7,  # West of Albuquerque
    'maxLon': -106.4   # East of Sandia Mountains
}

def generate_albuquerque_map(color_mode='bw'):
    """Generate a contour map of Albuquerque and Sandia Mountains"""
    print(f"\nGenerating {color_mode} map of Albuquerque and Sandia Mountains...")
    print(f"Bounds: {ALBUQUERQUE_BOUNDS}")
    
    # Generate timestamp for filename
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    
    # Generate the map
    output_file = generate_contour_map(
        color_mode=color_mode,
        bounds=ALBUQUERQUE_BOUNDS
    )
    
    print(f"Map generated: {output_file}")
    return output_file

if __name__ == '__main__':
    # Generate both black & white and color versions
    generate_albuquerque_map('bw')
    generate_albuquerque_map('color') 