#!/bin/bash

echo "Counting points in mother.db..."
sqlite3 mother.db "SELECT COUNT(*) as point_count FROM elevation_points;"

echo "Counting points in sandia_detail.db..."
sqlite3 sandia_detail.db "SELECT COUNT(*) as point_count FROM elevation_points;"

echo "Counting points in mountains_ne_sw.db..."
sqlite3 mountains_ne_sw.db "SELECT COUNT(*) as point_count FROM elevation_points;"

echo "Counting points in grid databases..."
for db in grid_databases/mountains_*.db; do
    echo "Database: $db"
    sqlite3 "$db" "SELECT COUNT(*) as point_count FROM elevation_points;"
done 