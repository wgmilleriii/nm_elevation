#!/bin/bash

# Directory for logs
mkdir -p logs

# Timestamp for log files
timestamp=$(date +"%Y%m%d_%H%M%S")

# Function to make a curl request and save response
check_page() {
    local url=$1
    local output_file="logs/page_${timestamp}.html"
    local curl_log="logs/curl_${timestamp}.log"
    
    echo "Checking $url at $(date)"
    echo "----------------------------------------"
    
    # Make curl request with full debugging
    curl -v "$url" \
        -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" \
        -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
        -H "Accept-Language: en-US,en;q=0.5" \
        --compressed \
        2>"$curl_log" \
        >"$output_file"

    # Check for HTTP errors
    if grep -q "< HTTP.*4" "$curl_log" || grep -q "< HTTP.*5" "$curl_log"; then
        echo "❌ HTTP Error detected:"
        grep "< HTTP" "$curl_log"
    else
        echo "✅ HTTP Status OK"
    fi

    # Check for JavaScript files
    echo -e "\nJavaScript files loaded:"
    grep -o 'src="[^"]*\.js"' "$output_file" | cut -d'"' -f2

    # Check for JavaScript errors in the files
    echo -e "\nChecking JavaScript files for errors..."
    for js_file in $(grep -o 'src="[^"]*\.js"' "$output_file" | cut -d'"' -f2); do
        if [[ $js_file == /* ]] || [[ $js_file == http* ]]; then
            js_url="$js_file"
        else
            js_url="http://localhost:3000/$js_file"
        fi
        
        echo -e "\nChecking $js_url"
        curl -s "$js_url" > "logs/js_${timestamp}_$(basename "$js_file")"
        
        # Basic JavaScript syntax check
        node --check "logs/js_${timestamp}_$(basename "$js_file")" 2>&1 || echo "⚠️ Syntax error detected"
        
        # Look for common error patterns
        echo "Checking for undefined variables and functions:"
        grep -n "undefined" "logs/js_${timestamp}_$(basename "$js_file")" || echo "None found"
    done

    # Check for missing resources
    echo -e "\nChecking for 404 errors:"
    grep "404 Not Found" "$curl_log" || echo "No 404 errors detected"

    # Save a summary
    echo -e "\nSummary saved to logs/summary_${timestamp}.txt"
    {
        echo "Page Check Summary - $(date)"
        echo "URL: $url"
        echo "----------------------------------------"
        echo "HTTP Status: $(grep "< HTTP" "$curl_log")"
        echo "JavaScript Files: $(grep -c 'src="[^"]*\.js"' "$output_file")"
        echo "Potential Errors: $(grep -c "undefined\|error\|failed" "logs/js_${timestamp}"*)"
    } > "logs/summary_${timestamp}.txt"
}

# Function to monitor server logs
monitor_server() {
    local log_file="logs/server_${timestamp}.log"
    echo "Monitoring server logs... (Press Ctrl+C to stop)"
    tail -f "$log_file" &
}

# Main execution
if [ "$1" == "" ]; then
    echo "Usage: ./monitor.sh <url>"
    echo "Example: ./monitor.sh http://localhost:3000/face.html"
    exit 1
fi

# Kill existing node process on port 3000
kill $(lsof -t -i:3000) 2>/dev/null

# Start server in background with logging
node server.js > "logs/server_${timestamp}.log" 2>&1 &
server_pid=$!

# Wait for server to start
sleep 2

# Check the page
check_page "$1"

# Start monitoring
monitor_server

echo -e "\nPress Ctrl+C to stop monitoring"
trap "kill $server_pid; exit" INT TERM

# Keep script running
while true; do sleep 1; done 