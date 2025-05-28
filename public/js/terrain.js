import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let terrain, terrainGeometry;
let colorMode = 'elevation';
let verticalScale = 2;
let terrainData = null;

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 5);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Add controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Add event listeners for controls
    document.getElementById('verticalScale').addEventListener('input', (e) => {
        verticalScale = parseFloat(e.target.value);
        if (terrainData) updateTerrain();
    });

    document.getElementById('colorMode').addEventListener('change', (e) => {
        colorMode = e.target.value;
        if (terrainData) updateTerrainColors();
    });
}

// Create terrain mesh
function createTerrain(points, minElev, maxElev) {
    const width = 100;  // Number of vertices on X axis
    const height = 100; // Number of vertices on Y axis
    
    // Create a regular grid of points
    terrainGeometry = new THREE.PlaneGeometry(10, 10, width - 1, height - 1);
    
    // Calculate grid positions for interpolation
    const latitudes = points.map(p => p.latitude);
    const longitudes = points.map(p => p.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    
    // Update vertex positions and create color array
    const positions = terrainGeometry.attributes.position.array;
    const colors = new Float32Array(positions.length);
    
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        
        // Convert local coordinates to lat/lon
        const lon = minLon + (x + 5) * (maxLon - minLon) / 10;
        const lat = minLat + (y + 5) * (maxLat - minLat) / 10;
        
        // Find nearest points and interpolate elevation
        let elevation = 0;
        let totalWeight = 0;
        
        for (const point of points) {
            const distance = Math.sqrt(
                Math.pow(lon - point.longitude, 2) + 
                Math.pow(lat - point.latitude, 2)
            );
            
            if (distance < 0.01) {  // Only use nearby points
                const weight = 1 / (distance + 0.0001);
                elevation += point.elevation * weight;
                totalWeight += weight;
            }
        }
        
        elevation = totalWeight > 0 ? elevation / totalWeight : minElev;
        
        // Update vertex position
        positions[i + 2] = (elevation - minElev) / (maxElev - minElev) * verticalScale;
        
        // Set color based on elevation
        const color = new THREE.Color();
        color.setHSL(
            0.7 * (1 - (elevation - minElev) / (maxElev - minElev)),
            1,
            0.5
        );
        
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
    }
    
    terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Create mesh
    const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        flatShading: true,
        side: THREE.DoubleSide
    });
    
    terrain = new THREE.Mesh(terrainGeometry, material);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);
    
    // Update info
    document.getElementById('info').innerHTML = `
        Terrain loaded:<br>
        - ${points.length} data points<br>
        - Elevation range: ${minElev.toFixed(1)}m to ${maxElev.toFixed(1)}m<br>
        - Area: ~${((maxLat - minLat) * (maxLon - minLon) * 111).toFixed(1)}km²
    `;
}

// Update terrain colors based on selected mode
function updateTerrainColors() {
    if (!terrain || !terrainData) return;
    
    const colors = terrainGeometry.attributes.color.array;
    const positions = terrainGeometry.attributes.position.array;
    
    for (let i = 0; i < positions.length; i += 3) {
        const elevation = positions[i + 2];
        const color = new THREE.Color();
        
        switch (colorMode) {
            case 'elevation':
                color.setHSL(0.7 * (1 - elevation / verticalScale), 1, 0.5);
                break;
            case 'slope':
                const slope = Math.atan2(
                    positions[i + 2] - (positions[i - 1] || 0),
                    0.1
                ) / (Math.PI / 2);
                color.setHSL(0.3 * (1 - slope), 1, 0.5);
                break;
            case 'features':
                // Find nearest feature
                const feature = terrainData.features.find(f => 
                    Math.abs(positions[i] - f.longitude) < 0.01 &&
                    Math.abs(positions[i + 1] - f.latitude) < 0.01
                );
                
                if (feature) {
                    switch (feature.feature_type) {
                        case 'peak':
                            color.setRGB(1, 0, 0);
                            break;
                        case 'valley':
                            color.setRGB(0, 0, 1);
                            break;
                        default:
                            color.setRGB(0, 1, 0);
                    }
                } else {
                    color.setHSL(0.7 * (1 - elevation / verticalScale), 0.3, 0.5);
                }
                break;
        }
        
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
    }
    
    terrainGeometry.attributes.color.needsUpdate = true;
}

// Update terrain geometry
function updateTerrain() {
    if (!terrain || !terrainData) return;
    
    const positions = terrainGeometry.attributes.position.array;
    const { min_elev, max_elev } = terrainData.stats;
    
    for (let i = 0; i < positions.length; i += 3) {
        const normalizedElevation = positions[i + 2] / verticalScale;
        positions[i + 2] = normalizedElevation * verticalScale;
    }
    
    terrainGeometry.attributes.position.needsUpdate = true;
    updateTerrainColors();
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Load terrain data and start visualization
async function loadAndVisualize() {
    try {
        const response = await fetch('/api/terrain-data');
        terrainData = await response.json();
        
        createTerrain(
            terrainData.points,
            terrainData.stats.min_elev,
            terrainData.stats.max_elev
        );
        
    } catch (error) {
        console.error('Failed to load terrain data:', error);
        document.getElementById('info').innerHTML = 'Error loading terrain data';
    }
}

// Start everything
init();
loadAndVisualize();
animate(); 