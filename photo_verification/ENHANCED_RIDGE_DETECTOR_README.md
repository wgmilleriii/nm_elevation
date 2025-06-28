# Enhanced Ridge Point Detector

An advanced GUI tool for selecting ridge points in landscape photographs with intelligent file management and GPS metadata editing capabilities.

## Features

### 🏔️ **Smart File Management**
- **Import Any Image**: Browse to any JPG/PNG file - automatically copies to data folder with proper naming
- **Data Folder Integration**: Browse to existing images in data folder - loads existing ridge point data
- **Auto-Create Data Files**: Automatically creates JSON data files for new images
- **Unique Naming**: Prevents filename conflicts with automatic numbering (e.g., `image_001.jpg`)

### 📍 **GPS & Direction Editing**
- **Interactive GPS Editor**: Dedicated dialog for editing GPS coordinates and direction
- **EXIF Data Extraction**: Automatically extracts GPS and direction from image EXIF data when available
- **Real-time Validation**: Validates coordinate ranges (lat: -90 to 90, lon: -180 to 180, dir: 0-360)
- **Inline Editing**: Quick edit fields in main interface with auto-save

### 🎯 **Ridge Point Selection**
- **Click to Select**: Click anywhere on image to add ridge points
- **Clear All Points**: Button to clear all selected points with confirmation
- **Undo Last Point**: Remove the most recently added point
- **Visual Feedback**: Red dots show selected points with proper scaling
- **Auto-Save**: Automatically saves data when points or metadata change

### 💾 **Data Management**
- **JSON Format**: Stores data in structured JSON format with metadata
- **Auto-Save**: Continuous saving of changes
- **Load/Save Controls**: Manual save and load options
- **Comprehensive Metadata**: Stores image dimensions, timestamps, GPS, direction, notes

## Installation & Setup

### Prerequisites
```bash
# Ensure you have the virtual environment activated
source venv/bin/activate

# Required packages (should already be installed)
pip install pillow opencv-python numpy
```

### File Structure
```
photo_verification/
├── src/
│   └── enhanced_ridge_detector.py    # Main application
├── launch_enhanced_ridge_detector.py # Launcher script
└── ENHANCED_RIDGE_DETECTOR_README.md # This documentation
```

## Usage

### Launch the Tool
```bash
# From photo_verification directory
python launch_enhanced_ridge_detector.py

# Or with virtual environment
source venv/bin/activate && python launch_enhanced_ridge_detector.py

# Or directly
python src/enhanced_ridge_detector.py
```

### Basic Workflow

1. **Open Image**
   - Click "Open Image" button
   - Browse to any JPG/PNG file (anywhere on your system)
   - Tool automatically copies external files to `data/images/` folder
   - Creates corresponding `*_data.json` file

2. **Edit GPS & Direction** (Optional)
   - Use inline fields for quick edits
   - Click "Edit GPS/Direction" for detailed dialog
   - Tool validates all coordinate ranges
   - Auto-extracts EXIF data when available

3. **Select Ridge Points**
   - Click anywhere on the image to add ridge points
   - Points appear as red dots
   - Use "Undo Last Point" to remove mistakes
   - Use "Clear All Points" to start over

4. **Save Data**
   - Data auto-saves on every change
   - Use "Save Data" for manual save with confirmation
   - All data stored in JSON format

### File Management Behavior

#### External Images (Outside data folder)
- **Action**: Copies file to `data/images/` folder
- **Naming**: Preserves original name, adds numbers if conflicts exist
- **Format**: Converts to JPG if needed (PNG → JPG)
- **Data File**: Creates new `*_data.json` file
- **Notification**: Shows import confirmation dialog

#### Data Folder Images (Already in data/images/)
- **Action**: Loads image directly
- **Data File**: Loads existing `*_data.json` if present, creates new if missing
- **Points**: Restores previously selected ridge points
- **Metadata**: Restores GPS, direction, and notes

## Data Format

### JSON Data File Structure
```json
{
  "image_path": "/path/to/image.jpg",
  "image_name": "image.jpg",
  "image_dimensions": {
    "width": 4032,
    "height": 3024
  },
  "ridge_points": [
    [1234, 567],
    [1456, 623],
    [1678, 589]
  ],
  "total_points": 3,
  "gps_latitude": "35.240222",
  "gps_longitude": "-106.635889",
  "direction_facing": "90",
  "notes": "Morning shot facing east",
  "last_modified": "2024-06-16T13:42:15.123456",
  "tool_version": "2.0"
}
```

