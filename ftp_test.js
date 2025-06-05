import ftp from 'basic-ftp';

async function testFTPConnection() {
    const client = new ftp.Client();
    client.ftp.verbose = true; // Enable verbose logging

    try {
        console.log('Attempting to connect to pi1...');
        await client.access({
            host: '10.0.0.68',  // pi1 IP address
            user: 'pi',         // updated username
            password: 'Lalalala3##3', // updated password
            secure: false       // not using FTPS
        });

        console.log('Successfully connected to pi1!');
        
        // List contents of root directory
        console.log('\nListing root directory contents:');
        const list = await client.list();
        console.log(list);

        // Try to create a test file
        console.log('\nCreating test file...');
        await client.uploadFrom('test.txt', 'Hello from FTP test!');
        console.log('Test file created successfully!');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.close();
    }
}

testFTPConnection(); 