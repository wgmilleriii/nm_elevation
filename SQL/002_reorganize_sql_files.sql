-- SQL/002_reorganize_sql_files.sql
-- Purpose: Reorganize existing SQL files to follow proper versioning format
-- Created: 2025-01-28
-- Following .cursorrules: "write all SQL files to a folder SQL for versioning with filenamed 001.sql, 002.sql etc"

-- This file documents the reorganization of existing SQL files:
-- 
-- EXISTING FILES (to be renamed/reorganized):
-- - 000_setup_database.sql -> should be 001_setup_database.sql (primary setup)
-- - 001.sql -> should be 002_initial_schema.sql (better name)
-- - 001_initial_schema.sql -> should be 003_elevation_schema.sql
-- - 001_setup_sync.sql -> should be 004_sync_setup.sql
-- - 001_create_interaction_tables.sql -> should be 005_interaction_tables.sql
-- - 001_count_points.sql -> should be 006_utility_count_points.sql

-- REORGANIZATION PLAN:
-- 001.sql - Primary database setup and configuration
-- 002.sql - Initial schema creation
-- 003.sql - Elevation data schema
-- 004.sql - Sync configuration
-- 005.sql - Interaction tables
-- 006.sql - Utility queries and maintenance

-- MySQL Connection Test (as per .cursorrules)
-- mysql port 3307 username root password root or nothing

-- Test connection:
-- mysql -P 3307 -u root -p
-- (password: root or blank)

SELECT 'SQL file reorganization documented' as status;