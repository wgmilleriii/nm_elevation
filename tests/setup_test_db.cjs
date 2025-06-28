const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');
const path = require('path');

async function setupTestDatabase() {
    // Create test database directory if it doesn't exist
    const testDbDir = path.join(__dirname, '..', 'test_databases');
    if (!fs.existsSync(testDbDir)) {
        fs.mkdirSync(testDbDir);
    }

    const dbPath = path.join(testDbDir, 'user_tracking_test.db');
    
    // Remove existing test database if it exists
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }

    // Create and initialize test database
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Read and execute schema files
    const schemaFiles = [
        '../SQL/003_user_gps_tracking.sql'
    ];

    for (const schemaFile of schemaFiles) {
        const schema = fs.readFileSync(path.join(__dirname, schemaFile), 'utf8');
        await db.exec(schema);
    }

    // Close database connection
    await db.close();

    console.log('Test database setup complete:', dbPath);
    return dbPath;
}

// Run setup if this script is run directly
if (require.main === module) {
    setupTestDatabase().catch(console.error);
}

module.exports = { setupTestDatabase }; 