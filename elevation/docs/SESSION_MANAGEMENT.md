# Session Management System Documentation

## Overview

The GPS Live Tracker now features an enhanced session management system with global session numbering, automatic cleanup, heartbeat monitoring, and improved concurrency handling.

## Key Features

### 1. Global Session Numbering
- **Unique Session IDs**: Each session gets a globally unique sequential number
- **Format**: `session_NNNNNN_USERID_TIMESTAMP` (e.g., `session_000123_user_abc_1234567890`)
- **Thread-Safe**: File locking prevents race conditions during concurrent session creation
- **History Tracking**: Maintains history of last 1000 sessions

### 2. Session Lifecycle Management
- **Automatic Cleanup**: Active sessions older than 30 minutes are marked as timed out
- **Conflict Resolution**: Starting new session automatically ends existing active sessions
- **Proper Termination**: Sessions can be explicitly ended or auto-ended due to inactivity

### 3. Heartbeat System
- **Keep-Alive**: Client sends heartbeat every 30 seconds to keep session active
- **Session Validation**: Server validates session exists and is active
- **Auto-Recovery**: Client can detect invalid sessions and restart if needed

## API Endpoints

### Session Creation
```http
POST /api/user/session/start
Content-Type: application/json

{
  "userId": "user_abc123"
}
```

**Response:**
```json
{
  "sessionId": "session_000123_user_abc123_1703875200",
  "globalNumber": 123,
  "startTime": "2023-12-29T12:00:00+00:00",
  "status": "active"
}
```

### Session Heartbeat
```http
POST /api/user/session/heartbeat
Content-Type: application/json

{
  "userId": "user_abc123",
  "sessionId": "session_000123_user_abc123_1703875200"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_000123_user_abc123_1703875200",
  "lastActivity": "2023-12-29T12:30:00+00:00"
}
```

### Session Lookup
```http
GET /api/session/lookup?number=123
GET /api/session/lookup?sessionId=session_000123_user_abc123_1703875200
```

**Response:**
```json
{
  "found": true,
  "sessionId": "session_000123_user_abc123_1703875200",
  "globalNumber": 123,
  "session": {
    "number": 123,
    "created": "2023-12-29T12:00:00+00:00"
  }
}
```

### Session Termination
```http
POST /api/user/session/end
Content-Type: application/json

{
  "userId": "user_abc123",
  "sessionId": "session_000123_user_abc123_1703875200"
}
```

## Data Structures

### Global Session Counter
**File**: `data/global_session_counter.json`

```json
{
  "lastSessionNumber": 123,
  "lastUpdated": "2023-12-29T12:00:00+00:00",
  "sessions": [
    {
      "number": 123,
      "created": "2023-12-29T12:00:00+00:00"
    }
  ]
}
```

### User Session Data
**File**: `data/users/user_abc123.json`

```json
{
  "userId": "user_abc123",
  "deviceId": "device_xyz789",
  "sessions": [
    {
      "sessionId": "session_000123_user_abc123_1703875200",
      "globalNumber": 123,
      "startTime": "2023-12-29T12:00:00+00:00",
      "lastActivity": "2023-12-29T12:30:00+00:00",
      "endTime": null,
      "status": "active",
      "userAgent": "Mozilla/5.0...",
      "ipAddress": "192.168.1.100",
      "points": [],
      "pointCount": 0,
      "totalDistance": 0
    }
  ]
}
```

## Session States

| State | Description | Transitions |
|-------|-------------|-------------|
| `active` | Session is currently tracking GPS points | → `completed`, `timeout`, `auto_ended` |
| `completed` | Session ended normally by user | Final state |
| `timeout` | Session ended due to inactivity (30+ min) | Final state |
| `auto_ended` | Session ended when new session started | Final state |

## Client-Side Integration

