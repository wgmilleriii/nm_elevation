#!/bin/bash

# Elevation Folder Sync Script
# Syncs local elevation folder to hanon.artsmetrics.net

set -e  # Exit on any error

# Configuration
REMOTE_HOST="hanon@hanon.artsmetrics.net"
REMOTE_PATH="public_html/elevation/"
LOCAL_PATH="elevation/"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Elevation Folder Sync Script${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Function to sync with progress
sync_files() {
    local source=$1
    local description=$2
    
    echo -e "${YELLOW}📤 Syncing $description...${NC}"
    
    if rsync -avz --progress --exclude='.DS_Store' --exclude='*.log' --exclude='node_modules/' "$source" "$REMOTE_HOST:$REMOTE_PATH"; then
        echo -e "${GREEN}✅ $description synced successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to sync $description${NC}"
        return 1
    fi
}

# Check if elevation folder exists
if [ ! -d "$LOCAL_PATH" ]; then
    echo -e "${RED}❌ Error: elevation folder not found${NC}"
    echo -e "${YELLOW}Please run this script from the nm_elevation directory${NC}"
    exit 1
fi

# Show what we're about to sync
echo -e "${BLUE}📋 Sync Configuration:${NC}"
echo -e "  Local:  ${LOCAL_PATH}"
echo -e "  Remote: ${REMOTE_HOST}:${REMOTE_PATH}"
echo ""

# Ask for confirmation unless --force flag is used
if [[ "$1" != "--force" ]]; then
    echo -e "${YELLOW}🤔 What would you like to sync?${NC}"
    echo "1) Full elevation folder (recommended)"
    echo "2) Just JS and CSS files"
    echo "3) Dry run (see what would be synced)"
    echo "4) Cancel"
    echo ""
    read -p "Choose option (1-4): " choice
    echo ""
else
    choice=1
    echo -e "${YELLOW}🚀 Force mode: syncing full elevation folder${NC}"
    echo ""
fi

case $choice in
    1)
        echo -e "${BLUE}🔄 Syncing full elevation folder...${NC}"
        sync_files "$LOCAL_PATH" "elevation folder"
        ;;
    2)
        echo -e "${BLUE}🔄 Syncing JS and CSS files...${NC}"
        sync_files "${LOCAL_PATH}js/" "JavaScript files" && \
        sync_files "${LOCAL_PATH}css/" "CSS files"
        ;;
    3)
        echo -e "${BLUE}🔍 Dry run - showing what would be synced:${NC}"
        echo ""
        rsync -avz --progress --dry-run --exclude='.DS_Store' --exclude='*.log' --exclude='node_modules/' "$LOCAL_PATH" "$REMOTE_HOST:$REMOTE_PATH"
        echo ""
        echo -e "${YELLOW}💡 Run with option 1 or 2 to actually sync${NC}"
        ;;
    4)
        echo -e "${YELLOW}🚫 Sync cancelled${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

if [[ $choice -eq 1 || $choice -eq 2 ]]; then
    echo ""
    echo -e "${GREEN}🎉 Sync completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}🌐 Your site is now live at:${NC}"
    echo -e "   ${YELLOW}https://hanon.artsmetrics.net/elevation/gps_live.html${NC}"
    echo ""
    echo -e "${BLUE}🔧 Next steps:${NC}"
    echo -e "   1. Clear browser cache (Ctrl+F5 or Cmd+Shift+R)"
    echo -e "   2. Test GPS functionality"
    echo -e "   3. Check session numbers are displaying"
    echo ""
fi

echo -e "${BLUE}✨ Done!${NC}" 