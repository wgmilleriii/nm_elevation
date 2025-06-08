import WindowCollector from './window_collection.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testWindowCollection() {
    // Test parameters
    const centerPoint = {
        lat: 35.6870,  // Albuquerque, NM
        lon: -105.9378 // Santa Fe, NM
    };
    
    const windowSize = 0.5; // degrees
    const direction = {
        x: 1,  // East
        y: 0   // No vertical component
    };
    
    console.log('\nWindow Collection Test');
    console.log('====================');
    console.log('Center Point:', centerPoint);
    console.log('Window Size:', windowSize, 'degrees');
    console.log('Direction:', direction);
    console.log('\nStarting collection process...\n');
    
    const collector = new WindowCollector(centerPoint, windowSize, direction);
    const dbPath = path.join(__dirname, 'test_window.db');
    const result = await collector.collectPoints(dbPath);
    
    console.log('\nCollection Summary');
    console.log('=================');
    console.log('Total Points:', result.metadata.totalPoints);
    console.log('Window Size:', result.metadata.windowSize, 'degrees');
    console.log('Direction: (', result.metadata.direction.x, ',', result.metadata.direction.y, ')');
    
    console.log('\nProgress Log');
    console.log('============');
    result.progressLog.forEach(entry => {
        const time = entry.timestamp.split('T')[1].split('.')[0];  // Extract just the time
        console.log(`[${time}] ${entry.message}`);
        if (Object.keys(entry.details).length > 0) {
            // Pretty print the details with 2 space indentation
            const details = JSON.stringify(entry.details, null, 2)
                .split('\n')
                .map(line => '  ' + line)  // Add 2 spaces to each line
                .join('\n');
            console.log(details);
        }
        console.log(''); // Add blank line between entries
    });
}

testWindowCollection().catch(console.error); 