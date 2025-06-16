#!/usr/bin/env python3

import requests
import sqlite3
import time
import json
import os
from datetime import datetime
from tqdm import tqdm

# Ensure data directory exists
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
os.makedirs(DATA_DIR, exist_ok=True)
# Sandia ridgeline bounds - focused on the main ridge and peak
BOUNDS = {
    'min_lat': 35.18,
    'max_lat': 35.25,
    'min_lon': -106.45,
    'max_lon': -106.38
}

# Configuration
GRID_SPACING = 0.0001  # About 11 meters
BATCH_SIZE = 50
RETRY_DELAY = 2  # seconds
MAX_RETRIES = 3

# API Configurations
APIS = [
    {
        'name': 'opentopodata-srtm',
        'url': 'https://api.opentopodata.org/v1/srtm30m',
        'batch_support': True
    },
    {
        'name': 'opentopodata-aster',
        'url': 'https://api.opentopodata.org/v1/aster30m',
        'batch_support': True
    },
    {
        'name': 'open-elevation',
        'url': 'https://api.open-elevation.com/api/v1/lookup',
        'batch_support': True
    }
]

def create_db():
    """Create or connect to the database with improved schema"""
    conn = sqlite3.connect('sandia_detail.db')
    cur = conn.cursor()
    
    # Check if table exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='elevation_points'")
    table_exists = cur.fetchone() is not None

    if table_exists:
        # Get current columns
        cur.execute("PRAGMA table_info(elevation_points)")
        columns = {row[1] for row in cur.fetchall()}
        
        # Add missing columns if needed
        if 'confidence' not in columns:
            cur.execute('ALTER TABLE elevation_points ADD COLUMN confidence REAL DEFAULT 1.0')
        if 'collection_date' not in columns:
            cur.execute('ALTER TABLE elevation_points ADD COLUMN collection_date DATETIME')
        if 'last_updated' not in columns:
            cur.execute('ALTER TABLE elevation_points ADD COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP')
    else:
        # Create new table with full schema
        cur.execute('''
            CREATE TABLE elevation_points (
                latitude REAL,
                longitude REAL,
                elevation REAL,
                source TEXT,
                confidence REAL DEFAULT 1.0,
                collection_date DATETIME,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (latitude, longitude)
            )
        ''')
    
    # Add indices for better query performance
    cur.execute('CREATE INDEX IF NOT EXISTS idx_lat_lon ON elevation_points(latitude, longitude)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_elevation ON elevation_points(elevation)')
    cur.execute('CREATE INDEX IF NOT EXISTS idx_source ON elevation_points(source)')
    
    conn.commit()
    return conn, cur

def fetch_elevation_batch(points, api):
    """Fetch elevation data for a batch of points from specified API"""
    locations = '|'.join(f"{lat},{lon}" for lat, lon in points)
    url = f"{api['url']}?locations={locations}"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if 'results' in data:
            results = []
            for i, result in enumerate(data['results']):
                lat, lon = points[i]
                if isinstance(result, dict):
                    elevation = result.get('elevation')
                    if elevation is not None:
                        results.append({
                            'latitude': lat,
                            'longitude': lon,
                            'elevation': elevation,
                            'source': api['name'],
                            'confidence': 1.0
                        })
            return results
    except Exception as e:
        print(f"Error with {api['name']}: {str(e)}")
    return None

def collect_data():
    """Collect elevation data with improved error handling and progress tracking"""
    conn, cur = create_db()
    
    # Generate grid points
    points = []
    lat = BOUNDS['min_lat']
    while lat <= BOUNDS['max_lat']:
        lon = BOUNDS['min_lon']
        while lon <= BOUNDS['max_lon']:
            points.append((lat, lon))
            lon += GRID_SPACING
        lat += GRID_SPACING
    
    total_points = len(points)
    print(f"Starting collection for {total_points:,} points...")
    
    # Track statistics
    stats = {
        'total': total_points,
        'collected': 0,
        'failed': 0,
        'start_time': datetime.now()
    }
    
    # Process in batches
    for i in tqdm(range(0, total_points, BATCH_SIZE)):
        batch = points[i:i + BATCH_SIZE]
        success = False
        
        # Try each API until successful
        for api in APIS:
            retries = 0
            while retries < MAX_RETRIES and not success:
                results = fetch_elevation_batch(batch, api)
                if results:
                    try:
                        # Insert successful results
                        cur.executemany('''
                            INSERT OR REPLACE INTO elevation_points 
                            (latitude, longitude, elevation, source, confidence, collection_date)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ''', [(r['latitude'], r['longitude'], r['elevation'], 
                              r['source'], r['confidence'], datetime.now().isoformat())
                             for r in results])
                        
                        conn.commit()
                        stats['collected'] += len(results)
                        success = True
                        break
                    except sqlite3.Error as e:
                        print(f"\nDatabase error: {e}")
                        print("Continuing with next batch...")
                        break
                
                retries += 1
                if retries < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)
        
        if not success:
            stats['failed'] += len(batch)
        
        # Periodic progress report
        if i % (BATCH_SIZE * 10) == 0:
            elapsed = (datetime.now() - stats['start_time']).total_seconds()
            rate = stats['collected'] / elapsed if elapsed > 0 else 0
            print(f"\nProgress: {stats['collected']:,} collected, "
                  f"{stats['failed']:,} failed, "
                  f"{rate:.1f} points/second")
    
    # Final statistics
    try:
        cur.execute('SELECT COUNT(*), MIN(elevation), MAX(elevation), AVG(elevation) FROM elevation_points')
        count, min_elev, max_elev, avg_elev = cur.fetchone()
        
        print(f"\nCollection complete!")
        print(f"Total points collected: {count:,}")
        print(f"Elevation range: {min_elev:.1f}m to {max_elev:.1f}m (avg: {avg_elev:.1f}m)")
        print(f"Failed points: {stats['failed']:,}")
        
        # Source distribution
        cur.execute('SELECT source, COUNT(*) FROM elevation_points GROUP BY source')
        sources = cur.fetchall()
        print("\nData sources:")
        for source, count in sources:
            print(f"  {source}: {count:,} points")
    except sqlite3.Error as e:
        print(f"\nError getting statistics: {e}")
    finally:
        conn.commit()
        conn.close()

if __name__ == '__main__':
    collect_data() 