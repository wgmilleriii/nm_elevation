#!/usr/bin/env node

// Client-Side JavaScript Validation Script
const fs = require('fs');
const path = require('path');

console.log('🔍 GPS Elevation System - Client-Side Validation');
console.log('================================================');

const elevationDir = './elevation';
const errors = [];
const warnings = [];

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(color, symbol, message) {
    console.log(`${colors[color]}${symbol} ${message}${colors.reset}`);
}

function logSuccess(message) { log('green', '✅', message); }
function logError(message) { log('red', '❌', message); errors.push(message); }
function logWarning(message) { log('yellow', '⚠️ ', message); warnings.push(message); }
function logInfo(message) { log('blue', 'ℹ️ ', message); }

// Check if elevation directory exists
if (!fs.existsSync(elevationDir)) {
    logError('Elevation directory not found!');
    process.exit(1);
}

console.log('\n🔍 Validating File Structure...');
console.log('================================');

// Required files and directories
const requiredFiles = [
    'index.php',
    '.htaccess',
    'home.html',
    'gps_live.html',
    'gps_tracker.html',
    'css/gps_live.css',
    'css/gps_tracker.css',
    'js/gps_live.js',
    'js/gps_tracker.js',
    'js/config.js',
    'js/modules/config.js',
    'js/modules/elevation.js',
    'js/algorithms/CollectionAlgorithm.js',
    'js/utils/elevationData.js',
    'docs/MOBILE_GUIDE.md',
    'docs/API_DOCUMENTATION.md'
];

requiredFiles.forEach(file => {
    const filePath = path.join(elevationDir, file);
    if (fs.existsSync(filePath)) {
        logSuccess(`Found: ${file}`);
    } else {
        logError(`Missing: ${file}`);
    }
});

console.log('\n📝 Validating HTML Files...');
console.log('============================');

// Check HTML files for proper structure
const htmlFiles = ['home.html', 'gps_live.html', 'gps_tracker.html'];

