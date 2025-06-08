# Dummy's Guide: Shell Commands for Data Gathering and Progress Checks

## Overview
This guide provides simple shell commands to manage data gathering (start/stop) and check progress on PC, Mac, and Pi.

---

## 1. Start Data Gathering

### On Mac
- **Start the collection service:**
  ```sh
  # Start the collection script in the background
  ./collect_service.sh &
  ```

### On PC
- **Start the collection service:**
  ```sh
  # Windows (PowerShell)
  Start-Process powershell -ArgumentList "-File collect_service.ps1"
  ```

### On Pi
- **Start the collection service:**
  ```sh
  # SSH into the Pi
  ssh -i "~/.ssh/pi_auto_key" pi@10.0.0.68
  # Then run the collection script
  cd /home/pi/nm_elevation
  ./collect_service.sh
  ```

---

## 2. Stop Data Gathering

### On Mac
- **Stop the collection service:**
  ```sh
  # Find and kill the collection process
  pkill -f collect_service.sh
  # Or more specifically
  pkill -f "node collect_sparse_points.js"
  ```

### On PC
- **Stop the collection service:**
  ```sh
  # Windows (PowerShell)
  Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*collect_sparse_points.js*" } | Stop-Process
  ```

### On Pi
- **Stop the collection service:**
  ```sh
  # SSH into the Pi
  ssh -i "~/.ssh/pi_auto_key" pi@10.0.0.68
  # Then stop the collection script
  pkill -f collect_service.sh
  ```

---

## 3. Check Progress

### On Mac
- **Check completion status:**
  ```sh
  # One-time check
  node check_completion.js
  
  # Monitor continuously (updates every 60 seconds)
  while true; do clear; node check_completion.js; sleep 60; done
  ```

- **Check sync health:**
  ```sh
  node check_sync_health.js
  ```

### On PC
- **Check completion status:**
  ```sh
  # One-time check
  node check_completion.js
  
  # Monitor continuously (PowerShell)
  while ($true) { cls; node check_completion.js; Start-Sleep -Seconds 60 }
  ```

### On Pi
- **Check completion status:**
  ```sh
  # SSH into the Pi
  ssh -i "~/.ssh/pi_auto_key" pi@10.0.0.68
  # Then run the completion check
  cd /home/pi/nm_elevation
  node check_completion.js
  
  # For continuous monitoring
  watch -n 60 node check_completion.js
  ```

---

## 4. Force Sync

### From Mac to Pi
```sh
rsync -avz -e "ssh -i ~/.ssh/pi_auto_key" --progress --delete ./grid_databases/mountains_*.db pi@10.0.0.68:/home/pi/nm_elevation/grid_databases/
```

### From PC to Pi
```sh
rsync -avz -e "ssh -i C:/Users/Wgmil/.ssh/pi_auto_key" --progress --delete ./grid_databases/mountains_*.db pi@10.0.0.68:/home/pi/nm_elevation/grid_databases/
```

---

## 5. Fix Missing Tables on Pi

```sh
# From Mac
ssh -i ~/.ssh/pi_auto_key pi@10.0.0.68 '
for db in /home/pi/nm_elevation/grid_databases/mountains_*.db; do
    sqlite3 "$db" "CREATE TABLE IF NOT EXISTS elevation_points (id INTEGER PRIMARY KEY, lat REAL, lon REAL, elevation REAL, timestamp TEXT);"
done
'

# From PC
ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68 '
for db in /home/pi/nm_elevation/grid_databases/mountains_*.db; do
    sqlite3 "$db" "CREATE TABLE IF NOT EXISTS elevation_points (id INTEGER PRIMARY KEY, lat REAL, lon REAL, elevation REAL, timestamp TEXT);"
done
'
```

---

## 6. Check Logs

### On Mac
```sh
# View recent collection progress (last 50 lines)
tail -n 50 collection_progress.log

# Watch collection progress in real-time
tail -f collection_progress.log

# View database status log
tail -f database_status.log

# View error log
tail -f collection_errors.log
```

### On PC
```sh
# View recent collection progress (last 50 lines)
Get-Content collection_progress.log -Tail 50

# Watch collection progress in real-time
Get-Content collection_progress.log -Wait -Tail 10
```

### On Pi
```sh
# SSH and view logs
ssh -i "~/.ssh/pi_auto_key" pi@10.0.0.68
cd /home/pi/nm_elevation
tail -f collection_progress.log
```

---

## 7. Troubleshooting

### Common Issues and Solutions

1. **Collection Not Starting**
   - Check if Node.js is running: `ps aux | grep node`
   - Check error logs: `tail -f collection_errors.log`
   - Try stopping and restarting the service

2. **Missing or Corrupt Databases**
   - Run the "Fix Missing Tables" command (Step 5)
   - Re-sync from the source machine (Step 4)
   - Check database status: `node check_completion.js`

3. **Sync Issues**
   - Verify Pi is accessible: `ping 10.0.0.68`
   - Check SSH key permissions (should be 600)
   - Check sync logs: `tail -f sync.log`

4. **API Rate Limiting**
   - Check collection_progress.log for rate limit messages
   - The system will automatically handle rate limits
   - No action needed unless all APIs are rate limited

---

## 8. Best Practices

1. **Before Starting Collection**
   - Check current progress
   - Verify no other collection is running
   - Ensure enough disk space is available

2. **During Collection**
   - Monitor logs periodically
   - Check completion status every few hours
   - Watch for error patterns in logs

3. **Before Syncing**
   - Stop collection on both machines
   - Verify source data is complete
   - Check network connectivity

---

## 9. Cross-References

- For detailed setup instructions:
  - `PI_SETUP.md`
  - `SYNC_SETUP.md`
  - `README.md`

---

## 10. Notes

- Always stop data gathering before syncing to avoid conflicts
- Regularly check logs to ensure smooth operation
- When in doubt, re-sync from the source machine
- Keep track of which machine is the primary collector 