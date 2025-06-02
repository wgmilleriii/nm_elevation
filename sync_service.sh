#!/bin/bash

# Create the sync script on the Pi
cat > /home/pi/nm_elevation/sync_data.sh << 'EOL'
#!/bin/bash

# Configuration
PI1_IP="10.0.0.68"
PI2_IP="10.0.0.69"  # Update this with your second Pi's IP
LOCAL_DATA_DIR="/home/pi/nm_elevation/data"
PI_DATA_DIR="/home/pi/nm_elevation/data"

# Create data directories if they don't exist
mkdir -p "$LOCAL_DATA_DIR"

# Function to sync data
sync_data() {
    local source=$1
    local dest=$2
    echo "Syncing from $source to $dest"
    rsync -avz --delete "$source" "$dest"
}

# Sync from Pi1 to Pi2
if [ "$(hostname)" = "pi1" ]; then
    echo "Syncing from Pi1 to Pi2..."
    sync_data "$LOCAL_DATA_DIR/" "pi@$PI2_IP:$PI_DATA_DIR/"
fi

# Sync from Pi2 to Pi1
if [ "$(hostname)" = "pi2" ]; then
    echo "Syncing from Pi2 to Pi1..."
    sync_data "$LOCAL_DATA_DIR/" "pi@$PI1_IP:$PI_DATA_DIR/"
fi

echo "Sync complete!"
EOL

# Make the script executable
chmod +x /home/pi/nm_elevation/sync_data.sh

# Create systemd service
cat > /etc/systemd/system/nm-elevation-sync.service << 'EOL'
[Unit]
Description=NM Elevation Data Sync Service
After=network.target

[Service]
Type=simple
User=pi
ExecStart=/home/pi/nm_elevation/sync_data.sh
Restart=always
RestartSec=300

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd and enable service
systemctl daemon-reload
systemctl enable nm-elevation-sync
systemctl start nm-elevation-sync 