-- Initial schema for elevation points database
CREATE TABLE IF NOT EXISTS elevation_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation REAL NOT NULL,
    source TEXT NOT NULL,
    grid_level INTEGER NOT NULL DEFAULT 0,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(latitude, longitude)
);

CREATE TABLE IF NOT EXISTS collection_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    current_level INTEGER NOT NULL,
    points_collected INTEGER NOT NULL,
    bounds TEXT NOT NULL,
    grid_size INTEGER NOT NULL,
    current_i INTEGER NOT NULL,
    current_j INTEGER NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_points_location ON elevation_points(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_points_grid_level ON elevation_points(grid_level); 