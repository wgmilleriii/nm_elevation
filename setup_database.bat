@echo off
echo Setting up elevation_tracking database...
"C:\xampp\mysql\bin\mysql.exe" -u root -P 3307 < SQL\000_setup_database.sql
if errorlevel 1 (
    echo Error: Could not execute MySQL command. Please check:
    echo 1. XAMPP MySQL service is running
    echo 2. Root password is correct
    pause
    exit /b 1
)
echo Database setup completed successfully!
pause 