FACE.md

UI requirements:
web page shows a map
and then an svg1 below the map
page evenly divded into two
svg should load data from local database and mirror the clicks of the map
so in memory will reside 3d elevation data lon/lat/ele
svg should be updated based on data in memory and as map moves
 on load, load into memory gps info for 10 major cities
 zoom map to see santa fe to las cruses
 
 update SVG1:
 - draw text markers and circles on the top 10 cities
 - use the local databases to start querying data gradually
 - here's the hard part: I want a true elevation map showing circles and rings like a true topographical map
 - in order to verify the topographie's accuracy, I need another layer in the SVG that are the standard circles in the blue->yellow gradient to show height. This part should be easy, and it should be easy to zoom into a region on the MAP, and have that translate to a data call to the collect_sparse

 For the first launch, let's get this all running locally and then we will move it to the PI and focus on collecting data directly from the PI

