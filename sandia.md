sandia.md: UI and Visualization Requirements for Sandia Mountains Horizon View
Overview
We want to generate an SVG-based visualization of the Sandia Mountains as viewed from the point (35.11542, -106.4979) facing west. The system must calculate visible terrain elevations, filter out hidden data points (those occluded by closer terrain), and render both:

A 2D projected elevation view using colored polygons representing successive visible ridgelines.

A 3D wireframe rendering of the raw elevation data, plotted as a point cloud for verification.

User Interface Components
1. Main Page (sandia.html)
A responsive HTML page with a minimal interface for clarity.

Divided into two main panes:

Left Pane: 2D elevation profile (SVG).

Right Pane: 3D wireframe (WebGL or SVG-based with pseudo-3D projection).

UI Layout Sketch
pgsql
Copy
Edit
+-----------------------------------------------------------+
|                       Sandia Viewer                       |
+------------------------+----------------+----------------+
|                        |                                |
|   2D Elevation View     |    3D Wireframe View           |
|   (Color-Coded SVG)     |    (Elevation Point Cloud)     |
|                        |                                |
+------------------------+----------------+----------------+
Data Requirements
DEM (Digital Elevation Model) data source, ideally in GeoTIFF or ASCII Grid format.

Preprocess terrain data into a mesh or grid of (latitude, longitude, elevation) points.

Projection Requirements
A. 3D to 2D Projection for Elevation Profile
Viewpoint: (35.11542, -106.4979)

Azimuth: facing west

For each data point:

Calculate relative bearing and distance from viewpoint.

Use distance and elevation difference to determine apparent angle of elevation.

Maintain only the highest apparent angle per direction ray (to simulate occlusion).

Group visible points into 8 polygonal "ridges" from foreground to background.

B. Pseudo-3D for Wireframe
Plot raw elevation data using x=distance west, y=elevation, z=north/south offset.

Use simple perspective projection:

ini
Copy
Edit
x_screen = x / (z + d)
y_screen = y / (z + d)
Rendering Details
A. 2D Elevation Profile (Left Pane)
SVG-based rendering.

8 Ridges, ordered from nearest to farthest.

Each ridge represented by a polygon:

Horizontal axis: distance west.

Vertical axis: elevation.

Color: gradient based on elevation (e.g., green < brown < gray < white).

Only visible points (not occluded) are rendered.

Polygons must not overlap — each new polygon is the horizon from the previous.

B. 3D Wireframe (Right Pane)
Show all terrain points in grayscale.

Use line segments to indicate terrain mesh.

Optionally use interactivity (e.g., mouse drag to rotate scene).

Highlight elevation with z-axis scaling.

Controls and Interactivity
Checkbox: Toggle visibility of ridgelines.

Slider: Adjust observer altitude.

Button: Reload data with new parameters.

Download: Export SVG as image.

Validation
The system must:

Provide visual confirmation that 2D ridgelines correspond to visible terrain from 3D perspective.

Color-coded elevation in 2D view must clearly match heights seen in 3D wireframe.

Ensure occlusion logic prevents background ridges from appearing where blocked.

Performance Goals
Handle DEM slices covering ~20km x 20km with reasonable performance (<3s load time).

Optimize visible ray calculation with angular binning and line-of-sight tracking.

Use SVG and WebGL/WebGPU efficiently to handle rendering of thousands of points.

Future Extensions
Load additional DEM layers for more resolution.

Add camera animations to simulate flyover.

Export KML/GeoJSON with visible ridge outlines.
