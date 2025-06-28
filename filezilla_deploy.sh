#!/bin/bash

# FileZilla-Compatible GPS Elevation System Deployment
# This script creates the proper directory structure and uploads all files

echo "🌍 GPS Elevation System - FileZilla Deployment Guide"
echo "=================================================="

FTP_SERVER="ftp.chipmiller.me"
FTP_USER="public_projects@chipmiller.me"
FTP_PASS="synxek-8xyhze-mAqror"
REMOTE_DIR="hanon/elevation"

echo ""
echo "📁 Creating proper directory structure..."

# Function to upload a file
upload_file() {
    local local_file="$1"
    local remote_file="$2"
    
    if [ ! -f "$local_file" ]; then
        echo "❌ File not found: $local_file"
        return 1
    fi
    
    echo "📤 Uploading $local_file -> $remote_file"
    
    curl -T "$local_file" \
         "ftp://$FTP_SERVER/$REMOTE_DIR/$remote_file" \
         --user "$FTP_USER:$FTP_PASS" \
         --create-dirs \
         --silent \
         --show-error
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully uploaded $remote_file"
    else
        echo "❌ Failed to upload $remote_file"
        return 1
    fi
}

echo ""
echo "🏠 Uploading main files..."
upload_file "remote_server.php" "index.php"
upload_file "temp_home.html" "home.html" 2>/dev/null || upload_file "public/index.html" "home.html"
upload_file ".htaccess" ".htaccess"

echo ""
echo "📱 Uploading GPS tracking applications..."
upload_file "public/gps_live.html" "gps_live.html"
upload_file "public/gps_tracker.html" "gps_tracker.html"
upload_file "public/elevation_new_mexico.html" "elevation_new_mexico.html"

echo ""
echo "🎨 Uploading CSS files to css/ directory..."
upload_file "public/css/gps_live.css" "css/gps_live.css"
upload_file "public/css/gps_tracker.css" "css/gps_tracker.css"
upload_file "public/css/nmviewer.css" "css/nmviewer.css"
upload_file "public/css/face.css" "css/face.css"

echo ""
echo "📜 Uploading JavaScript files to js/ directory..."
upload_file "public/js/gps_live.js" "js/gps_live.js"
upload_file "public/js/gps_tracker.js" "js/gps_tracker.js"
upload_file "public/js/map.js" "js/map.js"
upload_file "public/js/utils.js" "js/utils.js"
upload_file "public/js/config.js" "js/config.js"
upload_file "public/js/logger.js" "js/logger.js"
upload_file "public/js/terrain.js" "js/terrain.js"
upload_file "public/js/viewer.js" "js/viewer.js"

echo ""
echo "📦 Uploading JavaScript modules to js/modules/..."
for module in public/js/modules/*.js; do
    if [ -f "$module" ]; then
        filename=$(basename "$module")
        upload_file "$module" "js/modules/$filename"
    fi
done

echo ""
echo "🧮 Uploading JavaScript algorithms to js/algorithms/..."
for algo in public/js/algorithms/*.js; do
    if [ -f "$algo" ]; then
        filename=$(basename "$algo")
        upload_file "$algo" "js/algorithms/$filename"
    fi
done

echo ""
echo "🔧 Uploading JavaScript utilities to js/utils/..."
for util in public/js/utils/*.js; do
    if [ -f "$util" ]; then
        filename=$(basename "$util")
        upload_file "$util" "js/utils/$filename"
    fi
done

echo ""
echo "📚 Uploading documentation to docs/..."
upload_file "DEPLOYMENT_GUIDE.md" "docs/DEPLOYMENT_GUIDE.md"
upload_file "docs/MOBILE_GUIDE.md" "docs/MOBILE_GUIDE.md"
upload_file "docs/API_DOCUMENTATION.md" "docs/API_DOCUMENTATION.md"
upload_file "README.md" "docs/README.md"

echo ""
echo "📊 Uploading data files to data/..."
if [ -f "public/data/new-mexico.geojson" ]; then
    upload_file "public/data/new-mexico.geojson" "data/new-mexico.geojson"
fi

if [ -f "public/elevation_cache_reduced.json" ]; then
    echo "📈 Uploading elevation cache (this may take a moment)..."
    upload_file "public/elevation_cache_reduced.json" "elevation_cache_reduced.json"
fi

echo ""
echo "🖼️ Uploading images to images/..."
for img in public/images/*.{png,jpg,jpeg,gif} 2>/dev/null; do
    if [ -f "$img" ]; then
        filename=$(basename "$img")
        upload_file "$img" "images/$filename"
    fi
done

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================"
echo ""
echo "📁 Directory Structure Created:"
echo "   /elevation/"
echo "   ├── index.php (API server)"
echo "   ├── home.html (landing page)"
echo "   ├── .htaccess (URL routing)"
echo "   ├── css/ (stylesheets)"
echo "   ├── js/ (JavaScript files)"
echo "   │   ├── modules/"
echo "   │   ├── algorithms/"
echo "   │   └── utils/"
echo "   ├── docs/ (documentation)"
echo "   ├── data/ (data files)"
echo "   └── images/ (images)"
echo ""
echo "🌐 Your GPS Elevation System is ready at:"
echo "   https://hanon.artsmetrics.net/elevation/"
echo ""
echo "📱 GPS Tracking Apps:"
echo "   • Live GPS: https://hanon.artsmetrics.net/elevation/gps_live.html"
echo "   • Data Collector: https://hanon.artsmetrics.net/elevation/gps_tracker.html"
echo "   • Elevation Map: https://hanon.artsmetrics.net/elevation/elevation_new_mexico.html"
echo ""
echo "🔧 API Endpoints:"
echo "   • Stats: https://hanon.artsmetrics.net/elevation/api/stats"
echo "   • Queue: https://hanon.artsmetrics.net/elevation/api/gps-queue"
echo "   • Logs: https://hanon.artsmetrics.net/elevation/api/logs"
echo ""
echo "📚 Documentation:"
echo "   • Mobile Guide: https://hanon.artsmetrics.net/elevation/docs/MOBILE_GUIDE.md"
echo "   • API Docs: https://hanon.artsmetrics.net/elevation/docs/API_DOCUMENTATION.md"
echo "   • Deployment Guide: https://hanon.artsmetrics.net/elevation/docs/DEPLOYMENT_GUIDE.md"

echo ""
echo "🚀 If using FileZilla manually:"
echo "   1. Connect to: $FTP_SERVER"
echo "   2. Username: $FTP_USER"
echo "   3. Password: $FTP_PASS"
echo "   4. Navigate to: /$REMOTE_DIR"
echo "   5. Create directories: css, js, docs, data, images"
echo "   6. Upload files maintaining the structure shown above"
echo ""
echo "🌍 Ready for GPS tracking!" 