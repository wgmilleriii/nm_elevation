<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration
$DATA_DIR = './data';
$USERS_DIR = $DATA_DIR . '/users';
$QUEUE_DIR = $DATA_DIR . '/queue';
$LOGS_DIR = $DATA_DIR . '/logs';

// Ensure directories exist
foreach ([$DATA_DIR, $USERS_DIR, $QUEUE_DIR, $LOGS_DIR] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

// Get request method and path
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = rtrim($path, '/');

// Remove /elevation prefix if present
if (strpos($path, '/elevation') === 0) {
    $path = substr($path, strlen('/elevation'));
}
$path = rtrim($path, '/');
if (empty($path)) {
    $path = '/';
}

// Log all requests
logRequest($method, $path, file_get_contents('php://input'));

// Add logging endpoints before the existing API routes
if ($path === '/api/log' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $logEntry = [
        'timestamp' => $input['timestamp'] ?? date('c'),
        'level' => $input['level'] ?? 'info',
        'message' => $input['message'] ?? 'No message',
        'userAgent' => $input['userAgent'] ?? $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
        'url' => $input['url'] ?? $_SERVER['HTTP_REFERER'] ?? 'Unknown',
        'userId' => $input['userId'] ?? 'anonymous',
        'sessionId' => $input['sessionId'] ?? 'none',
        'deviceId' => $input['deviceId'] ?? 'unknown',
        'data' => $input['data'] ?? [],
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ];
    
    // Create logs directory if it doesn't exist
    if (!file_exists('data/logs')) {
        mkdir('data/logs', 0755, true);
    }
    
    // Write to daily log file
    $logFile = 'data/logs/client_' . date('Y-m-d') . '.log';
    $logLine = json_encode($logEntry) . "\n";
    
    file_put_contents($logFile, $logLine, FILE_APPEND | LOCK_EX);
    
    header('Content-Type: application/json');
    echo json_encode(['status' => 'logged']);
    exit;
}

if ($path === '/api/logs' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $date = $_GET['date'] ?? date('Y-m-d');
    $logFile = 'data/logs/client_' . $date . '.log';
    
    if (!file_exists($logFile)) {
        header('Content-Type: application/json');
        echo json_encode(['logs' => [], 'message' => 'No logs found for ' . $date]);
        exit;
    }
    
    $logs = [];
    $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($lines as $line) {
        $logEntry = json_decode($line, true);
        if ($logEntry) {
            $logs[] = $logEntry;
        }
    }
    
    // Get recent logs (last 50)
    $logs = array_slice($logs, -50);
    
    header('Content-Type: application/json');
    echo json_encode([
        'date' => $date,
        'count' => count($logs),
        'logs' => $logs
    ]);
    exit;
}

// Route requests
switch ($path) {
    case '/api/user/init':
        if ($method === 'POST') {
            handleUserInit();
        }
        break;
        
    case '/api/user/session/start':
        if ($method === 'POST') {
            handleSessionStart();
        }
        break;
        
    case '/api/user/track-point':
        if ($method === 'POST') {
            handleTrackPoint();
        }
        break;
        
    case '/api/gps-queue':
        if ($method === 'GET') {
            handleGPSQueue();
        }
        break;
        
    case '/api/elevation-update':
        if ($method === 'POST') {
            handleElevationUpdate();
        }
        break;
        
    case '/api/user-sessions':
        if ($method === 'GET') {
            handleUserSessions();
        }
        break;
        
    case '/api/stats':
        if ($method === 'GET') {
            handleStats();
        }
        break;
        
    case '/api/queue/claim':
        if ($method === 'POST') {
            handleQueueClaim();
        }
        break;
        
    case '/api/queue/batch-update':
        if ($method === 'POST') {
            handleBatchElevationUpdate();
        }
        break;
        
    case '/api/user/session/end':
        if ($method === 'POST') {
            handleSessionEnd();
        }
        break;
        
    case '/api/user/points':
        if ($method === 'GET') {
            handleUserPoints();
        }
        break;
        
    case '/api/queue/status':
        if ($method === 'GET') {
            handleQueueStatus();
        }
        break;
        
    case '/api/processing/heartbeat':
        if ($method === 'POST') {
            handleProcessingHeartbeat();
        }
        break;
        
    case '/api/logs':
        if ($method === 'GET') {
            handleGetLogs();
        }
        break;
        
    case '/api/version':
        if ($method === 'GET') {
            handleVersion();
        }
        break;
        
    case '/api/elevation':
        if ($method === 'GET') {
            handleElevation();
        }
        break;
        
    case '/api/server/version':
        if ($method === 'GET') {
            handleServerVersion();
        }
        break;
        
    case '/api/user/session/heartbeat':
        if ($method === 'POST') {
            handleSessionHeartbeat();
        }
        break;
        
    case '/api/session/lookup':
        if ($method === 'GET') {
            handleSessionLookup();
        }
        break;
        
    // Public Elevation Analysis APIs
    case '/api/analysis/journey-data':
        if ($method === 'GET') {
            handleJourneyData();
        }
        break;
        
    case '/api/analysis/elevation-chart':
        if ($method === 'GET') {
            handleElevationChart();
        }
        break;
        
    case '/api/analysis/elevation-svg':
        if ($method === 'GET') {
            handleElevationSVG();
        }
        break;
        
    case '/api/analysis/route-map':
        if ($method === 'GET') {
            handleRouteMap();
        }
        break;
        
    case '/api/analysis/session-summary':
        if ($method === 'GET') {
            handleSessionSummary();
        }
        break;
        
    case '/api/analysis/elevation-profile':
        if ($method === 'GET') {
            handleElevationProfile();
        }
        break;
        
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Endpoint not found']);
        break;
}

function handleUserInit() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['deviceId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Device ID required']);
        return;
    }
    
    $deviceId = $input['deviceId'];
    $userId = generateUserId($deviceId);
    
    // Create or load user profile
    $userFile = getUserFile($userId);
    $userData = [
        'userId' => $userId,
        'deviceId' => $deviceId,
        'createdAt' => date('c'),
        'lastActivity' => date('c'),
        'sessions' => [],
        'totalPoints' => 0
    ];
    
    if (file_exists($userFile)) {
        $existingData = json_decode(file_get_contents($userFile), true);
        $userData = array_merge($userData, $existingData);
        $userData['lastActivity'] = date('c');
    }
    
    file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT));
    
    echo json_encode(['userId' => $userId]);
}

