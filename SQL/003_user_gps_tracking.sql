-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL UNIQUE,  -- Unique identifier for the device/browser
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    total_distance REAL,
    max_elevation REAL,
    min_elevation REAL,
    avg_elevation REAL,
    point_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create user track points table
CREATE TABLE IF NOT EXISTS user_track_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation REAL,
    accuracy REAL NOT NULL,
    timestamp DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indices for better query performance
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_time ON user_sessions(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_track_points_session ON user_track_points(session_id);
CREATE INDEX IF NOT EXISTS idx_track_points_user ON user_track_points(user_id);
CREATE INDEX IF NOT EXISTS idx_track_points_location ON user_track_points(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_track_points_timestamp ON user_track_points(timestamp); 