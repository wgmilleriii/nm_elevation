# GPS Elevation API Documentation

## Base URL
- **Production**: `https://hanon.artsmetrics.net/elevation/api/`
- **Local Development**: `http://localhost:3001/api/`

## Authentication
Currently, no authentication is required. All endpoints are publicly accessible.

## User Management

### Initialize User
Create or retrieve a user profile based on device ID.

**Endpoint**: `POST /user/init`

**Request Body**:
```json
{
  "deviceId": "unique_device_identifier"
}
```

**Response**:
```json
{
  "userId": "user_79b1147179a2dd1fa51a735adf56f802"
}
```

### Start GPS Session
Begin a new GPS tracking session for a user.

**Endpoint**: `POST /user/session/start`

**Request Body**:
```json
{
  "userId": "user_79b1147179a2dd1fa51a735adf56f802"
}
```

**Response**:
```json
{
  "sessionId": "session_000123_user_79b1147179a2dd1fa51a735adf56f802_1703875200",
  "globalNumber": 123,
  "startTime": "2023-12-29T12:00:00+00:00",
  "status": "active"
}
```

### End GPS Session
End an active GPS tracking session.

**Endpoint**: `POST /user/session/end`

**Request Body**:
```json
{
  "userId": "user_79b1147179a2dd1fa51a735adf56f802",
  "sessionId": "session_user_79b1147179a2dd1fa51a735adf56f802_1703875200"
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "session_000123_user_79b1147179a2dd1fa51a735adf56f802_1703875200",
  "endTime": "2023-12-29T13:00:00+00:00"
}
```

### Session Heartbeat
Keep an active session alive by sending periodic heartbeats.

**Endpoint**: `POST /user/session/heartbeat`

**Request Body**:
```json
{
  "userId": "user_79b1147179a2dd1fa51a735adf56f802",
  "sessionId": "session_000123_user_79b1147179a2dd1fa51a735adf56f802_1703875200"
}
```

**Response**:
```json
{
  "success": true,
  "sessionId": "session_000123_user_79b1147179a2dd1fa51a735adf56f802_1703875200",
  "lastActivity": "2023-12-29T12:30:00+00:00"
}
```

### Session Lookup
Look up session information by global number or session ID.

**Endpoint**: `GET /session/lookup`

**Query Parameters**:
- `number` (optional): Global session number
- `sessionId` (optional): Full session ID

**Examples**:
```
GET /session/lookup?number=123
GET /session/lookup?sessionId=session_000123_user_79b1147179a2dd1fa51a735adf56f802_1703875200
```

**Response**:
```json
{
  "found": true,
  "sessionId": "session_000123_user_79b1147179a2dd1fa51a735adf56f802_1703875200",
  "globalNumber": 123,
  "session": {
    "number": 123,
    "created": "2023-12-29T12:00:00+00:00"
  }
}
```

## GPS Tracking

### Save Track Point
Save a GPS coordinate point to the user's active session.

**Endpoint**: `POST /user/track-point`

**Request Body**:
```json
{
  "userId": "user_79b1147179a2dd1fa51a735adf56f802",
  "sessionId": "session_user_79b1147179a2dd1fa51a735adf56f802_1703875200",
  "point": {
    "lat": 35.0844,
    "lon": -106.6504,
    "accuracy": 5.2,
    "speed": 15.5,
    "heading": 180,
    "timestamp": "2023-12-29T12:30:00+00:00"
  }
}
```

**Response**:
```json
{
  "success": true,
  "pointId": "point_user_79b1147179a2dd1fa51a735adf56f802_session_1703875200_1703877000.123",
  "stats": {
    "point_count": 150,
    "total_points": 150
  }
}
```

### Get User Points
Retrieve GPS points for a user or specific session.

**Endpoint**: `GET /user/points`

**Query Parameters**:
- `userId` (required): User identifier
- `sessionId` (optional): Specific session ID
- `withElevation` (optional): `true` to only return points with elevation data
- `limit` (optional): Maximum points to return (default: 100, max: 1000)

**Response**:
```json
{
  "points": [
    {
      "pointId": "point_123",
      "lat": 35.0844,
      "lon": -106.6504,
      "elevation": 1650.5,
      "elevationSource": "srtm30m",
      "timestamp": "2023-12-29T12:30:00+00:00",
      "sessionId": "session_123"
    }
  ],
  "total_count": 150,
  "has_more": false
}
```

### Get User Sessions
Retrieve all sessions for a user with statistics.

**Endpoint**: `GET /user-sessions`

**Query Parameters**:
- `userId` (required): User identifier

**Response**:
```json
{
  "sessions": [
    {
      "sessionId": "session_123",
      "startTime": "2023-12-29T12:00:00+00:00",
      "endTime": "2023-12-29T13:00:00+00:00",
      "status": "completed",
      "pointCount": 150,
      "totalDistance": 15000.5,
      "min_elevation": 1600.2,
      "max_elevation": 1750.8,
      "avg_elevation": 1675.3,
      "elevation_gain": 150.6
    }
  ]
}
```

## Elevation Processing Queue

### Get GPS Queue
Retrieve GPS points that need elevation processing.

