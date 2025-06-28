-- Create tracks table
CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    total_distance REAL NOT NULL,
    point_count INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create track points table
CREATE TABLE IF NOT EXISTS track_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation REAL,
    accuracy REAL NOT NULL,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES tracks(id)
);

-- Create indices for better query performance
CREATE INDEX IF NOT EXISTS idx_track_points_track_id ON track_points(track_id);
CREATE INDEX IF NOT EXISTS idx_track_points_timestamp ON track_points(timestamp);
CREATE INDEX IF NOT EXISTS idx_track_points_location ON track_points(latitude, longitude); 