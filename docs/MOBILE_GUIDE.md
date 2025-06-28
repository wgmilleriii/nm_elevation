# Mobile GPS Tracking Guide

## 🌐 Live GPS Tracking System

### **NEW: Cloud-Based GPS Tracking**
Your GPS elevation system is now live at:
- **🏠 Landing Page**: https://hanon.artsmetrics.net/elevation/home.html
- **📍 Live GPS Tracker**: https://hanon.artsmetrics.net/elevation/gps_live.html
- **🗺️ GPS Data Collector**: https://hanon.artsmetrics.net/elevation/gps_tracker.html
- **🏔️ Elevation Map**: https://hanon.artsmetrics.net/elevation/elevation_new_mexico.html

### Quick Start (Cloud Version)
1. Open your phone's browser
2. Go to: **https://hanon.artsmetrics.net/elevation/gps_live.html**
3. Allow location access when prompted
4. Start tracking! ✨

### Quick Start (Local Development)
1. Connect your laptop to your phone's hotspot
2. Start the server on your laptop
3. Access the tracker on your phone at: `http://192.168.105.126:3001/gps_live.html`

## Detailed Setup

### On Your Laptop
1. Connect to your phone's hotspot
2. Open terminal in the project directory
3. Run the server:
   ```bash
   node server.js
   ```
4. Look for the message showing your IP address (usually 192.168.xxx.xxx)

### On Your Phone
1. Open your preferred browser (Chrome recommended)
2. Navigate to `http://[LAPTOP_IP]:3001/gps_live.html`
   - Replace [LAPTOP_IP] with your laptop's IP address
   - Example: `http://192.168.105.126:3001/gps_live.html`
3. When prompted, allow location access

## Features

### GPS Tracking
- **High Accuracy Mode**: Enabled by default
- **Update Frequency**: Every 2 seconds
- **Accuracy Display**: Shows in meters
- **Location Source**: Indicated by color
  - 🟢 Green: High accuracy GPS
  - 🟡 Yellow: Wi-Fi based
  - 🔴 Red: Low accuracy/IP based

### Journey Tracking
- **Route**: Albuquerque to Denver
- **Landmarks**:
  - Albuquerque (Start)
  - Santa Fe
  - Taos
  - Trinidad
  - Pueblo
  - Colorado Springs
  - Denver (End)

### Real-time Data
- Current position (lat/lon)
- Elevation
- Speed
- Heading
- GPS accuracy
- Nearest landmark
- Distance to destination

## Troubleshooting

### Common Issues

#### "Unable to get location"
- Check if GPS is enabled on your phone
- Make sure location permissions are allowed for the browser
- Try refreshing the page

#### "Connection failed"
- Verify your laptop's IP address
- Ensure your phone is connected to your hotspot
- Check if the server is running

#### Poor Accuracy
- Move to an area with clearer sky view
- Wait a few seconds for GPS to stabilize
- Check if your phone case is interfering with GPS

### Best Practices
1. **Battery Life**:
   - Keep your phone charged
   - GPS tracking uses significant battery power

2. **Data Usage**:
   - Tracking uses minimal data
   - Maps may use more data initially

3. **Accuracy Tips**:
   - Outdoor tracking is more accurate
   - Allow a few seconds for GPS to stabilize
   - Avoid dense urban canyons

## Technical Details

### Network Setup
- Server runs on port 3001
- Uses WebSocket for real-time updates
- Supports all modern mobile browsers

### GPS Parameters
- High accuracy mode enabled
- Minimum accuracy threshold: 100 meters
- Update interval: 2 seconds
- Position caching disabled

### Data Storage
- All tracking data saved locally on laptop
- Uses SQLite database
- Automatic journey resumption on reconnection

## Links

### 🌐 Live Cloud System
- [🏠 Landing Page](https://hanon.artsmetrics.net/elevation/home.html)
- [📍 Live GPS Tracker](https://hanon.artsmetrics.net/elevation/gps_live.html)
- [🗺️ GPS Data Collector](https://hanon.artsmetrics.net/elevation/gps_tracker.html)
- [🏔️ Elevation Map](https://hanon.artsmetrics.net/elevation/elevation_new_mexico.html)

### 💻 Local Development
- [GPS Live Tracker](http://localhost:3001/gps_live.html)
- [Journey Summary](http://localhost:3001/summary.html)

### 📚 Documentation
- [Collection Algorithms](./COLLECTION_ALGORITHMS.md)
- [Sync Setup](./SYNC_SETUP.md)
- [Dummies Guide](./DUMMIES_GUIDE.md)

### External Resources
- [Leaflet Maps Documentation](https://leafletjs.com/reference.html)
- [Geolocation API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

## Updates and Maintenance
- Check for server updates regularly
- Keep your mobile OS and browser updated
- Review logs for tracking accuracy

## Support
If you encounter issues:
1. Check the console logs in your browser
2. Review server logs on your laptop
3. Verify network connectivity
4. Ensure GPS is enabled and has clear sky view 