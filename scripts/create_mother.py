#!/usr/bin/env python3

import sqlite3
import glob
import os
from tqdm import tqdm

def create_mother_db():
    # Path to mother database
    mother_path = 'mother.db'
    
    # Remove existing mother.db if it exists
    if os.path.exists(mother_path):
        os.remove(mother_path)
    
    # Create mother database and table
    mother_conn = sqlite3.connect(mother_path)
    mother_cur = mother_conn.cursor()
    
    # Create table with same schema as grid databases
    mother_cur.execute('''
        CREATE TABLE IF NOT EXISTS elevation_points (
            latitude REAL,
            longitude REAL,
            elevation REAL,
            PRIMARY KEY (latitude, longitude)
        )
    ''')
    
    # Get list of all grid databases
    grid_dbs = glob.glob('grid_databases/mountains_*.db')
    print(f"Found {len(grid_dbs)} grid databases")
    
    # Create index after all data is inserted for better performance
    total_points = 0
    
    # Process each database
    for db_path in tqdm(grid_dbs, desc="Processing databases"):
        try:
            # Connect to grid database
            grid_conn = sqlite3.connect(db_path)
            grid_cur = grid_conn.cursor()
            
            # Get all points from this database
            grid_cur.execute('SELECT latitude, longitude, elevation FROM elevation_points WHERE elevation IS NOT NULL')
            points = grid_cur.fetchall()
            
            if points:
                # Insert points into mother database, ignore duplicates
                mother_cur.executemany('''
                    INSERT OR REPLACE INTO elevation_points (latitude, longitude, elevation)
                    VALUES (?, ?, ?)
                ''', points)
                
                total_points += len(points)
            
            # Commit after each database to save progress
            mother_conn.commit()
            grid_conn.close()
            
        except sqlite3.Error as e:
            print(f"Error processing {db_path}: {e}")
            continue
    
    print(f"\nCreating spatial index...")
    mother_cur.execute('''
        CREATE INDEX IF NOT EXISTS idx_lat_lon 
        ON elevation_points(latitude, longitude)
    ''')
    
    # Create index on elevation for efficient min/max queries
    print("Creating elevation index...")
    mother_cur.execute('''
        CREATE INDEX IF NOT EXISTS idx_elevation 
        ON elevation_points(elevation)
    ''')
    
    # Get some stats
    mother_cur.execute('SELECT COUNT(*) FROM elevation_points')
    final_count = mother_cur.fetchone()[0]
    
    mother_cur.execute('SELECT MIN(elevation), MAX(elevation) FROM elevation_points')
    min_elev, max_elev = mother_cur.fetchone()
    
    mother_cur.execute('SELECT MIN(latitude), MAX(latitude), MIN(longitude), MAX(longitude) FROM elevation_points')
    min_lat, max_lat, min_lon, max_lon = mother_cur.fetchone()
    
    print(f"\nMother database created successfully!")
    print(f"Total points: {final_count:,}")
    print(f"Elevation range: {min_elev:.1f}m to {max_elev:.1f}m")
    print(f"Coverage area: {min_lat:.4f}°N to {max_lat:.4f}°N, {min_lon:.4f}°W to {max_lon:.4f}°W")
    
    # Close connections
    mother_conn.commit()
    mother_conn.close()

if __name__ == '__main__':
    create_mother_db() 