# 📁 GPS Elevation System - Upload Instructions

## ✅ Ready-to-Upload Folder Structure

This `elevation/` folder contains the complete GPS Elevation System ready for upload to your remote server.

### 📂 Directory Structure:
```
elevation/
├── index.php              # Main API server (from remote_server.php)
├── .htaccess              # URL routing configuration
├── home.html              # Landing page with app links
├── gps_live.html          # Live GPS tracking app
├── gps_tracker.html       # GPS data collection app
├── elevation_new_mexico.html # New Mexico elevation map
├── elevation_cache_reduced.json # Elevation data cache
├── css/                   # Stylesheets
│   ├── gps_live.css
│   ├── gps_tracker.css
│   ├── nmviewer.css
│   ├── face.css
│   └── sandia-view.css
├── js/                    # JavaScript files
│   ├── gps_live.js        # Main GPS tracking logic
│   ├── gps_tracker.js     # Data collection logic
│   ├── config.js          # Configuration settings
│   ├── map.js             # Map utilities
│   ├── modules/           # Modular components
│   │   ├── config.js
│   │   ├── elevation.js
│   │   ├── grid.js
│   │   ├── map.js
│   │   ├── state.js
│   │   └── svg.js
│   ├── algorithms/        # Collection algorithms
│   │   ├── CollectionAlgorithm.js
│   │   ├── CollectionManager.js
│   │   ├── EdgeDetector.js
│   │   └── RidgeDetector.js
│   ├── utils/             # Utility functions
│   │   └── elevationData.js
│   └── [other JS files]
├── docs/                  # Documentation
│   ├── MOBILE_GUIDE.md
│   ├── API_DOCUMENTATION.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── README.md
├── data/                  # Data files
│   └── new-mexico.geojson
└── images/                # Image assets
    └── [image files]
```

## 🚀 Upload Instructions

### Option 1: FileZilla (Recommended)
1. **Connect to your FTP server:**
   - Server: `ftp.chipmiller.me`
   - Username: `public_projects@chipmiller.me`
   - Password: `synxek-8xyhze-mAqror`

2. **Navigate to the target directory:**
   - Go to `/hanon/elevation/`

3. **Upload the entire folder:**
   - Simply drag and drop the entire `elevation/` folder contents
   - FileZilla will maintain the directory structure automatically

### Option 2: Command Line FTP
```bash
# Navigate to the nm_elevation directory
cd /path/to/nm_elevation

# Upload using rsync or similar tool
rsync -avz elevation/ user@server:/path/to/hanon/elevation/
```

### Option 3: Web Panel File Manager
1. Access your hosting control panel
2. Navigate to `/hanon/elevation/`
3. Upload the entire `elevation/` folder contents
4. Ensure directory structure is preserved

## 🌐 After Upload - Your System Will Be Available At:

- **Main Landing Page:** `https://hanon.artsmetrics.net/elevation/`
- **Live GPS Tracker:** `https://hanon.artsmetrics.net/elevation/gps_live.html`
- **Data Collector:** `https://hanon.artsmetrics.net/elevation/gps_tracker.html`
- **API Endpoints:** `https://hanon.artsmetrics.net/elevation/api/stats`

## 🔧 What Happens After Upload:

1. **PHP Server** (`index.php`) will automatically create data directories:
   - `data/users/` - User profiles and sessions
   - `data/queue/` - GPS points awaiting elevation processing
   - `data/logs/` - System logs

2. **File Permissions** should be set to allow PHP to write to the data directory

3. **URL Routing** via `.htaccess` will handle API endpoints properly

## ✅ Verification Steps:

After upload, test these URLs:
- [ ] Landing page loads: `https://hanon.artsmetrics.net/elevation/`
- [ ] API responds: `https://hanon.artsmetrics.net/elevation/api/stats`
- [ ] GPS tracker loads: `https://hanon.artsmetrics.net/elevation/gps_live.html`
- [ ] CSS/JS files load properly (check browser console)

## 🚨 Important Notes:

- **No server-side Node.js required** - This is a pure PHP/JavaScript system
- **Data storage uses JSON files** - No database setup needed
- **Elevation processing** requires your Mac server running `elevation_service.js`
- **CORS enabled** - Works from any domain

---

🌍 **Your GPS Elevation System is ready for deployment!** 