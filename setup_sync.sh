#!/bin/bash

# Create necessary directories
echo "Creating directories..."
mkdir -p grid_databases
mkdir -p backups
mkdir -p logs

# Install required packages
echo "Installing required packages..."
sudo apt update
sudo apt install -y rsync sqlite3 nodejs npm

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install winston

# Set up SSH keys for rsync
echo "Setting up SSH keys..."
if [ ! -f ~/.ssh/id_rsa ]; then
    ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa
fi

# Create systemd service for sync
echo "Creating systemd service..."
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

# Create systemd service for backup
echo "Creating backup service..."
sudo tee /etc/systemd/system/nm-elevation-backup.service << EOF
[Unit]
Description=NM Elevation Database Backup
After=network.target

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/nm_elevation
ExecStart=/bin/bash -c 'rsync -avz --delete grid_databases/ backups/\$(date +%%Y-%%m-%%d)/'
EOF

# Create backup timer
echo "Creating backup timer..."
sudo tee /etc/systemd/system/nm-elevation-backup.timer << EOF
[Unit]
Description=Daily backup of elevation databases

[Timer]
OnCalendar=*-*-* 00:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start services
echo "Enabling and starting services..."
sudo systemctl daemon-reload
sudo systemctl enable nm-elevation-sync
sudo systemctl enable nm-elevation-backup.timer
sudo systemctl start nm-elevation-sync
sudo systemctl start nm-elevation-backup.timer

# Set up log rotation
echo "Setting up log rotation..."
sudo tee /etc/logrotate.d/nm-elevation << EOF
/home/pi/nm_elevation/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 pi pi
}
EOF

# Set permissions
echo "Setting permissions..."
chmod 755 grid_databases
chmod 755 backups
chmod 755 logs

echo "Setup complete! Checking services..."
sudo systemctl status nm-elevation-sync
sudo systemctl status nm-elevation-backup.timer

echo "To check logs:"
echo "sudo journalctl -u nm-elevation-sync"
echo "sudo journalctl -u nm-elevation-backup" 