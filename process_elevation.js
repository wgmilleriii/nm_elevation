import { readFileSync, writeFileSync } from 'fs';

// Read the original file
const data = JSON.parse(readFileSync('public/data/elevation_cache_reduced.json', 'utf8'));

// Process each elevation value
const processedData = {};
for (const [key, value] of Object.entries(data)) {
    processedData[key] = Number(value.toFixed(1));
}

// Write back to file with 1 decimal place
writeFileSync('public/data/elevation_cache_reduced.json', 
    JSON.stringify(processedData, null, 2));

console.log('Processed elevation data and rounded to 1 decimal place'); 