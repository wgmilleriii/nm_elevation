#!/bin/bash

echo "🚗 Collecting Complete Journey Data - Albuquerque to Denver"
echo "=========================================================="

API_BASE="https://hanon.artsmetrics.net/elevation/api"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "📊 Getting system statistics..."
curl -s "$API_BASE/stats" > system_stats.json
cat system_stats.json | jq .

echo ""
echo "📍 Collecting ALL GPS points from all users..."

# Get all active user IDs from the GPS queue
echo "Getting user IDs from GPS queue..."
curl -s "$API_BASE/gps-queue" | jq -r '.points[].userId' | sort -u > user_ids.txt

echo "Found $(wc -l < user_ids.txt) unique users"
cat user_ids.txt

echo ""
echo "📱 Collecting session and GPS data for each user..."

# Initialize combined data file
echo '{"journey_data": [], "metadata": {"collection_time": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'", "total_users": 0, "total_points": 0}}' > combined_journey_data.json

total_points=0
user_count=0

while read -r user_id; do
    if [ ! -z "$user_id" ]; then
        user_count=$((user_count + 1))
        echo "  📲 Processing User $user_count: $user_id"
        
        # Get user sessions
        echo "    Getting sessions..."
        curl -s "$API_BASE/user-sessions?userId=$user_id" > "user_${user_count}_sessions.json"
        
        # Get user GPS points  
        echo "    Getting GPS points..."
        curl -s "$API_BASE/user/points?userId=$user_id" > "user_${user_count}_points.json"
        
        # Count points for this user
        point_count=$(cat "user_${user_count}_points.json" | jq '.points | length' 2>/dev/null || echo 0)
        echo "    📍 Found $point_count GPS points"
        total_points=$((total_points + point_count))
        
        # Extract key data for journey analysis
        if [ -f "user_${user_count}_points.json" ]; then
            cat "user_${user_count}_points.json" | jq --arg user_id "$user_id" --arg user_num "$user_count" '
            .points[] | {
                user_id: $user_id,
                user_number: ($user_num | tonumber),
                lat: .lat,
                lon: .lon,
                elevation: .elevation,
                timestamp: .timestamp,
                iso_time: ((.timestamp / 1000) | strftime("%Y-%m-%dT%H:%M:%SZ")),
                accuracy: .accuracy,
                speed: .speed,
                heading: .heading,
                session_id: .sessionId
            }' >> temp_journey_points.jsonl 2>/dev/null
        fi
        
        echo ""
    fi
done < user_ids.txt

echo "🎯 Total Points Collected: $total_points"
echo "👥 Total Users Processed: $user_count"

# Convert JSONL to proper JSON array and sort by timestamp
echo "📊 Processing and sorting journey data..."
if [ -f temp_journey_points.jsonl ]; then
    echo "Converting to JSON array..."
    jq -s 'sort_by(.timestamp)' temp_journey_points.jsonl > sorted_journey_points.json
    
    # Update combined data file
    jq --argjson points "$(cat sorted_journey_points.json)" --arg total_points "$total_points" --arg user_count "$user_count" '
    .journey_data = $points | 
    .metadata.total_points = ($total_points | tonumber) |
    .metadata.total_users = ($user_count | tonumber)
    ' combined_journey_data.json > temp_combined.json && mv temp_combined.json combined_journey_data.json
    
    rm temp_journey_points.jsonl
    
    echo "✅ Journey data processed and sorted chronologically"
    
    # Show summary statistics
    echo ""
    echo "📈 Journey Summary:"
    echo "=================="
    
    first_point=$(cat sorted_journey_points.json | jq -r '.[0] | "\(.iso_time) - Lat: \(.lat), Lon: \(.lon), Elevation: \(.elevation)m"' 2>/dev/null)
    last_point=$(cat sorted_journey_points.json | jq -r '.[-1] | "\(.iso_time) - Lat: \(.lat), Lon: \(.lon), Elevation: \(.elevation)m"' 2>/dev/null)
    
    echo "🚀 Journey Start: $first_point"
    echo "🏁 Journey End:   $last_point"
    
    # Calculate elevation statistics
    echo ""
    echo "🏔️ Elevation Statistics:"
    cat sorted_journey_points.json | jq -r '
    map(select(.elevation != null)) | 
    if length > 0 then
        "   Min Elevation: \(min_by(.elevation).elevation)m at \(min_by(.elevation).iso_time)",
        "   Max Elevation: \(max_by(.elevation).elevation)m at \(max_by(.elevation).iso_time)", 
        "   Avg Elevation: \((map(.elevation) | add / length) | floor)m",
        "   Total Points with Elevation: \(length)"
    else
        "   No elevation data found"
    end'
    
    # Calculate distance and time statistics
    echo ""
    echo "�� Time Statistics:"
    start_time=$(cat sorted_journey_points.json | jq -r '.[0].timestamp' 2>/dev/null)
    end_time=$(cat sorted_journey_points.json | jq -r '.[-1].timestamp' 2>/dev/null)
    
    if [ "$start_time" != "null" ] && [ "$end_time" != "null" ]; then
        duration_ms=$((end_time - start_time))
        duration_hours=$((duration_ms / 3600000))
        duration_minutes=$(((duration_ms % 3600000) / 60000))
        echo "   Journey Duration: ${duration_hours}h ${duration_minutes}m"
        echo "   Data Collection Span: $(date -d @$((start_time/1000)) '+%Y-%m-%d %H:%M') to $(date -d @$((end_time/1000)) '+%Y-%m-%d %H:%M')"
    fi
    
else
    echo "❌ No GPS points found to process"
fi

echo ""
echo "📁 Files Generated:"
ls -la *.json | awk '{print "   " $9 " (" $5 " bytes)"}'

echo ""
echo "🎉 Journey data collection complete!"
echo "📊 Main data file: combined_journey_data.json"
echo "📈 Sorted points: sorted_journey_points.json"
