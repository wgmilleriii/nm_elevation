# FileZilla Connection Guide

## Connection Details
- Host: 10.0.0.68
- Username: pi
- Password: (your password)
- Port: 22
- Protocol: SFTP

## Steps
1. Open FileZilla
2. Click "File" -> "Site Manager"
3. Click "New Site"
4. Enter the connection details above
5. Click "Connect"

## Files to Transfer
Only transfer these essential files:
- `config.json`
- `sync_databases.js`
- `setup_sync.sh`
- `collect_sparse_points.js`
- `check_completion.js`
- `package.json`
- `package-lock.json`

## Directory Structure
The main directory is: `/home/pi/nm_elevation/`

Key subdirectories:
- `/home/pi/nm_elevation/grid_databases/` - Database files
- `/home/pi/nm_elevation/backups/` - Backup files
- `/home/pi/nm_elevation/logs/` - Log files

## Tips
- You can drag and drop files between your computer and the Pi
- Right-click files to set permissions (chmod)
- Use the "Remote Site" panel to navigate the Pi's filesystem
- Use the "Local Site" panel to navigate your computer's filesystem

## After Transfer
1. SSH into the Pi
2. Navigate to `/home/pi/nm_elevation/`
3. Run `npm install` to install dependencies
4. Make setup script executable: `chmod +x setup_sync.sh`
5. Run setup: `./setup_sync.sh` 