import sqlite3
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import math
from nm_border import draw_border, NM_BORDER_POINTS
import glob

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
    {"name": "Carlsbad", "lat": 32.4207, "lon": -104.2288, "population": 32238},
    {"name": "Taos", "lat": 36.4072, "lon": -105.5734, "population": 5716}
]

def get_elevation_data():
    """Fetch all elevation data from the grid of databases"""
    all_points = []
    
    # Get all database files in the grid_databases directory
    db_files = glob.glob('grid_databases/mountains_*.db')
    
    for db_file in db_files:
        try:
            conn = sqlite3.connect(db_file)
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
            all_points.extend(points)
            conn.close()
            
        except sqlite3.Error as e:
            print(f"Error reading {db_file}: {e}")
            continue
    
    print(f"Read elevation data from {len(db_files)} databases")
    return all_points

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

def create_colormap_rainbow(val):
    # Map val in [0,1] to ROPGBIV (Red, Orange, Purple, Green, Blue, Indigo, Violet)
    # We'll use matplotlib's rainbow colormap for accuracy if available, otherwise a manual mapping
    try:
        import matplotlib.pyplot as plt
        cmap = plt.get_cmap('rainbow')
        r, g, b, _ = [int(255*x) for x in cmap(val)]
        return (r, g, b)
    except ImportError:
        # Manual mapping for 7 segments
        if val < 1/6:
            # Red to Orange
            ratio = val / (1/6)
            return (255, int(127+128*ratio), 0)
        elif val < 2/6:
            # Orange to Yellow
            ratio = (val-1/6)/(1/6)
            return (255, 255, int(255*ratio))
        elif val < 3/6:
            # Yellow to Green
            ratio = (val-2/6)/(1/6)
            return (int(255*(1-ratio)), 255, 0)
        elif val < 4/6:
            # Green to Blue
            ratio = (val-3/6)/(1/6)
            return (0, int(255*(1-ratio)), int(255*ratio))
        elif val < 5/6:
            # Blue to Indigo
            ratio = (val-4/6)/(1/6)
            return (int(75*ratio), 0, 255)
        else:
            # Indigo to Violet
            ratio = (val-5/6)/(1/6)
            return (int(75+180*ratio), 0, int(255*(1-ratio)+130*ratio))

def create_rainbow_image(grid, width, height):
    """Create rainbow image using vectorized operations"""
    try:
        import matplotlib.pyplot as plt
        # Use matplotlib's rainbow colormap for faster processing
        cmap = plt.get_cmap('rainbow')
        # Reshape grid to 1D array
        grid_flat = grid.reshape(-1)
        # Get colors for all values at once
        colors = cmap(grid_flat)
        # Convert to RGB and reshape back to 2D
        rgb_image = (colors[:, :3] * 255).astype(np.uint8).reshape(height, width, 3)
        return Image.fromarray(rgb_image)
    except ImportError:
        # Fallback to manual mapping if matplotlib is not available
        rgb_image = np.zeros((height, width, 3), dtype=np.uint8)
        # Vectorize the color mapping
        for y in range(height):
            if y % 100 == 0:
                print(f"Rainbow image progress: {y}/{height} ({(y/height*100):.1f}%)")
            row = grid[y]
            # Create masks for each color segment
            mask1 = row < 1/6
            mask2 = (row >= 1/6) & (row < 2/6)
            mask3 = (row >= 2/6) & (row < 3/6)
            mask4 = (row >= 3/6) & (row < 4/6)
            mask5 = (row >= 4/6) & (row < 5/6)
            mask6 = row >= 5/6
            
            # Apply colors for each segment
            rgb_image[y, mask1] = [255, (127 + 128 * (row[mask1] * 6)).astype(np.uint8), 0]
            rgb_image[y, mask2] = [255, 255, (255 * ((row[mask2] - 1/6) * 6)).astype(np.uint8)]
            rgb_image[y, mask3] = [(255 * (1 - (row[mask3] - 2/6) * 6)).astype(np.uint8), 255, 0]
            rgb_image[y, mask4] = [0, (255 * (1 - (row[mask4] - 3/6) * 6)).astype(np.uint8), (255 * ((row[mask4] - 3/6) * 6)).astype(np.uint8)]
            rgb_image[y, mask5] = [(75 * ((row[mask5] - 4/6) * 6)).astype(np.uint8), 0, 255]
            rgb_image[y, mask6] = [(75 + 180 * ((row[mask6] - 5/6) * 6)).astype(np.uint8), 0, (255 * (1 - (row[mask6] - 5/6) * 6) + 130 * ((row[mask6] - 5/6) * 6)).astype(np.uint8)]
        
        return Image.fromarray(rgb_image)

