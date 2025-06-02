# Set working directory to script location
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# Start the collection service
Write-Host "Starting collection service..."
node collect_sparse_points.js 