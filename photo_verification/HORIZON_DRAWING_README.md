# Horizon Line Drawing Tool

An interactive GUI tool for drawing horizon lines on mountain photographs. This tool allows you to manually trace the visible horizon by clicking and dragging to create a red line that follows the mountain ridges.

## 🎯 Features

### 🖱️ Interactive Drawing
- **Click and Drag**: Click and drag your mouse to draw a red horizon line
- **Multiple Segments**: Draw multiple separate segments to handle complex horizons
- **Real-time Feedback**: See the line being drawn in real-time as you drag

### 🔧 Control Buttons
- **Clear Horizon**: Remove the entire horizon line (with confirmation)
- **Undo Last Segment**: Remove the most recently drawn segment
- **Save Horizon**: Save the horizon line data to a JSON or text file
- **Load Horizon**: Load previously saved horizon line data
- **Load Image**: Load a different image to work with

### 💾 Data Management
- **JSON Format**: Save horizon data with metadata (image info, timestamps, etc.)
- **Text Format**: Simple comma-separated coordinate format
- **Original Coordinates**: All coordinates saved in original image resolution
- **Auto-scaling**: Tool automatically scales large images for display

## 🚀 Quick Start

### Method 1: Using the Launcher
```bash
# Launch with default image (corrales.png)
python launch_horizon_drawer.py

# Launch with specific image
python launch_horizon_drawer.py path/to/your/image.png
```

### Method 2: Direct Launch
```bash
# From the src directory
python src/horizon_line_drawer.py

# With specific image
python src/horizon_line_drawer.py path/to/your/image.png
```

### Method 3: With Virtual Environment
```bash
# Activate virtual environment first
source venv/bin/activate

# Then launch
python launch_horizon_drawer.py
```

## 🎮 How to Use

### Drawing Horizon Lines
1. **Load Image**: The tool loads `corrales.png` by default, or use "Load Image" button
2. **Start Drawing**: Click where you want to start the horizon line
3. **Drag to Draw**: Hold down the mouse button and drag to trace the horizon
4. **Release to Finish**: Release the mouse button to complete a segment
5. **Continue Drawing**: Click and drag again to add more segments

### Managing Your Work
- **Save Progress**: Click "Save Horizon" to save your work
- **Clear Mistakes**: Use "Clear Horizon" to start over
- **Undo Segments**: Use "Undo Last Segment" to remove recent work
- **Load Previous Work**: Use "Load Horizon" to continue previous work

### Keyboard Shortcuts
- `Ctrl+O`: Load new image
- `Ctrl+S`: Save horizon data
- `Ctrl+Z`: Undo last segment
- `Delete`: Clear entire horizon
- `Escape`: Cancel current drawing operation

## 📁 File Formats

### JSON Format (Recommended)
```json
{
  "image_path": "/path/to/corrales.png",
  "image_name": "corrales.png",
  "image_dimensions": {
    "width": 1920,
    "height": 1080
  },
  "horizon_points": [
    [100, 200],
    [101, 201],
    [102, 199]
  ],
  "total_points": 3,
  "created_date": "2024-01-15T10:30:00",
  "tool_version": "1.0"
}
```

### Text Format
```
# Horizon Line Data for corrales.png
# Image dimensions: 1920x1080
# Total points: 3
# Created: 2024-01-15T10:30:00
# Format: x,y (in original image coordinates)

100,200
101,201
102,199
```

## 🖼️ Working with Images

### Supported Formats
- PNG (*.png)
- JPEG (*.jpg, *.jpeg)
- GIF (*.gif)
- BMP (*.bmp)
- TIFF (*.tiff)

### Image Scaling
- Large images are automatically scaled down for display
- All coordinates are saved in original image resolution
- Scaling is handled transparently - you don't need to worry about it

### Default Image
The tool loads `data/images/corrales.png` by default. This is a mountain photograph perfect for testing horizon line drawing.

## 🔧 Technical Details

### Coordinate System
- Origin (0,0) is at the top-left corner of the image
- X increases to the right
- Y increases downward
- All saved coordinates are in original image pixels

### Drawing Precision
- Mouse movements are captured continuously during drag operations
- Line segments are drawn with anti-aliasing for smooth appearance
- Points are stored at mouse movement resolution

### Performance
- Handles large images efficiently through automatic scaling
- Smooth drawing performance even with hundreds of points
- Minimal memory usage through efficient data structures

## 🎯 Use Cases

### Photo Verification
- Trace the actual horizon line visible in mountain photographs
- Compare with generated terrain backgrounds
- Validate elevation data accuracy

### Ridge Analysis
- Manually identify visible mountain ridges
- Create reference data for automated ridge detection
- Document complex horizon profiles

### Research Applications
- Create ground truth data for computer vision algorithms
- Study horizon line characteristics in different terrains
- Generate training data for machine learning models

## 🐛 Troubleshooting

### Common Issues

**Tool won't start**
- Make sure you have the required dependencies installed
- Activate the virtual environment: `source venv/bin/activate`
- Check that the image file exists

**Image won't load**
- Verify the image file format is supported
- Check file permissions
- Try a different image file

**Drawing is laggy**
- Large images are automatically scaled down
- Close other applications to free up memory
- Try with a smaller image file

**Can't save horizon data**
- Check write permissions in the target directory
- Make sure you've drawn at least one point
- Try saving to a different location

### Getting Help
If you encounter issues:
1. Check the status bar at the bottom of the window for error messages
2. Look at the terminal/console output for detailed error information
3. Try restarting the tool
4. Verify your image file is valid and accessible

## 📝 Tips and Best Practices

### Drawing Technique
- **Start from one side**: Begin at the left or right edge of the image
- **Follow the ridge**: Trace along the actual visible mountain ridge line
- **Use multiple segments**: For complex horizons, draw separate segments
- **Zoom if needed**: Use a larger monitor or zoom your display for precision

### Data Management
- **Save frequently**: Save your work regularly to avoid losing progress
- **Use descriptive names**: Name your horizon files clearly (e.g., `horizon_corrales_east_view.json`)
- **Keep backups**: Save multiple versions if working on important data
- **Document your work**: Add notes about the image source and viewing conditions

### Quality Control
- **Check your work**: Review the drawn line to ensure it follows the actual horizon
- **Be consistent**: Use the same drawing style throughout a project
- **Validate results**: Compare with other reference data when available

## 🔄 Integration

This horizon drawing tool integrates with the broader photo verification system:

- **Ridge Analysis**: Use drawn horizons to validate automated ridge detection
- **Background Generation**: Compare manual horizons with generated terrain backgrounds  
- **3D Visualization**: Import horizon data into 3D terrain viewers
- **Data Export**: Export horizon coordinates for use in other analysis tools

The tool is designed to work seamlessly with the existing photo verification workflow while providing precise manual control over horizon line definition. 