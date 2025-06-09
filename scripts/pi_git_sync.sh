#!/bin/bash

# Function to check if we're running on the specific Pi setup
check_if_pi() {
    local username=$(whoami)
    local hostname=$(hostname)
    
    if [ "$username" = "raspberry" ] && [ "$hostname" = "pi1" ]; then
        return 0  # True, this is our specific Pi
    else
        return 1  # False, not our Pi
    fi
}

# Function to restart the collect sparse points service
restart_service() {
    echo "Restarting collect_sparse_points service..."
    # First try systemctl if it exists
    if command -v systemctl >/dev/null 2>&1; then
        sudo systemctl restart collect_sparse_points.service
    else
        # Fallback to manual process management
        pkill -f "node collect_sparse_points.js"
        nohup node collect_sparse_points.js > collect_sparse_points.log 2>&1 &
    fi
}

# Main script execution
if ! check_if_pi; then
    echo "This script must be run on the specific Raspberry Pi setup"
    exit 1
fi

# Ensure we're in the correct directory
cd /home/raspberry/projects/nm_elevation || {
    echo "Failed to change to nm_elevation directory"
    exit 1
}

echo "Running on Raspberry Pi - proceeding with sync operations..."

# Store current Git hash to check for changes
BEFORE_PULL_HASH=$(git rev-parse HEAD)

# Push database changes
echo "Pushing database changes..."
git add data/*.json
git commit -m "Auto-update: Database sync from Pi $(date '+%Y-%m-%d %H:%M:%S')" || true
git push

# Pull new changes
echo "Pulling new changes..."
git pull

# Check if there were any changes
AFTER_PULL_HASH=$(git rev-parse HEAD)

if [ "$BEFORE_PULL_HASH" != "$AFTER_PULL_HASH" ]; then
    echo "Changes detected in pull - restarting service..."
    restart_service
else
    echo "No changes detected - service restart not needed"
fi

echo "Git sync completed successfully" 