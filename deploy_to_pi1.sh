#!/bin/bash

# Files to transfer
FILES=(
    "config.json"
    "sync_databases.js"
    "setup_sync.sh"
    "collect_sparse_points.js"
    "check_completion.js"
)

# Make setup script executable
chmod +x setup_sync.sh

# Transfer files to pi1
echo "Transferring files to pi1..."
for file in "${FILES[@]}"; do
    scp "$file" pi@10.0.0.68:/home/pi/nm_elevation/
done

# Execute setup on pi1
echo "Running setup on pi1..."
ssh pi@10.0.0.68 "cd /home/pi/nm_elevation && chmod +x setup_sync.sh && ./setup_sync.sh"

echo "Deployment complete! Check status on pi1 with:"
echo "ssh pi@10.0.0.68 'sudo systemctl status nm-elevation-sync'"
echo "ssh pi@10.0.0.68 'sudo systemctl status nm-elevation-backup.timer'" 