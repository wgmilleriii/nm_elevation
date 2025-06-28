#!/bin/bash

# Quick Elevation Sync - No questions asked!
echo "🚀 Quick syncing elevation folder..."
rsync -avz --progress --exclude='.DS_Store' elevation/ hanon@hanon.artsmetrics.net:public_html/elevation/
echo "✅ Done! Visit: https://hanon.artsmetrics.net/elevation/gps_live.html" 