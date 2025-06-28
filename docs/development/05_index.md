


TODO: when map is moved, clear the SVG, and then add text elements that are the stats of the map window

when the map movies, the SVG should
- clear all the circles
- create a grid of 100x100 circles , all light grey initially , and containing placholder info of what the GPS info is , laid out as if it were on a map
- look at the elevation data for the selected window 
- change the color on all of the circles to the closest datapoint entry


# New Mexico Elevation Data Collection System

## Core Features
1. Data Collection
   - [x] Grid-based database system
   - [x] Mother database aggregation
   - [x] Elevation point collection
   - [ ] Priority queue system

2. Web Interface
   - [x] Interactive map view
   - [x] Elevation visualization
   - [x] Debug terminal
   - [x] Statistics display
   - [ ] User location features

3. API System
   - [x] Elevation data endpoints
   - [x] Statistics API
   - [x] API testing framework
   - [ ] Window collection API
   - [ ] Queue management API

## Best Practices

### API Development
- [x] Separate test script (test_apis.js)
- [x] Comprehensive endpoint testing
- [x] Error handling
- [ ] Rate limiting
- [ ] API documentation

### Frontend Architecture
- [x] Separated CSS/JS from HTML
- [x] Debug terminal implementation
  - [x] Color-coded output
  - [x] Log levels (verbose, info, warning)
  - [x] Toggle visibility
  - [x] Filter controls
- [x] Modern UI components
- [ ] Responsive design

### Data Management
- [x] Grid database structure
- [x] Mother database aggregation
- [ ] Queue-based collection
- [ ] Progress tracking
- [ ] Data validation

## Public Access Setup
- [x] Port 3000 exposure
- [x] Pi configuration (10.0.0.68)
- [x] Public endpoint (98.60.28.152:3000)
- [ ] HTTPS implementation
- [ ] Access controls

## Current APIs
1. `/api/stats`
   - Returns total elevation points
   - Database statistics

2. `/api/elevation-data`
   - Bounds-based queries
   - Point retrieval
   - Statistics

3. `/api/ip-info`
   - Client information
   - Server status

4. `/api/santa-fe-elevation`
   - Location-specific data
   - Radius-based queries

5. `/api/enhance-region`
   - Targeted data collection
   - Region enhancement

6. `/api/collect-points`
   - Grid-based collection
   - Zoom-level support

## Next Steps (Priority Order)

1. Server Stability
   - [ ] Fix express dependency issues
   - [ ] Implement proper error handling
   - [ ] Add server logging

2. Data Collection Enhancement
   - [ ] Implement window API endpoint
   - [ ] Add queue processing system
   - [ ] Optimize collection strategies

3. User Experience
   - [ ] Add location-based features
   - [ ] Implement progress indicators
   - [ ] Enhance error messaging

4. Security & Performance
   - [ ] Add rate limiting
   - [ ] Implement caching
   - [ ] Add request validation

5. Documentation
   - [ ] API documentation
   - [ ] Setup instructions
   - [ ] Contribution guidelines

## Development Notes

### Database Structure
- Grid databases in `grid_databases/`
- Aggregated data in `mother.db`
- Queue data in `public_queue.txt`

### Debug Terminal
Sample output format:
```
(grey) INFO: (white) Application startup
(orange) WARN: (red) Connection error
```

### Testing
Run tests frequently:
```bash
npm test        # Run API tests
npm run start   # Start development server
```

