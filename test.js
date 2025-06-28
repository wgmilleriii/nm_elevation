import http from 'http';

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/elevation?lat=35.0844&lon=-106.6504',
    method: 'GET'
};

const req = http.request(options, res => {
    let data = '';

    res.on('data', chunk => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            const parsed = JSON.parse(data);
            console.log('Response:', JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log('Raw response:', data);
        }
    });
});

req.on('error', error => {
    console.error('Error:', error);
});

req.end(); 