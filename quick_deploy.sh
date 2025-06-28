#!/bin/bash

# Quick GPS Elevation Deployment
# Uploads key files directly to hanon.artsmetrics.net/elevation/

echo "🚀 Quick deploying GPS elevation files..."

FTP_SERVER="ftp.chipmiller.me"
FTP_USER="public_projects@chipmiller.me"
FTP_PASS="synxek-8xyhze-mAqror"
REMOTE_DIR="hanon/elevation"

# Upload function
upload() {
    local file="$1"
    local remote_name="$2"
    echo "📤 Uploading $file -> $remote_name"
    curl -T "$file" "ftp://$FTP_SERVER/$REMOTE_DIR/$remote_name" \
         --user "$FTP_USER:$FTP_PASS" --silent --show-error
    if [ $? -eq 0 ]; then
        echo "✅ $remote_name uploaded"
    else
        echo "❌ Failed: $remote_name"
    fi
}

# Upload key GPS tracking files
echo ""
echo "📱 Uploading GPS tracking apps..."
upload "public/gps_live.html" "gps_live.html"
upload "public/gps_tracker.html" "gps_tracker.html"
upload "public/elevation_new_mexico.html" "elevation_new_mexico.html"

echo ""
echo "📜 Uploading JavaScript files to js/ and root..."
upload "public/js/gps_live.js" "js_gps_live.js"
upload "public/js/gps_tracker.js" "js_gps_tracker.js"
upload "public/js/svgUtils.js" "js_svgUtils.js"
upload "public/js/map.js" "js_map.js"
upload "public/js/utils.js" "js_utils.js"
upload "public/js/logger.js" "js_logger.js"
upload "public/js/config.js" "js_config.js"

echo ""
echo "🎨 Uploading CSS files to css/ and root..."
upload "public/css/gps_live.css" "css_gps_live.css"
upload "public/css/gps_tracker.css" "css_gps_tracker.css"

echo ""
echo "✅ Quick deployment complete!"
echo ""
echo "🌐 Access your GPS tracking system:"
echo "   • Landing: https://hanon.artsmetrics.net/elevation/home.html"
echo "   • Live GPS: https://hanon.artsmetrics.net/elevation/gps_live.html"
echo "   • GPS Tracker: https://hanon.artsmetrics.net/elevation/gps_tracker.html"
echo "   • Elevation Map: https://hanon.artsmetrics.net/elevation/elevation_new_mexico.html"
echo ""
echo "🚀 To connect Mac server:"
echo "   REMOTE_SERVER_URL=https://hanon.artsmetrics.net/elevation node deploy_remote.js" 