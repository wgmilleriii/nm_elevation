import mysql from 'mysql2/promise';

const config = {
    mysql: {
        host: 'localhost',
        port: 3307,
        user: 'root',
        database: 'elevation_tracking'
    }
};

async function addTestInteraction() {
    const conn = await mysql.createConnection(config.mysql);
    try {
        await conn.execute(
            'INSERT INTO interactions (actor, command, interpretation, changes_made, efficiency_suggestions, next_steps) VALUES (?, ?, ?, ?, ?, ?)',
            ['PC', 'Test Command', 'Test Interpretation', 'Test Changes', 'Test Suggestions', 'Test Next Steps']
        );
        console.log('Test interaction added successfully');
    } finally {
        await conn.end();
    }
}

addTestInteraction().catch(err => {
    console.error('Failed to add test interaction:', err);
}); 