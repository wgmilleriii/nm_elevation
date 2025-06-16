#!/bin/bash
set -e

echo "Starting cleanup of points table in all grid_databases..."

for db in grid_databases/mountains_*_*.db; do
  echo "Processing $db..."
  # Check if points table exists
  if sqlite3 "$db" ".tables" | grep -qw points; then
    # Insert data from points to elevation_points, skipping duplicates
    sqlite3 "$db" "INSERT OR IGNORE INTO elevation_points (latitude, longitude, elevation, source, collected_at, grid_level) SELECT lat, lon, elevation, source, timestamp, 0 FROM points;"
    # Drop the points table
    sqlite3 "$db" "DROP TABLE IF EXISTS points;"
    echo "  Migrated and dropped points table."
  else
    echo "  No points table found, skipping."
  fi
done

echo "Cleanup complete." 