#!/bin/bash

# Quick FTP Sync - Just the essentials!
echo "⚡ Quick FTP sync of elevation JS and CSS..."

FTP_SERVER="ftp.chipmiller.me"
FTP_USER="public_projects@chipmiller.me"
FTP_PASS="synxek-8xyhze-mAqror"
REMOTE_DIR="hanon/elevation"

echo "📤 Uploading gps_live.js..."
curl -T "elevation/js/gps_live.js" "ftp://$FTP_SERVER/$REMOTE_DIR/js_gps_live.js" --user "$FTP_USER:$FTP_PASS" --create-dirs --silent --show-error

echo "📤 Uploading gps_live.css..."
curl -T "elevation/css/gps_live.css" "ftp://$FTP_SERVER/$REMOTE_DIR/css_gps_live.css" --user "$FTP_USER:$FTP_PASS" --create-dirs --silent --show-error

echo "📤 Uploading gps_live.html..."
curl -T "elevation/gps_live.html" "ftp://$FTP_SERVER/$REMOTE_DIR/gps_live.html" --user "$FTP_USER:$FTP_PASS" --create-dirs --silent --show-error

echo "✅ Done! Visit: https://hanon.artsmetrics.net/elevation/gps_live.html" 