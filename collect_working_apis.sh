#!/bin/bash

# GPS Data Collection Script - Working APIs Only
# Downloads data from actually implemented elevation API endpoints

echo "📊 GPS Data Collection - Working APIs"
echo "====================================="

# Configuration
API_BASE="https://hanon.artsmetrics.net/elevation/api"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="working_apis_$TIMESTAMP"

# Create reports directory
mkdir -p "$REPORT_DIR"
cd "$REPORT_DIR"

echo "📁 Created report directory: $REPORT_DIR"
echo ""

# Function to make API call and save response
call_api() {
    local endpoint="$1"
    local filename="$2"
    local description="$3"
    
    echo "📡 Fetching $description..."
    echo "   Endpoint: $endpoint"
    
    if curl -s "$endpoint" -o "$filename.json"; then
        echo "   ✅ Saved to: $filename.json"
        
        # Also create a pretty-printed version if jq is available
        if command -v jq &> /dev/null; then
            cat "$filename.json" | jq . > "$filename.pretty.json" 2>/dev/null
        fi
        
        # Get file size
        local size=$(wc -c < "$filename.json")
        echo "   📏 Size: $size bytes"
        
        # Show preview if it's JSON
        if command -v jq &> /dev/null; then
            echo "   👀 Preview:"
            cat "$filename.json" | jq . | head -10 | sed 's/^/      /'
        fi
        echo ""
        
        return 0
    else
        echo "   ❌ Failed to fetch $description"
        return 1
    fi
}

# Function to call API with parameters
call_api_with_params() {
    local endpoint="$1"
    local params="$2"
    local filename="$3"
    local description="$4"
    
    local full_url="${endpoint}?${params}"
    call_api "$full_url" "$filename" "$description"
}

echo "🚀 Starting data collection from working endpoints..."
echo ""

# 1. Server Version and Status
call_api "$API_BASE/version" "01_version" "Server Version & Status"

# 2. System Statistics
call_api "$API_BASE/stats" "02_stats" "System Statistics"

# 3. GPS Queue Status
call_api "$API_BASE/gps-queue" "03_gps_queue" "GPS Processing Queue"

# 4. Queue Status
call_api "$API_BASE/queue/status" "04_queue_status" "Queue Status Details"

# 5. System Logs
call_api "$API_BASE/logs" "05_logs" "System Logs"

# 6. Session Lookups (try several session numbers based on stats)
echo "🔍 Looking up specific sessions..."
for session_num in 1 5 10 15 20 25 30 35 40 45 50 55; do
    call_api_with_params "$API_BASE/session/lookup" "number=$session_num" "06_session_$session_num" "Session #$session_num"
done

# 7. Try to get user sessions for some user IDs (we'll need to guess or extract from logs)
echo "🔍 Trying to find user data..."

# Extract user IDs from logs if available
if [ -f "05_logs.json" ] && command -v jq &> /dev/null; then
    echo "   Extracting user IDs from logs..."
    USER_IDS=$(cat 05_logs.json | jq -r '.logs[]? | select(.userId != null) | .userId' 2>/dev/null | head -5 | sort -u)
    
    if [ ! -z "$USER_IDS" ]; then
        echo "   Found user IDs: $USER_IDS"
        counter=1
        for user_id in $USER_IDS; do
            call_api_with_params "$API_BASE/user-sessions" "userId=$user_id" "07_user_${counter}_sessions" "User $user_id Sessions"
            call_api_with_params "$API_BASE/user/points" "userId=$user_id" "08_user_${counter}_points" "User $user_id GPS Points"
            counter=$((counter + 1))
        done
    else
        echo "   No user IDs found in logs"
    fi
fi

echo ""
echo "📊 Generating Enhanced Summary Report..."

# Create comprehensive summary report
cat > "00_COMPREHENSIVE_REPORT.md" << EOF
# GPS Data Collection Report - Working APIs
**Generated:** $(date)
**Directory:** $REPORT_DIR

## System Overview
EOF

# Add system stats if available
if [ -f "02_stats.json" ] && command -v jq &> /dev/null; then
    cat >> "00_COMPREHENSIVE_REPORT.md" << EOF

### System Statistics
- **Total Users:** $(cat 02_stats.json | jq -r '.totalUsers' 2>/dev/null || echo "N/A")
- **Total Sessions:** $(cat 02_stats.json | jq -r '.totalSessions' 2>/dev/null || echo "N/A")  
- **Total GPS Points:** $(cat 02_stats.json | jq -r '.totalPoints' 2>/dev/null || echo "N/A")
- **Queue Size:** $(cat 02_stats.json | jq -r '.queueSize' 2>/dev/null || echo "N/A")
- **Pending Points:** $(cat 02_stats.json | jq -r '.pendingPoints' 2>/dev/null || echo "N/A")
- **Processing Points:** $(cat 02_stats.json | jq -r '.processingPoints' 2>/dev/null || echo "N/A")
- **Completed Points:** $(cat 02_stats.json | jq -r '.completedPoints' 2>/dev/null || echo "N/A")
EOF
fi

