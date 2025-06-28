#!/bin/bash

# GPS Elevation System Deployment Script
# Uploads all necessary files to hanon.artsmetrics.ai/elevation/
# Phase 1: Core server and client files
# Phase 2: Documentation and additional resources

echo "🌍 Deploying GPS Elevation System to hanon.artsmetrics.ai/elevation/..."
echo "======================================================================"

# FTP Configuration
FTP_SERVER="ftp.chipmiller.me"
FTP_USER="public_projects@chipmiller.me"
FTP_PASS="synxek-8xyhze-mAqror"
REMOTE_DIR="hanon/elevation"

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

echo ""
echo "🚀 PHASE 1: Deploying core elevation system files..."
echo "=================================================="

# Create remote directories
create_remote_dir "data"
create_remote_dir "data/users"
create_remote_dir "data/queue"
create_remote_dir "data/logs"
create_remote_dir "docs"
create_remote_dir "client"
create_remote_dir "client/css"
create_remote_dir "client/js"
create_remote_dir "client/js/modules"
create_remote_dir "client/js/algorithms"
create_remote_dir "client/js/utils"

# Upload main PHP server file (handles /api/* routes)
echo ""
echo "🐘 Uploading PHP API server..."
upload_file "remote_server.php" "index.php"

# Create a simple landing page
echo ""
echo "🏠 Creating landing page..."
cat > temp_index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GPS Elevation Tracking System</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: #2c3e50; color: white; padding: 20px; margin: -30px -30px 30px -30px; border-radius: 10px 10px 0 0; text-align: center; }
        .section { margin: 20px 0; padding: 20px; background: #f8f9fa; border-radius: 5px; }
        .link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .link-box { background: #3498db; color: white; padding: 20px; border-radius: 5px; text-decoration: none; text-align: center; transition: background 0.3s; }
        .link-box:hover { background: #2980b9; text-decoration: none; color: white; }
        .api-endpoint { background: #2c3e50; color: #ecf0f1; padding: 10px; border-radius: 3px; font-family: monospace; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌍 GPS Elevation Tracking System</h1>
            <p>Real-time GPS tracking with automatic elevation lookup</p>
        </div>

        <div class="section">
            <h2>📱 Client Applications</h2>
            <div class="link-grid">
                <a href="client/gps_live.html" class="link-box">
                    <h3>📍 Live GPS Tracker</h3>
                    <p>Real-time GPS tracking with elevation display</p>
                </a>
                <a href="client/gps_tracker.html" class="link-box">
                    <h3>🗺️ GPS Data Collector</h3>
                    <p>Collect and visualize GPS tracking data</p>
                </a>
                <a href="client/elevation_new_mexico.html" class="link-box">
                    <h3>🏔️ New Mexico Elevation Map</h3>
                    <p>Interactive elevation visualization</p>
                </a>
            </div>
        </div>

        <div class="section">
            <h2>🔧 API Endpoints</h2>
            <p>The system provides the following REST API endpoints:</p>
            <div class="api-endpoint">POST /api/user/init - Initialize user session</div>
            <div class="api-endpoint">POST /api/user/session/start - Start GPS tracking session</div>
            <div class="api-endpoint">POST /api/user/track-point - Save GPS point</div>
            <div class="api-endpoint">GET /api/gps-queue - Get points needing elevation</div>
            <div class="api-endpoint">POST /api/elevation-update - Update point with elevation</div>
            <div class="api-endpoint">GET /api/stats - Get system statistics</div>
        </div>

        <div class="section">
            <h2>📚 Documentation</h2>
            <p><a href="docs/DEPLOYMENT_GUIDE.md">📖 Deployment Guide</a> - Complete setup instructions</p>
            <p><a href="docs/MOBILE_GUIDE.md">📱 Mobile Guide</a> - Mobile GPS tracking setup</p>
        </div>

        <div class="section">
            <h2>⚡ System Status</h2>
            <p>System is operational and ready to accept GPS tracking data.</p>
            <p><strong>Last Updated:</strong> <span id="timestamp"></span></p>
        </div>
    </div>

    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
    </script>
</body>
</html>
EOF

upload_file "temp_index.html" "home.html"
rm temp_index.html

# Upload client-side files
echo ""
echo "📱 Uploading client files..."
upload_file "public/gps_live.html" "client/gps_live.html"
upload_file "public/gps_tracker.html" "client/gps_tracker.html"
upload_file "public/elevation_new_mexico.html" "client/elevation_new_mexico.html"
upload_file "public/index.html" "client/index.html"

# Upload CSS files
echo ""
echo "🎨 Uploading CSS files..."
for css_file in public/css/*.css; do
    if [ -f "$css_file" ]; then
        filename=$(basename "$css_file")
        upload_file "$css_file" "client/css/$filename"
    fi
done

# Upload JavaScript files
echo ""
echo "📜 Uploading JavaScript files..."
for js_file in public/js/*.js; do
    if [ -f "$js_file" ]; then
        filename=$(basename "$js_file")
        upload_file "$js_file" "client/js/$filename"
    fi
done

# Upload JavaScript modules
echo ""
echo "📦 Uploading JavaScript modules..."
for module in public/js/modules/*.js; do
    if [ -f "$module" ]; then
        filename=$(basename "$module")
        upload_file "$module" "client/js/modules/$filename"
    fi
done

# Upload JavaScript algorithms
echo ""
echo "🧮 Uploading algorithm files..."
for algo in public/js/algorithms/*.js; do
    if [ -f "$algo" ]; then
        filename=$(basename "$algo")
        upload_file "$algo" "client/js/algorithms/$filename"
    fi
done

# Upload JavaScript utilities
echo ""
echo "🔧 Uploading utility files..."
for util in public/js/utils/*.js; do
    if [ -f "$util" ]; then
        filename=$(basename "$util")
        upload_file "$util" "client/js/utils/$filename"
    fi
done

echo ""
echo "✅ PHASE 1 COMPLETE: Core elevation system deployed!"
echo "================================================="
echo ""
echo "🎯 Your GPS elevation system should now be accessible at:"
echo "   https://hanon.artsmetrics.net/elevation/"
echo ""

# Ask user if they want to deploy documentation
read -p "📚 Deploy documentation and additional files? (y/N): " deploy_docs

if [[ $deploy_docs =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 PHASE 2: Deploying documentation and resources..."
    echo "================================================="
    
    # Upload documentation
    echo ""
    echo "📖 Uploading documentation..."
    upload_file "DEPLOYMENT_GUIDE.md" "docs/DEPLOYMENT_GUIDE.md"
    upload_file "docs/MOBILE_GUIDE.md" "docs/MOBILE_GUIDE.md"
    upload_file "README.md" "docs/README.md"
    
    # Upload data files if they exist
    echo ""
    echo "📊 Uploading data files..."
    if [ -f "public/data/new-mexico.geojson" ]; then
        upload_file "public/data/new-mexico.geojson" "client/data/new-mexico.geojson"
    fi
    
    if [ -f "public/elevation_cache_reduced.json" ]; then
        echo "📈 Uploading elevation cache (this may take a moment)..."
        upload_file "public/elevation_cache_reduced.json" "client/elevation_cache_reduced.json"
    fi
    
    echo ""
    echo "✅ PHASE 2 COMPLETE: Documentation and resources deployed!"
    echo "======================================================="
else
    echo ""
    echo "⏭️  Documentation deployment skipped."
    echo "   Run this script again and choose 'y' to deploy documentation later."
fi

echo ""
echo "🎉 Deployment Summary:"
echo "====================="
echo "✅ PHP API server deployed to /elevation/index.php (handles /api/* routes)"
echo "✅ Client applications deployed to /elevation/client/"
echo "✅ CSS and JavaScript files deployed"
echo "✅ Landing page created at /elevation/home.html"
if [[ $deploy_docs =~ ^[Yy]$ ]]; then
    echo "✅ Documentation deployed to /elevation/docs/"
    echo "✅ Data files deployed"
else
    echo "⏭️  Documentation skipped (deploy later if needed)"
fi
echo ""
echo "🌐 Your GPS Elevation System is ready at:"
echo "   https://hanon.artsmetrics.net/elevation/ (API server)"
echo "   https://hanon.artsmetrics.net/elevation/home.html (Landing page)"
echo ""
echo "📱 Direct links:"
echo "   • Live GPS Tracker: https://hanon.artsmetrics.net/elevation/client/gps_live.html"
echo "   • GPS Data Collector: https://hanon.artsmetrics.net/elevation/client/gps_tracker.html"
echo "   • Elevation Map: https://hanon.artsmetrics.net/elevation/client/elevation_new_mexico.html"
echo ""
echo "🚀 To connect your Mac processing server, use:"
echo "   REMOTE_SERVER_URL=https://hanon.artsmetrics.net/elevation node deploy_remote.js"
echo ""
echo "🌍 Happy GPS tracking!" 