# Raspberry Pi Data Collection Service

## Setup
The Pi is configured to automatically collect elevation data across all grid cells (10x10 grid = 100 cells total).

### Service Location
- Working Directory: `/home/raspberry/projects/nm_elevation`
- Service File: `/etc/systemd/system/nm-elevation.service`
- Collection Script: `collect_service.sh`

### Service Management
```bash
# Check service status
systemctl status nm-elevation

# View logs
tail -f collection.log

# Stop service if needed
sudo systemctl stop nm-elevation

# Start service
sudo systemctl start nm-elevation
```

### Data Storage
- Database Location: `grid_databases/mountains_X_Y.db`
- Each database collects 10,000 points
- Even distribution across 4 sources:
  - aster30m (25%)
  - open-elevation (25%)
  - open-meteo (25%)
  - srtm30m (25%)

### Progress Monitoring
```bash
# Check current database points
sqlite3 grid_databases/mountains_0_0.db 'SELECT COUNT(*) as count, source FROM points GROUP BY source;'

# List all databases and their counts
for db in grid_databases/mountains_*.db; do 
    echo -n "$db: "
    sqlite3 "$db" 'SELECT COUNT(*) FROM points;'
done
``` 