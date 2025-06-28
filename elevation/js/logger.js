// Client-side logger
class Logger {
    constructor(name) {
        this.name = name;
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${this.name}] ${message}`;
        
        // Log to console
        console.log(logMessage);
        if (data) {
            console.log(data);
        }

        // Send to server for file logging
        fetch('/api/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timestamp,
                logger: this.name,
                message,
                data
            })
        }).catch(err => console.error('Failed to send log to server:', err));
    }

    error(message, error = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${this.name}] ERROR: ${message}`;
        
        // Log to console
        console.error(logMessage);
        if (error) {
            console.error(error);
        }

        // Send to server for file logging
        fetch('/api/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                timestamp,
                logger: this.name,
                level: 'error',
                message,
                error: error ? error.stack : null
            })
        }).catch(err => console.error('Failed to send error log to server:', err));
    }
}

// Create separate loggers for different components
export const svgLogger = new Logger('SVG');
export const mapLogger = new Logger('Map');
export const dataLogger = new Logger('Data'); 