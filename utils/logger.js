import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    constructor(filename) {
        this.logFile = path.join(__dirname, '..', 'logs', filename);
        
        // Ensure logs directory exists
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
        
        // Log to console
        console.log(logMessage);
        
        // Log to file
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }

    error(message, error = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ERROR: ${message}${error ? '\n' + error.stack : ''}`;
        
        // Log to console
        console.error(logMessage);
        
        // Log to file
        fs.appendFileSync(this.logFile, logMessage + '\n');
    }
}

// Create separate loggers for different components
export const svgLogger = new Logger('svg.log');
export const mapLogger = new Logger('map.log');
export const dataLogger = new Logger('data.log'); 