# Pi Setup Files

## Essential Files for Transfer

### Core Files
- `package.json` - Dependencies and scripts
- `package-lock.json` - Exact dependency versions
- `config.json` - Configuration settings
- `collect_sparse_points.js` - Main collection script
- `check_and_lock_db.js` - Database locking mechanism

### Utility Scripts
- `check_completion.js` - Monitor collection progress
- `check_grid.js` - Grid status verification
- `check_schema.js` - Database schema validation
- `sync_databases.js` - Database synchronization
- `merge_databases.js` - Database merging utility
- `update_schema.js` - Schema updates
- `sync_data.sh` - Data synchronization script

### Database Management
- `mountains.db` (if exists) - Main database file
- `/grid_databases/` directory - For storing grid-specific databases

### Directory Structure
```
/home/pi/nm_elevation/
├── package.json
├── package-lock.json
├── config.json
├── collect_sparse_points.js
├── check_and_lock_db.js
├── check_completion.js
├── check_grid.js
├── check_schema.js
├── sync_databases.js
├── merge_databases.js
├── update_schema.js
├── sync_data.sh
├── grid_databases/
├── logs/
├── locks/
└── PI/
```

## Transfer Instructions

1. Create the base directory on Pi:
```bash
ssh raspberry@pi1 "mkdir -p /home/pi/nm_elevation/{grid_databases,logs,locks,PI}"
```

2. FTP/SCP Transfer Commands:
```bash
# From your Mac terminal:
cd /Users/willismiller/Documents/GitHub/nm_elevation

# Transfer core files
scp package.json package-lock.json config.json collect_sparse_points.js check_and_lock_db.js raspberry@pi1:/home/pi/nm_elevation/

# Transfer utility scripts
scp check_completion.js check_grid.js check_schema.js sync_databases.js merge_databases.js update_schema.js sync_data.sh raspberry@pi1:/home/pi/nm_elevation/

# Transfer any existing databases
scp -r grid_databases/* raspberry@pi1:/home/pi/nm_elevation/grid_databases/
```

3. Post-Transfer Setup:
```bash
# SSH into Pi
ssh raspberry@pi1

# Navigate to project directory
cd /home/pi/nm_elevation

# Install dependencies
npm install

# Make shell scripts executable
chmod +x sync_data.sh

# Start collection
npm start
```

## Important Notes
- Ensure Pi has Node.js installed (v20.11.1 or later recommended)
- Check network connectivity before transfer
- Verify Pi has sufficient storage space (at least 1GB free recommended)
- The Pi will use its own logs/ and locks/ directories
- Collection will automatically start from incomplete grid sections
- Database files can get large, consider transferring only necessary grid sections
- Use `check_completion.js` to monitor progress
- Use `sync_databases.js` for periodic synchronization with other devices

## Monitoring Commands
```bash
# Check collection progress
node check_completion.js

# Verify grid status
node check_grid.js

# Check database schema
node check_schema.js

# Monitor logs
tail -f logs/collection_progress.log
``` 