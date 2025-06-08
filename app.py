from flask import Flask, render_template, request, send_file, url_for, jsonify
import os
import glob
from generate_contour_map import create_contour_map, get_elevation_data, generate_contour_map
import time
from datetime import datetime
import sqlite3
import subprocess
import json

app = Flask(__name__)

@app.route('/')
def home():
    maps = []
    for color_mode in ['bw', 'color']:
        pattern = os.path.normpath(f'public/images/contour_map_{color_mode}*.png')
        print(f"\nSearching for pattern: {pattern}")
        for file in glob.glob(pattern):
            print(f"Found file: {file}")
            # Convert to forward slashes and remove public/ prefix
            static_path = file.replace('\\', '/').replace('public/', '')
            maps.append({
                'file': static_path,
                'color_mode': color_mode,
                'date': 'Unknown',  # Simplified for now
                'timestamp': os.path.basename(file)  # Use full filename as timestamp
            })
    print(f"\nFound {len(maps)} maps")
    return render_template('index.html', maps=maps)

@app.route('/generate_map', methods=['GET'])
def generate_map():
    try:
        # Get parameters from request
        north = float(request.args.get('north', 35.3))
        south = float(request.args.get('south', 35.0))
        east = float(request.args.get('east', -106.4))
        west = float(request.args.get('west', -106.7))
        color_mode = request.args.get('color_mode', 'color')
        
        # Generate timestamp for unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Generate the map
        bounds = {
            'minLat': south,
            'maxLat': north,
            'minLon': west,
            'maxLon': east
        }
        
        # Generate both color and BW versions
        generate_contour_map(bounds=bounds, color_mode='color')
        generate_contour_map(bounds=bounds, color_mode='bw')
        
        # Return success response
        return jsonify({
            'status': 'success',
            'message': 'Map generated successfully',
            'timestamp': timestamp,
            'bounds': bounds
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/get_map')
def get_map():
    color_mode = request.args.get('color_mode', 'bw')
    map_file = os.path.normpath(f'public/images/contour_map_{color_mode}.png')
    return send_file(map_file, mimetype='image/png', max_age=0)

@app.route('/get_historical_maps')
def get_historical_maps():
    maps = []
    for color_mode in ['bw', 'color']:
        pattern = os.path.normpath(f'public/images/contour_map_{color_mode}_*.png')
        for file in glob.glob(pattern):
            timestamp = os.path.basename(file).split('_')[-1].replace('.png', '')
            if len(timestamp) != 15 or not timestamp.replace('_', '').isdigit():
                print(f"Skipping invalid timestamp file: {file}")
                continue
            try:
                date = datetime.fromtimestamp(
                    time.mktime(time.strptime(timestamp, '%Y%m%d_%H%M%S')))
                maps.append({
                    'file': os.path.normpath(file.replace('public/', '')),
                    'color_mode': color_mode,
                    'timestamp': timestamp,
                    'date': date.strftime('%Y-%m-%d %H:%M:%S')
                })
            except ValueError:
                print(f"Skipping file with ValueError: {file}")
                continue
    maps.sort(key=lambda x: x['timestamp'], reverse=True)
    return jsonify(maps)

@app.route('/generate_map_bounds')
def generate_map_bounds():
    try:
        # Get parameters from request
        color_mode = request.args.get('color_mode', 'bw')
        north = float(request.args.get('north', 0))
        south = float(request.args.get('south', 0))
        east = float(request.args.get('east', 0))
        west = float(request.args.get('west', 0))
        
        print(f"\nGenerating map with bounds: north={north}, south={south}, east={east}, west={west}")
        
        # Create bounds object for collect_sparse_points.js
        bounds = {
            "minLat": min(north, south),
            "maxLat": max(north, south),
            "minLon": min(east, west),
            "maxLon": max(east, west)
        }
        
        # Write bounds to enhance_bounds.json
        with open('enhance_bounds.json', 'w') as f:
            json.dump(bounds, f)
        
        # Call collect_sparse_points.js
        print("\nStarting data collection...")
        try:
            result = subprocess.run(['node', 'collect_sparse_points.js'], 
                                 capture_output=True, 
                                 text=True, 
                                 check=True)
            print("Data collection output:", result.stdout)
        except subprocess.CalledProcessError as e:
            print("Error running collect_sparse_points.js:", e.stderr)
            return jsonify({'success': False, 'error': f'Data collection failed: {e.stderr}'})
        
        # Generate the contour map
        print("\nGenerating contour map...")
        generate_contour_map(color_mode, bounds)
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error generating map: {e}")
        import traceback
        print("Full traceback:")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)})

@app.route('/test_db')
def test_db():
    try:
        # Test a specific database
        db_file = 'grid_databases/mountains_0_0.db'
        print(f"\nTesting database: {db_file}")
        
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # Check table structure
        cursor.execute("PRAGMA table_info(elevation_points)")
        columns = cursor.fetchall()
        print(f"Table structure: {columns}")
        
        # Get total points
        cursor.execute("SELECT COUNT(*) FROM elevation_points")
        total_points = cursor.fetchone()[0]
        print(f"Total points in database: {total_points}")
        
        # Get sample points
        cursor.execute("SELECT latitude, longitude, elevation FROM elevation_points LIMIT 5")
        samples = cursor.fetchall()
        print(f"Sample points: {samples}")
        
        conn.close()
        
        return jsonify({
            'success': True,
            'table_structure': columns,
            'total_points': total_points,
            'sample_points': samples
        })
    except Exception as e:
        print(f"Error testing database: {e}")
        import traceback
        print("Full traceback:")
        print(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e)
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8020, debug=True) 