**Endpoint**: `GET /gps-queue`

**Query Parameters**:
- `lastProcessedId` (optional): Only return points with ID greater than this
- `limit` (optional): Maximum points to return (default: 50, max: 100)
- `status` (optional): Filter by status (`pending`, `processing`, `completed`)

**Response**:
```json
{
  "points": [
    {
      "id": 123,
      "userId": "user_79b1147179a2dd1fa51a735adf56f802",
      "sessionId": "session_123",
      "pointId": "point_123",
      "lat": 35.0844,
      "lon": -106.6504,
      "timestamp": "2023-12-29T12:30:00+00:00",
      "addedToQueue": "2023-12-29T12:30:01+00:00",
      "status": "pending",
      "priority": 70
    }
  ],
  "stats": {
    "total_pending": 25,
    "total_processing": 5,
    "total_completed": 120,
    "oldest_pending": "2023-12-29T12:25:00+00:00",
    "newest_pending": "2023-12-29T12:35:00+00:00"
  },
  "timestamp": "2023-12-29T12:35:00+00:00",
  "has_more": false
}
```

### Claim Queue Points
Mark specific points as being processed to prevent duplicate processing.

**Endpoint**: `POST /queue/claim`

**Request Body**:
```json
{
  "pointIds": [123, 124, 125],
  "processorId": "mac_server_001"
}
```

**Response**:
```json
{
  "success": true,
  "claimed": 3,
  "processor_id": "mac_server_001",
  "timestamp": "2023-12-29T12:35:00+00:00"
}
```

### Batch Update Elevations
Update multiple points with elevation data at once.

**Endpoint**: `POST /queue/batch-update`

**Request Body**:
```json
{
  "updates": [
    {
      "lat": 35.0844,
      "lon": -106.6504,
      "elevation": 1650.5,
      "source": "srtm30m"
    },
    {
      "lat": 35.0845,
      "lon": -106.6505,
      "elevation": 1651.2,
      "source": "open-meteo"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "total_updated": 2,
  "errors": [],
  "timestamp": "2023-12-29T12:35:00+00:00"
}
```

### Single Elevation Update
Update a single point with elevation data.

**Endpoint**: `POST /elevation-update`

**Request Body**:
```json
{
  "lat": 35.0844,
  "lon": -106.6504,
  "elevation": 1650.5,
  "source": "srtm30m"
}
```

**Response**:
```json
{
  "success": true,
  "updated": 1,
  "timestamp": "2023-12-29T12:35:00+00:00"
}
```

## Monitoring & Status

### Get System Statistics
Retrieve overall system statistics.

**Endpoint**: `GET /stats`

**Response**:
```json
{
  "totalUsers": 15,
  "totalSessions": 45,
  "totalPoints": 12500,
  "queueSize": 150,
  "pendingPoints": 25,
  "processingPoints": 5,
  "completedPoints": 120
}
```

### Get Queue Status
Detailed queue status with optional point details.

**Endpoint**: `GET /queue/status`

**Query Parameters**:
- `detailed` (optional): `true` to include all queue points

**Response**:
```json
{
  "status": {
    "pending": 25,
    "processing": 5,
    "completed": 120,
    "failed": 0,
    "oldest_pending": "2023-12-29T12:25:00+00:00",
    "newest_pending": "2023-12-29T12:35:00+00:00",
    "active_processors": {
      "mac_server_001": 3,
      "mac_server_002": 2
    }
  },
  "timestamp": "2023-12-29T12:35:00+00:00"
}
```

### Processing Heartbeat
Send heartbeat from processing servers to track activity.

**Endpoint**: `POST /processing/heartbeat`

**Request Body**:
```json
{
  "processorId": "mac_server_001",
  "processingCount": 5,
  "completedCount": 120
}
```

**Response**:
```json
{
  "success": true,
  "processor_id": "mac_server_001",
  "timestamp": "2023-12-29T12:35:00+00:00",
  "active_processors": 2
}
```

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (missing required parameters)
- `404`: Not Found (user/session not found)
- `500`: Internal Server Error

Error responses follow this format:
```json
{
  "error": "Description of the error"
}
```

## Data Flow

1. **Mobile App** calls `/user/init` to get a user ID
2. **Mobile App** calls `/user/session/start` to begin tracking
3. **Mobile App** repeatedly calls `/user/track-point` to save GPS coordinates
4. **Mac Server** polls `/gps-queue` to get points needing elevation
5. **Mac Server** calls `/queue/claim` to reserve points for processing
6. **Mac Server** processes elevation data and calls `/queue/batch-update`
7. **Mobile App** can retrieve updated points with elevation via `/user/points?withElevation=true`
8. **Mobile App** calls `/user/session/end` when tracking is complete

## Rate Limits

Currently no rate limits are enforced, but consider implementing them for production use:
- Track point submissions: 1 per second per user
- Queue polling: 1 per 5 seconds per processor
- Elevation updates: 10 per second per processor

## Notes

- All timestamps are in ISO 8601 format with timezone
- Coordinates are in decimal degrees (WGS84)
- Distances are in meters
- Elevations are in meters above sea level
- Priority calculation favors newer points and active sessions 