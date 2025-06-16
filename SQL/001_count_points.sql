-- Count points in each database
SELECT 'mother.db' as database_name, COUNT(*) as point_count 
FROM elevation_points;

SELECT 'sandia_detail.db' as database_name, COUNT(*) as point_count 
FROM elevation_points;

SELECT 'mountains_ne_sw.db' as database_name, COUNT(*) as point_count 
FROM elevation_points;

-- Count points in grid databases
SELECT 'grid_databases/mountains_*.db' as database_name, COUNT(*) as point_count 
FROM elevation_points; 