function handleSessionStart() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['userId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID required']);
        return;
    }
    
    $userId = $input['userId'];
    
    try {
        $sessionId = generateSessionId($userId);
        
        // Extract global number from session ID
        preg_match('/session_(\d+)_/', $sessionId, $matches);
        $globalNumber = intval($matches[1]);
        
        // Load user data
        $userFile = getUserFile($userId);
        if (!file_exists($userFile)) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }
        
        $userData = json_decode(file_get_contents($userFile), true);
        
        // End any existing active sessions to prevent conflicts
        if (isset($userData['sessions'])) {
            foreach ($userData['sessions'] as &$session) {
                if ($session['status'] === 'active') {
                    $session['status'] = 'auto_ended';
                    $session['endTime'] = date('c');
                    $session['endReason'] = 'new_session_started';
                    logGPS($userId, $session['sessionId'], 'session_auto_ended', [
                        'reason' => 'new_session_started',
                        'newSessionId' => $sessionId
                    ]);
                }
            }
        }
        
        // Create new session
        $session = [
            'sessionId' => $sessionId,
            'globalNumber' => $globalNumber,
            'startTime' => date('c'),
            'lastActivity' => date('c'),
            'endTime' => null,
            'points' => [],
            'totalDistance' => 0,
            'pointCount' => 0,
            'status' => 'active',
            'userAgent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'ipAddress' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ];
        
        $userData['sessions'][] = $session;
        $userData['lastActivity'] = date('c');
        
        file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT));
        
        // Log session creation
        logGPS($userId, $sessionId, 'session_started', [
            'globalNumber' => $globalNumber,
            'userAgent' => $session['userAgent'],
            'ipAddress' => $session['ipAddress']
        ]);
        
        echo json_encode([
            'sessionId' => $sessionId,
            'globalNumber' => $globalNumber,
            'startTime' => $session['startTime'],
            'status' => 'active'
        ]);
        
    } catch (Exception $e) {
        logError('Session start failed', [
            'userId' => $userId,
            'error' => $e->getMessage()
        ]);
        
        http_response_code(500);
        echo json_encode([
            'error' => 'Failed to start session',
            'message' => 'Internal server error'
        ]);
    }
}

function handleTrackPoint() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['userId']) || !isset($input['sessionId']) || !isset($input['point'])) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID, session ID, and point data required']);
        return;
    }
    
    $userId = $input['userId'];
    $sessionId = $input['sessionId'];
    $point = $input['point'];
    
    // Validate point data
    if (!isset($point['lat']) || !isset($point['lon'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Point must have lat and lon']);
        return;
    }
    
    // Load user data
    $userFile = getUserFile($userId);
    if (!file_exists($userFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        return;
    }
    
    $userData = json_decode(file_get_contents($userFile), true);
    
    // Ensure sessions array exists
    if (!$userData || !isset($userData['sessions']) || !is_array($userData['sessions'])) {
        http_response_code(400);
        echo json_encode(['error' => 'User data corrupted or no sessions found', 'code' => 'INVALID_USER_DATA']);
        return;
    }
    
    // Find active session
    $sessionIndex = -1;
    foreach ($userData['sessions'] as $index => $session) {
        if ($session['sessionId'] === $sessionId && $session['status'] === 'active') {
            $sessionIndex = $index;
            break;
        }
    }
    
    if ($sessionIndex === -1) {
        http_response_code(400);
        echo json_encode(['error' => 'Active session not found', 'code' => 'INVALID_SESSION']);
        return;
    }
    
    // Add point to session
    $pointId = generatePointId($userId, $sessionId);
    $point['pointId'] = $pointId;
    $point['timestamp'] = $point['timestamp'] ?? date('c');
    $point['receivedAt'] = date('c');
    
    $userData['sessions'][$sessionIndex]['points'][] = $point;
    $userData['sessions'][$sessionIndex]['pointCount']++;
    $userData['sessions'][$sessionIndex]['lastActivity'] = date('c');
    $userData['totalPoints']++;
    $userData['lastActivity'] = date('c');
    
    // Add to elevation processing queue
    addToElevationQueue($userId, $sessionId, $point);
    
    // Save user data
    file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'pointId' => $pointId,
        'stats' => [
            'point_count' => $userData['sessions'][$sessionIndex]['pointCount'],
            'total_points' => $userData['totalPoints']
        ]
    ]);
}

