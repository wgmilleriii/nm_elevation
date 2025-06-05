import sqlite3
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import math
from nm_border import draw_border, NM_BORDER_POINTS

# New Mexico bounds
NM_BOUNDS = {
    'minLat': 31.20,
    'maxLat': 37.20,
    'minLon': -109.20,
    'maxLon': -102.80
}

# Top 10 New Mexico cities
NM_CITIES = [
    {"name": "Albuquerque", "lat": 35.0844, "lon": -106.6504, "population": 564559},
    {"name": "Las Cruces", "lat": 32.3199, "lon": -106.7637, "population": 111385},
    {"name": "Rio Rancho", "lat": 35.2328, "lon": -106.6630, "population": 104046},
    {"name": "Santa Fe", "lat": 35.6870, "lon": -105.9378, "population": 87505},
    {"name": "Roswell", "lat": 33.3943, "lon": -104.5230, "population": 48386},
    {"name": "Farmington", "lat": 36.7281, "lon": -108.2087, "population": 46624},
    {"name": "Clovis", "lat": 34.4048, "lon": -103.2052, "population": 39860},
    {"name": "Hobbs", "lat": 32.7026, "lon": -103.1360, "population": 39141},
    {"name": "Alamogordo", "lat": 32.8995, "lon": -105.9603, "population": 31384},
    {"name": "Carlsbad", "lat": 32.4207, "lon": -104.2288, "population": 32238}
]

def get_elevation_data():
    """Fetch all elevation data from the database"""
    conn = sqlite3.connect('mountains.db')
    cursor = conn.cursor()
    
    # Get all points within New Mexico bounds
    cursor.execute("""
        SELECT latitude, longitude, elevation
        FROM elevation_points
        WHERE latitude BETWEEN ? AND ?
        AND longitude BETWEEN ? AND ?
        AND elevation IS NOT NULL
    """, [NM_BOUNDS['minLat'], NM_BOUNDS['maxLat'], 
          NM_BOUNDS['minLon'], NM_BOUNDS['maxLon']])
    
    points = cursor.fetchall()
    conn.close()
    return points

def add_city_markers(image, width, height):
    """Add city markers and labels to the image"""
    draw = ImageDraw.Draw(image)
    
    # Calculate population range for scaling
    populations = [city["population"] for city in NM_CITIES]
    min_pop = min(populations)
    max_pop = max(populations)
    
    try:
        # Try to load a nice font, fall back to default if not available
        font_path = "/System/Library/Fonts/Helvetica.ttc"  # Mac OS path
        if not os.path.exists(font_path):
            font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"  # Linux path
        if not os.path.exists(font_path):
            font_path = "C:\\Windows\\Fonts\\Arial.ttf"  # Windows path
            
        base_font = ImageFont.truetype(font_path, 24)
    except:
        base_font = ImageFont.load_default()

    for city in NM_CITIES:
        # Convert lat/lon to image coordinates
        x = int((city["lon"] - NM_BOUNDS["minLon"]) / (NM_BOUNDS["maxLon"] - NM_BOUNDS["minLon"]) * (width - 1))
        y = int((NM_BOUNDS["maxLat"] - city["lat"]) / (NM_BOUNDS["maxLat"] - NM_BOUNDS["minLat"]) * (height - 1))
        
        # Calculate marker size based on population (logarithmic scale)
        pop_ratio = math.log(city["population"]) / math.log(max_pop)
        circle_radius = int(5 + (pop_ratio * 15))  # 5-20 pixels
        
        # Draw white outline circle
        for offset in range(-1, 2):
            for offset2 in range(-1, 2):
                draw.ellipse([x - circle_radius + offset, y - circle_radius + offset2,
                            x + circle_radius + offset, y + circle_radius + offset2],
                           outline='white', width=2)
        
        # Draw city circle
        draw.ellipse([x - circle_radius, y - circle_radius,
                     x + circle_radius, y + circle_radius],
                    outline='black', fill='red', width=2)
        
        # Calculate font size based on population
        font_size = int(12 + (pop_ratio * 12))  # 12-24 pixels
        try:
            font = ImageFont.truetype(font_path, font_size)
        except:
            font = base_font
            
        # Draw city name with outline
        text = city["name"]
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        text_x = x - text_width // 2
        text_y = y - text_height - circle_radius - 5
        
        # Draw text outline
        outline_color = 'white'
        for offset_x in range(-2, 3):
            for offset_y in range(-2, 3):
                draw.text((text_x + offset_x, text_y + offset_y),
                         text, font=font, fill=outline_color)
        
        # Draw text
        draw.text((text_x, text_y), text, font=font, fill='black')

def create_elevation_image(points, width=2000, height=2000):
    """Create an elevation image from points"""
    # Create empty grid
    grid = np.zeros((height, width), dtype=np.float32)
    counts = np.zeros((height, width), dtype=np.int32)
    
    # Find elevation range
    elevations = [p[2] for p in points]
    min_elev = min(elevations)
    max_elev = max(elevations)
    
    # Convert points to grid coordinates
    for lat, lon, elev in points:
        x = int((lon - NM_BOUNDS['minLon']) / (NM_BOUNDS['maxLon'] - NM_BOUNDS['minLon']) * (width - 1))
        y = int((NM_BOUNDS['maxLat'] - lat) / (NM_BOUNDS['maxLat'] - NM_BOUNDS['minLat']) * (height - 1))
        if 0 <= x < width and 0 <= y < height:
            grid[y, x] += elev
            counts[y, x] += 1
    
    # Average points in same cell
    mask = counts > 0
    grid[mask] /= counts[mask]
    
    # Fill empty cells using nearest neighbor interpolation
    from scipy.ndimage import distance_transform_edt
    mask = counts == 0
    if mask.any():
        # Get coordinates of valid points
        valid_points = np.argwhere(~mask)
        # Get coordinates of points to fill
        points_to_fill = np.argwhere(mask)
        # Find nearest valid point for each point to fill
        from scipy.spatial import cKDTree
        tree = cKDTree(valid_points)
        distances, indices = tree.query(points_to_fill)
        # Fill with values from nearest valid points
        grid[points_to_fill[:, 0], points_to_fill[:, 1]] = grid[valid_points[indices, 0], valid_points[indices, 1]]
    
    # Normalize to 0-1 range
    grid = (grid - min_elev) / (max_elev - min_elev)
    
    # Create blue to yellow colormap
    def create_colormap(val):
        # Blue (0, 0, 255) to Yellow (255, 255, 0)
        r = int(val * 255)
        g = int(val * 255)
        b = int(255 * (1 - val))
        return (r, g, b)
    
    # Create RGB image
    rgb_image = np.zeros((height, width, 3), dtype=np.uint8)
    for y in range(height):
        for x in range(width):
            rgb_image[y, x] = create_colormap(grid[y, x])
    
    # Convert to PIL Image
    image = Image.fromarray(rgb_image)
    draw = ImageDraw.Draw(image)
    
    # Draw New Mexico border with thicker lines
    draw_border(draw, NM_BOUNDS, width, height, color='white', outline_width=6)
    
    # Add city markers and labels
    add_city_markers(image, width, height)
    
    # Save image
    os.makedirs('public/images', exist_ok=True)
    image.save('public/images/elevation.jpg', quality=95)
    print(f"Created elevation image with {len(points):,} points")
    print(f"Elevation range: {min_elev:.1f}m to {max_elev:.1f}m")
    print("Added markers for top 10 New Mexico cities")
    print(f"Added state border outline using {len(NM_BORDER_POINTS)} points")

if __name__ == '__main__':
    points = get_elevation_data()
    create_elevation_image(points) 