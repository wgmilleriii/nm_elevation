import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function scanNetwork() {
    console.log('Scanning network for Raspberry Pi...');
    
    // Scan common Pi hostnames
    const hostnames = [
        'raspberrypi.local',
        'pi1.local',
        'pi2.local',
        'raspberrypi-1.local',
        'raspberrypi-2.local'
    ];

    for (const hostname of hostnames) {
        try {
            const { stdout } = await execAsync(`ping -n 1 ${hostname}`);
            if (stdout.includes('TTL=')) {
                console.log(`\nFound Raspberry Pi at: ${hostname}`);
                console.log('Response:', stdout);
            }
        } catch (error) {
            // Ignore errors, just means this hostname wasn't found
        }
    }

    // Scan IP range
    console.log('\nScanning IP range 10.0.0.1-254...');
    for (let i = 1; i <= 254; i++) {
        const ip = `10.0.0.${i}`;
        try {
            const { stdout } = await execAsync(`ping -n 1 -w 100 ${ip}`);
            if (stdout.includes('TTL=')) {
                console.log(`\nFound device at: ${ip}`);
                // Try to get hostname
                try {
                    const { stdout: hostname } = await execAsync(`nslookup ${ip}`);
                    console.log('Hostname info:', hostname);
                } catch (error) {
                    // Ignore hostname lookup errors
                }
            }
        } catch (error) {
            // Ignore errors, just means this IP didn't respond
        }
    }
}

scanNetwork().catch(console.error); 