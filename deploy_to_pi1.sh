#!/bin/bash

# Pi configuration
PI_IP="10.0.0.68"
PI_USER="raspberry"
PI_PATH="/home/pi/nm_elevation"

# Files to transfer
FILES=(
    "package.json"
    "package-lock.json"
    "config.json"
    "collect_sparse_points.js"
    "check_and_lock_db.js"
    "check_completion.js"
    "check_grid.js"
    "check_schema.js"
    "sync_databases.js"
    "merge_databases.js"
    "update_schema.js"
    "sync_data.sh"
)

# Create necessary directories on Pi
echo "Creating directories on Pi ($PI_IP)..."
ssh ${PI_USER}@${PI_IP} "mkdir -p ${PI_PATH}/{grid_databases,logs,locks,PI}"

# Make scripts executable locally
chmod +x sync_data.sh

# Transfer files to Pi
echo "Transferring files to Pi ($PI_IP)..."
for file in "${FILES[@]}"; do
    echo "Copying $file..."
    scp "$file" ${PI_USER}@${PI_IP}:${PI_PATH}/
done

# Transfer any existing databases
echo "Transferring grid databases..."
scp -r grid_databases/* ${PI_USER}@${PI_IP}:${PI_PATH}/grid_databases/

# Setup on Pi
echo "Setting up on Pi..."
ssh ${PI_USER}@${PI_IP} "cd ${PI_PATH} && npm install && chmod +x sync_data.sh"

echo "Deployment complete!"
echo "To start collection on Pi:"
echo "ssh ${PI_USER}@${PI_IP} 'cd ${PI_PATH} && npm start'"
echo "To monitor progress:"
echo "ssh ${PI_USER}@${PI_IP} 'cd ${PI_PATH} && node check_completion.js'" 