#!/bin/bash

# Set working directory to script location
cd "$(dirname "$0")"

# Start the collection service with automatic restart
echo "Starting collection service with automatic restart..."
while true; do
    node collect_sparse_points.js
    EXIT_CODE=$?
    
    echo "Process exited with code $EXIT_CODE at $(date)"
    
    # If the process crashed (non-zero exit), wait 5 minutes before restart
    if [ $EXIT_CODE -ne 0 ]; then
        echo "Waiting 5 minutes before restart..."
        sleep 300
    fi
done 