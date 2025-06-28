#!/usr/bin/env node

import { ReactiveElevationQueue } from './reactive_elevation_queue.js';
import { UserDatabaseManager } from './user_adaptive_database_system.js';
import fs from 'fs';
import path from 'path';

class AdaptiveCollectionService {
    constructor() {
        this.queue = new ReactiveElevationQueue();
        this.dbManager = new UserDatabaseManager();
        this.statusFile = path.join(process.cwd(), 'service_status.json');
        this.startTime = Date.now();
    }

    async start() {
        console.log('🌟 Starting Adaptive Elevation Collection Service');
        console.log('================================================');
        console.log('This service will:');
        console.log('  📱 Monitor public API for GPS requests');
        console.log('  🗺️  Create user-specific databases with GPS boundaries');
        console.log('  🏔️  Collect elevation data using ridge detection');
        console.log('  📊 Fan out from user position: 10mi → 5mi → 1mi → 0.5mi');
        console.log('');

        // Update status file
        this.updateStatus('starting');

        // Start the reactive queue
        await this.queue.startMonitoring();
    }

    stop() {
        console.log('🛑 Stopping Adaptive Elevation Collection Service');
        this.queue.stopMonitoring();
        this.updateStatus('stopped');
    }

    updateStatus(status) {
        const statusData = {
            status,
            startTime: this.startTime,
            uptime: Date.now() - this.startTime,
            activeCollections: this.queue.getActiveCollectionStatus(),
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(this.statusFile, JSON.stringify(statusData, null, 2));
    }

    async getSystemStatus() {
        const activeCollections = this.queue.getActiveCollectionStatus();
        const userDatabases = this.dbManager.listAllUserDatabases();
        
        return {
            service: {
                status: 'running',
                uptime: Date.now() - this.startTime,
                startTime: new Date(this.startTime).toISOString()
            },
            collections: {
                active: activeCollections.length,
                details: activeCollections
            },
            databases: {
                total: userDatabases.length,
                totalPoints: userDatabases.reduce((sum, db) => sum + (db.pointCount || 0), 0),
                avgCompletion: userDatabases.length > 0 
                    ? userDatabases.reduce((sum, db) => sum + (db.completion || 0), 0) / userDatabases.length 
                    : 0
            }
        };
    }

    async generateReport() {
        const status = await this.getSystemStatus();
        const userDatabases = this.dbManager.listAllUserDatabases();
        
        console.log('\n📊 Adaptive Collection Service Report');
        console.log('=====================================');
        console.log(`Service Uptime: ${Math.floor(status.service.uptime / 60000)} minutes`);
        console.log(`Active Collections: ${status.collections.active}`);
        console.log(`Total User Databases: ${status.databases.total}`);
        console.log(`Total Points Collected: ${status.databases.totalPoints.toLocaleString()}`);
        console.log(`Average Database Completion: ${(status.databases.avgCompletion * 100).toFixed(1)}%`);
        
        if (status.collections.active > 0) {
            console.log('\n🔄 Active Collections:');
            status.collections.details.forEach(collection => {
                console.log(`  User: ${collection.userId.substring(0, 12)}...`);
                console.log(`    Status: ${collection.status}`);
                console.log(`    Zone: ${collection.currentZone}/${collection.totalZones}`);
                console.log(`    Points: ${collection.pointsCollected}, Anomalies: ${collection.anomaliesFound}`);
                console.log(`    Runtime: ${Math.floor(collection.runtime / 1000)}s`);
            });
        }

        if (userDatabases.length > 0) {
            console.log('\n🗄️ Recent User Databases:');
            userDatabases.slice(0, 5).forEach(db => {
                const user = db.metadata?.user_id?.substring(5, 17) || 'unknown';
                const radius = db.metadata?.radius_miles || '?';
                const completion = ((db.completion || 0) * 100).toFixed(1);
                console.log(`  ${user} - ${radius}mi radius - ${db.pointCount} points (${completion}%)`);
            });
        }

        return status;
    }
}

// CLI Commands
const command = process.argv[2];
const service = new AdaptiveCollectionService();

switch (command) {
    case 'start':
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Received shutdown signal...');
            service.stop();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Received termination signal...');
            service.stop();
            process.exit(0);
        });

        service.start().catch(error => {
            console.error('❌ Service failed to start:', error);
            process.exit(1);
        });
        break;

    case 'status':
        service.generateReport().then(() => {
            process.exit(0);
        }).catch(error => {
            console.error('❌ Error generating report:', error);
            process.exit(1);
        });
        break;

    case 'databases':
        const dbManager = new UserDatabaseManager();
        const allDbs = dbManager.listAllUserDatabases();
        
        console.log('🗄️ All User Databases');
        console.log('=====================');
        
        if (allDbs.length === 0) {
            console.log('No user databases found.');
        } else {
            allDbs.forEach(db => {
                const user = db.metadata?.user_id || 'unknown';
                const session = db.metadata?.session_id || 'unknown';
                const radius = db.metadata?.radius_miles || '?';
                const completion = ((db.completion || 0) * 100).toFixed(1);
                
                console.log(`📁 ${db.file}`);
                console.log(`   User: ${user}`);
                console.log(`   Session: ${session}`);
                console.log(`   Center: (${db.metadata?.center_lat}, ${db.metadata?.center_lon})`);
                console.log(`   Radius: ${radius} miles`);
                console.log(`   Points: ${db.pointCount}/${db.maxPoints} (${completion}%)`);
                console.log(`   Created: ${db.metadata?.created_at}`);
                console.log('');
            });
        }
        process.exit(0);
        break;

    case 'test':
        console.log('🧪 Testing Adaptive Collection System');
        console.log('=====================================');
        
        // Test database manager
        const testDbManager = new UserDatabaseManager();
        const testUserId = 'test_user_123';
        const testSessionId = 'test_session_456';
        const testLat = 35.0844; // Albuquerque
        const testLon = -106.6504;
        
        console.log('\n📍 Testing database creation for multiple radii...');
        for (const radius of [10, 5, 1]) {
            const dbInfo = testDbManager.getUserDatabase(testUserId, testSessionId, testLat, testLon, radius);
            console.log(`✅ Created: ${dbInfo.dbName} (${dbInfo.isNew ? 'new' : 'existing'})`);
            dbInfo.db.close();
        }
        
        console.log('\n📊 Testing database listing...');
        const testUserDbs = testDbManager.getUserDatabases(testUserId);
        testUserDbs.forEach(db => {
            console.log(`   ${db.file} - Radius: ${db.radiusMiles}mi`);
        });
        
        console.log('\n✅ Test completed successfully!');
        process.exit(0);
        break;

    default:
        console.log('🌟 Adaptive Elevation Collection Service');
        console.log('========================================');
        console.log('');
        console.log('Commands:');
        console.log('  start      - Start the reactive collection service');
        console.log('  status     - Show current service status and report');
        console.log('  databases  - List all user databases');
        console.log('  test       - Test the system components');
        console.log('');
        console.log('Examples:');
        console.log('  node adaptive_collection_service.js start');
        console.log('  node adaptive_collection_service.js status');
        console.log('  node adaptive_collection_service.js databases');
        console.log('');
        process.exit(0);
}
