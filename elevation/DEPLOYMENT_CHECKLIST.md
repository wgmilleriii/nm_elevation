# Session Management Deployment Checklist

## Pre-Deployment Verification

### 1. File Changes Summary
- ✅ `elevation/index.php` - Enhanced session management with global numbering
- ✅ `elevation/js/gps_live.js` - Added heartbeat system and session display
- ✅ `elevation/gps_live.html` - Added session UI elements
- ✅ `elevation/css/gps_live.css` - Styled session panel
- ✅ `elevation/docs/SESSION_MANAGEMENT.md` - Complete documentation

### 2. New Features
- ✅ Global session numbering with file locking
- ✅ Session heartbeat system (30-second intervals)
- ✅ Automatic session cleanup (30-minute timeout)
- ✅ Session conflict resolution
- ✅ Enhanced logging and monitoring
- ✅ Session lookup API endpoints
- ✅ UI display of session information

### 3. API Endpoints Added
- ✅ `POST /api/user/session/heartbeat` - Keep session alive
- ✅ `GET /api/session/lookup` - Look up session by number or ID
- ✅ Enhanced `POST /api/user/session/start` - Returns global number

### 4. Data Structure Changes
- ✅ Sessions now include `globalNumber`, `lastActivity`, `userAgent`, `ipAddress`
- ✅ Global session counter file: `data/global_session_counter.json`
- ✅ Enhanced session states: `active`, `completed`, `timeout`, `auto_ended`

## Deployment Steps

### 1. Backup Current System
```bash
# Create backup of current elevation folder
cp -r elevation elevation_backup_$(date +%Y%m%d_%H%M%S)
```

### 2. Upload Files via FTP
Upload these files to the production server:
- `elevation/index.php`
- `elevation/js/gps_live.js`
- `elevation/gps_live.html`
- `elevation/css/gps_live.css`
- `elevation/docs/SESSION_MANAGEMENT.md`
- `elevation/DEPLOYMENT_CHECKLIST.md`

### 3. Set Directory Permissions
```bash
# Ensure data directory is writable
chmod 755 elevation/data/
chmod 644 elevation/data/*.json
```

### 4. Initialize Global Session Counter
The system will automatically create `data/global_session_counter.json` on first session creation.

## Post-Deployment Testing

### 1. Basic Session Creation
```bash
# Test user initialization
curl -X POST https://hanon.artsmetrics.net/elevation/api/user/init \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test_device_123"}'

# Test session start (use userId from above)
curl -X POST https://hanon.artsmetrics.net/elevation/api/user/session/start \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_abc123"}'
```

### 2. Test Session Heartbeat
```bash
# Test heartbeat (use sessionId from session start)
curl -X POST https://hanon.artsmetrics.net/elevation/api/user/session/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_abc123","sessionId":"session_000001_user_abc123_1703875200"}'
```

### 3. Test Session Lookup
```bash
# Test lookup by number
curl "https://hanon.artsmetrics.net/elevation/api/session/lookup?number=1"

# Test lookup by session ID
curl "https://hanon.artsmetrics.net/elevation/api/session/lookup?sessionId=session_000001_user_abc123_1703875200"
```

### 4. Verify UI Elements
1. Open https://hanon.artsmetrics.net/elevation/gps_live.html
2. Check that session panel appears at top center
3. Verify session number displays correctly
4. Confirm user ID shows truncated version

### 5. Check Logging
```bash
# View recent GPS logs
curl "https://hanon.artsmetrics.net/elevation/api/logs?type=gps&lines=20"

# Check for any errors
curl "https://hanon.artsmetrics.net/elevation/api/logs?type=errors&lines=20"
```

## Monitoring After Deployment

### 1. Session Statistics
```bash
# Check overall system stats
curl "https://hanon.artsmetrics.net/elevation/api/stats"
```

### 2. Global Session Counter
Monitor the creation of `data/global_session_counter.json` and verify it's incrementing properly.

### 3. Session Cleanup
After 30+ minutes of inactivity, verify sessions are marked as `timeout` status.

## Rollback Plan

If issues occur:

1. **Immediate Rollback**:
   ```bash
   # Restore from backup
   rm -rf elevation/
   mv elevation_backup_YYYYMMDD_HHMMSS elevation/
   ```

2. **Partial Rollback**:
   - Keep new `index.php` for server improvements
   - Revert client files if UI issues occur

## Success Criteria

- ✅ Sessions are created with global numbers (format: `session_NNNNNN_...`)
- ✅ Session panel displays in UI with user ID and session number
- ✅ Heartbeat system keeps sessions alive
- ✅ Inactive sessions timeout after 30 minutes
- ✅ Multiple sessions from same user are handled correctly
- ✅ All existing functionality continues to work
- ✅ No JavaScript errors in browser console
- ✅ GPS tracking continues to function normally

## Contact Information

- **Documentation**: `elevation/docs/SESSION_MANAGEMENT.md`
- **API Reference**: `elevation/docs/API_DOCUMENTATION.md`
- **Debug Tools**: `session_translator.cjs` for session analysis

## Notes

- The system is backward compatible with existing sessions
- Global session counter starts from 1 for new deployments
- File locking prevents race conditions during high traffic
- Session heartbeat reduces server load compared to constant polling 