function handleGPSQueue() {
    $lastProcessedId = $_GET['lastProcessedId'] ?? 0;
    $limit = min($_GET['limit'] ?? 50, 100); // Max 100 points per request
    $status = $_GET['status'] ?? 'pending'; // pending, processing, completed
    
    $queueFiles = glob($GLOBALS['QUEUE_DIR'] . '/queue_*.json');
    $points = [];
    $stats = [
        'total_pending' => 0,
        'total_processing' => 0,
        'total_completed' => 0,
        'oldest_pending' => null,
        'newest_pending' => null
    ];
    
    foreach ($queueFiles as $file) {
        $queueData = json_decode(file_get_contents($file), true);
        if ($queueData && isset($queueData['points'])) {
            foreach ($queueData['points'] as $point) {
                $pointStatus = getPointStatus($point);
                $stats['total_' . $pointStatus]++;
                
                if ($pointStatus === 'pending') {
                    if (!$stats['oldest_pending'] || $point['addedToQueue'] < $stats['oldest_pending']) {
                        $stats['oldest_pending'] = $point['addedToQueue'];
                    }
                    if (!$stats['newest_pending'] || $point['addedToQueue'] > $stats['newest_pending']) {
                        $stats['newest_pending'] = $point['addedToQueue'];
                    }
                }
                
                if ($point['id'] > $lastProcessedId && $pointStatus === $status) {
                    $point['status'] = $pointStatus;
                    $point['priority'] = calculatePriority($point);
                    $points[] = $point;
                }
            }
        }
    }
    
    // Sort by priority (high priority first), then by ID
    usort($points, function($a, $b) {
        if ($a['priority'] !== $b['priority']) {
            return $b['priority'] - $a['priority']; // Higher priority first
        }
        return $a['id'] - $b['id'];
    });
    
    $response = [
        'points' => array_slice($points, 0, $limit),
        'stats' => $stats,
        'timestamp' => date('c'),
        'has_more' => count($points) > $limit
    ];
    
    echo json_encode($response);
}

function getPointStatus($point) {
    if (isset($point['elevation'])) {
        return 'completed';
    }
    if (isset($point['processing_started']) && !isset($point['processing_failed'])) {
        // Check if processing has been going on too long (>5 minutes = failed)
        $started = strtotime($point['processing_started']);
        if (time() - $started > 300) {
            return 'pending'; // Reset to pending if stuck
        }
        return 'processing';
    }
    return 'pending';
}

function calculatePriority($point) {
    $priority = 50; // Base priority
    
    // Higher priority for newer points
    $age = time() - strtotime($point['addedToQueue']);
    if ($age < 300) $priority += 20; // Less than 5 minutes old
    elseif ($age < 1800) $priority += 10; // Less than 30 minutes old
    
    // Higher priority for active sessions
    if (isActiveSession($point['userId'], $point['sessionId'])) {
        $priority += 30;
    }
    
    return $priority;
}

function isActiveSession($userId, $sessionId) {
    $userFile = getUserFile($userId);
    if (!file_exists($userFile)) return false;
    
    $userData = json_decode(file_get_contents($userFile), true);
    if (!$userData || !isset($userData['sessions']) || !is_array($userData['sessions'])) return false;
    
    foreach ($userData['sessions'] as $session) {
        if (isset($session['sessionId']) && $session['sessionId'] === $sessionId) {
            return isset($session['status']) && $session['status'] === 'active';
        }
    }
    return false;
}

function handleElevationUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['lat']) || !isset($input['lon']) || !isset($input['elevation'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Latitude, longitude, and elevation required']);
        return;
    }
    
    $lat = $input['lat'];
    $lon = $input['lon'];
    $elevation = $input['elevation'];
    $source = $input['source'] ?? 'unknown';
    
    // Update all matching points in user files
    $updated = updateElevationInUserFiles($lat, $lon, $elevation, $source);
    
    echo json_encode([
        'success' => true,
        'updated' => $updated,
        'timestamp' => date('c')
    ]);
}

function handleUserSessions() {
    $userId = $_GET['userId'] ?? null;
    
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID required']);
        return;
    }
    
    $userFile = getUserFile($userId);
    if (!file_exists($userFile)) {
        echo json_encode(['sessions' => []]);
        return;
    }
    
    $userData = json_decode(file_get_contents($userFile), true);
    $sessions = $userData['sessions'] ?? [];
    
    // Add statistics to each session
    foreach ($sessions as &$session) {
        if (!empty($session['points'])) {
            $elevations = array_filter(array_column($session['points'], 'elevation'));
            if (!empty($elevations)) {
                $session['min_elevation'] = min($elevations);
                $session['max_elevation'] = max($elevations);
                $session['avg_elevation'] = array_sum($elevations) / count($elevations);
            }
        }
    }
    
    echo json_encode(['sessions' => $sessions]);
}

