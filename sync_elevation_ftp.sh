#!/bin/bash

# Elevation FTP Sync Script
# Syncs elevation folder to hanon.artsmetrics.ai/elevation/
# Uses same FTP credentials as Hanon Viewer deployment

echo "🗺️ Syncing Elevation GPS Tracker to hanon.artsmetrics.ai..."
echo "=========================================================="

# FTP Configuration (same as Hanon Viewer)
FTP_SERVER="ftp.chipmiller.me"
FTP_USER="public_projects@chipmiller.me"
FTP_PASS="synxek-8xyhze-mAqror"
REMOTE_DIR="hanon/elevation"  # elevation subfolder under hanon
LOCAL_DIR="elevation"

# Function to upload a file
upload_file() {
    local local_file="$1"
    local remote_file="$2"
    
    if [ ! -f "$local_file" ]; then
        echo "❌ File not found: $local_file"
        return 1
    fi
    
    echo "📤 Uploading $local_file -> $remote_file..."
    
    curl -T "$local_file" \
         "ftp://$FTP_SERVER/$REMOTE_DIR/$remote_file" \
         --user "$FTP_USER:$FTP_PASS" \
         --create-dirs \
         --silent \
         --show-error
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully uploaded $remote_file"
        return 0
    else
        echo "❌ Failed to upload $remote_file"
        return 1
    fi
}

# Function to create remote directory
create_remote_dir() {
    local dir_name="$1"
    echo "📁 Creating remote directory: $dir_name"
    
    curl "ftp://$FTP_SERVER/$REMOTE_DIR/" \
         --user "$FTP_USER:$FTP_PASS" \
         --ftp-create-dirs \
         --quote "MKD $dir_name" \
         --silent 2>/dev/null || true
}

# Function to sync directory recursively
sync_directory() {
    local local_dir="$1"
    local remote_path="$2"
    local description="$3"
    
    echo ""
    echo "📁 Syncing $description..."
    echo "   Local: $local_dir"
    echo "   Remote: $remote_path"
    
    if [ ! -d "$local_dir" ]; then
        echo "❌ Local directory not found: $local_dir"
        return 1
    fi
    
    local success_count=0
    local total_count=0
    
    # Upload all files in directory
    find "$local_dir" -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.json" -o -name "*.php" -o -name "*.md" \) | while read -r file; do
        # Get relative path from local_dir
        relative_path="${file#$local_dir/}"
        remote_file_path="$remote_path/$relative_path"
        
        # Create remote directory if needed
        remote_dir=$(dirname "$remote_file_path")
        if [ "$remote_dir" != "." ] && [ "$remote_dir" != "$remote_path" ]; then
            create_remote_dir "$remote_dir"
        fi
        
        upload_file "$file" "$relative_path"
        total_count=$((total_count + 1))
        if [ $? -eq 0 ]; then
            success_count=$((success_count + 1))
        fi
    done
}

# Check if elevation folder exists
if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ Error: elevation folder not found"
    echo "   Please run this script from the nm_elevation directory"
    exit 1
fi

echo ""
echo "📋 FTP Configuration:"
echo "   Server: $FTP_SERVER"
echo "   Remote: $REMOTE_DIR"
echo "   Local:  $LOCAL_DIR"
echo ""

# Ask what to sync
echo "🤔 What would you like to sync?"
echo "1) Full elevation folder (recommended)"
echo "2) Just core files (HTML, JS, CSS)"
echo "3) Quick update (JS and CSS only)"
echo "4) Test connection"
echo "5) Cancel"
echo ""
read -p "Choose option (1-5): " choice
echo ""

case $choice in
    1)
        echo "🚀 Syncing full elevation folder..."
        
        # Create main elevation directory
        create_remote_dir ""
        
        # Sync all subdirectories
        create_remote_dir "js"
        create_remote_dir "css"
        create_remote_dir "data"
        create_remote_dir "docs"
        create_remote_dir "images"
        
        # Upload main HTML files
        echo ""
        echo "📱 Uploading main files..."
        upload_file "$LOCAL_DIR/gps_live.html" "gps_live.html"
        upload_file "$LOCAL_DIR/gps_tracker.html" "gps_tracker.html"
        upload_file "$LOCAL_DIR/elevation_new_mexico.html" "elevation_new_mexico.html"
        upload_file "$LOCAL_DIR/home.html" "home.html"
        upload_file "$LOCAL_DIR/index.php" "index.php"
        
        # Upload JavaScript files
        echo ""
        echo "🟨 Uploading JavaScript files..."
        for js_file in "$LOCAL_DIR/js"/*.js; do
            if [ -f "$js_file" ]; then
                filename=$(basename "$js_file")
                upload_file "$js_file" "js/$filename"
            fi
        done
        
        # Upload CSS files
        echo ""
        echo "🎨 Uploading CSS files..."
        for css_file in "$LOCAL_DIR/css"/*.css; do
            if [ -f "$css_file" ]; then
                filename=$(basename "$css_file")
                upload_file "$css_file" "css/$filename"
            fi
        done
        
        # Upload data files
        echo ""
        echo "📊 Uploading data files..."
        for data_file in "$LOCAL_DIR/data"/*.{json,geojson}; do
            if [ -f "$data_file" ]; then
                filename=$(basename "$data_file")
                upload_file "$data_file" "data/$filename"
            fi
        done
        
        # Upload documentation
        echo ""
        echo "📚 Uploading documentation..."
        for doc_file in "$LOCAL_DIR/docs"/*.md; do
            if [ -f "$doc_file" ]; then
                filename=$(basename "$doc_file")
                upload_file "$doc_file" "docs/$filename"
            fi
        done
        ;;
        
    2)
        echo "🚀 Syncing core files only..."
        create_remote_dir ""
        create_remote_dir "js"
        create_remote_dir "css"
        
        upload_file "$LOCAL_DIR/gps_live.html" "gps_live.html"
        upload_file "$LOCAL_DIR/gps_tracker.html" "gps_tracker.html"
        upload_file "$LOCAL_DIR/js/gps_live.js" "js/gps_live.js"
        upload_file "$LOCAL_DIR/js/gps_tracker.js" "js/gps_tracker.js"
        upload_file "$LOCAL_DIR/css/gps_live.css" "css/gps_live.css"
        upload_file "$LOCAL_DIR/css/gps_tracker.css" "css/gps_tracker.css"
        ;;
        
    3)
        echo "⚡ Quick update - JS and CSS only..."
        upload_file "$LOCAL_DIR/js/gps_live.js" "js/gps_live.js"
        upload_file "$LOCAL_DIR/css/gps_live.css" "css/gps_live.css"
        ;;
        
    4)
        echo "🔍 Testing FTP connection..."
        curl "ftp://$FTP_SERVER/$REMOTE_DIR/" \
             --user "$FTP_USER:$FTP_PASS" \
             --list-only \
             --silent
        if [ $? -eq 0 ]; then
            echo "✅ FTP connection successful!"
        else
            echo "❌ FTP connection failed!"
        fi
        ;;
        
    5)
        echo "🚫 Sync cancelled"
        exit 0
        ;;
        
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

if [[ $choice -ge 1 && $choice -le 3 ]]; then
    echo ""
    echo "🎉 Elevation sync completed!"
    echo "============================"
    echo ""
    echo "🌐 Your GPS tracker is now live at:"
    echo "   https://hanon.artsmetrics.ai/elevation/gps_live.html"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)"
    echo "   2. Test GPS functionality"
    echo "   3. Check session numbers are displaying"
    echo "   4. Test on mobile device"
    echo ""
fi

echo "✨ Done!" 