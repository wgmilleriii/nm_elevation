# Dummy's Guide: Shell Commands for Data Gathering and Progress Checks

## Overview
This guide provides simple shell commands to manage data gathering (start/stop) and check progress on both your PC and Pi.

---

## 1. Start Data Gathering

### On PC
- **Start the collection service:**
  ```sh
  # Windows (PowerShell)
  Start-Process powershell -ArgumentList "-File collect_service.ps1"
  ```
  This runs the collection script in the background.

### On Pi
- **Start the collection service:**
  ```sh
  # SSH into the Pi
  ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68
  # Then run the collection script
  cd /home/pi/nm_elevation
  ./collect_service.sh
  ```

---

## 2. Stop Data Gathering

### On PC
- **Stop the collection service:**
  ```sh
  # Windows (PowerShell)
  Get-Process -Name "node" | Where-Object { $_.CommandLine -like "*collect_sparse_points.js*" } | Stop-Process
  ```
  This stops any running Node.js processes related to data collection.

### On Pi
- **Stop the collection service:**
  ```sh
  # SSH into the Pi
  ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68
  # Then stop the collection script
  pkill -f collect_service.sh
  ```

---

## 3. Check Progress

### On PC
- **Check completion status:**
  ```sh
  node check_completion.js
  ```
  This shows the completion status of all grid databases on the PC.

- **Check sync health:**
  ```sh
  node check_sync_health.js
  ```
  This checks the sync status between PC and Pi.

### On Pi
- **Check completion status:**
  ```sh
  # SSH into the Pi
  ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68
  # Then run the completion check
  cd /home/pi/nm_elevation
  node check_completion.js
  ```

- **Check sync health:**
  ```sh
  # SSH into the Pi
  ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68
  # Then run the sync health check
  cd /home/pi/nm_elevation
  node check_sync_health.js
  ```

---

## 4. Force Sync from PC to Pi

- **Sync all grid databases from PC to Pi:**
  ```sh
  rsync -avz -e "ssh -i C:/Users/Wgmil/.ssh/pi_auto_key" --progress --delete ./grid_databases/mountains_*.db pi@10.0.0.68:/home/pi/nm_elevation/grid_databases/
  ```
  This overwrites the Pi's databases with the PC's latest versions.

---

## 5. Fix Missing Tables on Pi

- **Create missing tables on Pi:**
  ```sh
  ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68 '
  for db in /home/pi/nm_elevation/grid_databases/mountains_*.db; do
    sqlite3 "$db" "CREATE TABLE IF NOT EXISTS elevation_points (id INTEGER PRIMARY KEY, lat REAL, lon REAL, elevation REAL, timestamp TEXT);"
  done
  '
  ```
  This ensures every database on the Pi has the required `elevation_points` table.

---

## 6. Check Logs

- **Check recent collection progress logs:**
  ```sh
  # On PC (shows last 50 lines)
  Get-Content collection_progress.log -Tail 50
  # On Pi (shows last 50 lines)
  ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68 "tail -n 50 /home/pi/nm_elevation/collection_progress.log"
  ```

- **Check recent sync logs:**
  ```sh
  # On PC (shows last 50 lines)
  Get-Content sync.log -Tail 50
  # On Pi (shows last 50 lines)
  ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68 "tail -n 50 /home/pi/nm_elevation/sync.log"
  ```

- **Watch logs in real-time:**
  ```sh
  # On PC (follows new entries)
  Get-Content collection_progress.log -Wait -Tail 10
  # On Pi (follows new entries)
  ssh -i "C:/Users/Wgmil/.ssh/pi_auto_key" pi@10.0.0.68 "tail -f /home/pi/nm_elevation/collection_progress.log"
  ```

---

## 7. Troubleshooting

- **If the Pi's databases are missing tables:**
  - Run the "Fix Missing Tables" command (Step 5).
  - Re-sync from the PC (Step 4).

- **If the PC is not collecting data:**
  - Check if the collection service is running (Step 1).
  - Check the collection logs (Step 6).

- **If the Pi is not collecting data:**
  - SSH into the Pi and check if the collection service is running (Step 1).
  - Check the collection logs (Step 6).

---

## 8. Summary

- **Start/Stop:** Use the commands in Steps 1 and 2.
- **Check Progress:** Use the commands in Step 3.
- **Sync Data:** Use the command in Step 4.
- **Fix Issues:** Use the commands in Steps 5 and 7.
- **Check Logs:** Use the commands in Step 6.

---

## 9. Cross-References

- For more details, see:
  - `PI_SETUP.md`
  - `SYNC_SETUP.md`
  - `README.md`

---

## 10. Notes

- Always stop data gathering before syncing to avoid conflicts.
- Regularly check logs to ensure everything is running smoothly.
- If in doubt, re-sync from the PC to ensure the Pi has the latest data. 