#!/bin/bash

# Install vsftpd (Very Secure FTP Daemon)
sudo apt-get update
sudo apt-get install -y vsftpd

# Backup original config
sudo cp /etc/vsftpd.conf /etc/vsftpd.conf.backup

# Create new config
sudo tee /etc/vsftpd.conf > /dev/null << EOL
listen=YES
listen_ipv6=NO
anonymous_enable=NO
local_enable=YES
write_enable=YES
local_umask=022
dirmessage_enable=YES
use_localtime=YES
xferlog_enable=YES
connect_from_port_20=YES
chroot_local_user=YES
secure_chroot_dir=/var/run/vsftpd/empty
pam_service_name=vsftpd
force_local_data_ssl=NO
force_local_logins_ssl=NO
ssl_enable=NO
allow_anon_ssl=NO
EOL

# Restart vsftpd service
sudo systemctl restart vsftpd
sudo systemctl enable vsftpd

# Create a test directory
mkdir -p ~/ftp_test
chmod 755 ~/ftp_test

echo "FTP server setup complete. You can now connect using:"
echo "Host: $(hostname -I | awk '{print $1}')"
echo "User: pi"
echo "Password: raspberry" 