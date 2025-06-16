import sqlite3
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import random
import os
import glob
import math
from scipy.ndimage import gaussian_filter

# Constants for the Sandia Mountains area
SANDIA_BOUNDS = {
    'minLat': 35.0,
    'maxLat': 35.3,
    'minLon': -106.6,
    'maxLon': -106.3
}

def get_elevation_data():
    """Fetch elevation data from the sandia_detail database"""
    try:
        conn = sqlite3.connect('sandia_detail.db')
        cursor = conn.cursor()
        cursor.execute("""
            SELECT latitude, longitude, elevation
            FROM elevation_points
            WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
            AND elevation IS NOT NULL
        """, [SANDIA_BOUNDS['minLat'], SANDIA_BOUNDS['maxLat'],
             SANDIA_BOUNDS['minLon'], SANDIA_BOUNDS['maxLon']])
        points = cursor.fetchall()
        conn.close()
        
        if not points:
            print("No elevation points found in the database!")
            return []
            
        print(f"Successfully loaded {len(points):,} points from sandia_detail.db")
        return points
        
    except Exception as e:
        print(f"Error reading sandia_detail.db: {e}")
        return []

def create_dreamscape(elevation_points, output_path):
    """Creates a surreal, layered visualization of the mountain."""
    print("Creating Dreamscape visualization...")
    img = Image.new('RGB', (3000, 2000), 'black')
    draw = ImageDraw.Draw(img)
    
    # Group points by elevation bands (every 100m)
    elevation_bands = {}
    min_elev = min(p[2] for p in elevation_points)
    max_elev = max(p[2] for p in elevation_points)
    
    for point in elevation_points:
        band = int((point[2] - min_elev) / 100) * 100
        if band not in elevation_bands:
            elevation_bands[band] = []
        elevation_bands[band].append(point)
    
    # Create neon color palette
    colors = [
        (255, 0, 128),   # Hot pink
        (0, 255, 128),   # Neon green
        (128, 0, 255),   # Purple
        (255, 128, 0),   # Orange
        (0, 128, 255),   # Blue
        (255, 255, 0)    # Yellow
    ]
    
    # Draw each elevation band
    for i, (band, points) in enumerate(sorted(elevation_bands.items())):
        color = colors[i % len(colors)]
        # Create layer for this band
        layer = Image.new('RGBA', (3000, 2000), (0, 0, 0, 0))
        layer_draw = ImageDraw.Draw(layer)
        
        for point in points:
            x = int((point[1] - SANDIA_BOUNDS['minLon']) / 
                   (SANDIA_BOUNDS['maxLon'] - SANDIA_BOUNDS['minLon']) * 3000)
            y = int((SANDIA_BOUNDS['maxLat'] - point[0]) / 
                   (SANDIA_BOUNDS['maxLat'] - SANDIA_BOUNDS['minLat']) * 2000)
            
            # Draw glowing point
            glow_radius = 5
            for r in range(glow_radius, 0, -1):
                opacity = int(255 * (r / glow_radius))
                layer_draw.ellipse([x-r, y-r, x+r, y+r], 
                                 fill=(*color, opacity))
        
        # Apply gaussian blur to the layer
        layer = layer.filter(ImageFilter.GaussianBlur(radius=2))
        img = Image.alpha_composite(img.convert('RGBA'), layer)
    
    # Final touch: add some stars in the background
    for _ in range(1000):
        x = random.randint(0, 2999)
        y = random.randint(0, 1999)
        brightness = random.randint(150, 255)
        draw.point([x, y], fill=(brightness, brightness, brightness))
    
    img.save(output_path, quality=95)
    print(f"Dreamscape saved as {output_path}")

