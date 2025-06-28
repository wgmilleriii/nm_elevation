-- Create a simple journey tracking schema
CREATE TABLE IF NOT EXISTS journeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    start_lat REAL,
    start_lon REAL,
    end_lat REAL,
    end_lon REAL,
    total_distance REAL,  -- in kilometers
    avg_speed REAL       -- in km/h
);

CREATE TABLE IF NOT EXISTS journey_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    journey_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation REAL,
    speed REAL,         -- in km/h
    heading REAL,       -- in degrees
    accuracy REAL,      -- in meters
    nearest_landmark TEXT,
    distance_to_landmark REAL, -- in kilometers
    FOREIGN KEY (journey_id) REFERENCES journeys(id)
);

-- Create indices for better query performance
CREATE INDEX IF NOT EXISTS idx_journey_points_journey ON journey_points(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_points_time ON journey_points(timestamp);
CREATE INDEX IF NOT EXISTS idx_journey_points_location ON journey_points(latitude, longitude); 