// Frontend Diagnostic Tool
// Run this in browser console to debug the frontend

async function diagnoseFrontend() {
    console.log('🔍 Starting Frontend Diagnostic...');
    
    // Test 1: Check if DOM elements exist
    console.log('\n1. Checking DOM elements...');
    const jsVersionEl = document.getElementById('js-version');
    const nodeVersionEl = document.getElementById('node-version');
    
    console.log('js-version element:', jsVersionEl);
    console.log('node-version element:', nodeVersionEl);
    
    if (!jsVersionEl || !nodeVersionEl) {
        console.error('❌ Missing DOM elements!');
        return;
    }
    
    // Test 2: Check current content
    console.log('\n2. Current element content...');
    console.log('js-version text:', jsVersionEl.textContent);
    console.log('node-version text:', nodeVersionEl.textContent);
    
    // Test 3: Test API directly
    console.log('\n3. Testing API call...');
    try {
        const response = await fetch('./api/version');
        console.log('API response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('API response data:', data);
            
            // Test 4: Manual version update
            console.log('\n4. Manually updating version display...');
            jsVersionEl.textContent = '3.2.0';
            nodeVersionEl.textContent = data.node_version || data.version || 'Unknown';
            
            console.log('✅ Manual update successful!');
            console.log('js-version now shows:', jsVersionEl.textContent);
            console.log('node-version now shows:', nodeVersionEl.textContent);
        } else {
            console.error('❌ API call failed:', response.status);
        }
    } catch (error) {
        console.error('❌ API error:', error);
    }
    
    // Test 5: Check if GPSLiveTracker class exists
    console.log('\n5. Checking GPSLiveTracker...');
    if (typeof GPSLiveTracker !== 'undefined') {
        console.log('✅ GPSLiveTracker class found');
        
        // Check if instance exists
        if (window.gpsTracker) {
            console.log('✅ GPS tracker instance found');
            console.log('Tracker state:', {
                userId: window.gpsTracker.userId,
                sessionId: window.gpsTracker.sessionId,
                tracking: window.gpsTracker.tracking
            });
        } else {
            console.log('❌ No GPS tracker instance found');
        }
    } else {
        console.error('❌ GPSLiveTracker class not found!');
    }
    
    console.log('\n🎯 Diagnostic complete!');
}

// Auto-run diagnostic
diagnoseFrontend(); 