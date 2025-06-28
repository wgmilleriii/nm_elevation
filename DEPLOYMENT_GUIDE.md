# Remote Server Deployment Guide

This guide covers deploying the GPS tracking and elevation processing system to a remote PHP server.

## Architecture Overview

```
[User's Browser] → [PHP Remote Server] → [Mac Processing Server]
     ↓                      ↓                       ↓
GPS Collection        JSON File Storage      Elevation Lookup
Session Management    Queue Management       API Processing
```

## Components

1. **Remote PHP Server** (`remote_server.php`)
   - Handles GPS data collection from users
   - Stores data in JSON files
   - Provides queue for elevation processing
   - Updates elevation data when received

2. **Mac Processing Server** (`elevation_service.js` + `deploy_remote.js`)
   - Polls remote server for GPS points
   - Processes elevation lookups using multiple APIs
   - Updates remote server with elevation data

## Deployment Steps

### 1. PHP Server Setup

#### Upload Files to Remote Server
```bash
# Upload to your web server
scp remote_server.php user@your-server.com:/path/to/web/root/
```

#### Set Permissions
```bash
# On remote server
chmod 755 remote_server.php
mkdir -p data/{users,queue,logs}
chmod 755 data data/users data/queue data/logs
```

#### Configure Web Server
Add to your `.htaccess` or Apache/Nginx config:

**Apache (.htaccess):**
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^api/(.*)$ remote_server.php [QSA,L]
```

**Nginx:**
```nginx
location /api/ {
    try_files $uri $uri/ /remote_server.php?$query_string;
}
```

### 2. Mac Processing Server Setup

#### Install Dependencies
```bash
npm install node-fetch
```

#### Configure Environment
Create `.env` file:
```bash
REMOTE_SERVER_URL=https://your-domain.com
LOCAL_PORT=8020
LOG_LEVEL=info
```

#### Start Processing Service
```bash
# Development
REMOTE_SERVER_URL=https://your-domain.com node deploy_remote.js

# Production with PM2
npm install -g pm2
pm2 start deploy_remote.js --name "elevation-service"
pm2 save
pm2 startup
```

### 3. Client Integration

Update your GPS tracking client to point to the remote server:

```javascript
// In gps_live.js
const API_BASE_URL = 'https://your-domain.com';

// Initialize user
const response = await fetch(`${API_BASE_URL}/api/user/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: this.deviceId })
});
```

## API Endpoints

### Remote PHP Server

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/init` | POST | Initialize user session |
| `/api/user/session/start` | POST | Start GPS tracking session |
| `/api/user/track-point` | POST | Save GPS point |
| `/api/gps-queue` | GET | Get points needing elevation |
| `/api/elevation-update` | POST | Update point with elevation |
| `/api/user-sessions` | GET | Get user's sessions |
| `/api/stats` | GET | Get system statistics |

### Mac Processing Server

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Status dashboard |
| `/api/status` | GET | Service status and stats |
| `/api/logs` | GET | Recent log entries |
| `/api/config` | GET | Current configuration |

## Data Flow

1. **User visits website**
   - Browser requests user initialization
   - PHP server creates user profile (JSON file)
   - Returns user ID

2. **GPS tracking starts**
   - Browser sends GPS points to PHP server
   - PHP server saves points to user's session
   - Points added to elevation processing queue

3. **Elevation processing**
   - Mac server polls PHP server for queue
   - Processes elevation lookups using APIs
   - Updates PHP server with elevation data

4. **Real-time updates**
   - Browser polls for elevation updates
   - PHP server returns updated point data

## File Structure

### Remote Server (PHP)
```
/
├── remote_server.php          # Main PHP script
├── data/
│   ├── users/                 # User profile JSON files
│   │   ├── user_abc123.json
│   │   └── user_def456.json
│   ├── queue/                 # Daily queue files
│   │   ├── queue_2024-01-15.json
│   │   └── queue_2024-01-16.json
│   └── logs/                  # Request logs
│       ├── requests_2024-01-15.log
│       └── requests_2024-01-16.log
```

### Mac Server
```
/
├── elevation_service.js       # Core elevation processing
├── deploy_remote.js          # Deployment script
├── data/
│   └── local_queue/
│       └── elevation_queue.json
```

## Monitoring

### PHP Server Monitoring
Check logs and data directories:
```bash
# Check recent requests
tail -f data/logs/requests_$(date +%Y-%m-%d).log

# Check queue size
ls -la data/queue/

# Check user count
ls -la data/users/ | wc -l
```

### Mac Server Monitoring
Access the status dashboard:
- Open `http://localhost:8020` in browser
- Check service status and statistics
- Monitor processing queue

### Health Checks
```bash
# Test PHP server
curl https://your-domain.com/api/stats

# Test Mac server
curl http://localhost:8020/api/status
```

## Troubleshooting

### Common Issues

1. **PHP Permissions**
   ```bash
   # Fix data directory permissions
   chmod -R 755 data/
   chown -R www-data:www-data data/
   ```

2. **CORS Issues**
   - Ensure PHP server sets proper CORS headers
   - Check browser console for CORS errors

3. **Elevation API Rate Limits**
   - Service automatically handles rate limits
   - Check Mac server logs for API status

4. **Queue Processing Delays**
   - Check network connectivity between servers
   - Verify remote server URL configuration

### Log Analysis
```bash
# Mac server logs
tail -f ~/.pm2/logs/elevation-service-out.log

# PHP server logs
tail -f data/logs/requests_$(date +%Y-%m-%d).log

# System logs
journalctl -u nginx  # or apache2
```

## Security Considerations

1. **API Rate Limiting**
   - Implement rate limiting on PHP endpoints
   - Monitor for abuse patterns

2. **Data Validation**
   - Validate all GPS coordinates
   - Sanitize user input

3. **File Permissions**
   - Restrict data directory access
   - Use proper web server user

4. **HTTPS**
   - Always use HTTPS for remote server
   - Validate SSL certificates

## Performance Optimization

1. **PHP Server**
   - Enable OPcache
   - Use efficient JSON encoding
   - Implement file locking for concurrent access

2. **Mac Server**
   - Adjust batch sizes based on API limits
   - Monitor memory usage
   - Use PM2 for process management

3. **Network**
   - Minimize API calls
   - Use compression for large responses
   - Implement caching where appropriate

## Backup and Recovery

1. **Data Backup**
   ```bash
   # Backup user data
   tar -czf backup_$(date +%Y%m%d).tar.gz data/
   
   # Sync to remote backup
   rsync -av data/ backup-server:/backups/gps-data/
   ```

2. **Recovery Procedures**
   - Restore from backup files
   - Verify data integrity
   - Restart services

## Scaling Considerations

1. **Multiple Processing Servers**
   - Run multiple Mac servers
   - Implement queue partitioning
   - Load balance elevation processing

2. **Database Migration**
   - Consider moving to proper database for high volume
   - Implement data migration scripts
   - Maintain JSON compatibility

3. **CDN Integration**
   - Use CDN for static assets
   - Cache API responses where appropriate
   - Optimize for global access 