function handleStats() {
    $stats = [
        'totalUsers' => count(glob($GLOBALS['USERS_DIR'] . '/user_*.json')),
        'totalSessions' => 0,
        'totalPoints' => 0,
        'queueSize' => 0,
        'pendingPoints' => 0,
        'processingPoints' => 0,
        'completedPoints' => 0
    ];
    
    // Count sessions and points
    $userFiles = glob($GLOBALS['USERS_DIR'] . '/user_*.json');
    foreach ($userFiles as $file) {
        $userData = json_decode(file_get_contents($file), true);
        if ($userData && isset($userData['sessions'])) {
            $stats['totalSessions'] += count($userData['sessions']);
            $stats['totalPoints'] += $userData['totalPoints'] ?? 0;
        }
    }
    
    // Count queue size and status breakdown
    $queueFiles = glob($GLOBALS['QUEUE_DIR'] . '/queue_*.json');
    foreach ($queueFiles as $file) {
        $queueData = json_decode(file_get_contents($file), true);
        if ($queueData && isset($queueData['points'])) {
            foreach ($queueData['points'] as $point) {
                $status = getPointStatus($point);
                $stats['queueSize']++;
                $stats[$status . 'Points']++;
            }
        }
    }
    
    echo json_encode($stats);
}

function handleQueueClaim() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['pointIds']) || !is_array($input['pointIds'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Point IDs array required']);
        return;
    }
    
    $pointIds = $input['pointIds'];
    $processorId = $input['processorId'] ?? 'unknown_processor';
    $claimed = 0;
    
    $queueFiles = glob($GLOBALS['QUEUE_DIR'] . '/queue_*.json');
    foreach ($queueFiles as $file) {
        $queueData = json_decode(file_get_contents($file), true);
        $modified = false;
        
        if ($queueData && isset($queueData['points'])) {
            foreach ($queueData['points'] as &$point) {
                if (in_array($point['id'], $pointIds) && getPointStatus($point) === 'pending') {
                    $point['processing_started'] = date('c');
                    $point['processor_id'] = $processorId;
                    $claimed++;
                    $modified = true;
                }
            }
        }
        
        if ($modified) {
            file_put_contents($file, json_encode($queueData, JSON_PRETTY_PRINT));
        }
    }
    
    echo json_encode([
        'success' => true,
        'claimed' => $claimed,
        'processor_id' => $processorId,
        'timestamp' => date('c')
    ]);
}

function handleBatchElevationUpdate() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['updates']) || !is_array($input['updates'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Updates array required']);
        return;
    }
    
    $updates = $input['updates'];
    $totalUpdated = 0;
    $errors = [];
    
    foreach ($updates as $update) {
        if (!isset($update['lat']) || !isset($update['lon']) || !isset($update['elevation'])) {
            $errors[] = 'Missing lat, lon, or elevation in update';
            continue;
        }
        
        $lat = $update['lat'];
        $lon = $update['lon'];
        $elevation = $update['elevation'];
        $source = $update['source'] ?? 'batch_update';
        
        // Update in user files
        $updated = updateElevationInUserFiles($lat, $lon, $elevation, $source);
        $totalUpdated += $updated;
        
        // Mark as completed in queue files
        markQueuePointCompleted($lat, $lon, $elevation, $source);
    }
    
    echo json_encode([
        'success' => true,
        'total_updated' => $totalUpdated,
        'errors' => $errors,
        'timestamp' => date('c')
    ]);
}

function markQueuePointCompleted($lat, $lon, $elevation, $source) {
    $queueFiles = glob($GLOBALS['QUEUE_DIR'] . '/queue_*.json');
    
    foreach ($queueFiles as $file) {
        $queueData = json_decode(file_get_contents($file), true);
        $modified = false;
        
        if ($queueData && isset($queueData['points'])) {
            foreach ($queueData['points'] as &$point) {
                if (abs($point['lat'] - $lat) < 0.000001 && abs($point['lon'] - $lon) < 0.000001) {
                    $point['elevation'] = $elevation;
                    $point['elevation_source'] = $source;
                    $point['processing_completed'] = date('c');
                    unset($point['processing_started']);
                    unset($point['processor_id']);
                    $modified = true;
                }
            }
        }
        
        if ($modified) {
            file_put_contents($file, json_encode($queueData, JSON_PRETTY_PRINT));
        }
    }
}

function handleSessionEnd() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['userId']) || !isset($input['sessionId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID and session ID required']);
        return;
    }
    
    $userId = $input['userId'];
    $sessionId = $input['sessionId'];
    
    $userFile = getUserFile($userId);
    if (!file_exists($userFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        return;
    }
    
    $userData = json_decode(file_get_contents($userFile), true);
    
    // Find and end the session
    $sessionFound = false;
    foreach ($userData['sessions'] as &$session) {
        if ($session['sessionId'] === $sessionId && $session['status'] === 'active') {
            $session['status'] = 'completed';
            $session['endTime'] = date('c');
            
            // Calculate session statistics
            if (!empty($session['points'])) {
                $elevations = array_filter(array_column($session['points'], 'elevation'));
                if (!empty($elevations)) {
                    $session['min_elevation'] = min($elevations);
                    $session['max_elevation'] = max($elevations);
                    $session['avg_elevation'] = array_sum($elevations) / count($elevations);
                    $session['elevation_gain'] = max($elevations) - min($elevations);
                }
                
                // Calculate total distance
                $session['totalDistance'] = calculateSessionDistance($session['points']);
            }
            
            $sessionFound = true;
            break;
        }
    }
    
    if (!$sessionFound) {
        http_response_code(400);
        echo json_encode(['error' => 'Active session not found']);
        return;
    }
    
    $userData['lastActivity'] = date('c');
    file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'sessionId' => $sessionId,
        'endTime' => date('c')
    ]);
}

