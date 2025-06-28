-- SQL/003_mysql_connection_test.sql
-- Purpose: Test MySQL connection as specified in .cursorrules
-- Created: 2025-01-28
-- Connection: mysql port 3307 username root password root or nothing

-- Connection test commands:
-- mysql -P 3307 -u root -p
-- mysql -P 3307 -u root -proot
-- mysql -P 3307 -u root

-- Basic connection verification
SELECT 'MySQL connection test successful' as test_result;
SELECT NOW() as current_time;
SELECT VERSION() as mysql_version;

-- Show available databases
SHOW DATABASES;

-- Test basic operations
CREATE DATABASE IF NOT EXISTS test_connection;
USE test_connection;

CREATE TABLE IF NOT EXISTS connection_test (
    id INT AUTO_INCREMENT PRIMARY KEY,
    test_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    test_message VARCHAR(255)
);

INSERT INTO connection_test (test_message) VALUES ('Connection test successful');

SELECT * FROM connection_test;

-- Cleanup
DROP TABLE IF EXISTS connection_test;
DROP DATABASE IF EXISTS test_connection;