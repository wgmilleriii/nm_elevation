-- Setup synchronization tracking
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id TEXT NOT NULL,
    last_sync TIMESTAMP,
    status TEXT,
    grid_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id TEXT NOT NULL,
    grid_id INTEGER,
    points_collected INTEGER DEFAULT 0,
    total_points INTEGER,
    status TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sync_status_instance ON sync_status(instance_id);
CREATE INDEX IF NOT EXISTS idx_collection_status_instance ON collection_status(instance_id);
CREATE INDEX IF NOT EXISTS idx_collection_status_grid ON collection_status(grid_id); 