function handleUserPoints() {
    $userId = $_GET['userId'] ?? null;
    $sessionId = $_GET['sessionId'] ?? null;
    $withElevation = $_GET['withElevation'] ?? 'false';
    $limit = min($_GET['limit'] ?? 100, 1000);
    
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID required']);
        return;
    }
    
    $userFile = getUserFile($userId);
    if (!file_exists($userFile)) {
        echo json_encode(['points' => []]);
        return;
    }
    
    $userData = json_decode(file_get_contents($userFile), true);
    $allPoints = [];
    
    foreach ($userData['sessions'] as $session) {
        if ($sessionId && $session['sessionId'] !== $sessionId) {
            continue;
        }
        
        if (isset($session['points'])) {
            foreach ($session['points'] as $point) {
                if ($withElevation === 'true' && !isset($point['elevation'])) {
                    continue;
                }
                
                $point['sessionId'] = $session['sessionId'];
                $allPoints[] = $point;
            }
        }
    }
    
    // Sort by timestamp
    usort($allPoints, function($a, $b) {
        return strtotime($a['timestamp']) - strtotime($b['timestamp']);
    });
    
    echo json_encode([
        'points' => array_slice($allPoints, 0, $limit),
        'total_count' => count($allPoints),
        'has_more' => count($allPoints) > $limit
    ]);
}

function handleQueueStatus() {
    $detailed = $_GET['detailed'] ?? 'false';
    
    $status = [
        'pending' => 0,
        'processing' => 0,
        'completed' => 0,
        'failed' => 0,
        'oldest_pending' => null,
        'newest_pending' => null,
        'active_processors' => []
    ];
    
    $queueFiles = glob($GLOBALS['QUEUE_DIR'] . '/queue_*.json');
    $allPoints = [];
    
    foreach ($queueFiles as $file) {
        $queueData = json_decode(file_get_contents($file), true);
        if ($queueData && isset($queueData['points'])) {
            foreach ($queueData['points'] as $point) {
                $pointStatus = getPointStatus($point);
                $status[$pointStatus]++;
                
                if ($pointStatus === 'pending') {
                    if (!$status['oldest_pending'] || $point['addedToQueue'] < $status['oldest_pending']) {
                        $status['oldest_pending'] = $point['addedToQueue'];
                    }
                    if (!$status['newest_pending'] || $point['addedToQueue'] > $status['newest_pending']) {
                        $status['newest_pending'] = $point['addedToQueue'];
                    }
                }
                
                if ($pointStatus === 'processing' && isset($point['processor_id'])) {
                    if (!isset($status['active_processors'][$point['processor_id']])) {
                        $status['active_processors'][$point['processor_id']] = 0;
                    }
                    $status['active_processors'][$point['processor_id']]++;
                }
                
                if ($detailed === 'true') {
                    $allPoints[] = $point;
                }
            }
        }
    }
    
    $response = [
        'status' => $status,
        'timestamp' => date('c')
    ];
    
    if ($detailed === 'true') {
        $response['points'] = $allPoints;
    }
    
    echo json_encode($response);
}

function handleProcessingHeartbeat() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['processorId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Processor ID required']);
        return;
    }
    
    $processorId = $input['processorId'];
    $processingCount = $input['processingCount'] ?? 0;
    $completedCount = $input['completedCount'] ?? 0;
    
    // Log processor activity
    $heartbeatFile = $GLOBALS['LOGS_DIR'] . '/processor_heartbeats.json';
    $heartbeats = [];
    
    if (file_exists($heartbeatFile)) {
        $heartbeats = json_decode(file_get_contents($heartbeatFile), true) ?: [];
    }
    
    $heartbeats[$processorId] = [
        'last_seen' => date('c'),
        'processing_count' => $processingCount,
        'completed_count' => $completedCount,
        'status' => 'active'
    ];
    
    // Clean up old heartbeats (older than 10 minutes)
    $cutoff = time() - 600;
    foreach ($heartbeats as $id => $data) {
        if (strtotime($data['last_seen']) < $cutoff) {
            unset($heartbeats[$id]);
        }
    }
    
    file_put_contents($heartbeatFile, json_encode($heartbeats, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'processor_id' => $processorId,
        'timestamp' => date('c'),
        'active_processors' => count($heartbeats)
    ]);
}

function calculateSessionDistance($points) {
    $totalDistance = 0;
    
    for ($i = 1; $i < count($points); $i++) {
        $lat1 = $points[$i-1]['lat'];
        $lon1 = $points[$i-1]['lon'];
        $lat2 = $points[$i]['lat'];
        $lon2 = $points[$i]['lon'];
        
        $totalDistance += haversineDistance($lat1, $lon1, $lat2, $lon2);
    }
    
    return $totalDistance;
}

function haversineDistance($lat1, $lon1, $lat2, $lon2) {
    $earthRadius = 6371000; // Earth radius in meters
    
    $lat1Rad = deg2rad($lat1);
    $lat2Rad = deg2rad($lat2);
    $deltaLatRad = deg2rad($lat2 - $lat1);
    $deltaLonRad = deg2rad($lon2 - $lon1);
    
    $a = sin($deltaLatRad/2) * sin($deltaLatRad/2) +
         cos($lat1Rad) * cos($lat2Rad) *
         sin($deltaLonRad/2) * sin($deltaLonRad/2);
    $c = 2 * atan2(sqrt($a), sqrt(1-$a));
    
    return $earthRadius * $c;
}

