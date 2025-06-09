# WINDOW Feature Implementation

## Public Access Requirements
1. Raspberry Pi Exposure
   - Port forwarding set up on port 3000 (TCP/UDP)
   - DMZ configured to Pi's IP (10.0.0.68)
   - Public access via http://98.60.28.152:3000

## Web Interface Features
1. Map View
   - Auto-zoom to user's location if in NM
   - Fallback to full NM view if outside state
   - Display current location marker
   - Add buttons to zoom to current location and to chicago

2. User Information Collection
   - Button to collect user's:
     - IP address
     - GPS coordinates
     - Browser info
     - Timestamp
   - Store in public_queue.txt format:
     ```json
     {
       "timestamp": "ISO-8601",
       "clientIP": "x.x.x.x",
       "location": {
         "lat": xx.xxxx,
         "lon": xx.xxxx
       },
       "browserInfo": "string"
     }
     ```

3. Elevation Data Collection
   - Priority queue system:
     1. Read from public_queue.txt first
     2. Fall back to grid-based collection if queue empty
   - Queue processing in collect_sparse_points.js
   - Window-based collection for user-specified areas

## API Endpoints
1. `/api/ip-info`
   - Returns client IP and server info
2. `/api/queue`
   - Accepts POST requests with location data
   - Adds to public_queue.txt
3. `/api/elevation-data`
   - Returns elevation data for specified bounds
4. `/api/window`
   - Accepts window parameters for targeted collection
   - Prioritizes window requests in queue

## Implementation Status
- [x] Basic web interface
- [x] Map integration
- [x] Geolocation
- [x] Public access setup
- [ ] Queue system implementation
- [ ] Window API endpoint
- [ ] Priority collection
- [ ] User data collection

## Next Steps
1. Implement window API endpoint
2. Add queue processing to collect_sparse_points.js
3. Enhance user data collection
4. Add queue visualization
5. Implement progress tracking for queued requests

help me get the pi exposed to the public 
i want to go to a puclib ip
and it serve a page on my pi
clicking a button will get my IP info etc and my GPS info
and a new file will be created called public_queue.txt containing a queue
then, collect spasrse points will need to read from the queue as a priority

http://localhost:3000/ 
should load a map zoomed in to user's location
below that is SVG1
send a window query to our window api, where is it?
 write it here:

