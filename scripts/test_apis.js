#!/usr/bin/env node

import fetch from 'node-fetch';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

const BASE_URL = 'http://localhost:3000';

class APITester {
    constructor() {
        this.passCount = 0;
        this.failCount = 0;
        this.tests = [];
    }

    async runTests() {
        console.log(chalk.cyan('\n🔍 Starting API Tests\n'));

        // Register all tests
        this.registerTests();

        // Run all tests
        for (const test of this.tests) {
            await this.runTest(test);
        }

        // Print summary
        this.printSummary();
    }

    registerTests() {
        // Stats API
        this.addTest('GET /api/stats', async () => {
            const response = await fetch(`${BASE_URL}/api/stats`);
            const data = await response.json();
            
            if (!response.ok) throw new Error('API returned error status');
            if (typeof data.total !== 'number') throw new Error('Total is not a number');
            if (data.total < 0) throw new Error('Total cannot be negative');
            
            return `Found ${data.total.toLocaleString()} elevation points`;
        });

        // Elevation Data API
        this.addTest('GET /api/elevation-data', async () => {
            const bounds = '31.33,-109.05,37.00,-103.00';
            const response = await fetch(`${BASE_URL}/api/elevation-data?bounds=${bounds}`);
            const data = await response.json();
            
            if (!response.ok) throw new Error('API returned error status');
            if (!Array.isArray(data.points)) throw new Error('Points is not an array');
            if (!data.stats) throw new Error('Missing stats object');
            
            return `Retrieved ${data.points.length} points within bounds`;
        });

        // IP Info API
        this.addTest('GET /api/ip-info', async () => {
            const response = await fetch(`${BASE_URL}/api/ip-info`);
            const data = await response.json();
            
            if (!response.ok) throw new Error('API returned error status');
            if (!data.serverTime) throw new Error('Missing server time');
            if (!data.message) throw new Error('Missing message');
            
            return `Server is accessible at ${data.serverTime}`;
        });

        // Santa Fe Elevation API
        this.addTest('GET /api/santa-fe-elevation', async () => {
            const params = new URLSearchParams({
                lat: '35.6870',
                lon: '-105.9378',
                radius: '5'
            });
            
            const response = await fetch(`${BASE_URL}/api/santa-fe-elevation?${params}`);
            const data = await response.json();
            
            if (!response.ok) throw new Error('API returned error status');
            if (!Array.isArray(data.points)) throw new Error('Points is not an array');
            if (!data.stats) throw new Error('Missing stats object');
            
            return `Retrieved ${data.points.length} points around Santa Fe`;
        });

        // Enhance Region API
        this.addTest('POST /api/enhance-region', async () => {
            const bounds = {
                minLat: 35.6870,
                maxLat: 35.7870,
                minLon: -105.9378,
                maxLon: -105.8378
            };
            
            const response = await fetch(`${BASE_URL}/api/enhance-region`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bounds)
            });
            
            const data = await response.json();
            
            if (!response.ok) throw new Error('API returned error status');
            if (data.status !== 'started') throw new Error('Enhancement not started');
            
            return 'Enhancement process started successfully';
        });

        // Collect Points API
        this.addTest('POST /api/collect-points', async () => {
            const body = {
                bounds: {
                    north: 35.7870,
                    south: 35.6870,
                    east: -105.8378,
                    west: -105.9378
                },
                zoom: 12
            };
            
            const response = await fetch(`${BASE_URL}/api/collect-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            
            if (!response.ok) throw new Error('API returned error status');
            if (!data.success) throw new Error('Collection failed');
            if (!Array.isArray(data.points)) throw new Error('Points is not an array');
            
            return `Collected ${data.points.length} points`;
        });
    }

    addTest(name, testFn) {
        this.tests.push({ name, testFn });
    }

    async runTest(test) {
        const startTime = performance.now();
        try {
            const result = await test.testFn();
            const duration = (performance.now() - startTime).toFixed(2);
            
            console.log(chalk.green('✓'), chalk.white(test.name));
            console.log(chalk.gray(`  ${result}`));
            console.log(chalk.gray(`  Completed in ${duration}ms\n`));
            
            this.passCount++;
        } catch (error) {
            const duration = (performance.now() - startTime).toFixed(2);
            
            console.log(chalk.red('✗'), chalk.white(test.name));
            console.log(chalk.red(`  Error: ${error.message}`));
            console.log(chalk.gray(`  Failed after ${duration}ms\n`));
            
            this.failCount++;
        }
    }

    printSummary() {
        const total = this.passCount + this.failCount;
        console.log(chalk.white.bold('\nTest Summary:'));
        console.log(chalk.green(`  Passed: ${this.passCount}`));
        console.log(chalk.red(`  Failed: ${this.failCount}`));
        console.log(chalk.white(`  Total:  ${total}`));
        
        if (this.failCount > 0) {
            console.log(chalk.yellow('\n⚠️  Some tests failed!\n'));
            process.exit(1);
        } else {
            console.log(chalk.green('\n✨ All tests passed!\n'));
            process.exit(0);
        }
    }
}

// Run tests
const tester = new APITester();
tester.runTests().catch(error => {
    console.error(chalk.red('\nTest runner error:'), error);
    process.exit(1);
}); 