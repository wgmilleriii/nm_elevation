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

# Function to safely add and commit changes
safe_commit() {
    local dir=$1
    local message=$2
    
    # Check if there are any files to add
    if [ -z "$(ls -A $dir 2>/dev/null)" ]; then
        echo "No files found in $dir - skipping"
        return 0
    fi
    
    # Add files one by one to avoid unstable object issues
    for file in "$dir"/*; do
        if [ -f "$file" ]; then
            echo "Adding file: $file"
            git add "$file"
        fi
    done
    
    # Check if there are changes to commit
    if git diff --cached --quiet; then
        echo "No changes to commit"
        return 0
    else
        # Commit changes
        git commit -m "$message"
        return $?
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

# Create grid_databases directory if it doesn't exist
mkdir -p grid_databases

# Store current Git hash to check for changes
BEFORE_PULL_HASH=$(git rev-parse HEAD)

# First, pull any changes to avoid conflicts
echo "Pulling latest changes first..."
git pull

# Push database changes if any exist
echo "Checking for database changes..."
if safe_commit "grid_databases" "Auto-update: Database sync from Pi $(date '+%Y-%m-%d %H:%M:%S')"; then
    echo "Pushing changes..."
    git push || {
        echo "Push failed - will try again next time"
        exit 1
    }
else
    echo "Commit failed - will try again next time"
    exit 1
fi

# Pull new changes again to ensure we're up to date
echo "Pulling final changes..."
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