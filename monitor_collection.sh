#!/bin/bash

# Set working directory to script location
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting collection service monitor...${NC}"

# Function to check if the service is running
check_service() {
    if pgrep -f "node server.js" > /dev/null; then
        echo -e "${GREEN}✓ Server is running${NC}"
    else
        echo -e "${RED}✗ Server is not running${NC}"
    fi
    
    if pgrep -f "collect_sparse_points.js" > /dev/null; then
        echo -e "${GREEN}✓ Collection process is running${NC}"
    else
        echo -e "${RED}✗ Collection process is not running${NC}"
    fi
}

# Function to check the latest log entries
check_logs() {
    echo -e "\n${YELLOW}Latest collection progress:${NC}"
    tail -n 5 collection_progress.log 2>/dev/null || echo "No collection progress log found"
    
    echo -e "\n${YELLOW}Latest database status:${NC}"
    tail -n 5 database_status.log 2>/dev/null || echo "No database status log found"
}

# Main monitoring loop
while true; do
    clear
    echo -e "${YELLOW}=== Collection Service Monitor ===${NC}"
    echo "Time: $(date)"
    echo "----------------------------------------"
    
    check_service
    check_logs
    
    echo -e "\n${YELLOW}Press Ctrl+C to exit${NC}"
    sleep 10
done 