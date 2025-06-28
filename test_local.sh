#!/bin/bash

# Quick Local Test Script
# Starts local server and opens browser

echo "🧪 Testing Elevation GPS Tracker Locally..."
echo "============================================"

# Kill any existing server on port 8020
pkill -f "python.*8020" 2>/dev/null || true

# Start local server in background
echo "🚀 Starting local server on port 8020..."
cd elevation
python3 -m http.server 8020 &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Open browser
echo "🌐 Opening browser..."
if command -v open &> /dev/null; then
    # macOS
    open "http://localhost:8020/gps_live.html"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "http://localhost:8020/gps_live.html"
else
    echo "📋 Manual: Open http://localhost:8020/gps_live.html in your browser"
fi

echo ""
echo "✅ Local server running at: http://localhost:8020/gps_live.html"
echo "🔧 This will use PRODUCTION APIs for data storage"
echo "📱 Test your GPS functionality locally before deploying"
echo ""
echo "Press Ctrl+C to stop the server"

# Wait for Ctrl+C
trap "echo '🛑 Stopping server...'; kill $SERVER_PID 2>/dev/null; exit 0" INT
wait $SERVER_PID 