def create_elevation_legend(image, min_elev, max_elev, width=2000, height=2000):
    """Create an elegant elevation legend"""
    draw = ImageDraw.Draw(image)
    
    # Legend dimensions and position
    legend_height = 100
    legend_width = 400
    legend_x = width - legend_width - 50  # 50px from right edge
    legend_y = height - legend_height - 50  # 50px from bottom
    
    # Create gradient bar
    for i in range(legend_width):
        # Calculate normalized position (0 to 1)
        pos = i / legend_width
        # Get color for this position
        if isinstance(image, Image.Image) and image.mode == 'RGB':
            # For blue-yellow image
            r = int(pos * 255)
            g = int(pos * 255)
            b = int(255 * (1 - pos))
        else:
            # For rainbow image
            try:
                import matplotlib.pyplot as plt
                cmap = plt.get_cmap('rainbow')
                r, g, b, _ = [int(255*x) for x in cmap(pos)]
            except ImportError:
                # Fallback to manual rainbow mapping
                if pos < 1/6:
                    r, g, b = 255, int(127+128*pos*6), 0
                elif pos < 2/6:
                    r, g, b = 255, 255, int(255*(pos-1/6)*6)
                elif pos < 3/6:
                    r, g, b = int(255*(1-(pos-2/6)*6)), 255, 0
                elif pos < 4/6:
                    r, g, b = 0, int(255*(1-(pos-3/6)*6)), int(255*(pos-3/6)*6)
                elif pos < 5/6:
                    r, g, b = int(75*(pos-4/6)*6), 0, 255
                else:
                    r, g, b = int(75+180*(pos-5/6)*6), 0, int(255*(1-(pos-5/6)*6)+130*(pos-5/6)*6)
        
        # Draw vertical line of this color
        for y in range(legend_height):
            draw.point((legend_x + i, legend_y + y), fill=(r, g, b))
    
    # Add border around legend
    draw.rectangle([legend_x-2, legend_y-2, legend_x+legend_width+2, legend_y+legend_height+2], 
                  outline='black', width=2)
    
    # Add elevation values
    try:
        font_path = "/System/Library/Fonts/Helvetica.ttc"  # Mac OS path
        if not os.path.exists(font_path):
            font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"  # Linux path
        if not os.path.exists(font_path):
            font_path = "C:\\Windows\\Fonts\\Arial.ttf"  # Windows path
        font = ImageFont.truetype(font_path, 20)
    except:
        font = ImageFont.load_default()
    
    # Add min and max elevation values
    min_text = f"{min_elev:.0f}m"
    max_text = f"{max_elev:.0f}m"
    
    # Draw text with white outline for better visibility
    for offset_x in range(-1, 2):
        for offset_y in range(-1, 2):
            draw.text((legend_x + offset_x, legend_y + legend_height + 5 + offset_y), 
                     min_text, font=font, fill='white')
            draw.text((legend_x + legend_width - 50 + offset_x, legend_y + legend_height + 5 + offset_y), 
                     max_text, font=font, fill='white')
    
    # Draw text
    draw.text((legend_x, legend_y + legend_height + 5), min_text, font=font, fill='black')
    draw.text((legend_x + legend_width - 50, legend_y + legend_height + 5), max_text, font=font, fill='black')
    
    # Add title
    title = "Elevation"
    title_bbox = draw.textbbox((0, 0), title, font=font)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = legend_x + (legend_width - title_width) // 2
    
    # Draw title with white outline
    for offset_x in range(-1, 2):
        for offset_y in range(-1, 2):
            draw.text((title_x + offset_x, legend_y - 25 + offset_y), 
                     title, font=font, fill='white')
    
    # Draw title
    draw.text((title_x, legend_y - 25), title, font=font, fill='black')