### JavaScript Implementation
```javascript
class GPSLiveTracker {
  constructor() {
    this.heartbeatInterval = null;
    this.globalSessionNumber = null;
  }

  async initializeUser() {
    // Initialize user and start session
    const sessionData = await this.startSession();
    this.sessionId = sessionData.sessionId;
    this.globalSessionNumber = sessionData.globalNumber;
    
    // Start heartbeat
    this.startSessionHeartbeat();
    
    // Update UI
    this.updateSessionDisplay();
  }

  startSessionHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, 30000); // 30 seconds
  }

  async sendHeartbeat() {
    const response = await fetch('/api/user/session/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.userId,
        sessionId: this.sessionId
      })
    });
    
    if (!response.ok) {
      console.warn('Session heartbeat failed - session may be invalid');
    }
  }
}
```

### HTML UI Elements
```html
<div class="session info-panel">
  <div>
    <label>USER</label>
    <span id="user-id" class="user-id">----</span>
  </div>
  <div>
    <label>SESSION</label>
    <span id="session-number" class="session-number">--</span>
    <span class="session-status" id="session-status">🔄</span>
  </div>
</div>
```

## Logging and Monitoring

### GPS Activity Logs
**File**: `data/logs/gps_YYYY-MM-DD.log`

```
[2023-12-29T12:00:00+00:00] GPS: session_started - User: user_abc123, Session: session_000123_user_abc123_1703875200
Data: {"globalNumber":123,"userAgent":"Mozilla/5.0...","ipAddress":"192.168.1.100"}
---
[2023-12-29T12:30:00+00:00] GPS: session_timeout - User: user_abc123, Session: session_000123_user_abc123_1703875200
Data: {"lastActivity":"2023-12-29T12:00:00+00:00","timeoutMinutes":30}
---
```

### Error Logs
**File**: `data/logs/errors_YYYY-MM-DD.log`

```
[2023-12-29T12:00:00+00:00] ERROR: Session start failed
Context: {"userId":"user_abc123","error":"Could not lock counter file"}
---
```

## Maintenance and Cleanup

### Automatic Cleanup
The system automatically cleans up stale sessions:

```php
function cleanupStaleSessions() {
    $timeout = 30 * 60; // 30 minutes
    // Scans all user files and marks inactive sessions as timed out
    // Returns count of cleaned sessions
}
```

### Manual Cleanup Commands
```bash
# View current session stats
curl "https://hanon.artsmetrics.net/elevation/api/stats"

# Check specific session
curl "https://hanon.artsmetrics.net/elevation/api/session/lookup?number=123"

# View recent logs
curl "https://hanon.artsmetrics.net/elevation/api/logs?type=gps&lines=50"
```

## Troubleshooting

### Common Issues

1. **Session Creation Fails**
   - Check file permissions on `data/` directory
   - Verify `global_session_counter.json` is writable
   - Check error logs for lock failures

2. **Heartbeat Failures**
   - Verify session is still active
   - Check network connectivity
   - Review session timeout settings

3. **Multiple Active Sessions**
   - System automatically ends old sessions when new ones start
   - Check logs for `auto_ended` events

### Debug Tools

1. **Session Translator**
   ```bash
   node session_translator.cjs --user user_abc123
   node session_translator.cjs session_000123_user_abc123_1703875200
   ```

2. **Log Analysis**
   ```bash
   curl "https://hanon.artsmetrics.net/elevation/api/logs?type=gps&date=2023-12-29"
   ```

## Performance Considerations

- **File Locking**: Prevents race conditions but may cause brief delays during high concurrency
- **Session History**: Limited to 1000 entries to prevent unbounded growth
- **Heartbeat Frequency**: 30-second intervals balance responsiveness with server load
- **Cleanup Timing**: 30-minute timeout balances usability with resource management

## Security Notes

- Session IDs include timestamp and user ID for uniqueness
- IP addresses and user agents are logged for debugging
- No sensitive data is stored in session files
- File permissions should restrict access to web server user only

## Migration from Old System

The new system is backward compatible with existing session data. Old sessions without `globalNumber` will continue to work but won't have global numbering until new sessions are created.

## Future Enhancements

1. **Session Recovery**: Automatic session restart on heartbeat failure
2. **Session Sharing**: Allow multiple devices to share session data
3. **Session Analytics**: Detailed session usage statistics
4. **Session Archiving**: Long-term storage of completed sessions 