-- SQL/001.sql
-- Initial database schema for New Mexico Elevation Data

-- Main elevation points table
CREATE TABLE IF NOT EXISTS elevation_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation REAL NOT NULL,
    collection_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    collection_direction TEXT CHECK(collection_direction IN ('ne_to_sw', 'sw_to_ne')),
    UNIQUE(latitude, longitude)
);

-- Create indices for faster querying
CREATE INDEX IF NOT EXISTS idx_lat_long ON elevation_points(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_elevation ON elevation_points(elevation);

-- Collection progress tracking table
CREATE TABLE IF NOT EXISTS collection_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    current_lat REAL NOT NULL,
    current_long REAL NOT NULL,
    direction TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Collection statistics table
CREATE TABLE IF NOT EXISTS collection_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_points INTEGER NOT NULL DEFAULT 0,
    min_elevation REAL,
    max_elevation REAL,
    avg_elevation REAL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
); 