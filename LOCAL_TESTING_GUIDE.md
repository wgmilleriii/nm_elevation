# 🧪 Local Testing Guide - GPS Elevation System

## ✅ Pre-Deployment Testing Strategy

Before deploying to the remote PHP server, we can test **95% of functionality** locally to catch issues early.

### 🔧 What We Can Test Locally:
- ✅ **PHP API Server** - Full functionality using PHP built-in server
- ✅ **Client-Side JavaScript** - All GPS tracking, UI, and map features
- ✅ **File Structure** - Verify all files are properly organized
- ✅ **API Endpoints** - All REST API functionality
- ✅ **Static File Serving** - CSS, JS, HTML files
- ✅ **Data Storage** - JSON file creation and management
- ✅ **Error Handling** - API error responses and edge cases

### ⚠️ What Requires Remote Testing:
- 🌐 **HTTPS GPS** - GPS requires HTTPS in production (works on localhost)
- 🔗 **CORS from External Domains** - Cross-origin requests
- 📱 **Mobile Device Testing** - Real mobile GPS hardware
- 🚀 **Production Performance** - Server load and response times

---

## 🚀 Quick Start Testing

### 1. **Automated Validation**
```bash
# Validate file structure and code quality
node test_client_validation.cjs
```

### 2. **Start Local PHP Server**
```bash
# Start comprehensive testing with live server
./test_local_server.sh
```

### 3. **Manual Browser Testing**
Open your browser to: `http://localhost:8080/home.html`

---

## 📋 Detailed Testing Checklist

### 🏠 **Landing Page Test**
- [ ] Landing page loads at `http://localhost:8080/home.html`
- [ ] All navigation links work
- [ ] CSS styling renders correctly
- [ ] Responsive design works on mobile viewport

### 🔌 **API Endpoint Tests**

#### Basic API Health
```bash
# Test API stats
curl http://localhost:8080/api/stats

# Expected: {"total_users":0,"total_sessions":0,"total_points":0,...}
```

#### User Management
```bash
# Initialize user
curl -X POST -H "Content-Type: application/json" \
  -d '{"deviceId":"test_device_123"}' \
  http://localhost:8080/api/user/init

# Expected: {"userId":"user_abc123..."}
```

#### Session Management
```bash
# Start session (use userId from above)
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"user_abc123..."}' \
  http://localhost:8080/api/user/session/start

# Expected: {"sessionId":"session_...","success":true}
```

#### GPS Point Tracking
```bash
# Track GPS point
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"user_abc123...","sessionId":"session_...","lat":35.2378,"lon":-106.6067,"accuracy":10,"timestamp":"2024-01-01T12:00:00.000Z"}' \
  http://localhost:8080/api/user/track-point

# Expected: {"success":true,"pointId":"point_..."}
```

### 📱 **GPS Application Tests**

#### GPS Live Tracker (`/gps_live.html`)
- [ ] Page loads without JavaScript errors
- [ ] Map initializes properly
- [ ] GPS permission prompt appears
- [ ] Location tracking starts (may show mock data on desktop)
- [ ] Elevation profile displays
- [ ] Speed tracking works
- [ ] UI elements respond correctly

#### GPS Data Collector (`/gps_tracker.html`)
- [ ] Page loads and initializes
- [ ] Data collection interface works
- [ ] Route tracking functionality
- [ ] Export/download features work

#### New Mexico Elevation Map (`/elevation_new_mexico.html`)
- [ ] Map loads with elevation data
- [ ] Interactive features work
- [ ] Zoom and pan functionality
- [ ] Elevation queries work

### 🎨 **Static File Tests**
- [ ] CSS files load: `http://localhost:8080/css/gps_live.css`
- [ ] JavaScript files load: `http://localhost:8080/js/gps_live.js`
- [ ] Module files load: `http://localhost:8080/js/modules/config.js`
- [ ] Image files load (if any): `http://localhost:8080/images/`

### 📊 **Data Storage Tests**
- [ ] User files created in `elevation/data/users/`
- [ ] Queue files created in `elevation/data/queue/`
- [ ] Log files created in `elevation/data/logs/`
- [ ] JSON files are valid and readable

