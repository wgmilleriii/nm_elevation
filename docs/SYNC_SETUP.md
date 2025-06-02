# PC and Pi1 Synchronization Setup

## Overview
This document outlines the setup for synchronized data collection between the PC and Raspberry Pi (pi1).

## Prerequisites
- PC running Windows 10
- Raspberry Pi (pi1) with Raspberry Pi OS
- Both devices on the same network
- MySQL running on port 3307 (PC)
- SSH access to pi1

## Configuration Steps

### 1. PC Setup
1. MySQL Configuration:
   - Port: 3307
   - Username: root
   - Password: root

2. Database Setup:
   - Run SQL/001_setup_sync.sql to create necessary tables
   - Verify database connection

### 2. Pi1 Setup
1. Network Configuration:
   - Ensure pi1 is accessible via SSH
   - Note pi1's IP address

2. Database Setup:
   - Run the same SQL setup script
   - Configure MySQL connection

### 3. Synchronization Setup
1. Create sync directories:
   ```bash
   mkdir -p grid_databases
   mkdir -p logs
   mkdir -p locks
   ```

2. Configure sync settings in config.json:
   - Update IP addresses
   - Set sync intervals
   - Configure grid assignments

## Monitoring

### PC Monitoring
1. Check sync status:
   ```sql
   SELECT * FROM sync_status ORDER BY last_sync DESC LIMIT 10;
   ```

2. Monitor collection progress:
   ```sql
   SELECT * FROM collection_status WHERE instance_id = 'pc';
   ```

### Pi1 Monitoring
1. SSH into pi1:
   ```bash
   ssh pi@<pi1_ip>
   ```

2. Check sync logs:
   ```bash
   tail -f logs/pi_sync.log
   ```

## Troubleshooting

### Common Issues
1. Connection Issues:
   - Verify network connectivity
   - Check firewall settings
   - Verify SSH access

2. Sync Issues:
   - Check sync logs
   - Verify database permissions
   - Check disk space

### Logs Location
- PC: `logs/sync.log`
- Pi1: `logs/pi_sync.log`

## Maintenance

### Regular Tasks
1. Monitor disk space
2. Check sync status
3. Review error logs
4. Backup databases

### Backup Schedule
- Daily backups at midnight
- Keep last 7 days of backups

## Security Notes
1. Keep API keys secure
2. Use SSH keys for authentication
3. Regular system updates
4. Monitor access logs 