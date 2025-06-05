#!/bin/bash

# Configuration
PI_USER="pi"
PI_HOST="10.0.0.68"
PI_DIR="/home/pi/your_script_folder"
LOCAL_DIR="./your_script_folder"

# Sync files from LOCAL_DIR to PI_DIR on the Pi
rsync -avz --delete "$LOCAL_DIR/" "$PI_USER@$PI_HOST:$PI_DIR/"

echo "Sync complete!" 