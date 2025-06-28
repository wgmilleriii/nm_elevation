# GPS Data Collection Report - Working APIs
**Generated:** Sat Jun 28 15:10:49 MDT 2025
**Directory:** working_apis_20250628_151040

## System Overview

### System Statistics
- **Total Users:** 58
- **Total Sessions:** 56  
- **Total GPS Points:** 978
- **Queue Size:** 64
- **Pending Points:** 64
- **Processing Points:** 0
- **Completed Points:** 0

### Server Information
- **Version:** 2.2.0
- **Server:** Elevation API Server
- **PHP Version:** PHP 8.3.21
- **Features:** global_session_numbering, session_heartbeat, automatic_cleanup, enhanced_logging

## Data Files Generated
- **01_version.json:** 219 bytes
- **01_version.pretty.json:** 263 bytes
- **02_stats.json:** 130 bytes
- **02_stats.pretty.json:** 159 bytes
- **03_gps_queue.json:** 21025 bytes
- **03_gps_queue.pretty.json:** 25578 bytes
- **04_queue_status.json:** 219 bytes
- **04_queue_status.pretty.json:** 273 bytes
- **05_logs.json:** 5382 bytes
- **05_logs.pretty.json:** 5792 bytes
- **06_session_1.json:** 76 bytes
- **06_session_1.pretty.json:** 100 bytes
- **06_session_10.json:** 77 bytes
- **06_session_10.pretty.json:** 101 bytes
- **06_session_15.json:** 77 bytes
- **06_session_15.pretty.json:** 101 bytes
- **06_session_20.json:** 77 bytes
- **06_session_20.pretty.json:** 101 bytes
- **06_session_25.json:** 77 bytes
- **06_session_25.pretty.json:** 101 bytes
- **06_session_30.json:** 53 bytes
- **06_session_30.pretty.json:** 62 bytes
- **06_session_35.json:** 53 bytes
- **06_session_35.pretty.json:** 62 bytes
- **06_session_40.json:** 53 bytes
- **06_session_40.pretty.json:** 62 bytes
- **06_session_45.json:** 53 bytes
- **06_session_45.pretty.json:** 62 bytes
- **06_session_5.json:** 76 bytes
- **06_session_5.pretty.json:** 100 bytes
- **06_session_50.json:** 53 bytes
- **06_session_50.pretty.json:** 62 bytes
- **06_session_55.json:** 53 bytes
- **06_session_55.pretty.json:** 62 bytes

## Session Data Found
- **Session #1:** Created 2025-06-28T20:09:56+00:00
- **Session #06_session_1.pretty.json:** Created 2025-06-28T20:09:56+00:00
- **Session #10:** Created 2025-06-28T20:15:50+00:00
- **Session #06_session_10.pretty.json:** Created 2025-06-28T20:15:50+00:00
- **Session #15:** Created 2025-06-28T20:29:24+00:00
- **Session #06_session_15.pretty.json:** Created 2025-06-28T20:29:24+00:00
- **Session #20:** Created 2025-06-28T20:35:00+00:00
- **Session #06_session_20.pretty.json:** Created 2025-06-28T20:35:00+00:00
- **Session #25:** Created 2025-06-28T21:00:07+00:00
- **Session #06_session_25.pretty.json:** Created 2025-06-28T21:00:07+00:00
- **Session #5:** Created 2025-06-28T20:12:33+00:00
- **Session #06_session_5.pretty.json:** Created 2025-06-28T20:12:33+00:00

## User Data Found

## API Endpoints Successfully Tested
- `https://hanon.artsmetrics.net/elevation/api/version` - Server version and features
- `https://hanon.artsmetrics.net/elevation/api/stats` - System statistics  
- `https://hanon.artsmetrics.net/elevation/api/gps-queue` - GPS processing queue
- `https://hanon.artsmetrics.net/elevation/api/queue/status` - Queue status details
- `https://hanon.artsmetrics.net/elevation/api/logs` - System logs
- `https://hanon.artsmetrics.net/elevation/api/session/lookup` - Session lookup by number
- `https://hanon.artsmetrics.net/elevation/api/user-sessions` - User session data (with userId parameter)
- `https://hanon.artsmetrics.net/elevation/api/user/points` - User GPS points (with userId parameter)

## Recommendations
1. **Active GPS Collection:** System shows 64 points in processing queue
2. **Session Management:** Global session numbering is working with 56 total sessions
3. **Data Export:** Use the JSON files for further analysis and visualization
4. **Real-time Monitoring:** Queue status shows current processing state

## Next Steps
1. Import GPS points into mapping software (QGIS, Google Earth, etc.)
2. Analyze session patterns and user behavior
3. Create visualizations from the collected data
4. Monitor queue processing efficiency
