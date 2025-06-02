import mysql from 'mysql2/promise';

const config = {
    host: 'localhost',
    port: 3307,
    user: 'root',
    database: 'elevation_tracking'
};

async function addTestInteraction() {
    const conn = await mysql.createConnection(config);
    try {
        console.log('Adding test interaction...');
        await conn.execute(
            'INSERT INTO interactions (actor, command, interpretation, changes_made, efficiency_suggestions, next_steps) VALUES (?, ?, ?, ?, ?, ?)',
            [
                'PC',
                'test command',
                'This is a test interaction',
                'Added test data to database',
                'Could have used a more descriptive command',
                'Verify the interaction was logged correctly'
            ]
        );
        console.log('Test interaction added successfully');
    } catch (error) {
        console.error('Error adding test interaction:', error);
    } finally {
        await conn.end();
    }
}

addTestInteraction(); 