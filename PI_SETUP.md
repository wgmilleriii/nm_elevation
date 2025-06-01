# Raspberry Pi Setup Guide

This guide will help you set up two Raspberry Pis to work together collecting elevation data.

## Prerequisites

- 2x Raspberry Pi 4 (4GB RAM recommended)
- 2x MicroSD cards (32GB+ recommended)
- 2x Power supplies
- Network connectivity (Ethernet or WiFi)
- SSH access enabled on both Pis

## Initial Setup

1. **Prepare SD Cards**
   - Download and flash Raspberry Pi OS (64-bit) to both SD cards
   - Enable SSH during first boot
   - Set hostnames:
     - First Pi: `pi1`
     - Second Pi: `pi2`

2. **Network Setup**
   - Connect both Pis to the same network
   - Note their IP addresses
   - Update `/etc/hosts` on both Pis:
     ```
     192.168.1.100 pi1
     192.168.1.101 pi2
     ```

3. **Clone Repository**
   ```bash
   git clone https://github.com/your-repo/nm_elevation.git
   cd nm_elevation
   ```

4. **Configure Instances**
   - Edit `config.json` on both Pis
   - Update IP addresses and API keys
   - Ensure grid assignments are correct

## Installation

1. **Make Setup Script Executable**
   ```bash
   chmod +x setup_pi.sh
   ```

2. **Run Setup Script**
   ```bash
   ./setup_pi.sh
   ```

3. **Verify Installation**
   ```bash
   sudo systemctl status nm-elevation
   sudo systemctl status nm-elevation-sync
   ```

## Monitoring

1. **Check Logs**
   ```bash
   tail -f pi_sync.log
   ```

2. **Check Database Health**
   ```bash
   node check_completion.js
   ```

3. **System Status**
   ```bash
   htop
   ```

## Troubleshooting

1. **Sync Issues**
   - Check SSH keys are properly set up
   - Verify network connectivity
   - Check rsync logs

2. **Database Issues**
   - Check disk space
   - Verify database permissions
   - Check SQLite logs

3. **Service Issues**
   - Check systemd logs:
     ```bash
     journalctl -u nm-elevation
     journalctl -u nm-elevation-sync
     ```

## Maintenance

1. **Regular Updates**
   ```bash
   sudo apt update && sudo apt upgrade
   ```

2. **Backup**
   ```bash
   rsync -avz /home/pi/nm_elevation/grid_databases/ /path/to/backup/
   ```

3. **Log Rotation**
   - Logs are automatically rotated
   - Check `logs` directory for archived logs

## Security Notes

1. **API Keys**
   - Keep API keys secure
   - Rotate keys regularly
   - Use environment variables

2. **SSH Security**
   - Use key-based authentication
   - Disable password login
   - Keep system updated

## Support

For issues or questions:
1. Check the logs
2. Review this documentation
3. Open an issue on GitHub 