#!/bin/bash

# Configuration
PI_HOST="raspberry@10.0.0.68"

echo "=== NM Elevation Collection Status ==="
echo "Checking Pi status..."

# Check service status
echo -e "\nService Status:"
ssh $PI_HOST "systemctl status nm-elevation | grep Active:"

# Check current database
echo -e "\nCurrent Database Status:"
ssh $PI_HOST "sqlite3 ~/projects/nm_elevation/grid_databases/mountains_0_0.db \
    \"SELECT source, COUNT(*) as count, 
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage 
    FROM points GROUP BY source;\""

# Check total progress
echo -e "\nTotal Progress:"
ssh $PI_HOST "cd ~/projects/nm_elevation/grid_databases && \
    echo 'Complete DBs:' && \
    find . -name 'mountains_*.db' -type f -exec sqlite3 {} 'SELECT COUNT(*) FROM points;' \; | \
    awk '\$1 == 10000 {complete++} END {print complete \" / 100 grid cells\"}'" 