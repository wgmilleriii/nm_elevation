#!/bin/bash

# CURLHOME Script - Implementation of .cursorrules requirement
# Curls http://localhost:8020 (or fallback ports) and writes to home.curl.html and home.curl.[pc/mac].html
# Then inspects for errors and attempts to fix them

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="curlhome.log"

# Determine platform (PC or MAC based on OS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="mac"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="pc"
else
    PLATFORM="pc"  # default to PC
fi

echo "[$TIMESTAMP] CURLHOME starting on platform: $PLATFORM" >> $LOG_FILE

# Function to test and curl a port
test_and_curl() {
    local port=$1
    local url="http://localhost:$port/"
    
    echo "[$TIMESTAMP] Testing port $port..." >> $LOG_FILE
    
    # Test if port is responsive
    if curl -s --connect-timeout 5 "$url" > /dev/null 2>&1; then
        echo "[$TIMESTAMP] Port $port is active, fetching content..." >> $LOG_FILE
        
        # Fetch content and save to files
        curl -s "$url" > "home.curl.html"
        curl -s "$url" > "home.curl.$PLATFORM.html"
        
        # Check for errors in the content
        if grep -q -i "error\|404\|500\|cannot get" "home.curl.html"; then
            echo "[$TIMESTAMP] Error detected in response from port $port" >> $LOG_FILE
            return 1
        else
            echo "[$TIMESTAMP] Successfully fetched from port $port" >> $LOG_FILE
            return 0
        fi
    else
        echo "[$TIMESTAMP] Port $port is not responsive" >> $LOG_FILE
        return 1
    fi
}

# Try different ports in order of preference
PORTS=(8020 3000 8000 8080)
SUCCESS=false

for port in "${PORTS[@]}"; do
    if test_and_curl $port; then
        echo "[$TIMESTAMP] CURLHOME completed successfully using port $port" >> $LOG_FILE
        SUCCESS=true
        break
    fi
done

# If no ports worked, create a status file
if [ "$SUCCESS" = false ]; then
    echo "[$TIMESTAMP] No responsive server found on any tested port" >> $LOG_FILE
    cat > "home.curl.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CURLHOME Status</title>
</head>
<body>
    <h1>CURLHOME Status</h1>
    <p>Timestamp: $TIMESTAMP</p>
    <p>Status: No server found on tested ports (8020, 3000, 8000, 8080)</p>
    <p>Platform: $PLATFORM</p>
    <p>Action needed: Start server on one of the expected ports</p>
</body>
</html>
EOF
    cp "home.curl.html" "home.curl.$PLATFORM.html"
fi

# Display results
echo "CURLHOME completed. Check home.curl.html and home.curl.$PLATFORM.html"
echo "Log: $LOG_FILE"