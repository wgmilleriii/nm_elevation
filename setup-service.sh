#!/bin/bash

# Copy service file to systemd directory
sudo cp nm-elevation.service /etc/systemd/system/

# Reload systemd daemon
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable nm-elevation

# Start the service now
sudo systemctl start nm-elevation

# Check status
sudo systemctl status nm-elevation 