---

## 🔍 Browser Developer Tools Testing

### 1. **Console Tab**
Check for JavaScript errors:
```
✅ No red error messages
✅ GPS initialization messages appear
✅ API calls succeed (green network requests)
⚠️  Warnings about HTTPS/GPS are expected on localhost
```

### 2. **Network Tab**
Monitor API calls:
```
✅ /api/user/init → 200 OK
✅ /api/user/session/start → 200 OK  
✅ /api/user/track-point → 200 OK
✅ CSS/JS files → 200 OK
❌ Any 404 or 500 errors need investigation
```

### 3. **Application Tab**
Check local storage:
```
✅ GPS device ID stored
✅ User preferences saved
✅ Session data persists
```

---

## 🧪 Advanced Testing Scenarios

### Error Handling Tests
```bash
# Test invalid API calls
curl -X POST http://localhost:8080/api/user/init
# Expected: 400 error (missing deviceId)

curl http://localhost:8080/api/nonexistent
# Expected: 404 error
```

### Data Validation Tests
```bash
# Test invalid GPS coordinates
curl -X POST -H "Content-Type: application/json" \
  -d '{"userId":"test","sessionId":"test","lat":"invalid","lon":"invalid"}' \
  http://localhost:8080/api/user/track-point
# Expected: 400 error or graceful handling
```

### Load Testing (Basic)
```bash
# Test multiple rapid requests
for i in {1..10}; do
  curl -s http://localhost:8080/api/stats &
done
wait
# All should succeed
```

---

## 📱 Mobile Testing (Local Network)

### Setup Mobile Testing
1. **Find your local IP:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

2. **Access from mobile:**
   - Connect phone to same WiFi
   - Visit: `http://YOUR_LOCAL_IP:8080/home.html`
   - Test GPS functionality on real device

### Mobile Checklist
- [ ] Page loads on mobile browser
- [ ] Touch interactions work
- [ ] GPS permission granted
- [ ] Location tracking functional
- [ ] UI scales properly
- [ ] Performance acceptable

---

## 🚨 Common Issues & Solutions

### Issue: PHP Server Won't Start
```bash
# Check if port is in use
lsof -i :8080

# Try different port
cd elevation && php -S localhost:8081
```

### Issue: GPS Not Working
- ✅ **Expected on desktop** - GPS requires mobile device or HTTPS
- 🔧 **Test with mock data** - Check if UI updates with simulated coordinates
- 📱 **Use mobile device** - Connect phone to test real GPS

### Issue: API Calls Failing
```bash
# Check PHP error log
tail -f php_server.log

# Verify file permissions
ls -la elevation/data/
```

### Issue: Files Not Loading
- 🔍 **Check file paths** - Ensure case-sensitive paths match
- 📁 **Verify directory structure** - Run `node test_client_validation.cjs`
- 🌐 **Check browser Network tab** - Look for 404 errors

---

## ✅ Pre-Deployment Checklist

Before uploading to remote server:

### Automated Tests
- [ ] ✅ `node test_client_validation.cjs` passes
- [ ] ✅ `./test_local_server.sh` completes successfully

### Manual Tests  
- [ ] ✅ Landing page loads and links work
- [ ] ✅ GPS Live tracker initializes without errors
- [ ] ✅ API endpoints respond correctly
- [ ] ✅ Static files serve properly
- [ ] ✅ Data storage creates files correctly

### Browser Tests
- [ ] ✅ No JavaScript console errors
- [ ] ✅ All network requests succeed
- [ ] ✅ Mobile viewport renders correctly
- [ ] ✅ GPS permission prompts work

### Performance Tests
- [ ] ✅ Page load times acceptable (< 3 seconds)
- [ ] ✅ API response times fast (< 500ms)
- [ ] ✅ No memory leaks in long sessions

---

## 🌐 Ready for Deployment!

Once all local tests pass:

1. **Upload the `elevation/` folder** to your remote server
2. **Test the same URLs** on the live server
3. **Verify HTTPS GPS functionality** on mobile devices
4. **Monitor logs** for any production-specific issues

Your system is now thoroughly tested and ready for production! 🚀 