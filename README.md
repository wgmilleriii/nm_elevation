# New Mexico Elevation Visualization

## Next Steps: Intelligent Horizon Drawing System

The system now focuses on creating **visually interesting horizon drawings** rather than overwhelming users with raw data. When a user casts their viewing net, the backend intelligently manages data collection while returning curated, artistic horizon representations.

### Core Philosophy: Quality Over Quantity
- **Smart Data Management**: Collect comprehensive elevation data in the background
- **Curated Visualization**: Return 10-20 interesting jagged lines that represent the horizon
- **Local Data Integration**: Leverage existing cached elevation data in the user's viewable area
- **Artistic Rendering**: Focus on visual appeal rather than raw data density

### Phase 1: Intelligent Data Curation
1. **Queue Management**: Add viewing area points to collection queue
2. **Local Data Mining**: Search existing elevation cache for relevant points
3. **Interest Detection**: Identify visually interesting terrain features (peaks, valleys, ridges)
4. **Line Simplification**: Reduce thousands of data points to 10-20 meaningful horizon lines

### Phase 2: Artistic Horizon Rendering
Create compelling visual representations using:
- **Jagged Horizon Lines**: 10-20 lines showing terrain silhouette
- **Multiple Shading Options**: Different visual styles for various conditions
- **SVG Templates**: Clean, scalable vector graphics
- **Python Alternatives**: Server-side rendering options

### Phase 3: Static Template Examples
Before implementing dynamic generation, create static templates showing:
- **Mountain Silhouettes**: Sharp peaks with varying heights
- **Rolling Hills**: Gentle, undulating terrain
- **Mixed Terrain**: Combination of peaks and valleys
- **Distance Layering**: Multiple horizon layers with depth

### Implementation Strategy
- **Frontend**: Enhanced `HorizonRenderer` with artistic line generation
- **Backend**: Intelligent data curation and line simplification algorithms
- **Templates**: Static examples demonstrating visual concepts
- **Integration**: Seamless blend of data collection and artistic rendering

---

## Static Template Development

### Template Goals
Create example horizon drawings that demonstrate:
1. **Visual Interest**: Compelling, non-overwhelming representations
2. **Technical Feasibility**: Achievable with current data and algorithms
3. **Multiple Styles**: Different shading and rendering approaches
4. **Scalability**: Templates that work across different viewing scenarios

### Template Types
1. **SVG/HTML Examples**: Client-side rendering with interactive elements
2. **Python Examples**: Server-side generation with advanced processing
3. **Hybrid Approaches**: Combination of both technologies

---

## Current Features

1. **Dynamic Viewing Area System** ✅
   - Concentric circle calculation (0.1-100 miles)
   - Real-time horizon updates with GPS position changes
   - Backend API integration for elevation data collection
   - Progressive horizon rendering with SVG visualization

2. **Static Elevation Image**
   - High-resolution (2000x2000) elevation visualization
   - Blue to yellow color gradient (blue = low elevation, yellow = high elevation)
   - Generated from 373,000+ elevation points
   - Interpolated to fill gaps using nearest neighbor algorithm

3. **Interactive Map**
   - OpenStreetMap base layer
   - 24x24 grid overlay showing elevation data
   - Rectangle selection tool for detailed area analysis

4. **Live GPS Tracking**
   - Real-time location and heading tracking
   - Session management with global numbering
   - Elevation data processing queue
   - Available at: https://hanon.artsmetrics.net/elevation/gps_live.html

5. **SVG2 View**
   - Shows selected area points in detail
   - Interactive tooltips with elevation data
   - Hover effects for better visualization

## Technical Details

- Python script (`generate_elevation_image.py`) creates the static elevation image
- Web interface (`face.html`) provides interactive visualization
- Canvas-based selection tool for area analysis
- SQLite database stores elevation points
- Node.js backend with queue processing system
- PHP remote server for GPS data collection
- **ViewingArea class** (`public/js/viewing-area.js`) - Concentric viewing area calculation
- **HorizonRenderer class** (`public/js/horizon-renderer.js`) - Progressive horizon visualization

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

### Node.js
- node-fetch
- better-sqlite3
- Express.js

## Usage

1. **Generate elevation image**:
   ```bash
   python3 generate_elevation_image.py
   ```

2. **Start development server**:
   ```bash
   ./local_server.sh
   ```

3. **Access live GPS tracking**:
   - Desktop: Open `face.html` in browser
   - Mobile: Navigate to server IP on port 8020

4. **Test horizon system**:
   - Access `horizon-demo.html` for standalone testing
   - Use 🏔️ Horizon button in GPS live tracker

5. **Start elevation processing**:
   ```bash
   REMOTE_SERVER_URL=https://hanon.artsmetrics.net/elevation node deploy_remote.js
   ```

## Data Range

- Latitude: 31.20°N to 37.20°N
- Longitude: 109.20°W to 102.80°W
- Elevation: 746.0m to 3,932.0m 