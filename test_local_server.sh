#!/bin/bash

# Local PHP Server Testing Script for GPS Elevation System
echo "🧪 GPS Elevation System - Local Testing Setup"
echo "=============================================="

# Configuration
LOCAL_PORT=8080
TEST_DIR="elevation"
PHP_SERVER_PID=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to cleanup on exit
cleanup() {
    if [ ! -z "$PHP_SERVER_PID" ]; then
        print_info "Stopping PHP server (PID: $PHP_SERVER_PID)..."
        kill $PHP_SERVER_PID 2>/dev/null
    fi
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

# Check if elevation directory exists
if [ ! -d "$TEST_DIR" ]; then
    print_error "Elevation directory not found. Please run this script from the nm_elevation directory."
    exit 1
fi

echo ""
print_info "Starting local PHP server on port $LOCAL_PORT..."

# Start PHP built-in server
cd $TEST_DIR
php -S localhost:$LOCAL_PORT > ../php_server.log 2>&1 &
PHP_SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Check if server started successfully
if ! ps -p $PHP_SERVER_PID > /dev/null; then
    print_error "Failed to start PHP server. Check php_server.log for details."
    exit 1
fi

print_status "PHP server started successfully (PID: $PHP_SERVER_PID)"
print_info "Server running at: http://localhost:$LOCAL_PORT"

echo ""
echo "🧪 Running Local Tests..."
echo "========================"

# Test 1: Check if landing page loads
echo ""
print_info "Test 1: Landing page accessibility..."
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$LOCAL_PORT/home.html" | grep -q "200"; then
    print_status "Landing page loads successfully"
else
    print_error "Landing page failed to load"
fi

# Test 2: Check API stats endpoint
echo ""
print_info "Test 2: API stats endpoint..."
STATS_RESPONSE=$(curl -s "http://localhost:$LOCAL_PORT/api/stats")
if echo "$STATS_RESPONSE" | grep -q '"total_users"'; then
    print_status "API stats endpoint working"
    echo "   Response: $STATS_RESPONSE"
else
    print_error "API stats endpoint failed"
    echo "   Response: $STATS_RESPONSE"
fi

# Test 3: Check user initialization
echo ""
print_info "Test 3: User initialization..."
INIT_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{"deviceId":"test_device_123"}' \
    "http://localhost:$LOCAL_PORT/api/user/init")

if echo "$INIT_RESPONSE" | grep -q '"userId"'; then
    print_status "User initialization working"
    USER_ID=$(echo "$INIT_RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
    echo "   Created user: $USER_ID"
else
    print_error "User initialization failed"
    echo "   Response: $INIT_RESPONSE"
fi

# Test 4: Check session start
if [ ! -z "$USER_ID" ]; then
    echo ""
    print_info "Test 4: Session start..."
    SESSION_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"userId\":\"$USER_ID\"}" \
        "http://localhost:$LOCAL_PORT/api/user/session/start")
    
    if echo "$SESSION_RESPONSE" | grep -q '"sessionId"'; then
        print_status "Session start working"
        SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
        echo "   Created session: $SESSION_ID"
    else
        print_error "Session start failed"
        echo "   Response: $SESSION_RESPONSE"
    fi
fi

# Test 5: Check GPS point tracking
if [ ! -z "$USER_ID" ] && [ ! -z "$SESSION_ID" ]; then
    echo ""
    print_info "Test 5: GPS point tracking..."
    TRACK_RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"userId\":\"$USER_ID\",\"sessionId\":\"$SESSION_ID\",\"lat\":35.2378,\"lon\":-106.6067,\"accuracy\":10,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}" \
        "http://localhost:$LOCAL_PORT/api/user/track-point")
    
    if echo "$TRACK_RESPONSE" | grep -q '"success"'; then
        print_status "GPS point tracking working"
    else
        print_error "GPS point tracking failed"
        echo "   Response: $TRACK_RESPONSE"
    fi
fi

# Test 6: Check queue endpoint
echo ""
print_info "Test 6: GPS queue endpoint..."
QUEUE_RESPONSE=$(curl -s "http://localhost:$LOCAL_PORT/api/gps-queue")
if echo "$QUEUE_RESPONSE" | grep -q '"points"'; then
    print_status "GPS queue endpoint working"
    QUEUE_COUNT=$(echo "$QUEUE_RESPONSE" | grep -o '"points":\[[^]]*\]' | grep -o ',' | wc -l)
    echo "   Queue contains $((QUEUE_COUNT + 1)) points"
else
    print_error "GPS queue endpoint failed"
    echo "   Response: $QUEUE_RESPONSE"
fi

# Test 7: Check static file serving
echo ""
print_info "Test 7: Static file serving..."

# Test CSS file
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$LOCAL_PORT/css/gps_live.css" | grep -q "200"; then
    print_status "CSS files serving correctly"
else
    print_error "CSS files not serving"
fi

# Test JS file
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$LOCAL_PORT/js/gps_live.js" | grep -q "200"; then
    print_status "JavaScript files serving correctly"
else
    print_error "JavaScript files not serving"
fi

# Test 8: Check GPS applications
echo ""
print_info "Test 8: GPS application pages..."

if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$LOCAL_PORT/gps_live.html" | grep -q "200"; then
    print_status "GPS Live tracker loads"
else
    print_error "GPS Live tracker failed to load"
fi

if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$LOCAL_PORT/gps_tracker.html" | grep -q "200"; then
    print_status "GPS Data collector loads"
else
    print_error "GPS Data collector failed to load"
fi

# Test 9: Check data directory creation
echo ""
print_info "Test 9: Data directory structure..."
if [ -d "data" ]; then
    print_status "Data directory created"
    if [ -d "data/users" ]; then
        print_status "Users directory created"
    fi
    if [ -d "data/queue" ]; then
        print_status "Queue directory created"
    fi
    if [ -d "data/logs" ]; then
        print_status "Logs directory created"
    fi
else
    print_warning "Data directories not yet created (will be created on first API call)"
fi

echo ""
echo "🌐 Local Testing URLs:"
echo "======================"
echo "• Landing Page:    http://localhost:$LOCAL_PORT/home.html"
echo "• GPS Live:        http://localhost:$LOCAL_PORT/gps_live.html"
echo "• GPS Tracker:     http://localhost:$LOCAL_PORT/gps_tracker.html"
echo "• API Stats:       http://localhost:$LOCAL_PORT/api/stats"
echo "• API Queue:       http://localhost:$LOCAL_PORT/api/gps-queue"
echo "• API Logs:        http://localhost:$LOCAL_PORT/api/logs"

echo ""
echo "📱 Testing Instructions:"
echo "========================"
echo "1. Open http://localhost:$LOCAL_PORT/home.html in your browser"
echo "2. Test each GPS application"
echo "3. Check browser console for JavaScript errors"
echo "4. Verify API responses in Network tab"
echo "5. Test GPS functionality (will require location permissions)"

echo ""
print_info "Server is running. Press Ctrl+C to stop..."
print_warning "Note: GPS functionality requires HTTPS in production, but works on localhost"

# Keep script running
while true; do
    sleep 1
done 