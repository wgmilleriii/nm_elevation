#!/bin/bash

# GPS Data Collection and Reporting Script
# Downloads data from all available elevation APIs and generates reports

echo "📊 GPS Data Collection and Reporting"
echo "===================================="

# Configuration
API_BASE="https://hanon.artsmetrics.net/elevation/api"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="reports_$TIMESTAMP"

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
        
        return 0
    else
        echo "   ❌ Failed to fetch $description"
        return 1
    fi
}

# Function to analyze JSON data
analyze_data() {
    local filename="$1"
    local description="$2"
    
    if [ -f "$filename.json" ]; then
        echo "🔍 Analyzing $description..."
        
        if command -v jq &> /dev/null; then
            # Count records if it's an array
            local count=$(cat "$filename.json" | jq 'length' 2>/dev/null || echo "N/A")
            if [ "$count" != "N/A" ] && [ "$count" != "null" ]; then
                echo "   📊 Records: $count"
            fi
            
            # Show keys/structure
            echo "   🔑 Structure:" 
            cat "$filename.json" | jq 'keys' 2>/dev/null | head -10 | sed 's/^/      /'
        fi
        echo ""
    fi
}

echo "🚀 Starting data collection..."
echo ""

# 1. Server Version and Status
call_api "$API_BASE/version" "01_server_version" "Server Version & Status"
analyze_data "01_server_version" "Server Version"

# 2. All Users
call_api "$API_BASE/users" "02_all_users" "All Users"
analyze_data "02_all_users" "Users Data"

# 3. All Sessions
call_api "$API_BASE/sessions" "03_all_sessions" "All Sessions"
analyze_data "03_all_sessions" "Sessions Data"

# 4. Recent Sessions (last 24 hours)
call_api "$API_BASE/sessions/recent" "04_recent_sessions" "Recent Sessions"
analyze_data "04_recent_sessions" "Recent Sessions"

# 5. Active Sessions
call_api "$API_BASE/sessions/active" "05_active_sessions" "Active Sessions"
analyze_data "05_active_sessions" "Active Sessions"

# 6. All GPS Points
call_api "$API_BASE/gps-points" "06_all_gps_points" "All GPS Points"
analyze_data "06_all_gps_points" "GPS Points"

# 7. Recent GPS Points
call_api "$API_BASE/gps-points/recent" "07_recent_gps_points" "Recent GPS Points"
analyze_data "07_recent_gps_points" "Recent GPS Points"

# 8. System Stats
call_api "$API_BASE/stats" "08_system_stats" "System Statistics"
analyze_data "08_system_stats" "System Stats"

# 9. Database Status
call_api "$API_BASE/db/status" "09_database_status" "Database Status"
analyze_data "09_database_status" "Database Status"

# 10. Session Lookup (try a few session numbers)
echo "🔍 Trying session lookups..."
for session_num in 1 5 10 15 20; do
    call_api "$API_BASE/session/lookup?number=$session_num" "10_session_$session_num" "Session #$session_num Lookup"
done

echo ""
echo "📊 Generating Summary Report..."

# Create summary report
cat > "00_SUMMARY_REPORT.md" << EOF
# GPS Data Collection Report
**Generated:** $(date)
**Directory:** $REPORT_DIR

## Data Sources Collected

### Server Information
- **Version:** $(cat 01_server_version.json | jq -r '.version' 2>/dev/null || echo "N/A")
- **Server:** $(cat 01_server_version.json | jq -r '.server' 2>/dev/null || echo "N/A")
- **Timestamp:** $(cat 01_server_version.json | jq -r '.timestamp' 2>/dev/null || echo "N/A")

### Data Counts
EOF

# Add data counts to summary if jq is available
if command -v jq &> /dev/null; then
    echo "- **Users:** $(cat 02_all_users.json | jq 'length' 2>/dev/null || echo "N/A")" >> "00_SUMMARY_REPORT.md"
    echo "- **Total Sessions:** $(cat 03_all_sessions.json | jq 'length' 2>/dev/null || echo "N/A")" >> "00_SUMMARY_REPORT.md"
    echo "- **Recent Sessions:** $(cat 04_recent_sessions.json | jq 'length' 2>/dev/null || echo "N/A")" >> "00_SUMMARY_REPORT.md"
    echo "- **Active Sessions:** $(cat 05_active_sessions.json | jq 'length' 2>/dev/null || echo "N/A")" >> "00_SUMMARY_REPORT.md"
    echo "- **Total GPS Points:** $(cat 06_all_gps_points.json | jq 'length' 2>/dev/null || echo "N/A")" >> "00_SUMMARY_REPORT.md"
    echo "- **Recent GPS Points:** $(cat 07_recent_gps_points.json | jq 'length' 2>/dev/null || echo "N/A")" >> "00_SUMMARY_REPORT.md"
fi

cat >> "00_SUMMARY_REPORT.md" << EOF

### Files Generated
$(ls -la *.json | awk '{print "- **" $9 ":** " $5 " bytes"}')

### Next Steps
1. Review individual JSON files for detailed data
2. Import GPS points into mapping software
3. Analyze session patterns and user behavior
4. Generate visualizations from the data

### API Endpoints Tested
- \`$API_BASE/version\`
- \`$API_BASE/users\`
- \`$API_BASE/sessions\`
- \`$API_BASE/sessions/recent\`
- \`$API_BASE/sessions/active\`
- \`$API_BASE/gps-points\`
- \`$API_BASE/gps-points/recent\`
- \`$API_BASE/stats\`
- \`$API_BASE/db/status\`
- \`$API_BASE/session/lookup\`
EOF

echo ""
echo "🎉 Data Collection Complete!"
echo "=========================="
echo ""
echo "📁 Report Directory: $REPORT_DIR"
echo "📊 Summary Report: $REPORT_DIR/00_SUMMARY_REPORT.md"
echo ""
echo "📋 Files Generated:"
ls -la *.json | awk '{print "   " $9 " (" $5 " bytes)"}'
echo ""
echo "🔍 Quick Stats:"
if command -v jq &> /dev/null; then
    echo "   Users: $(cat 02_all_users.json | jq 'length' 2>/dev/null || echo "N/A")"
    echo "   Sessions: $(cat 03_all_sessions.json | jq 'length' 2>/dev/null || echo "N/A")"
    echo "   GPS Points: $(cat 06_all_gps_points.json | jq 'length' 2>/dev/null || echo "N/A")"
fi
echo ""
echo "📖 To view summary: cat $REPORT_DIR/00_SUMMARY_REPORT.md" 