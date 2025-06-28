# Photo Verification System

A comprehensive system for validating elevation data by analyzing mountain photographs and generating terrain background images.

## 🎯 Features

### 📸 Photo Analysis
- **EXIF Data Extraction**: Automatically extracts GPS coordinates and camera direction from photos
- **Ridge Detection**: 10 different algorithms for separating mountains from sky
- **Manual Point Selection**: Interactive GUI for selecting ridge points
- **3D Projection**: Maps 2D photo coordinates to 3D terrain data

### 🏔️ Terrain Background Generation
- **Coordinate Input**: Enter lat/lon in format `[lat], [lon]` and facing direction 1-360° (360° = North)
- **Database Query**: Searches elevation databases for terrain data
- **Line-of-Sight Analysis**: Returns only visible ridge points (not hidden behind other mountains)
- **Top 100 Points**: Identifies the closest visible ridge points along the horizon

### 🖼️ Background Images
- **Realistic Terrain**: Generated from real elevation data
- **Multiple Directions**: Support for any facing direction
- **Visual Overlays**: Compass direction, coordinates, and ridge statistics
- **High Quality**: Saved as JPEG images with detailed metadata

## 🚀 Quick Start

### Command Line Interface
```bash
# Basic usage - enter coordinates and direction
python src/ridge_cli.py '32.9609357, -107.3267788' 45

# Interactive mode
python src/ridge_cli.py
```

### Background Image Generation
```bash
# Generate background for specific location and direction
python src/generate_background_images.py --lat 32.9609357 --lon -107.3267788 --direction 45

# Generate multiple backgrounds for photo verification site
python src/generate_background_images.py
```

### Web Interface
Open `ridge_viewer.html` in your browser for a visual interface with:
- Coordinate input with validation
- Direction selection dropdown
- Quick preset locations
- Gallery of generated images
- Interactive controls

## 📊 Example Results

### Northeast Direction (45°)
- **Location**: 32.9609°N, -107.3268°W
- **Visible Ridges**: 30 peaks
- **Distance Range**: 3.90 - 49.35 km
- **Elevation Range**: 1279 - 1728 m
- **Highest Peak**: 1728m at 12.24km (67.0° bearing)

### East Direction (90°)
- **Location**: 32.9609°N, -107.3268°W  
- **Visible Ridges**: 26 peaks
- **Distance Range**: 3.90 - 49.50 km
- **Elevation Range**: 1279 - 2089 m
- **Highest Peak**: 2089m at 9.23km (83.0° bearing)

## 🛠️ Technical Implementation

### Ridge Analysis Algorithm
1. **Terrain Data Collection**: Query elevation databases within 50km radius
2. **Field of View Filtering**: Select points within 60° FOV of facing direction
3. **Line-of-Sight Calculation**: Use viewing angles to determine visibility
4. **Ridge Prioritization**: Sort by viewing angle (highest ridges first)
5. **Top Selection**: Return up to 100 closest visible points

### Background Image Generation
1. **Coordinate Conversion**: Transform lat/lon to local coordinate system
2. **Terrain Mapping**: Create 3D terrain model from elevation data
3. **Visibility Analysis**: Calculate which points are visible from observer position
4. **Image Rendering**: Generate realistic mountain silhouettes with sky gradient
5. **Metadata Overlay**: Add compass direction, coordinates, and statistics

## 📁 File Structure

```
photo_verification/
├── src/
│   ├── ridge_cli.py                    # Command-line interface
│   ├── generate_background_images.py   # Background image generator
│   ├── ridge_viewer_app.py            # Streamlit web app
│   ├── ridge_3d_viewer.py             # 3D visualization
│   └── interactive_3d_viewer.py       # Enhanced 3D viewer
├── data/
│   ├── images/                        # Generated background images
│   ├── selected_ridge_points.txt      # Manual ridge selections
│   └── ridge_points_*.txt            # Generated ridge analysis files
├── ridge_viewer.html                  # Web interface
└── README.md                         # This file
```

## 🎮 Usage Examples

### 1. Photo Verification Site Analysis
```bash
python src/ridge_cli.py '32.9609357, -107.3267788' 45
```
**Output**: 30 visible ridge points facing northeast, with detailed statistics

### 2. Generate Background for Any Location
```bash
python src/ridge_cli.py '35.0844, -106.6504' 90  # Albuquerque facing east
```

### 3. Interactive Analysis
```bash
python src/ridge_cli.py
# Follow prompts to enter coordinates and direction
```

### 4. Batch Generation
```bash
python src/generate_background_images.py
# Generates backgrounds for all 4 cardinal directions
```

## 🔧 Requirements

- Python 3.8+
- SQLite databases with elevation data
- PIL (Python Imaging Library)
- NumPy
- Matplotlib (optional, for enhanced visualizations)

## 📈 Performance

- **Database Query**: ~1-2 seconds for 50km radius
- **Ridge Analysis**: ~0.5 seconds for 100 points
- **Background Generation**: ~3-5 seconds per image
- **Memory Usage**: ~50MB for typical analysis

## 🎯 Key Insights

1. **3D Projection Complexity**: 2D photos compress 3D terrain depth, making direct comparison challenging
2. **Line-of-Sight Critical**: Many high peaks are hidden behind closer ridges
3. **Direction Matters**: Different facing directions reveal completely different ridge profiles
4. **Distance vs Elevation**: Closer ridges often appear more prominent than distant high peaks

## 🚀 Future Enhancements

- [ ] Real-time web API for background generation
- [ ] Integration with photo overlay system
- [ ] Advanced 3D visualization with rotation controls
- [ ] Batch processing for multiple locations
- [ ] Export to various image formats
- [ ] Integration with mapping services

## 📝 Notes

- Coordinates must be in decimal degrees format
- Direction range: 1-360° (360° = North)
- Database coverage: New Mexico region
- Generated images: 1600x1200 pixels
- Ridge analysis: Up to 100 visible points per direction 