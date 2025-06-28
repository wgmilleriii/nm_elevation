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
        
    case '/api/checkpoint':
        if ($method === 'POST') {
            handleCheckpoint();
        }
        break;
        
    case '/api/users':
        if ($method === 'GET') {
            handleListUsers();
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
    $sessionId = generateSessionId($userId);
    
    // Load user data
    $userFile = getUserFile($userId);
    if (!file_exists($userFile)) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        return;
    }
    
    $userData = json_decode(file_get_contents($userFile), true);
    
    // Create new session
    $session = [
        'sessionId' => $sessionId,
        'startTime' => date('c'),
        'endTime' => null,
        'points' => [],
        'totalDistance' => 0,
        'pointCount' => 0,
        'status' => 'active'
    ];
    
    $userData['sessions'][] = $session;
    $userData['lastActivity'] = date('c');
    
    file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT));
    
    echo json_encode([
        'sessionId' => $sessionId,
        'startTime' => $session['startTime']
    ]);
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
    if (!$userData || !isset($userData['sessions'])) return false;
    
    foreach ($userData['sessions'] as $session) {
        if ($session['sessionId'] === $sessionId) {
            return $session['status'] === 'active';
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

function handleListUsers() {
    $users = [];
    $userFiles = glob($GLOBALS['USERS_DIR'] . '/user_*.json');
    
    foreach ($userFiles as $file) {
        $userData = json_decode(file_get_contents($file), true);
        if ($userData) {
            $totalPoints = 0;
            $sessionCount = count($userData['sessions'] ?? []);
            
            // Count total points across all sessions
            foreach ($userData['sessions'] ?? [] as $session) {
                $totalPoints += count($session['points'] ?? []);
            }
            
            $users[] = [
                'userId' => $userData['userId'],
                'deviceId' => $userData['deviceId'] ?? null,
                'createdAt' => $userData['createdAt'] ?? null,
                'lastActivity' => $userData['lastActivity'] ?? null,
                'sessionCount' => $sessionCount,
                'totalPoints' => $totalPoints
            ];
        }
    }
    
    // Sort by total points descending
    usort($users, function($a, $b) {
        return $b['totalPoints'] - $a['totalPoints'];
    });
    
    echo json_encode([
        'users' => $users,
        'totalUsers' => count($users),
        'timestamp' => date('c')
    ]);
}

function handleCheckpoint() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    $required = ['name', 'timestamp', 'latitude', 'longitude', 'userId', 'sessionId'];
    foreach ($required as $field) {
        if (!isset($input[$field])) {
            http_response_code(400);
            echo json_encode(['error' => "Field '$field' is required"]);
            return;
        }
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
    
    // Find the session
    $sessionIndex = -1;
    foreach ($userData['sessions'] as $index => $session) {
        if ($session['sessionId'] === $sessionId) {
            $sessionIndex = $index;
            break;
        }
    }
    
    if ($sessionIndex === -1) {
        http_response_code(404);
        echo json_encode(['error' => 'Session not found']);
        return;
    }
    
    // Create checkpoint object
    $checkpoint = [
        'id' => uniqid('checkpoint_'),
        'name' => $input['name'],
        'description' => $input['description'] ?? '',
        'timestamp' => $input['timestamp'],
        'latitude' => (float)$input['latitude'],
        'longitude' => (float)$input['longitude'],
        'elevation' => isset($input['elevation']) ? (float)$input['elevation'] : null,
        'accuracy' => isset($input['accuracy']) ? (float)$input['accuracy'] : null,
        'speed' => isset($input['speed']) ? (float)$input['speed'] : null,
        'heading' => isset($input['heading']) ? (float)$input['heading'] : null,
        'deviceId' => $input['deviceId'] ?? null,
        'createdAt' => date('c')
    ];
    
    // Add checkpoint to session
    if (!isset($userData['sessions'][$sessionIndex]['checkpoints'])) {
        $userData['sessions'][$sessionIndex]['checkpoints'] = [];
    }
    $userData['sessions'][$sessionIndex]['checkpoints'][] = $checkpoint;
    
    // Update user's last activity
    $userData['lastActivity'] = date('c');
    
    // Save updated user data
    file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT));
    
    // Log the checkpoint creation
    logGPS($userId, $sessionId, 'checkpoint_created', [
        'checkpointId' => $checkpoint['id'],
        'name' => $checkpoint['name'],
        'location' => $checkpoint['latitude'] . ',' . $checkpoint['longitude']
    ]);
    
    echo json_encode([
        'success' => true,
        'checkpoint' => $checkpoint,
        'timestamp' => date('c')
    ]);
}

// Helper functions
function generateUserId($deviceId) {
    return 'user_' . md5($deviceId);
}

function generateSessionId($userId) {
    // Get global session counter
    $globalSessionNumber = getNextGlobalSessionNumber();
    return 'session_' . $globalSessionNumber . '_' . $userId . '_' . time();
}

function getNextGlobalSessionNumber() {
    $counterFile = $GLOBALS['DATA_DIR'] . '/global_session_counter.json';
    
    // Initialize counter file if it doesn't exist
    if (!file_exists($counterFile)) {
        $counterData = ['lastSessionNumber' => 0];
        file_put_contents($counterFile, json_encode($counterData, JSON_PRETTY_PRINT));
    }
    
    // Read current counter
    $counterData = json_decode(file_get_contents($counterFile), true);
    if (!$counterData || !isset($counterData['lastSessionNumber'])) {
        $counterData = ['lastSessionNumber' => 0];
    }
    
    // Increment counter
    $counterData['lastSessionNumber']++;
    $counterData['lastUpdated'] = date('c');
    
    // Save updated counter
    file_put_contents($counterFile, json_encode($counterData, JSON_PRETTY_PRINT));
    
    return $counterData['lastSessionNumber'];
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
?> 