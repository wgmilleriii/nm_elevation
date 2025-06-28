# New Mexico Elevation Visualization

This project visualizes elevation data for New Mexico using a combination of static images and interactive maps.

## Features

1. Static Elevation Image
   - High-resolution (2000x2000) elevation visualization
   - Blue to yellow color gradient (blue = low elevation, yellow = high elevation)
   - Generated from 373,000+ elevation points
   - Interpolated to fill gaps using nearest neighbor algorithm

2. Interactive Map
   - OpenStreetMap base layer
   - 24x24 grid overlay showing elevation data
   - Rectangle selection tool for detailed area analysis

3. SVG2 View
   - Shows selected area points in detail
   - Interactive tooltips with elevation data
   - Hover effects for better visualization

## Technical Details

- Python script (`generate_elevation_image.py`) creates the static elevation image
- Web interface (`face.html`) provides interactive visualization
- Canvas-based selection tool for area analysis
- SQLite database stores elevation points

## Dependencies

### Python
- NumPy
- Pillow (PIL)
- SciPy (for interpolation)
- SQLite3

### Web
- Leaflet.js for mapping
- HTML5 Canvas for selection
- Modern browser with JavaScript enabled

## Usage

1. Generate elevation image:
   ```bash
   python3 generate_elevation_image.py
   ```

2. Open `face.html` in a web browser
3. Use the rectangle selection tool on the elevation image to analyze specific areas
4. View detailed elevation data in the map and SVG2 view

## Data Range

- Latitude: 31.20°N to 37.20°N
- Longitude: 109.20°W to 102.80°W
- Elevation: 746.0m to 3,932.0m 