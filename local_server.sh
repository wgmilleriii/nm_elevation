#!/bin/bash

# Local Development Server for Elevation GPS Tracker
# Serves the elevation folder locally for testing

echo "🏠 Starting Local Elevation GPS Tracker Server..."
echo "================================================"

# Configuration
LOCAL_PORT=8020
ELEVATION_DIR="elevation"

# Check if elevation folder exists
if [ ! -d "$ELEVATION_DIR" ]; then
    echo "❌ Error: elevation folder not found"
    echo "   Please run this script from the nm_elevation directory"
    exit 1
fi

# Check if port is available
if lsof -Pi :$LOCAL_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port $LOCAL_PORT is already in use"
    echo "   Trying to stop existing server..."
    pkill -f "python.*$LOCAL_PORT" 2>/dev/null || true
    sleep 2
fi

echo ""
echo "📋 Server Configuration:"
echo "   Directory: $ELEVATION_DIR"
echo "   Port: $LOCAL_PORT"
echo "   URL: http://localhost:$LOCAL_PORT"
echo ""

# Start Python HTTP server
cd "$ELEVATION_DIR"

echo "🚀 Starting server..."
echo "   Press Ctrl+C to stop"
echo ""

# Try Python 3 first, then Python 2
if command -v python3 &> /dev/null; then
    echo "🐍 Using Python 3 HTTP server"
    python3 -m http.server $LOCAL_PORT
elif command -v python &> /dev/null; then
    echo "🐍 Using Python 2 HTTP server"
    python -m SimpleHTTPServer $LOCAL_PORT
else
    echo "❌ Python not found. Trying Node.js..."
    if command -v npx &> /dev/null; then
        echo "🟩 Using Node.js HTTP server"
        npx http-server -p $LOCAL_PORT -c-1 --cors
    else
        echo "❌ Neither Python nor Node.js found"
        echo "   Please install Python or Node.js to run local server"
        exit 1
    fi
fi 