htmlFiles.forEach(htmlFile => {
    const filePath = path.join(elevationDir, htmlFile);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        logInfo(`Checking ${htmlFile}...`);
        
        // Check for proper HTML structure
        if (content.includes('<!DOCTYPE html>')) {
            logSuccess(`  DOCTYPE declaration found`);
        } else {
            logWarning(`  Missing DOCTYPE declaration`);
        }
        
        // Check for CSS references
        const cssMatches = content.match(/href="css\/[^"]+\.css"/g);
        if (cssMatches) {
            logSuccess(`  CSS references found: ${cssMatches.length}`);
            cssMatches.forEach(match => {
                const cssFile = match.match(/css\/([^"]+\.css)/)[1];
                const cssPath = path.join(elevationDir, 'css', cssFile);
                if (fs.existsSync(cssPath)) {
                    logSuccess(`    ✓ ${cssFile} exists`);
                } else {
                    logError(`    ✗ ${cssFile} missing`);
                }
            });
        }
        
        // Check for JS references
        const jsMatches = content.match(/src="js\/[^"]+\.js"/g);
        if (jsMatches) {
            logSuccess(`  JavaScript references found: ${jsMatches.length}`);
            jsMatches.forEach(match => {
                const jsFile = match.match(/js\/([^"]+\.js)/)[1];
                const jsPath = path.join(elevationDir, 'js', jsFile);
                if (fs.existsSync(jsPath)) {
                    logSuccess(`    ✓ ${jsFile} exists`);
                } else {
                    logError(`    ✗ ${jsFile} missing`);
                }
            });
        }
        
        // Check for viewport meta tag (mobile responsiveness)
        if (content.includes('name="viewport"')) {
            logSuccess(`  Mobile viewport meta tag found`);
        } else {
            logWarning(`  Missing mobile viewport meta tag`);
        }
    }
});

console.log('\n🎨 Validating CSS Files...');
console.log('===========================');

// Check CSS files
const cssDir = path.join(elevationDir, 'css');
if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(file => file.endsWith('.css'));
    
    cssFiles.forEach(cssFile => {
        const filePath = path.join(cssDir, cssFile);
        const content = fs.readFileSync(filePath, 'utf8');
        
        logInfo(`Checking ${cssFile}...`);
        
        // Check file size
        const sizeKB = Math.round(content.length / 1024);
        if (sizeKB > 100) {
            logWarning(`  Large CSS file: ${sizeKB}KB`);
        } else {
            logSuccess(`  File size: ${sizeKB}KB`);
        }
        
        // Check for common CSS patterns
        if (content.includes('@media')) {
            logSuccess(`  Media queries found (responsive design)`);
        }
        
        if (content.includes('flexbox') || content.includes('display: flex') || content.includes('grid')) {
            logSuccess(`  Modern layout methods found`);
        }
    });
}

console.log('\n📜 Validating JavaScript Files...');
console.log('==================================');

// Check main JavaScript files
const jsMainFiles = ['gps_live.js', 'gps_tracker.js', 'config.js'];

jsMainFiles.forEach(jsFile => {
    const filePath = path.join(elevationDir, 'js', jsFile);
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        logInfo(`Checking ${jsFile}...`);
        
        // Check file size
        const sizeKB = Math.round(content.length / 1024);
        logSuccess(`  File size: ${sizeKB}KB`);
        
        // Check for ES6+ features
        if (content.includes('class ') || content.includes('const ') || content.includes('let ')) {
            logSuccess(`  Modern JavaScript syntax found`);
        }
        
        // Check for API calls
        if (content.includes('fetch(') || content.includes('XMLHttpRequest')) {
            logSuccess(`  API calls found`);
        }
        
        // Check for error handling
        if (content.includes('try {') || content.includes('catch')) {
            logSuccess(`  Error handling found`);
        } else {
            logWarning(`  No error handling detected`);
        }
        
        // Check for console.log (should be minimal in production)
        const consoleLogCount = (content.match(/console\.log/g) || []).length;
        if (consoleLogCount > 5) {
            logWarning(`  Many console.log statements: ${consoleLogCount}`);
        }
    }
});

console.log('\n🔧 Validating JavaScript Modules...');
console.log('====================================');

// Check JavaScript modules
const jsModulesDir = path.join(elevationDir, 'js', 'modules');
if (fs.existsSync(jsModulesDir)) {
    const moduleFiles = fs.readdirSync(jsModulesDir).filter(file => file.endsWith('.js'));
    
    moduleFiles.forEach(moduleFile => {
        const filePath = path.join(jsModulesDir, moduleFile);
        const content = fs.readFileSync(filePath, 'utf8');
        
        logInfo(`Checking module: ${moduleFile}...`);
        
        // Check for proper ES6 module syntax
        if (content.includes('export ') || content.includes('export default')) {
            logSuccess(`  ES6 exports found`);
        } else {
            logWarning(`  No ES6 exports detected`);
        }
        
        if (content.includes('import ')) {
            logSuccess(`  ES6 imports found`);
        }
    });
}

console.log('\n🗂️  Validating Configuration Files...');
console.log('=====================================');

// Check .htaccess
const htaccessPath = path.join(elevationDir, '.htaccess');
if (fs.existsSync(htaccessPath)) {
    const content = fs.readFileSync(htaccessPath, 'utf8');
    
    logInfo('Checking .htaccess...');
    
    if (content.includes('RewriteEngine On')) {
        logSuccess('  URL rewriting enabled');
    } else {
        logError('  URL rewriting not enabled');
    }
    
    if (content.includes('api/')) {
        logSuccess('  API routing rules found');
    } else {
        logWarning('  No API routing rules detected');
    }
}

// Check PHP server file
const phpServerPath = path.join(elevationDir, 'index.php');
if (fs.existsSync(phpServerPath)) {
    const content = fs.readFileSync(phpServerPath, 'utf8');
    
    logInfo('Checking index.php...');
    
    if (content.includes('<?php')) {
        logSuccess('  Valid PHP file');
    } else {
        logError('  Not a valid PHP file');
    }
    
    if (content.includes('CORS')) {
        logSuccess('  CORS headers configured');
    } else {
        logWarning('  CORS headers not detected');
    }
    
    if (content.includes('json_encode')) {
        logSuccess('  JSON responses configured');
    }
}

console.log('\n📊 Validation Summary');
console.log('====================');

if (errors.length === 0 && warnings.length === 0) {
    logSuccess('All validations passed! ✨');
} else {
    if (errors.length > 0) {
        console.log(`\n${colors.red}❌ Errors found: ${errors.length}${colors.reset}`);
        errors.forEach(error => console.log(`   • ${error}`));
    }
    
    if (warnings.length > 0) {
        console.log(`\n${colors.yellow}⚠️  Warnings: ${warnings.length}${colors.reset}`);
        warnings.forEach(warning => console.log(`   • ${warning}`));
    }
}

console.log('\n🚀 Pre-deployment Checklist:');
console.log('============================');
console.log('• ✅ File structure validated');
console.log('• ✅ HTML files checked');
console.log('• ✅ CSS files validated');
console.log('• ✅ JavaScript files analyzed');
console.log('• ✅ Configuration files verified');
console.log('\n📝 Next Steps:');
console.log('1. Run local PHP server test: ./test_local_server.sh');
console.log('2. Test in browser at http://localhost:8080');
console.log('3. Check browser console for JavaScript errors');
console.log('4. Test GPS functionality');
console.log('5. Deploy to remote server');

process.exit(errors.length > 0 ? 1 : 0); 