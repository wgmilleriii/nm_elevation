from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import glob
from generate_contour_map import create_contour_map, get_elevation_data
import time
from datetime import datetime
import sqlite3
import subprocess
import json

app = Flask(__name__, static_folder='public', static_url_path='')

def generate_contour_map(coords, timestamp=None, bw=False):
    """Generate a contour map for the given coordinates"""
    try:
        print(f"Generating {'black & white' if bw else 'color'} map with coords: {coords}")
        north, south, east, west = coords
        
        # Get elevation data
        print("Fetching elevation data...")
        elevation_data = get_elevation_data(north, south, east, west)
        if elevation_data is None:
            print("Failed to get elevation data")
            return None
            
        # Create contour map
        print("Creating contour map...")
        contour_map = create_contour_map(elevation_data, bw=bw)
        if contour_map is None:
            print("Failed to create contour map")
            return None
            
        # Save the map
        print("Saving map...")
        filename = f"contour_map_{'bw' if bw else 'color'}_{timestamp}.png"
        filepath = os.path.join('public', 'images', filename)
        contour_map.save(filepath)
        print(f"Map saved to {filepath}")
        
        return filepath
        
    except Exception as e:
        print(f"Error in generate_contour_map: {str(e)}")
        return None

@app.route('/')
def index():
    # Get list of generated maps
    color_maps = glob.glob('public/images/contour_map_color_*.png')
    bw_maps = glob.glob('public/images/contour_map_bw_*.png')
    
    print(f"Found {len(color_maps)} color maps and {len(bw_maps)} bw maps")
    
    # Sort maps by timestamp
    color_maps.sort(reverse=True)
    bw_maps.sort(reverse=True)
    
    # Pair color and bw maps by timestamp
    maps = []
    for color_map in color_maps:
        # Extract full timestamp (date and time)
        timestamp = '_'.join(color_map.split('_')[-2:]).replace('.png', '')
        bw_map = f'public/images/contour_map_bw_{timestamp}.png'
        print(f"Checking pair: {color_map} and {bw_map}")
        if os.path.exists(bw_map):
            maps.append({
                'color': os.path.basename(color_map),
                'bw': os.path.basename(bw_map),
                'timestamp': timestamp
            })
            print(f"Added map pair with timestamp {timestamp}")
    
    print(f"Total map pairs found: {len(maps)}")
    return render_template('index.html', maps=maps)

@app.route('/generate_map')
def generate_map():
    try:
        # Get coordinates from query parameters
        north = float(request.args.get('north', 35.15))
        south = float(request.args.get('south', 35.05))
        east = float(request.args.get('east', -106.45))
        west = float(request.args.get('west', -106.65))
        
        print(f"Received coordinates: north={north}, south={south}, east={east}, west={west}")
        
        # Validate coordinates
        if not (31.0 <= south <= north <= 37.0 and -109.0 <= west <= east <= -103.0):
            return jsonify({
                'status': 'error',
                'message': 'Coordinates must be within New Mexico bounds'
            })
        
        # Generate timestamp for filenames
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # Generate color map
        print("Generating color map...")
        color_map = generate_contour_map((north, south, east, west), timestamp=timestamp)
        if not color_map:
            return jsonify({
                'status': 'error',
                'message': 'Failed to generate color map'
            })
            
        # Generate black & white map
        print("Generating black & white map...")
        bw_map = generate_contour_map((north, south, east, west), timestamp=timestamp, bw=True)
        if not bw_map:
            return jsonify({
                'status': 'error',
                'message': 'Failed to generate black & white map'
            })
        
        return jsonify({
            'status': 'success',
            'timestamp': timestamp,
            'bounds': {
                'minLat': south,
                'maxLat': north,
                'minLon': west,
                'maxLon': east
            }
        })
        
    except Exception as e:
        print(f"Error in generate_map route: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

@app.route('/get_map')
def get_map():
    color_mode = request.args.get('color_mode', 'bw')
    map_file = os.path.normpath(f'public/images/contour_map_{color_mode}.png')
    return send_from_directory('public/images', map_file)

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

@app.route('/public/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('public/images', filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8020, debug=True) 