// Helper functions
function generateUserId($deviceId) {
    return 'user_' . md5($deviceId . '_' . time());
}

function generateSessionId($userId) {
    // Get global session counter
    $globalSessionNumber = getNextGlobalSessionNumber();
    
    // Format: session_NNNNNN_USERID_TIMESTAMP
    // where NNNNNN is padded to 6 digits
    return sprintf(
        'session_%06d_%s_%d',
        $globalSessionNumber,
        $userId,
        time()
    );
}

function getNextGlobalSessionNumber() {
    $counterFile = $GLOBALS['DATA_DIR'] . '/global_session_counter.json';
    
    // Initialize counter file if it doesn't exist
    if (!file_exists($counterFile)) {
        $counterData = [
            'lastSessionNumber' => 0,
            'lastUpdated' => date('c'),
            'sessions' => []
        ];
        file_put_contents($counterFile, json_encode($counterData, JSON_PRETTY_PRINT));
    }
    
    // Get an exclusive lock on the file
    $fp = fopen($counterFile, 'r+');
    if (!$fp) {
        throw new Exception('Could not open counter file');
    }
    
    try {
        // Get exclusive lock
        if (!flock($fp, LOCK_EX)) {
            throw new Exception('Could not lock counter file');
        }
        
        // Read current data
        $data = fread($fp, filesize($counterFile));
        $counterData = json_decode($data, true);
        
        if (!$counterData || !isset($counterData['lastSessionNumber'])) {
            $counterData = [
                'lastSessionNumber' => 0,
                'lastUpdated' => date('c'),
                'sessions' => []
            ];
        }
        
        // Increment counter
        $counterData['lastSessionNumber']++;
        $counterData['lastUpdated'] = date('c');
        
        // Track session info
        $counterData['sessions'][] = [
            'number' => $counterData['lastSessionNumber'],
            'created' => date('c')
        ];
        
        // Keep only last 1000 sessions in history
        if (count($counterData['sessions']) > 1000) {
            $counterData['sessions'] = array_slice($counterData['sessions'], -1000);
        }
        
        // Rewind and truncate
        ftruncate($fp, 0);
        rewind($fp);
        
        // Write updated data
        fwrite($fp, json_encode($counterData, JSON_PRETTY_PRINT));
        
        // Release lock
        flock($fp, LOCK_UN);
        
        return $counterData['lastSessionNumber'];
    } finally {
        fclose($fp);
    }
}

function getSessionByNumber($sessionNumber) {
    $counterFile = $GLOBALS['DATA_DIR'] . '/global_session_counter.json';
    if (!file_exists($counterFile)) {
        return null;
    }
    
    $counterData = json_decode(file_get_contents($counterFile), true);
    if (!$counterData || !isset($counterData['sessions'])) {
        return null;
    }
    
    foreach ($counterData['sessions'] as $session) {
        if ($session['number'] == $sessionNumber) {
            return $session;
        }
    }
    
    return null;
}

function generatePointId($userId, $sessionId) {
    return 'point_' . $userId . '_' . $sessionId . '_' . microtime(true);
}

function getUserFile($userId) {
    return $GLOBALS['USERS_DIR'] . '/' . $userId . '.json';
}

function addToElevationQueue($userId, $sessionId, $point) {
    $queueFile = $GLOBALS['QUEUE_DIR'] . '/queue_' . date('Y-m-d') . '.json';
    
    $queueData = [];
    if (file_exists($queueFile)) {
        $queueData = json_decode(file_get_contents($queueFile), true) ?: [];
    }
    
    if (!isset($queueData['points'])) {
        $queueData['points'] = [];
    }
    
    $queuePoint = [
        'id' => count($queueData['points']) + 1,
        'userId' => $userId,
        'sessionId' => $sessionId,
        'pointId' => $point['pointId'],
        'lat' => $point['lat'],
        'lon' => $point['lon'],
        'timestamp' => $point['timestamp'],
        'addedToQueue' => date('c')
    ];
    
    $queueData['points'][] = $queuePoint;
    file_put_contents($queueFile, json_encode($queueData, JSON_PRETTY_PRINT));
}

function updateElevationInUserFiles($lat, $lon, $elevation, $source) {
    $updated = 0;
    $userFiles = glob($GLOBALS['USERS_DIR'] . '/user_*.json');
    
    foreach ($userFiles as $file) {
        $userData = json_decode(file_get_contents($file), true);
        $modified = false;
        
        if ($userData && isset($userData['sessions'])) {
            foreach ($userData['sessions'] as &$session) {
                if (isset($session['points'])) {
                    foreach ($session['points'] as &$point) {
                        if (abs($point['lat'] - $lat) < 0.000001 && abs($point['lon'] - $lon) < 0.000001) {
                            $point['elevation'] = $elevation;
                            $point['elevationSource'] = $source;
                            $point['elevationUpdated'] = date('c');
                            $modified = true;
                            $updated++;
                        }
                    }
                }
            }
        }
        
        if ($modified) {
            file_put_contents($file, json_encode($userData, JSON_PRETTY_PRINT));
        }
    }
    
    return $updated;
}

