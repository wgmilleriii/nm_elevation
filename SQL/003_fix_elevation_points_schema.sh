#!/bin/bash
set -e

echo "Fixing elevation_points schema in affected databases..."

affected_dbs=(
  grid_databases/mountains_31_-104.db
  grid_databases/mountains_31_-105.db
  grid_databases/mountains_31_-106.db
  grid_databases/mountains_31_-107.db
  grid_databases/mountains_31_-108.db
  grid_databases/mountains_31_-109.db
  grid_databases/mountains_31_-110.db
  grid_databases/mountains_32_-104.db
  grid_databases/mountains_32_-105.db
  grid_databases/mountains_32_-106.db
  grid_databases/mountains_32_-107.db
  grid_databases/mountains_32_-108.db
  grid_databases/mountains_32_-109.db
  grid_databases/mountains_32_-110.db
  grid_databases/mountains_33_-104.db
  grid_databases/mountains_33_-105.db
  grid_databases/mountains_33_-106.db
  grid_databases/mountains_33_-107.db
  grid_databases/mountains_33_-108.db
  grid_databases/mountains_33_-109.db
  grid_databases/mountains_33_-110.db
  grid_databases/mountains_34_-104.db
  grid_databases/mountains_34_-105.db
  grid_databases/mountains_34_-106.db
  grid_databases/mountains_34_-107.db
  grid_databases/mountains_34_-108.db
  grid_databases/mountains_34_-109.db
  grid_databases/mountains_34_-110.db
  grid_databases/mountains_35_-104.db
  grid_databases/mountains_35_-105.db
  grid_databases/mountains_35_-106.db
  grid_databases/mountains_35_-107.db
  grid_databases/mountains_35_-108.db
  grid_databases/mountains_35_-109.db
  grid_databases/mountains_35_-110.db
  grid_databases/mountains_36_-104.db
  grid_databases/mountains_36_-105.db
  grid_databases/mountains_36_-106.db
  grid_databases/mountains_36_-107.db
  grid_databases/mountains_36_-108.db
  grid_databases/mountains_36_-109.db
  grid_databases/mountains_36_-110.db
)

for db in "${affected_dbs[@]}"; do
  echo "Fixing $db..."
  sqlite3 "$db" "
    PRAGMA foreign_keys=off;
    BEGIN TRANSACTION;
    CREATE TABLE elevation_points_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation REAL NOT NULL,
      source TEXT NOT NULL DEFAULT 'unknown',
      grid_level INTEGER NOT NULL DEFAULT 0,
      collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(latitude, longitude)
    );
    INSERT OR IGNORE INTO elevation_points_new (id, latitude, longitude, elevation, source, grid_level, collected_at)
      SELECT id, lat, lon, elevation, source, grid_level, COALESCE(collected_at, timestamp, datetime('now')) FROM elevation_points;
    DROP TABLE elevation_points;
    ALTER TABLE elevation_points_new RENAME TO elevation_points;
    COMMIT;
    PRAGMA foreign_keys=on;
  "
  echo "Done with $db."
done

echo "Schema fix complete." 