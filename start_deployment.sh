#!/bin/bash

# GPS Elevation Service - Deployment Startup Script
echo "🌍 GPS Elevation Service - Remote Deployment"
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if required files exist
if [ ! -f "elevation_service.js" ]; then
    echo "❌ elevation_service.js not found"
    exit 1
fi

if [ ! -f "deploy_remote.js" ]; then
    echo "❌ deploy_remote.js not found"
    exit 1
fi

# Get remote server URL from user
if [ -z "$REMOTE_SERVER_URL" ]; then
    echo ""
    read -p "Enter your remote server URL (e.g., https://your-domain.com): " REMOTE_SERVER_URL
    export REMOTE_SERVER_URL
fi

# Get local port
if [ -z "$LOCAL_PORT" ]; then
    LOCAL_PORT=8020
    export LOCAL_PORT
fi

echo ""
echo "Configuration:"
echo "- Remote Server: $REMOTE_SERVER_URL"
echo "- Local Port: $LOCAL_PORT"
echo ""

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/local_queue
mkdir -p data/logs

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install node-fetch
fi

# Check if PM2 is available for production
if command -v pm2 &> /dev/null; then
    echo "🚀 Starting with PM2 (production mode)..."
    pm2 start deploy_remote.js --name "elevation-service" --env production
    pm2 save
    echo ""
    echo "✅ Service started with PM2"
    echo "📊 Status dashboard: http://localhost:$LOCAL_PORT"
    echo "🔧 PM2 commands:"
    echo "   pm2 status                    # Check status"
    echo "   pm2 logs elevation-service    # View logs"
    echo "   pm2 restart elevation-service # Restart service"
    echo "   pm2 stop elevation-service    # Stop service"
else
    echo "🚀 Starting in development mode..."
    echo "💡 Install PM2 for production: npm install -g pm2"
    echo ""
    echo "Starting service..."
    node deploy_remote.js
fi 