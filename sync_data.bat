@echo off
echo Starting NM Elevation Data Sync...

:loop
echo Running sync at %time%
bash sync_data.sh
timeout /t 300 /nobreak
goto loop 