def create_fingerprint(elevation_points, output_path):
    """Creates a unique 'fingerprint' of the mountain using contour lines."""
    print("Creating Fingerprint visualization...")
    img = Image.new('RGB', (4000, 4000), 'black')
    draw = ImageDraw.Draw(img, 'RGBA')
    
    # Convert points to numpy array for faster processing
    points = np.array(elevation_points)
    elevations = points[:, 2]
    min_elev = np.min(elevations)
    max_elev = np.max(elevations)
    
    # Increase number of contour lines for smoother elevation transitions
    num_contours = 50
    
    # Create a regular grid for interpolation
    grid_size = 200  # Increased for better resolution
    lat_grid = np.linspace(SANDIA_BOUNDS['minLat'], SANDIA_BOUNDS['maxLat'], grid_size)
    lon_grid = np.linspace(SANDIA_BOUNDS['minLon'], SANDIA_BOUNDS['maxLon'], grid_size)
    lon_mesh, lat_mesh = np.meshgrid(lon_grid, lat_grid)
    
    # Create elevation grid using gaussian filter for smoothing
    elevation_grid = np.zeros((grid_size, grid_size))
    for p in points:
        i = int((p[0] - SANDIA_BOUNDS['minLat']) / (SANDIA_BOUNDS['maxLat'] - SANDIA_BOUNDS['minLat']) * (grid_size - 1))
        j = int((p[1] - SANDIA_BOUNDS['minLon']) / (SANDIA_BOUNDS['maxLon'] - SANDIA_BOUNDS['minLon']) * (grid_size - 1))
        if 0 <= i < grid_size and 0 <= j < grid_size:
            elevation_grid[i, j] = p[2]
    
    # Apply Gaussian smoothing to the elevation grid
    elevation_grid = gaussian_filter(elevation_grid, sigma=1.0)
    
    # Generate contour lines
    for elevation in np.linspace(min_elev, max_elev, num_contours):
        # Create contour mask
        contour_mask = np.abs(elevation_grid - elevation) < (max_elev - min_elev) / (num_contours * 2)
        
        # Find contour points
        contour_points = []
        for i in range(grid_size):
            for j in range(grid_size):
                if contour_mask[i, j]:
                    contour_points.append([lat_grid[i], lon_grid[j]])
        
        if len(contour_points) < 2:
            continue
        
        # Convert to numpy array
        contour_points = np.array(contour_points)
        
        # Sort points by longitude for consistent line direction
        sorted_indices = np.argsort(contour_points[:, 1])
        sorted_points = contour_points[sorted_indices]
        
        # Smooth the line using a moving average
        window_size = 5
        smoothed_points = []
        for i in range(len(sorted_points) - window_size + 1):
            window = sorted_points[i:i + window_size]
            smoothed_points.append(np.mean(window, axis=0))
        
        if len(smoothed_points) < 2:
            continue
            
        smoothed_points = np.array(smoothed_points)
        
        # Calculate normalized elevation for styling
        normalized_elev = (elevation - min_elev) / (max_elev - min_elev)
        
        # Create golden color with varying brightness and opacity
        gold_brightness = int(128 + normalized_elev * 127)
        base_opacity = int(50 + normalized_elev * 205)  # More variation in opacity
        color = (gold_brightness, int(gold_brightness * 0.85), 0, base_opacity)
        
        # Draw smooth lines with varying thickness
        thickness = int(1 + normalized_elev * 3)  # Reduced maximum thickness
        
        # Draw the contour line with anti-aliasing effect
        for i in range(len(smoothed_points) - 1):
            p1 = smoothed_points[i]
            p2 = smoothed_points[i + 1]
            
            # Only connect points if they're not too far apart
            if np.sqrt(((p1 - p2)**2).sum()) < 0.02:  # Reduced maximum distance
                # Convert to screen coordinates
                x1 = int((p1[1] - SANDIA_BOUNDS['minLon']) / 
                        (SANDIA_BOUNDS['maxLon'] - SANDIA_BOUNDS['minLon']) * 4000)
                y1 = int((SANDIA_BOUNDS['maxLat'] - p1[0]) / 
                        (SANDIA_BOUNDS['maxLat'] - SANDIA_BOUNDS['minLat']) * 4000)
                x2 = int((p2[1] - SANDIA_BOUNDS['minLon']) / 
                        (SANDIA_BOUNDS['maxLon'] - SANDIA_BOUNDS['minLon']) * 4000)
                y2 = int((SANDIA_BOUNDS['maxLat'] - p2[0]) / 
                        (SANDIA_BOUNDS['maxLat'] - SANDIA_BOUNDS['minLat']) * 4000)
                
                # Draw multiple lines with slightly different thicknesses for anti-aliasing
                for offset in range(thickness + 1):
                    current_opacity = int(base_opacity * (1 - offset/thickness))
                    current_color = (*color[:3], current_opacity)
                    draw.line([x1, y1, x2, y2], fill=current_color, width=thickness-offset)
    
    # Apply final gaussian blur for extra smoothing
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    
    img.save(output_path, quality=95)
    print(f"Fingerprint saved as {output_path}")

