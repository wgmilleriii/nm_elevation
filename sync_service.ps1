# Set working directory to script location
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Start the sync service
Write-Host "Starting sync service..."
node sync_databases.js 