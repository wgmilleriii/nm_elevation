const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8020'; // Update this to match your server port

describe('GPS Tracking API Tests', () => {
    let userId;
    let sessionId;
    const testDeviceId = `test_device_${Date.now()}`;

    // Mock GPS point data
    const mockPoint = {
        lat: 35.0844,
        lon: -106.6504,
        elevation: 1620,
        accuracy: 10,
        timestamp: Date.now()
    };

    test('should initialize a user', async () => {
        const response = await fetch(`${BASE_URL}/api/user/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: testDeviceId })
        });

        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data).toHaveProperty('userId');
        userId = data.userId;
    });

    test('should start a tracking session', async () => {
        const response = await fetch(`${BASE_URL}/api/user/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data).toHaveProperty('sessionId');
        expect(data).toHaveProperty('startTime');
        sessionId = data.sessionId;
    });

    test('should save track points', async () => {
        const response = await fetch(`${BASE_URL}/api/user/track-point`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                sessionId,
                point: mockPoint
            })
        });

        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('stats');
        expect(data.stats).toHaveProperty('point_count');
        expect(data.stats.point_count).toBe(1);
    });

    test('should save multiple track points', async () => {
        // Create slightly different points
        const points = Array.from({ length: 5 }, (_, i) => ({
            ...mockPoint,
            lat: mockPoint.lat + (i * 0.001),
            lon: mockPoint.lon + (i * 0.001),
            timestamp: mockPoint.timestamp + (i * 10000)
        }));

        for (const point of points) {
            const response = await fetch(`${BASE_URL}/api/user/track-point`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    sessionId,
                    point
                })
            });

            expect(response.ok).toBe(true);
            const data = await response.json();
            expect(data.success).toBe(true);
        }

        // Verify total points
        const response = await fetch(`${BASE_URL}/api/user/${userId}/sessions`);
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.sessions[0].point_count).toBe(6); // 5 new points + 1 from previous test
    });

    test('should end tracking session', async () => {
        const response = await fetch(`${BASE_URL}/api/user/session/end`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                sessionId
            })
        });

        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data).toHaveProperty('totalDistance');
        expect(data).toHaveProperty('endTime');
    });

    test('should retrieve user sessions', async () => {
        const response = await fetch(`${BASE_URL}/api/user/${userId}/sessions`);
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(Array.isArray(data.sessions)).toBe(true);
        expect(data.sessions.length).toBeGreaterThan(0);

        const session = data.sessions[0];
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('start_time');
        expect(session).toHaveProperty('end_time');
        expect(session).toHaveProperty('total_distance');
        expect(session).toHaveProperty('point_count');
        expect(session).toHaveProperty('min_elevation');
        expect(session).toHaveProperty('max_elevation');
        expect(session).toHaveProperty('avg_elevation');
    });

    test('should handle pagination in sessions', async () => {
        // Create another session
        const session2Response = await fetch(`${BASE_URL}/api/user/session/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        expect(session2Response.ok).toBe(true);

        // Test pagination
        const response = await fetch(`${BASE_URL}/api/user/${userId}/sessions?limit=1`);
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(Array.isArray(data.sessions)).toBe(true);
        expect(data.sessions.length).toBe(1);
    });

    test('should handle invalid user ID', async () => {
        const response = await fetch(`${BASE_URL}/api/user/999999/sessions`);
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(Array.isArray(data.sessions)).toBe(true);
        expect(data.sessions.length).toBe(0);
    });

    test('should handle invalid session ID', async () => {
        const response = await fetch(`${BASE_URL}/api/user/track-point`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                sessionId: 999999,
                point: mockPoint
            })
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data).toHaveProperty('code');
        expect(data.code).toBe('INVALID_SESSION');
    });
}); 