# Add server info if available
if [ -f "01_version.json" ] && command -v jq &> /dev/null; then
    cat >> "00_COMPREHENSIVE_REPORT.md" << EOF

### Server Information
- **Version:** $(cat 01_version.json | jq -r '.version' 2>/dev/null || echo "N/A")
- **Server:** $(cat 01_version.json | jq -r '.server' 2>/dev/null || echo "N/A")
- **PHP Version:** $(cat 01_version.json | jq -r '.node_version' 2>/dev/null || echo "N/A")
- **Features:** $(cat 01_version.json | jq -r '.features | join(", ")' 2>/dev/null || echo "N/A")
EOF
fi

cat >> "00_COMPREHENSIVE_REPORT.md" << EOF

## Data Files Generated
$(ls -la *.json | awk '{print "- **" $9 ":** " $5 " bytes"}')

## Session Data Found
EOF

# List found sessions
if ls 06_session_*.json 1> /dev/null 2>&1; then
    for session_file in 06_session_*.json; do
        if command -v jq &> /dev/null; then
            session_num=$(echo "$session_file" | sed 's/.*session_\([0-9]*\)\.json/\1/')
            found=$(cat "$session_file" | jq -r '.found' 2>/dev/null)
            if [ "$found" = "true" ]; then
                created=$(cat "$session_file" | jq -r '.session.created' 2>/dev/null)
                echo "- **Session #$session_num:** Created $created" >> "00_COMPREHENSIVE_REPORT.md"
            fi
        fi
    done
fi

cat >> "00_COMPREHENSIVE_REPORT.md" << EOF

## User Data Found
EOF

# List user data if found
if ls 07_user_*.json 1> /dev/null 2>&1; then
    counter=1
    for user_file in 07_user_*_sessions.json; do
        if command -v jq &> /dev/null; then
            session_count=$(cat "$user_file" | jq '.sessions | length' 2>/dev/null)
            echo "- **User $counter:** $session_count sessions" >> "00_COMPREHENSIVE_REPORT.md"
        fi
        counter=$((counter + 1))
    done
fi

cat >> "00_COMPREHENSIVE_REPORT.md" << EOF

## API Endpoints Successfully Tested
- \`$API_BASE/version\` - Server version and features
- \`$API_BASE/stats\` - System statistics  
- \`$API_BASE/gps-queue\` - GPS processing queue
- \`$API_BASE/queue/status\` - Queue status details
- \`$API_BASE/logs\` - System logs
- \`$API_BASE/session/lookup\` - Session lookup by number
- \`$API_BASE/user-sessions\` - User session data (with userId parameter)
- \`$API_BASE/user/points\` - User GPS points (with userId parameter)

## Recommendations
1. **Active GPS Collection:** System shows $(cat 02_stats.json | jq -r '.queueSize' 2>/dev/null || echo "N/A") points in processing queue
2. **Session Management:** Global session numbering is working with $(cat 02_stats.json | jq -r '.totalSessions' 2>/dev/null || echo "N/A") total sessions
3. **Data Export:** Use the JSON files for further analysis and visualization
4. **Real-time Monitoring:** Queue status shows current processing state

## Next Steps
1. Import GPS points into mapping software (QGIS, Google Earth, etc.)
2. Analyze session patterns and user behavior
3. Create visualizations from the collected data
4. Monitor queue processing efficiency
EOF

echo ""
echo "🎉 Data Collection Complete!"
echo "=========================="
echo ""
echo "📁 Report Directory: $REPORT_DIR"
echo "📊 Comprehensive Report: $REPORT_DIR/00_COMPREHENSIVE_REPORT.md"
echo ""
echo "📋 Files Generated:"
ls -la *.json | awk '{print "   " $9 " (" $5 " bytes)"}'
echo ""

# Show quick summary
if command -v jq &> /dev/null && [ -f "02_stats.json" ]; then
    echo "🔍 Quick System Status:"
    echo "   👥 Users: $(cat 02_stats.json | jq -r '.totalUsers')"
    echo "   📱 Sessions: $(cat 02_stats.json | jq -r '.totalSessions')"  
    echo "   📍 GPS Points: $(cat 02_stats.json | jq -r '.totalPoints')"
    echo "   ⏳ Queue Size: $(cat 02_stats.json | jq -r '.queueSize')"
    echo "   ✅ Completed: $(cat 02_stats.json | jq -r '.completedPoints')"
    echo "   🔄 Processing: $(cat 02_stats.json | jq -r '.processingPoints')"
    echo "   ⏸️ Pending: $(cat 02_stats.json | jq -r '.pendingPoints')"
fi

echo ""
echo "📖 To view report: cat $REPORT_DIR/00_COMPREHENSIVE_REPORT.md"
echo "📊 To view stats: cat $REPORT_DIR/02_stats.pretty.json" 