function handleGetLogs() {
    $type = $_GET['type'] ?? 'requests';
    $date = $_GET['date'] ?? date('Y-m-d');
    $lines = min($_GET['lines'] ?? 100, 1000);
    
    $logFile = '';
    switch ($type) {
        case 'requests':
            $logFile = $GLOBALS['LOGS_DIR'] . '/requests_' . $date . '.log';
            break;
        case 'errors':
            $logFile = $GLOBALS['LOGS_DIR'] . '/errors_' . $date . '.log';
            break;
        case 'gps':
            $logFile = $GLOBALS['LOGS_DIR'] . '/gps_' . $date . '.log';
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid log type. Use: requests, errors, gps']);
            return;
    }
    
    if (!file_exists($logFile)) {
        echo json_encode([
            'logs' => [],
            'message' => 'No logs found for ' . $date,
            'file' => basename($logFile)
        ]);
        return;
    }
    
    $content = file_get_contents($logFile);
    $logLines = array_filter(explode("\n", $content));
    $recentLogs = array_slice($logLines, -$lines);
    
    echo json_encode([
        'logs' => $recentLogs,
        'total_lines' => count($logLines),
        'showing_lines' => count($recentLogs),
        'file' => basename($logFile),
        'date' => $date,
        'type' => $type
    ]);
}

function logRequest($method, $path, $body) {
    $logFile = $GLOBALS['LOGS_DIR'] . '/requests_' . date('Y-m-d') . '.log';
    $timestamp = date('c');
    $logEntry = "[$timestamp] $method $path\n";
    if ($body && strlen($body) < 1000) {
        $logEntry .= "Body: $body\n";
    }
    $logEntry .= "---\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

function logError($message, $context = []) {
    $logFile = $GLOBALS['LOGS_DIR'] . '/errors_' . date('Y-m-d') . '.log';
    $timestamp = date('c');
    $logEntry = "[$timestamp] ERROR: $message\n";
    if (!empty($context)) {
        $logEntry .= "Context: " . json_encode($context) . "\n";
    }
    $logEntry .= "---\n";
    
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

function logGPS($userId, $sessionId, $action, $data = []) {
    $logFile = $GLOBALS['LOGS_DIR'] . '/gps_' . date('Y-m-d') . '.log';
    $timestamp = date('c');
    $logEntry = "[$timestamp] GPS: $action - User: $userId, Session: $sessionId\n";
    if (!empty($data)) {
        $logEntry .= "Data: " . json_encode($data) . "\n";
    }
    $logEntry .= "---\n";
    
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

function handleSessionHeartbeat() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['userId']) || !isset($input['sessionId'])) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID and session ID required']);
        return;
    }
    
    $userId = $input['userId'];
    $sessionId = $input['sessionId'];
    
    // Load user data
    $userFile = getUserFile($userId);
    if (!file_exists($userFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        return;
    }
    
    $userData = json_decode(file_get_contents($userFile), true);
    
    // Find and update session
    $sessionFound = false;
    foreach ($userData['sessions'] as &$session) {
        if ($session['sessionId'] === $sessionId && $session['status'] === 'active') {
            $session['lastActivity'] = date('c');
            $sessionFound = true;
            break;
        }
    }
    
    if (!$sessionFound) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Active session not found',
            'code' => 'INVALID_SESSION'
        ]);
        return;
    }
    
    $userData['lastActivity'] = date('c');
    file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'success' => true,
        'sessionId' => $sessionId,
        'lastActivity' => date('c')
    ]);
}

function handleSessionLookup() {
    $sessionNumber = $_GET['number'] ?? null;
    $sessionId = $_GET['sessionId'] ?? null;
    
    if ($sessionNumber) {
        $sessionInfo = getSessionByNumber($sessionNumber);
        if ($sessionInfo) {
            echo json_encode([
                'found' => true,
                'session' => $sessionInfo
            ]);
        } else {
            echo json_encode([
                'found' => false,
                'message' => 'Session number not found'
            ]);
        }
    } elseif ($sessionId) {
        // Extract session number from session ID
        preg_match('/session_(\d+)_/', $sessionId, $matches);
        if ($matches) {
            $globalNumber = intval($matches[1]);
            $sessionInfo = getSessionByNumber($globalNumber);
            echo json_encode([
                'found' => true,
                'sessionId' => $sessionId,
                'globalNumber' => $globalNumber,
                'session' => $sessionInfo
            ]);
        } else {
            echo json_encode([
                'found' => false,
                'message' => 'Invalid session ID format'
            ]);
        }
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Session number or session ID required']);
    }
}

function handleVersion() {
    echo json_encode([
        'version' => '2.2.0',
        'node_version' => 'PHP ' . phpversion(),
        'timestamp' => date('c'),
        'server' => 'Elevation API Server',
        'features' => [
            'global_session_numbering',
            'session_heartbeat',
            'automatic_cleanup',
            'enhanced_logging'
        ]
    ]);
}

function handleServerVersion() {
    // Dedicated server version endpoint with additional details
    $uptime = time() - filemtime(__FILE__);
    $memoryUsage = memory_get_usage(true);
    $peakMemory = memory_get_peak_usage(true);
    
    echo json_encode([
        'api_version' => '2.2.0',
        'php_version' => phpversion(),
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'timestamp' => date('c'),
        'uptime_seconds' => $uptime,
        'memory_usage_mb' => round($memoryUsage / 1024 / 1024, 2),
        'peak_memory_mb' => round($peakMemory / 1024 / 1024, 2),
        'server_name' => 'GPS Elevation API Server',
        'endpoints' => [
            'version' => '/api/version',
            'server_version' => '/api/server/version',
            'stats' => '/api/stats',
            'gps_queue' => '/api/gps-queue',
            'user_init' => '/api/user/init',
            'session_start' => '/api/user/session/start',
            'session_heartbeat' => '/api/user/session/heartbeat',
            'session_lookup' => '/api/session/lookup'
        ],
        'features' => [
            'global_session_numbering',
            'session_heartbeat',
            'automatic_cleanup',
            'enhanced_logging',
            'real_time_gps_tracking',
            'elevation_data_collection',
            'user_session_management'
        ],
        'status' => 'operational'
    ]);
}

