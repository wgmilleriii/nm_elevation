#!/bin/bash

# Update system
echo "Updating system..."
sudo apt update && sudo apt upgrade -y

# Install required packages
echo "Installing required packages..."
sudo apt install -y nodejs npm sqlite3 rsync

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install winston

# Create necessary directories
echo "Creating directories..."
mkdir -p grid_databases
mkdir -p logs

# Set up SSH keys for rsync
echo "Setting up SSH keys..."
if [ ! -f ~/.ssh/id_rsa ]; then
    ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa
fi

# Add SSH key to authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Create systemd service
echo "Creating systemd service..."
sudo tee /etc/systemd/system/nm-elevation.service << EOF
[Unit]
Description=NM Elevation Data Collection
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/nm_elevation
ExecStart=/usr/bin/node collect_sparse_points.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create sync service
sudo tee /etc/systemd/system/nm-elevation-sync.service << EOF
[Unit]
Description=NM Elevation Database Sync
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/nm_elevation
ExecStart=/usr/bin/node sync_databases.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
echo "Enabling and starting services..."
sudo systemctl daemon-reload
sudo systemctl enable nm-elevation
sudo systemctl enable nm-elevation-sync
sudo systemctl start nm-elevation
sudo systemctl start nm-elevation-sync

echo "Setup complete! Check status with:"
echo "sudo systemctl status nm-elevation"
echo "sudo systemctl status nm-elevation-sync" 