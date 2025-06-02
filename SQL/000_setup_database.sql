-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS elevation_tracking;

-- Use the database
USE elevation_tracking;

-- Create tables for interaction tracking and improvements
CREATE TABLE IF NOT EXISTS interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    actor ENUM('PC', 'MAC') NOT NULL,
    command TEXT NOT NULL,
    interpretation TEXT,
    changes_made TEXT,
    efficiency_suggestions TEXT,
    next_steps TEXT
);

CREATE TABLE IF NOT EXISTS improvements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    priority INT DEFAULT 3,
    assigned_to VARCHAR(50),
    completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS automation_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    script_name VARCHAR(100) NOT NULL,
    status ENUM('success', 'failure', 'warning') NOT NULL,
    message TEXT,
    execution_time FLOAT,
    affected_files TEXT
);

-- Create indexes for better query performance
CREATE INDEX idx_interactions_timestamp ON interactions(timestamp);
CREATE INDEX idx_improvements_status ON improvements(status);
CREATE INDEX idx_automation_logs_script ON automation_logs(script_name);

-- Insert initial improvements
INSERT INTO improvements (category, description, priority) VALUES
('automation', 'Set up automated testing', 1),
('documentation', 'Update README with new features', 2),
('performance', 'Optimize database queries', 2),
('security', 'Implement proper authentication', 1); 