function cleanupStaleSessions() {
    $timeout = 30 * 60; // 30 minutes
    $userFiles = glob($GLOBALS['USERS_DIR'] . '/user_*.json');
    $cleanedCount = 0;
    
    foreach ($userFiles as $file) {
        $userData = json_decode(file_get_contents($file), true);
        $modified = false;
        
        if ($userData && isset($userData['sessions'])) {
            foreach ($userData['sessions'] as &$session) {
                if ($session['status'] === 'active') {
                    $lastActivity = strtotime($session['lastActivity'] ?? $session['startTime']);
                    if (time() - $lastActivity > $timeout) {
                        $session['status'] = 'timeout';
                        $session['endTime'] = date('c');
                        $session['endReason'] = 'inactivity_timeout';
                        $modified = true;
                        $cleanedCount++;
                        
                        logGPS($userData['userId'] ?? 'unknown', $session['sessionId'], 'session_timeout', [
                            'lastActivity' => $session['lastActivity'] ?? $session['startTime'],
                            'timeoutMinutes' => $timeout / 60
                        ]);
                    }
                }
            }
        }
        
        if ($modified) {
            file_put_contents($file, json_encode($userData, JSON_PRETTY_PRINT));
        }
    }
    
    return $cleanedCount;
}

function handleElevation() {
    $lat = $_GET['lat'] ?? null;
    $lon = $_GET['lon'] ?? null;
    
    if (!$lat || !$lon) {
        http_response_code(400);
        echo json_encode(['error' => 'Latitude and longitude required']);
        return;
    }
    
    $latitude = floatval($lat);
    $longitude = floatval($lon);
    
    // Validate coordinates
    if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid coordinates']);
        return;
    }
    
    // Try to get elevation from grid databases
    $elevation = getElevationFromGrid($latitude, $longitude);
    
    if ($elevation !== null) {
        echo json_encode([
            'elevation' => $elevation,
            'lat' => $latitude,
            'lon' => $longitude,
            'source' => 'grid_database',
            'timestamp' => date('c')
        ]);
    } else {
        // Fallback to simulated elevation for areas without data
        $simulatedElevation = simulateElevation($latitude, $longitude);
        echo json_encode([
            'elevation' => $simulatedElevation,
            'lat' => $latitude,
            'lon' => $longitude,
            'source' => 'simulated',
            'timestamp' => date('c')
        ]);
    }
}

function getElevationFromGrid($lat, $lon) {
    // Check if we have elevation data in any of the grid databases
    $gridFiles = glob('../grid_databases/*.db');
    
    foreach ($gridFiles as $gridFile) {
        try {
            // Suppress warnings for databases that don't have the table
            $db = @new SQLite3($gridFile);
            if (!$db) continue;
            
            // Check if table exists first
            $tableCheck = @$db->querySingle("SELECT name FROM sqlite_master WHERE type='table' AND name='elevation_points'");
            if (!$tableCheck) {
                $db->close();
                continue;
            }
            
            // Look for elevation data near this coordinate
            $stmt = @$db->prepare('
                SELECT elevation 
                FROM elevation_points 
                WHERE ABS(latitude - ?) < 0.001 AND ABS(longitude - ?) < 0.001 
                ORDER BY ABS(latitude - ?) + ABS(longitude - ?) 
                LIMIT 1
            ');
            
            if ($stmt === false) {
                $db->close();
                continue;
            }
            
            $stmt->bindValue(1, $lat, SQLITE3_FLOAT);
            $stmt->bindValue(2, $lon, SQLITE3_FLOAT);
            $stmt->bindValue(3, $lat, SQLITE3_FLOAT);
            $stmt->bindValue(4, $lon, SQLITE3_FLOAT);
            
            $result = @$stmt->execute();
            if (!$result) {
                $db->close();
                continue;
            }
            
            $row = $result->fetchArray(SQLITE3_ASSOC);
            
            if ($row && isset($row['elevation'])) {
                $elevation = floatval($row['elevation']);
                $db->close();
                return $elevation;
            }
            
            $db->close();
        } catch (Exception $e) {
            // Continue to next database if this one fails
            continue;
        }
    }
    
    return null;
}

function simulateElevation($lat, $lon) {
    // Base elevation around 1500m (typical for New Mexico)
    $elevation = 1500;
    
    // Add variation based on latitude (higher in north)
    $elevation += ($lat - 34) * 100;
    
    // Add some longitude-based variation
    $elevation += sin($lon * 0.5) * 200;
    
    // Add some random variation (±100m)
    $elevation += (mt_rand() / mt_getrandmax() - 0.5) * 200;
    
    // Ensure elevation stays within reasonable bounds
    $elevation = max(1000, min(4000, $elevation));
    
    return round($elevation, 1);
}
?> 