def create_watercolor(elevation_points, output_path):
    """Creates a watercolor-style rendering of the mountain."""
    print("Creating Watercolor visualization...")
    img = Image.new('RGB', (3000, 2000), 'white')
    draw = ImageDraw.Draw(img, 'RGBA')
    
    # Find elevation range
    elevations = [p[2] for p in elevation_points]
    min_elev = min(elevations)
    max_elev = max(elevations)
    
    # Create earthy watercolor palette
    colors = [
        (139, 69, 19),   # Brown
        (34, 139, 34),   # Forest green
        (169, 169, 169), # Gray
        (205, 133, 63),  # Peru
        (85, 107, 47)    # Dark olive green
    ]
    
    # Create multiple semi-transparent layers
    for layer in range(20):
        # Select random subset of points
        points_subset = random.sample(elevation_points, len(elevation_points)//10)
        
        for point in points_subset:
            normalized_elev = (point[2] - min_elev) / (max_elev - min_elev)
            color_idx = int(normalized_elev * (len(colors) - 1))
            base_color = colors[color_idx]
            
            # Add some random variation to the color
            color = tuple(min(255, max(0, c + random.randint(-20, 20))) for c in base_color)
            
            # Convert coordinates
            x = int((point[1] - SANDIA_BOUNDS['minLon']) / 
                   (SANDIA_BOUNDS['maxLon'] - SANDIA_BOUNDS['minLon']) * 3000)
            y = int((SANDIA_BOUNDS['maxLat'] - point[0]) / 
                   (SANDIA_BOUNDS['maxLat'] - SANDIA_BOUNDS['minLat']) * 2000)
            
            # Draw irregular shapes with varying sizes and opacity
            size = random.randint(5, 20)
            opacity = random.randint(20, 40)
            
            # Create irregular shape by drawing multiple overlapping circles
            for _ in range(3):
                offset_x = random.randint(-5, 5)
                offset_y = random.randint(-5, 5)
                draw.ellipse([x-size+offset_x, y-size+offset_y, 
                            x+size+offset_x, y+size+offset_y], 
                           fill=(*color, opacity))
    
    # Apply slight blur for watercolor effect
    img = img.filter(ImageFilter.GaussianBlur(radius=1))
    
    # Add some texture
    texture = Image.new('RGBA', (3000, 2000), (0, 0, 0, 0))
    texture_draw = ImageDraw.Draw(texture)
    
    for _ in range(5000):
        x = random.randint(0, 2999)
        y = random.randint(0, 1999)
        size = random.randint(1, 3)
        opacity = random.randint(5, 15)
        texture_draw.ellipse([x-size, y-size, x+size, y+size], 
                           fill=(255, 255, 255, opacity))
    
    img = Image.alpha_composite(img.convert('RGBA'), texture)
    img.save(output_path, quality=95)
    print(f"Watercolor saved as {output_path}")

def create_wind_map(elevation_points, output_path):
    """Creates a visualization that makes the mountain look like wind patterns."""
    print("Creating Wind Map visualization...")
    img = Image.new('RGB', (4000, 3000), 'black')
    draw = ImageDraw.Draw(img, 'RGBA')
    
    # Calculate slope vectors
    points = np.array(elevation_points)
    
    # Create a grid of points for smoother flow
    x = np.linspace(SANDIA_BOUNDS['minLon'], SANDIA_BOUNDS['maxLon'], 200)
    y = np.linspace(SANDIA_BOUNDS['minLat'], SANDIA_BOUNDS['maxLat'], 150)
    X, Y = np.meshgrid(x, y)
    
    # Calculate flow field
    flow_field = np.zeros((150, 200, 2))
    
    for i in range(len(points)-1):
        p1 = points[i]
        p2 = points[i+1]
        
        # Calculate slope
        elevation_diff = p2[2] - p1[2]
        distance = math.sqrt((p2[1]-p1[1])**2 + (p2[0]-p1[0])**2)
        if distance > 0:
            slope = elevation_diff/distance
            angle = math.atan2(p2[0]-p1[0], p2[1]-p1[1])
            
            # Convert to screen coordinates
            x1 = int((p1[1] - SANDIA_BOUNDS['minLon']) / 
                    (SANDIA_BOUNDS['maxLon'] - SANDIA_BOUNDS['minLon']) * 199)
            y1 = int((p1[0] - SANDIA_BOUNDS['minLat']) / 
                    (SANDIA_BOUNDS['maxLat'] - SANDIA_BOUNDS['minLat']) * 149)
            
            if 0 <= x1 < 200 and 0 <= y1 < 150:
                flow_field[y1, x1] += np.array([math.cos(angle), math.sin(angle)]) * slope
    
    # Normalize flow field
    max_magnitude = np.sqrt((flow_field**2).sum(axis=2)).max()
    flow_field /= max_magnitude
    
    # Draw flow lines
    for y in range(150):
        for x in range(200):
            if np.any(flow_field[y, x]):
                screen_x = int(x * 4000 / 200)
                screen_y = int(y * 3000 / 150)
                
                # Get flow direction and magnitude
                dx, dy = flow_field[y, x]
                magnitude = math.sqrt(dx**2 + dy**2)
                
                # Draw flow line
                line_length = int(magnitude * 30)
                end_x = screen_x + int(dx * line_length)
                end_y = screen_y + int(dy * line_length)
                
                # Color based on magnitude and direction
                hue = (math.atan2(dy, dx) + math.pi) / (2 * math.pi)
                intensity = int(magnitude * 255)
                
                # Create color with varying opacity
                color = (
                    int(intensity * (1 - hue)),
                    int(intensity * hue),
                    int(intensity * abs(0.5 - hue) * 2),
                    int(magnitude * 200)
                )
                
                draw.line([screen_x, screen_y, end_x, end_y], 
                         fill=color, width=1)
    
    # Apply motion blur effect
    img = img.filter(ImageFilter.GaussianBlur(radius=1))
    img = img.filter(ImageFilter.BLUR)
    
    img.save(output_path, quality=95)
    print(f"Wind Map saved as {output_path}")

def main():
    # Create output directory if it doesn't exist
    os.makedirs('artistic_renders', exist_ok=True)
    
    # Get elevation data
    print("Fetching elevation data...")
    elevation_points = get_elevation_data()
    
    if not elevation_points:
        print("No elevation data found!")
        return
    
    print(f"Processing {len(elevation_points)} elevation points...")
    
    # Create all four visualizations
    create_dreamscape(elevation_points, 'artistic_renders/dreamscape.png')
    create_fingerprint(elevation_points, 'artistic_renders/fingerprint.png')
    create_watercolor(elevation_points, 'artistic_renders/watercolor.png')
    create_wind_map(elevation_points, 'artistic_renders/wind_map.png')
    
    print("\nAll visualizations completed!")
    print("Output files are in the 'artistic_renders' directory:")
    print("- dreamscape.png")
    print("- fingerprint.png")
    print("- watercolor.png")
    print("- wind_map.png")

if __name__ == '__main__':
    main() 