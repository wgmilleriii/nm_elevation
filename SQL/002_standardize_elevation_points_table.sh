#!/bin/bash
set -e

echo "Standardizing elevation_points table schema in all grid_databases..."

for db in grid_databases/mountains_*_*.db; do
  echo "Checking $db..."
  # Get the schema of elevation_points
  schema=$(sqlite3 "$db" "PRAGMA table_info(elevation_points);")

  # Add missing columns as needed
  if ! echo "$schema" | grep -q 'source'; then
    echo "  Adding column 'source'..."
    sqlite3 "$db" "ALTER TABLE elevation_points ADD COLUMN source TEXT DEFAULT 'unknown';"
  fi
  if ! echo "$schema" | grep -q 'grid_level'; then
    echo "  Adding column 'grid_level'..."
    sqlite3 "$db" "ALTER TABLE elevation_points ADD COLUMN grid_level INTEGER DEFAULT 0;"
  fi
  if ! echo "$schema" | grep -q 'collected_at'; then
    echo "  Adding column 'collected_at'..."
    sqlite3 "$db" "ALTER TABLE elevation_points ADD COLUMN collected_at TIMESTAMP;"
    # Set collected_at to current timestamp for existing rows
    sqlite3 "$db" "UPDATE elevation_points SET collected_at = datetime('now') WHERE collected_at IS NULL;"
  fi

done

echo "Schema standardization complete." 