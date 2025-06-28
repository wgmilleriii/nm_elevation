# Start the Node.js server in a new window
Start-Process powershell -ArgumentList "node server.js"

# Wait a moment for the server to start
Start-Sleep -Seconds 2

# Open Chrome with the GPS tracker URL
Start-Process "chrome.exe" -ArgumentList "http://localhost:3001/gps_live.html" 