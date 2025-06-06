#!/bin/bash

# Configuration
PI_HOST="raspberry@10.0.0.68"
PI_PATH="/home/raspberry/projects/nm_elevation/grid_databases/"
LOCAL_PATH="./grid_databases/"

# Function to check if we're on the Pi
is_pi() {
    if [ -f /etc/rpi-issue ]; then
        return 0  # True, we are on Pi
    else
        return 1  # False, we are not on Pi
    fi
}

# Function to sync databases
sync_dbs() {
    local source_path=$1
    local target_path=$2
    local direction=$3

    echo "Syncing databases ${direction}..."
    
    # Use rsync to sync only complete databases (10,000 points)
    # First, create a filter list of complete databases
    find "${source_path}" -name "mountains_*.db" -type f -exec sh -c '
        for db; do
            count=$(sqlite3 "$db" "SELECT COUNT(*) FROM points;")
            if [ "$count" -eq 10000 ]; then
                echo "$(basename "$db")"
            fi
        done
    ' sh {} + > complete_dbs.txt

    # Then use the filter list with rsync
    if [ -s complete_dbs.txt ]; then
        rsync -av --progress --files-from=complete_dbs.txt "${source_path}" "${target_path}"
    fi
    
    rm complete_dbs.txt
}

# Main sync logic
if is_pi; then
    echo "Running on Raspberry Pi"
    # On Pi, we pull from Mac
    sync_dbs "${LOCAL_PATH}" "${PI_PATH}" "from Mac to Pi"
else
    echo "Running on Mac"
    # On Mac, we pull from Pi
    sync_dbs "${PI_HOST}:${PI_PATH}" "${LOCAL_PATH}" "from Pi to Mac"
fi

echo "Sync complete!" 