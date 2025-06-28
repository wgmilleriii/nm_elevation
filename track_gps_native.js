import SerialPort from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class NativeGPSTracker {
    constructor() {
        this.db = new sqlite3.Database(join(__dirname, 'grid_databases/user_tracking.db'));
        this.port = null;
        this.parser = null;
    }

    async findGPSDevice() {
        const ports = await SerialPort.list();
        console.log('Available serial ports:');
        ports.forEach(port => {
            console.log(`${port.path} - ${port.manufacturer || 'Unknown manufacturer'}`);
        });
        
        // Try to identify GPS device (common USB GPS vendors)
        const gpsPort = ports.find(port => 
            port.manufacturer?.toLowerCase().includes('u-blox') ||
            port.manufacturer?.toLowerCase().includes('garmin') ||
            port.manufacturer?.toLowerCase().includes('gps')
        );

        return gpsPort?.path;
    }

    async start() {
        try {
            const portPath = await this.findGPSDevice();
            if (!portPath) {
                console.error('No GPS device found. Please connect a GPS device and try again.');
                console.log('Tips:');
                console.log('1. Connect a USB GPS device');
                console.log('2. Check device manager for COM port');
                console.log('3. Run this script again');
                return;
            }

            console.log(`Connecting to GPS device on ${portPath}...`);
            
            this.port = new SerialPort({
                path: portPath,
                baudRate: 9600
            });

            this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

            this.port.on('open', () => {
                console.log('GPS connection established');
                console.log('Waiting for GPS fix...');
            });

            this.parser.on('data', (data) => {
                if (data.startsWith('$GPGGA')) {
                    this.handleGPSData(this.parseGPGGA(data));
                }
            });

            this.port.on('error', (err) => {
                console.error('GPS device error:', err.message);
            });

        } catch (error) {
            console.error('Failed to start GPS tracking:', error);
        }
    }

    parseGPGGA(data) {
        // $GPGGA,time,latitude,N/S,longitude,E/W,quality,satellites,hdop,altitude,M,geoidheight,M,dgpsupdate,checksum
        const parts = data.split(',');
        if (parts.length < 14) return null;

        const lat = this.convertGPSCoord(parts[2], parts[3]);
        const lon = this.convertGPSCoord(parts[4], parts[5]);
        
        return {
            timestamp: new Date(),
            latitude: lat,
            longitude: lon,
            quality: parseInt(parts[6]),
            satellites: parseInt(parts[7]),
            hdop: parseFloat(parts[8]),
            altitude: parseFloat(parts[9]),
            accuracy: parseFloat(parts[8]) * 5 // Approximate accuracy from HDOP
        };
    }

    convertGPSCoord(coord, dir) {
        if (!coord) return null;
        const degrees = parseInt(coord.substring(0, 2));
        const minutes = parseFloat(coord.substring(2));
        let decimal = degrees + (minutes / 60);
        if (dir === 'S' || dir === 'W') decimal *= -1;
        return decimal;
    }

    async handleGPSData(data) {
        if (!data) return;

        console.clear();
        console.log('=== Native GPS Tracker ===');
        console.log(`Position: ${data.latitude.toFixed(6)}°, ${data.longitude.toFixed(6)}°`);
        console.log(`Altitude: ${data.altitude}m`);
        console.log(`Accuracy: ${data.accuracy}m`);
        console.log(`Satellites: ${data.satellites}`);
        console.log(`Quality: ${this.getQualityDescription(data.quality)}`);
        console.log(`Last Update: ${data.timestamp.toLocaleTimeString()}`);
        console.log('\nPress Ctrl+C to exit');

        // Save to database
        await this.savePoint(data);
    }

    getQualityDescription(quality) {
        const qualities = {
            0: 'No fix',
            1: 'GPS fix',
            2: 'DGPS fix',
            3: 'PPS fix',
            4: 'Real Time Kinematic',
            5: 'Float RTK',
            6: 'Estimated',
            7: 'Manual input',
            8: 'Simulation'
        };
        return qualities[quality] || 'Unknown';
    }

    async savePoint(data) {
        const stmt = this.db.prepare(`
            INSERT INTO user_track_points (
                latitude, longitude, elevation, accuracy, timestamp
            ) VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
            data.latitude,
            data.longitude,
            data.altitude,
            data.accuracy,
            data.timestamp.toISOString()
        );
    }

    stop() {
        if (this.port) {
            this.port.close();
        }
        this.db.close();
    }
}

// Start tracking
const tracker = new NativeGPSTracker();
tracker.start();

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\nStopping GPS tracker...');
    tracker.stop();
    process.exit();
}); 