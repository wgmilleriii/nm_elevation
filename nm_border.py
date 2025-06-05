"""
New Mexico border outline coordinates and translation utilities.
Uses key points along the border to create a simplified outline.
"""

# Key points along New Mexico's border (clockwise from northwest)
NM_BORDER_POINTS = [
    # Northwest corner
    {'lat': 37.000174, 'lon': -109.045223},
    
    # North border (with Colorado)
    {'lat': 37.000174, 'lon': -106.528588},
    {'lat': 37.000174, 'lon': -105.728874},
    {'lat': 37.000174, 'lon': -103.001705},
    
    # East border (with Texas)
    {'lat': 35.182252, 'lon': -103.001705},
    {'lat': 33.643532, 'lon': -103.001705},
    {'lat': 32.000659, 'lon': -103.001705},
    {'lat': 31.332177, 'lon': -103.001705},
    
    # Boot heel area (southeast)
    {'lat': 31.332177, 'lon': -106.528588},
    {'lat': 31.332177, 'lon': -106.628588},  # Extra point for boot heel
    {'lat': 31.782177, 'lon': -106.528588},  # Top of boot heel
    {'lat': 31.332177, 'lon': -108.208164},  # Bottom of boot heel
    
    # Southern border with Mexico
    {'lat': 31.332177, 'lon': -108.208164},
    {'lat': 31.332177, 'lon': -109.045223},
    
    # West border (with Arizona)
    {'lat': 32.694866, 'lon': -109.045223},
    {'lat': 34.959955, 'lon': -109.045223},
    {'lat': 36.088646, 'lon': -109.045223}
]

def translate_coordinates(points, bounds, image_width, image_height):
    """
    Translate GPS coordinates to image pixel coordinates.
    
    Args:
        points: List of dictionaries containing 'lat' and 'lon' keys
        bounds: Dictionary with 'minLat', 'maxLat', 'minLon', 'maxLon' keys
        image_width: Width of the target image in pixels
        image_height: Height of the target image in pixels
    
    Returns:
        List of (x, y) tuples representing pixel coordinates
    """
    pixel_coords = []
    
    for point in points:
        # Convert longitude to x coordinate
        x = int(((point['lon'] - bounds['minLon']) / 
                (bounds['maxLon'] - bounds['minLon'])) * (image_width - 1))
        
        # Convert latitude to y coordinate (inverted because image origin is top-left)
        y = int(((bounds['maxLat'] - point['lat']) /
                (bounds['maxLat'] - bounds['minLat'])) * (image_height - 1))
        
        pixel_coords.append((x, y))
    
    return pixel_coords

def draw_border(draw, bounds, width, height, color='white', outline_width=3):
    """
    Draw the New Mexico border on a PIL ImageDraw object.
    
    Args:
        draw: PIL ImageDraw object
        bounds: Dictionary with 'minLat', 'maxLat', 'minLon', 'maxLon' keys
        width: Image width in pixels
        height: Image height in pixels
        color: Border line color (default: white)
        outline_width: Width of the border line in pixels (default: 3)
    """
    # Get pixel coordinates
    pixel_coords = translate_coordinates(NM_BORDER_POINTS, bounds, width, height)
    
    # Draw filled polygon with black outline
    # First draw a slightly larger black polygon
    draw.polygon(pixel_coords, outline='black', width=outline_width + 4)
    
    # Then draw the white border on top
    draw.polygon(pixel_coords, outline=color, width=outline_width)
    
    # Draw dots at each point for debugging
    for x, y in pixel_coords:
        draw.ellipse([x-2, y-2, x+2, y+2], fill='red')

def get_border_bounds():
    """
    Get the minimum and maximum coordinates of the border.
    
    Returns:
        Dictionary with minLat, maxLat, minLon, maxLon
    """
    lats = [p['lat'] for p in NM_BORDER_POINTS]
    lons = [p['lon'] for p in NM_BORDER_POINTS]
    
    return {
        'minLat': min(lats),
        'maxLat': max(lats),
        'minLon': min(lons),
        'maxLon': max(lons)
    } 