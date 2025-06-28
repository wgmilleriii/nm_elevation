const { spawn } = require('child_process');
const path = require('path');
const { setupTestDatabase } = require('./setup_test_db.cjs');

async function runTests() {
    try {
        // First, set up the test database
        console.log('Setting up test database...');
        const testDbPath = await setupTestDatabase();
        
        // Start the server with test configuration
        console.log('Starting server with test configuration...');
        const server = spawn('node', ['server.js'], {
            env: {
                ...process.env,
                NODE_ENV: 'test',
                TEST_DB_PATH: testDbPath,
                PORT: '8020'
            }
        });

        // Log server output
        server.stdout.on('data', (data) => {
            console.log(`Server: ${data}`);
        });

        server.stderr.on('data', (data) => {
            console.error(`Server Error: ${data}`);
        });

        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Run the tests using global jest
        console.log('Running GPS tracking tests...');
        const jest = spawn('jest', [
            'gps_tracking.test.cjs',
            '--detectOpenHandles'
        ], {
            stdio: 'inherit',
            shell: true,
            cwd: __dirname
        });

        // Handle test completion
        jest.on('close', (code) => {
            console.log(`Tests completed with code ${code}`);
            // Shutdown server
            server.kill();
            process.exit(code);
        });

    } catch (error) {
        console.error('Error running tests:', error);
        process.exit(1);
    }
}

runTests(); 