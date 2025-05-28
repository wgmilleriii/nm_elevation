NMVIEWER2.md


UI is a web interface. Top of screen shows map of new mexico. Bottom shows SVG1 viewer . Map view is smaller than bottom view.

On load, add a marker on the map for Albuquerque, another for Corrales, another for Socorro in different colors and labelled.

Begin with user clicks on map. This represents where you stand. Draw a black square 20x20 at first click. Then second point click represents what direction you are looking. Draw a circle on the map with the first point as the center and use the second point to get a radius. Then draw a green arc on the screen (1/4 of a circle), that is centered relative to the line between the center of the circle (point one user click.) and the edge (point two user click.)

Stop here at checkpoint one until this looks good.

can you figure out what points in the green arc are closely found in our dataset? calculate 10 points, evenly distributed close to the green arc. Then draw circles on the SVG1 from left to right. color-code the circles according to elevation and keep them all in a straight line left to right. create a dynamic legend for the colorcoding (ROYGBIV) and add an HTML datable below the SVG that shows the details of the 10 points.

--
next
Add circles on the map for each of the 10 points.
When you click on an SVG circle, zoom the map to the corresponding map circle.
--
THEN
create a loop so that the arc is done 10 times, each a little further out from the center, building a grid on the SVG instead of just a single line.
--
SVG1 
Add a new SVG object that takes the "grid" idea from SVG1.
The top row of SVG1 is row1, the left is col1.
place SVG2 right below SVG1.

given: SVG1 has rendered a top-down view, with the top row being the closest to the user's standing point (user click1)
Arrange the circles now so that initially they are all vertically aligned, but there are 3 controls:
"depth" view (this would in effect , gradually reduce the size of row10),
"height of camera" (this will gradually decrease the Y value [to make higher on the screen that is] of each row)
"scaling" - also increase the y-position based on the data's height factor.
also the rows should decrease in opacity gradually from 1-10 10 being 10% opacity and 1 being 50% opacity

adjustments: initially, the values should all be 0 on the sliders and the view should look like this: SVG1's rows and columns are now translated to be on a single line in the center of the SVG. (as if near row 5 but all on a single row). When camera heigh changes, row 10 goes towards bottom of screen and row 1 to top. let's start with that much.

Depth view: current scaling is good for each circle, now the width of the rows should also decrease.
Heigh scaling: as it increases the size of the circles increase proportionate to their elevation


NEXT:
increase the factor for scaling elevation. 

## Current Status
- Map visualization with city markers (Albuquerque, Corrales, Socorro)
- Interactive point selection for viewing position and direction
- Arc visualization with elevation-based color coding
- Grid-based SVG visualization with controls:
  - Depth view
  - Camera height
  - Elevation scaling
- Dynamic data tables and legends
- SVG2 implementation with perspective controls

## Next Steps
1. Fine-tune elevation scaling factor
2. Consider adding:
   - Save/load view configurations
   - Export visualization data
   - Additional city markers
   - Performance optimizations for large datasets

## Known Issues
- None reported

## Recent Updates
- Implemented SVG2 with perspective controls
- Added depth, height, and scaling controls
- Integrated elevation-based color coding
- Added dynamic data tables and legends



set initial values for 
depth view:  54
camera height: 35
height scaling: 72

with every control change, draw grey lines that connect the tops of circles , row by row, so that row1 col1 circle top connects to col2, then to col 3 , creating a jagged line. There will be 10 jagged lines, one for each row. their opacity and thickness should be proportaional to the Depth view scale


- create a new SVG3 that
 is based on the same points from SVG2
 - colors the ine segments based on changes in elevation from col2-col1 e.g., if col2 is higher the line should be colored as the right side of the spectrum.


 - LAZY LOADING:
 Change test_cache.js to accept parameters of starting end ending edges for latlon so it can pass in to the UI more cdata with increasing resolution.
 As more data becomes available, increase the rows from 10x10 to 11x11, then 12x12, add one row/col per second and update all of the SVGs