### Ridge Points Format
- **Coordinates**: `[x, y]` in original image pixel coordinates
- **Origin**: Top-left corner (0, 0)
- **Scaling**: Automatically handled for display vs. original coordinates

## User Interface

### Main Window Layout
```
┌─────────────────────────────────────────────────────────────┐
│ File Operations          │ Point Operations                 │
│ [Open] [Save] [Load]     │ [Clear All] [Undo Last]         │
├─────────────────────────────────────────────────────────────┤
│ Image Metadata                                              │
│ GPS Lat: [____] GPS Lon: [____] Direction: [__] [Edit GPS] │
│ Notes: [_____________________________________________]      │
├─────────────────────────────────────────────────────────────┤
│ Status: Ready - Open an image to start selecting points    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    Image Canvas                             │
│                  (with scrollbars)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### GPS/Direction Editor Dialog
```
┌─────────────────────────────────────┐
│ Edit GPS and Direction              │
├─────────────────────────────────────┤
│ GPS Latitude:  [____________]       │
│ GPS Longitude: [____________]       │
│ Direction:     [____________]       │
├─────────────────────────────────────┤
│ Help:                               │
│ • Decimal degrees format            │
│ • Lat: -90 to 90 (N+, S-)          │
│ • Lon: -180 to 180 (E+, W-)        │
│ • Dir: 0-360° (N=0°, E=90°)        │
├─────────────────────────────────────┤
│              [OK] [Cancel]          │
└─────────────────────────────────────┘
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open Image |
| `Ctrl+S` | Save Data |
| `Ctrl+Z` | Undo Last Point |
| `Delete` | Clear All Points |

## Technical Details

### Image Scaling
- **Display Scaling**: Images automatically scaled to fit 1000x600 display area
- **Coordinate Mapping**: Click coordinates mapped back to original image pixels
- **Quality**: Uses LANCZOS resampling for high-quality scaling

### File Handling
- **Supported Formats**: JPG, JPEG, PNG, GIF, BMP, TIFF (input)
- **Output Format**: JPG (for consistency)
- **Quality**: 95% JPEG quality for conversions
- **EXIF Preservation**: Attempts to preserve EXIF data when possible

### Error Handling
- **File Access**: Graceful handling of permission errors
- **Image Format**: Automatic format conversion
- **Data Corruption**: JSON validation and error recovery
- **User Input**: Coordinate range validation

## Integration with Photo Verification System

### Data Folder Structure
```
data/images/
├── image1.jpg
├── image1_data.json
├── image2.jpg
├── image2_data.json
└── ...
```

### Compatibility
- **Ridge Points**: Compatible with existing ridge detection tools
- **Coordinate System**: Uses same pixel coordinate system
- **File Naming**: Follows established naming conventions
- **JSON Format**: Extensible format for future enhancements

## Troubleshooting

### Common Issues

**"Can't open file" Error**
- Check file permissions
- Ensure image file is not corrupted
- Try copying file to a different location first

**"Failed to save data" Error**
- Check write permissions in data folder
- Ensure sufficient disk space
- Verify data folder exists

**GPS Dialog Validation Errors**
- Latitude must be between -90 and 90
- Longitude must be between -180 and 180
- Direction must be between 0 and 360

**Points Not Appearing**
- Ensure image is loaded successfully
- Check if clicking within image bounds
- Try clearing points and starting over

### Debug Mode
```bash
# Run with debug output
python -u src/enhanced_ridge_detector.py
```

## Future Enhancements

- **Batch Processing**: Process multiple images at once
- **Point Types**: Different point types (ridge, valley, peak)
- **Measurement Tools**: Distance and angle measurements
- **Export Options**: Export to different formats (CSV, KML)
- **Undo/Redo Stack**: Multiple levels of undo/redo
- **Zoom Controls**: Zoom in/out for precise point placement

---

**Version**: 2.0  
**Last Updated**: June 16, 2024  
**Compatibility**: Python 3.7+, tkinter, PIL, OpenCV 