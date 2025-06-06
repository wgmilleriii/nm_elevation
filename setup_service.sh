#!/bin/bash

# Ensure we're running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Copy service file to systemd directory
cp nm-elevation.service /etc/systemd/system/

# Reload systemd to recognize new service
systemctl daemon-reload

# Enable and start the service
systemctl enable nm-elevation
systemctl start nm-elevation

echo "Service installed and started!"
echo "Check status with: systemctl status nm-elevation"
echo "View logs with: journalctl -u nm-elevation -f"
echo "Or check collection.log in the project directory" 