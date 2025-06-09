#!/bin/bash

# Set working directory to script location
cd "$(dirname "$0")"

# Start the main server in the background
node server.js &
SERVER_PID=$!

# Initialize grid position
CURRENT_LAT=31.33
CURRENT_LON=-109.05
GRID_SIZE=1.0  # 1 degree grid size

echo "Starting collection service..."
while true; do
    # Calculate bounds for current grid cell
    BOUNDS="${CURRENT_LAT},${CURRENT_LON},$(echo "${CURRENT_LAT} + ${GRID_SIZE}" | bc),$(echo "${CURRENT_LON} + ${GRID_SIZE}" | bc)"
    echo "Collecting data for bounds: ${BOUNDS}"
    
    # Run the collection script with current bounds
    node collect_sparse_points.js --bounds=${BOUNDS}
    EXIT_CODE=$?
    
    echo "Process exited with code $EXIT_CODE at $(date)"
    
    # If exit code is 0 (success/completion), move to next grid cell
    if [ $EXIT_CODE -eq 0 ]; then
        # Move to next longitude
        CURRENT_LON=$(echo "${CURRENT_LON} + ${GRID_SIZE}" | bc)
        
        # If we've reached the eastern boundary, move north and reset longitude
        if (( $(echo "${CURRENT_LON} >= -103.00" | bc -l) )); then
            CURRENT_LON=-109.05
            CURRENT_LAT=$(echo "${CURRENT_LAT} + ${GRID_SIZE}" | bc)
            
            # If we've reached the northern boundary, start over
            if (( $(echo "${CURRENT_LAT} >= 37.00" | bc -l) )); then
                CURRENT_LAT=31.33
                echo "Completed full New Mexico scan. Starting over..."
                sleep 3600  # Wait an hour before starting over
            fi
        fi
        
        echo "Moving to next grid cell: ${CURRENT_LAT}, ${CURRENT_LON}"
        sleep 60  # Wait a minute before starting next cell
    else
        # If the process crashed (non-zero exit), wait 5 minutes before restart
        echo "Process failed. Waiting 5 minutes before restart..."
        sleep 300  # Wait 5 minutes
    fi
done 