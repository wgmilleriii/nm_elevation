# User-Adaptive Elevation Collection System

A reactive elevation data collection system that automatically creates user-specific databases based on GPS boundaries and collects elevation data using ridge detection algorithms when users access the public API.

## 🌟 Key Features

### 🔄 Reactive Queue System
- **Monitors public API requests** in real-time
- **Automatically triggers collection** when users open GPS tracker
- **Tracks user movement** and starts collection when they move significantly
- **Manages concurrent collections** with intelligent queuing

### 🗺️ GPS-Boundary Database Naming
- **User-specific databases** with GPS coordinate boundaries
- **Session-aware naming** incorporating user ID and session ID
- **Radius-based organization** (10mi, 5mi, 1mi, 0.5mi zones)
- **Format**: `user_{userId}_{sessionId}_{latGrid}_{lonGrid}_radius{miles}.db`

### 🏔️ Ridge Detection Integration
- **Uses existing ridge detection algorithms** to identify elevation anomalies
- **Fans out from user position** in concentric circles
- **Prioritizes elevation changes** and terrain features
- **Adaptive collection** based on user movement patterns

### 📊 Intelligent Data Management
- **40,000 point limit per database** (same as existing system)
- **Automatic cleanup** of old databases
- **Progress tracking** per radius zone
- **Anomaly scoring** for elevation changes

## 🚀 Quick Start

### Install Dependencies
```bash
npm install better-sqlite3 node-fetch
```

### Test the System
```bash
node adaptive_collection_service.js test
```

### Start the Reactive Service
```bash
node adaptive_collection_service.js start
```

### Check Status
```bash
node adaptive_collection_service.js status
```

### List User Databases
```bash
node adaptive_collection_service.js databases
```

## 📁 File Structure

```
user_adaptive_collection/
├── user_adaptive_database_system.js    # Database naming and management
├── reactive_elevation_queue.js          # Real-time API monitoring
├── adaptive_collection_service.js       # CLI service manager
├── README.md                           # This documentation
└── user_databases/                     # Generated user databases
    ├── user_abc123_session001_3584_-1048_radius10.db
    ├── user_abc123_session001_3584_-1048_radius5.db
    └── user_abc123_session001_3584_-1048_radius1.db
```

## 🔧 How It Works

### 1. API Monitoring
The system continuously monitors your public elevation API (`/api/gps-queue`) for new GPS tracking requests.

### 2. User Detection
When a user opens the GPS tracker on their phone, the system detects:
- New user activity
- Significant movement (>0.1 miles)
- Active GPS session

### 3. Database Creation
For each user location, creates databases with GPS boundary naming:
```
user_{userId}_{sessionId}_{latGrid}_{lonGrid}_radius{miles}.db
```

### 4. Adaptive Collection
Starts collecting elevation data in concentric zones:
- **10 mile radius**: Broad terrain overview
- **5 mile radius**: Regional elevation patterns  
- **1 mile radius**: Local terrain features
- **0.5 mile radius**: Detailed elevation data

### 5. Ridge Detection
Uses your existing ridge detection algorithms to:
- Identify elevation anomalies
- Prioritize terrain changes
- Focus on ridges and edges
- Score elevation significance

## 📊 Database Schema

### Points Table
```sql
CREATE TABLE points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    elevation REAL,
    source TEXT,
    collection_type TEXT DEFAULT 'adaptive',
    priority_score REAL DEFAULT 0,
    distance_from_user REAL,
    elevation_anomaly_score REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### User Metadata Table
```sql
CREATE TABLE user_metadata (
    id INTEGER PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    center_lat REAL NOT NULL,
    center_lon REAL NOT NULL,
    radius_miles REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_points INTEGER DEFAULT 0,
    ridge_points INTEGER DEFAULT 0,
    edge_points INTEGER DEFAULT 0
);
```

### Collection Progress Table
```sql
CREATE TABLE collection_progress (
    radius_zone REAL PRIMARY KEY,
    points_collected INTEGER DEFAULT 0,
    anomalies_found INTEGER DEFAULT 0,
    last_collection DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🎯 Integration with Existing System

This system **extends** your current elevation collection infrastructure:

- **Uses same APIs**: OpenTopoData, Open-Meteo, ASTER30m, Open-Elevation
- **Same point limits**: 40,000 points per database
- **Same ridge algorithms**: RidgeDetector.js and EdgeDetector.js
- **Same database schema**: Compatible with existing tools
- **Same rate limiting**: Respects API limits and delays

## 🔗 API Integration

The system integrates with your public elevation API endpoints:

- `GET /api/gps-queue` - Monitor for new GPS requests
- `GET /api/user-sessions?userId=X` - Get user session data
- `GET /api/user/points?userId=X` - Get user GPS points
- `GET /api/stats` - System statistics

## 📈 Example Usage Scenario

1. **User opens GPS tracker** in Denver, Colorado
2. **System detects new activity** at coordinates (39.7392, -104.9903)
3. **Creates databases**:
   - `user_abc123_session024_397392_-1049903_radius10.db`
   - `user_abc123_session024_397392_-1049903_radius5.db`
   - `user_abc123_session024_397392_-1049903_radius1.db`
4. **Starts collecting** elevation data in 10-mile radius
5. **Uses ridge detection** to find elevation anomalies
6. **Stores prioritized points** with anomaly scores
7. **Continues collection** as user moves

## ��️ Configuration

### Environment Variables
```bash
export COLLECTION_DIRECTION=sw_to_ne
export MAX_CONCURRENT_COLLECTIONS=3
export POLLING_INTERVAL=5000
```

### Service Configuration
- **Polling interval**: 5 seconds (configurable)
- **Movement threshold**: 0.1 miles (configurable)
- **Max concurrent collections**: 3 (configurable)
- **Point collection per zone**: 200-1000 based on radius

## 🚦 Running as a Service

### Development
```bash
node adaptive_collection_service.js start
```

### Production (PM2)
```bash
pm2 start adaptive_collection_service.js --name "elevation-collector"
pm2 save
pm2 startup
```

### Systemd Service
```ini
[Unit]
Description=Adaptive Elevation Collection Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/user_adaptive_collection
ExecStart=/usr/bin/node adaptive_collection_service.js start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## �� Monitoring and Logs

### Status Monitoring
```bash
# Real-time status
node adaptive_collection_service.js status

# Database overview
node adaptive_collection_service.js databases
```

### Log Files
- `reactive_queue.log` - Service activity log
- `collection_errors.log` - Error tracking
- `service_status.json` - Current status file

## 🔄 Integration with Journey Dashboard

This system provides data for your GPS Journey Dashboard:

- **User-specific route data** from databases
- **Elevation profiles** with anomaly detection
- **Real-time collection status** for active users
- **Historical journey data** from completed sessions

## 🎯 Next Steps

1. **Deploy the service** to your server
2. **Monitor API activity** for user GPS requests
3. **Integrate with journey dashboard** for visualization
4. **Add elevation profile APIs** for public access
5. **Scale collection algorithms** based on usage patterns

## 📝 TODO List

- [ ] Integrate with existing RidgeDetector.js
- [ ] Add elevation profile generation APIs
- [ ] Implement database cleanup automation
- [ ] Add metrics and monitoring dashboard
- [ ] Create elevation anomaly visualization
- [ ] Add user journey reconstruction
- [ ] Implement predictive collection zones
- [ ] Add elevation change notifications

---

**🏔️ This system turns your elevation API into a smart, user-aware data collection network that automatically builds detailed elevation maps around your users as they travel!**
