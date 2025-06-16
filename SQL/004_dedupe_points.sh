#!/bin/bash

# Script to deduplicate points in all databases
# This script will:
# 1. Create a temporary table with deduplicated points
# 2. Drop the original table
# 3. Rename the temporary table to the original name

echo "Starting deduplication process..."

for db in grid_databases/mountains_*_*.db; do
    echo "Processing $db..."
    
    # First try elevation_points table
    sqlite3 "$db" <<EOF
    -- Check if elevation_points table exists
    SELECT name FROM sqlite_master WHERE type='table' AND name='elevation_points';
EOF
    
    if [ $? -eq 0 ]; then
        echo "Deduplicating elevation_points table..."
        sqlite3 "$db" <<EOF
        -- Create temporary table with deduplicated points
        CREATE TABLE elevation_points_deduped AS
        SELECT 
            latitude,
            longitude,
            elevation,
            source,
            grid_level,
            MAX(collected_at) as collected_at
        FROM elevation_points
        GROUP BY latitude, longitude;

        -- Drop original table
        DROP TABLE elevation_points;

        -- Rename deduplicated table
        ALTER TABLE elevation_points_deduped RENAME TO elevation_points;

        -- Recreate indexes
        CREATE UNIQUE INDEX idx_lat_lon ON elevation_points(latitude, longitude);
        CREATE INDEX idx_grid_level ON elevation_points(grid_level);
EOF
    fi

    # Then try points table
    sqlite3 "$db" <<EOF
    -- Check if points table exists
    SELECT name FROM sqlite_master WHERE type='table' AND name='points';
EOF
    
    if [ $? -eq 0 ]; then
        echo "Deduplicating points table..."
        sqlite3 "$db" <<EOF
        -- Create temporary table with deduplicated points
        CREATE TABLE points_deduped AS
        SELECT 
            lat,
            lon,
            elevation,
            source,
            MAX(timestamp) as timestamp
        FROM points
        GROUP BY lat, lon;

        -- Drop original table
        DROP TABLE points;

        -- Rename deduplicated table
        ALTER TABLE points_deduped RENAME TO points;

        -- Recreate indexes
        CREATE UNIQUE INDEX idx_lat_lon ON points(lat, lon);
EOF
    fi

    # Get counts before and after
    echo "Database statistics after deduplication:"
    sqlite3 "$db" <<EOF
    SELECT 'elevation_points count:', COUNT(*) FROM elevation_points;
    SELECT 'points count:', COUNT(*) FROM points;
EOF

    echo "----------------------------------------"
done

echo "Deduplication complete!" 