def create_elevation_image(points, width=2000, height=2000):
    """Create an elevation image from points"""
    print("Starting elevation image creation...")
    total_steps = 4  # Total number of major steps
    current_step = 0
    
    # Create empty grid
    grid = np.zeros((height, width), dtype=np.float32)
    counts = np.zeros((height, width), dtype=np.int32)
    
    # Find elevation range
    current_step += 1
    print(f"Step {current_step}/{total_steps}: Processing elevation data...")
    elevations = [p[2] for p in points]
    min_elev = min(elevations)
    max_elev = max(elevations)
    
    # Convert points to grid coordinates
    print(f"Step {current_step}/{total_steps}: Converting points to grid...")
    total_points = len(points)
    for i, (lat, lon, elev) in enumerate(points):
        if i % 10000 == 0:  # Show progress every 10,000 points
            print(f"Processing points: {i}/{total_points} ({(i/total_points*100):.1f}%)")
        x = int((lon - NM_BOUNDS['minLon']) / (NM_BOUNDS['maxLon'] - NM_BOUNDS['minLon']) * (width - 1))
        y = int((NM_BOUNDS['maxLat'] - lat) / (NM_BOUNDS['maxLat'] - NM_BOUNDS['minLat']) * (height - 1))
        if 0 <= x < width and 0 <= y < height:
            grid[y, x] += elev
            counts[y, x] += 1
    
    # Average points in same cell
    mask = counts > 0
    grid[mask] /= counts[mask]
    
    # Fill empty cells using nearest neighbor interpolation
    current_step += 1
    print(f"\nStep {current_step}/{total_steps}: Starting interpolation...")
    from scipy.ndimage import distance_transform_edt
    mask = counts == 0
    if mask.any():
        # Get coordinates of valid points
        valid_points = np.argwhere(~mask)
        # Get coordinates of points to fill
        points_to_fill = np.argwhere(mask)
        total_to_fill = len(points_to_fill)
        print(f"Filling {total_to_fill} empty cells...")
        
        # Find nearest valid point for each point to fill
        from scipy.spatial import cKDTree
        tree = cKDTree(valid_points)
        batch_size = 10000  # Process in batches
        for i in range(0, total_to_fill, batch_size):
            end_idx = min(i + batch_size, total_to_fill)
            distances, indices = tree.query(points_to_fill[i:end_idx])
            grid[points_to_fill[i:end_idx, 0], points_to_fill[i:end_idx, 1]] = grid[valid_points[indices, 0], valid_points[indices, 1]]
            print(f"Interpolation progress: {end_idx}/{total_to_fill} ({(end_idx/total_to_fill*100):.1f}%)")
    
    # Normalize to 0-1 range
    grid = (grid - min_elev) / (max_elev - min_elev)
    
    # Create blue to yellow colormap
    def create_colormap(val):
        # Blue (0, 0, 255) to Yellow (255, 255, 0)
        r = int(val * 255)
        g = int(val * 255)
        b = int(255 * (1 - val))
        return (r, g, b)
    
    # Create RGB images
    current_step += 1
    print(f"\nStep {current_step}/{total_steps}: Creating blue-yellow image...")
    rgb_image = np.zeros((height, width, 3), dtype=np.uint8)
    for y in range(height):
        if y % 100 == 0:  # Show progress every 100 rows
            print(f"Blue-yellow image progress: {y}/{height} ({(y/height*100):.1f}%)")
        for x in range(width):
            rgb_image[y, x] = create_colormap(grid[y, x])
    
    # Convert to PIL Image
    image = Image.fromarray(rgb_image)
    draw = ImageDraw.Draw(image)
    
    # Add city markers and labels
    add_city_markers(image, width, height)
    
    # Add elevation legend
    create_elevation_legend(image, min_elev, max_elev, width, height)
    
    # Save blue-yellow image
    os.makedirs('public/images', exist_ok=True)
    image.save('public/images/elevation.jpg', quality=95)
    print(f"Created elevation image with {len(points):,} points")
    print(f"Elevation range: {min_elev:.1f}m to {max_elev:.1f}m")
    print("Added markers for top 10 New Mexico cities")

    # Create rainbow image
    current_step += 1
    print(f"\nStep {current_step}/{total_steps}: Creating rainbow image...")
    image_rainbow = create_rainbow_image(grid, width, height)
    draw_rainbow = ImageDraw.Draw(image_rainbow)
    add_city_markers(image_rainbow, width, height)
    
    # Add elevation legend to rainbow image
    create_elevation_legend(image_rainbow, min_elev, max_elev, width, height)
    
    image_rainbow.save('public/images/elevation_rainbow.jpg', quality=95)
    print("Created rainbow elevation image as public/images/elevation_rainbow.jpg")
    print("\nAll steps completed successfully!")

if __name__ == '__main__':
    points = get_elevation_data()
    create_elevation_image(points) 