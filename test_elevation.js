import http from 'http';

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/elevation?lat=35.0844&lon=-106.6504',
    method: 'GET'
};

const req = http.request(options, res => {
    console.log(`Status Code: ${res.statusCode}`);

    res.on('data', d => {
        const data = JSON.parse(d);
        console.log('Response:', JSON.stringify(data, null, 2));
    });
});

req.on('error', error => {
    console.error('Error:', error);
});

req.end(); 