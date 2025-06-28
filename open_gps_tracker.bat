@echo off
echo Starting GPS Tracker...

:: Start the Node.js server in a new window
start cmd /k "node server.js"

:: Wait for server to start
timeout /t 2 /nobreak > nul

:: Open Chrome with the GPS tracker URL
start chrome http://localhost:3001/gps_live.html

echo GPS Tracker launched in Chrome! 