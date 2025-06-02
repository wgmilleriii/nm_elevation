# Start SSH agent and add key
Write-Host "Starting SSH agent..."
Start-Service ssh-agent
ssh-add C:\Users\Wgmil\.ssh\pi_key

# Files to transfer
$files = @(
    "config.json",
    "sync_databases.js",
    "setup_sync.sh",
    "collect_sparse_points.js",
    "check_completion.js",
    "package.json",
    "package-lock.json"
)

# Create directory structure on pi1
Write-Host "Creating directories on pi1..."
ssh -i C:\Users\Wgmil\.ssh\pi_auto_key pi@10.0.0.68 "mkdir -p /home/pi/nm_elevation/{grid_databases,backups,logs}"

# Transfer files
Write-Host "Transferring files to pi1..."
foreach ($file in $files) {
    scp -i C:\Users\Wgmil\.ssh\pi_auto_key $file pi@10.0.0.68:/home/pi/nm_elevation/
}

# Install Node.js and setup
Write-Host "Installing Node.js and setting up..."
ssh -i C:\Users\Wgmil\.ssh\pi_auto_key pi@10.0.0.68 "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs && cd /home/pi/nm_elevation && npm install && chmod +x setup_sync.sh && ./setup_sync.sh"

Write-Host "Deployment complete! Check status on pi1 with:"
Write-Host "ssh -i C:\Users\Wgmil\.ssh\pi_auto_key pi@10.0.0.68 'sudo systemctl status nm-elevation-sync'"
Write-Host "ssh -i C:\Users\Wgmil\.ssh\pi_auto_key pi@10.0.0.68 'sudo systemctl status nm-elevation-backup.timer'" 