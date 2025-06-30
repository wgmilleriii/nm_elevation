
next steps will be this: the q that will be created from the web user interface will work like this first got your location second get your heading third cast a " " net out into your viewing area to do this imagine this a series of concentric circles emanating from your current location you are looking only at a quarter of the full circle though this is your viewing area your q is going to consist of data points that are initially a tenth of a mile a quarter of a mile a half a mile one mile two miles five miles 10 miles 20 miles 50 miles and 100 miles those are the radiuses of data points that we need to gather longitude latitude and elevation for after they are gathered use the ridge detection to look for interesting changes and then focus on sending data up to the web interface so that it draws a horizon gradually the horizon and the layout of each one of the concentric circles and the data gathering priorities should be figured out by looking at the vantage point of the user and collecting only visible data for example if the user is only a half a mile away from a sharp mountain he really can't see anything on the other side of that mountain so don't bother collecting data for that however if in your initial wide casting of the net there are only few changes in elevation throughout then you need to begin looking for where of the smaller changes in elevation and the perspective of the user may then be standing on top of a mountain looking out over a very large flat space and the next mountain range might be 50 miles away

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