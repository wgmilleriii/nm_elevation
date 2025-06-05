#!/bin/bash

# Configuration
PI1_IP="10.0.0.68"
LOCAL_DATA_DIR="/c/Users/Wgmil/OneDrive/Documents/GitHub/nm_elevation/data"
PI_DATA_DIR="/home/pi/nm_elevation/data"

# Create data directories if they don't exist
mkdir -p "$LOCAL_DATA_DIR"

# Function to sync data
sync_data() {
    local source=$1
    local dest=$2
    echo "Syncing from $source to $dest"
    rsync -avz --delete "$source" "$dest"
}

# Sync from Pi1 to local PC
echo "Syncing from Pi1 to local PC..."
sync_data "pi@$PI1_IP:$PI_DATA_DIR/" "$LOCAL_DATA_DIR/"

# Sync from local PC to Pi1
echo "Syncing from local PC to Pi1..."
sync_data "$LOCAL_DATA_DIR/" "pi@$PI1_IP:$PI_DATA_DIR/"

echo "Sync complete!" 