import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { Octree } from 'three/addons/math/Octree.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { setupScene, camera, renderer, stats } from './core/sceneSetup.js';
import { playerCollider, playerVelocity, playerDirection, keyStates, initPlayerControls, updatePlayer, teleportPlayerIfOob } from './core/player.js';
import { worldOctree, spheres, initSpheres, updateSpheres } from './physics/physics.js';
import { loadCollisionWorld, visibilitySettings } from './utils/loader.js';

const clock = new THREE.Clock();
const scene = setupScene(); // Get the scene from sceneSetup

const STEPS_PER_FRAME = 5;

// --- Initialization ---

initSpheres(scene); // Pass scene to sphere initialization
initPlayerControls(scene, camera, playerCollider, playerDirection, spheres);

// Helper function to save settings to localStorage
function saveSettings() {
    try {
        localStorage.setItem('visibilitySettings', JSON.stringify(visibilitySettings));
        console.log('Saved visibility settings to localStorage');
    } catch (error) {
        console.warn('Failed to save settings to localStorage:', error);
    }
}

// Load saved visibility settings from localStorage if available
try {
    const savedSettings = localStorage.getItem('visibilitySettings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // Only apply saved settings that exist in our visibilitySettings object
        Object.keys(parsedSettings).forEach(key => {
            if (key in visibilitySettings) {
                visibilitySettings[key] = parsedSettings[key];
            }
        });
        console.log('Loaded visibility settings from localStorage');
    }
} catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
}

// Set initial camera far plane from visibility settings
camera.far = visibilitySettings.cameraFar;
camera.updateProjectionMatrix();

// Load the world model and build Octree
loadCollisionWorld(scene, worldOctree, './assets/low_poly_industrial_zone.glb', renderer, camera) // Pass renderer and camera
    .then(() => {
        console.log('Collision world loaded and Octree built.');
        // Start animation loop only after the world is loaded
        renderer.setAnimationLoop(animate);
    })
    .catch(error => {
        console.error('Error loading collision world:', error);
    });


// --- Event Listeners ---

window.addEventListener('resize', onWindowResize);

// Add keyboard shortcuts for visibility toggles
window.addEventListener('keydown', (event) => {
    if (event.key === 'g' || event.key === 'G') {
        visibilitySettings.showGUI = !visibilitySettings.showGUI;
        visibilitySettings.showUI = visibilitySettings.showGUI;

        const uiWrapper = document.getElementById('ui-wrapper');
        if (uiWrapper) {
            uiWrapper.style.opacity = visibilitySettings.showUI ? '1' : '0';
            uiWrapper.style.pointerEvents = visibilitySettings.showUI ? 'auto' : 'none';
        }

        saveSettings();

        window.dispatchEvent(new CustomEvent('gui-visibility-toggle', {
            detail: { showGUI: visibilitySettings.showGUI }
        }));
    }
});

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Animation Loop ---

function animate() {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        // Player controls are handled internally by player.js via event listeners
        updatePlayer(deltaTime, worldOctree);
        updateSpheres(deltaTime, worldOctree, spheres, playerCollider, playerVelocity); // Pass necessary state
        teleportPlayerIfOob(camera, playerCollider); // Pass necessary state
    }

    renderer.render(scene, camera);
    stats.update();
}

// --- Initial Setup ---
// Append renderer to the container
const container = document.getElementById('container');
if (container) {
    container.appendChild(renderer.domElement);
} else {
    console.error("Container element 'container' not found.");
}

// Append stats to the stats container
const statsContainer = document.getElementById('stats-container');
if (statsContainer) {
    statsContainer.appendChild(stats.domElement);
} else {
    console.error("Stats container element 'stats-container' not found.");
}

// Set UI wrapper visibility based on settings
const uiWrapper = document.getElementById('ui-wrapper');
if (uiWrapper) {
    // Add showUI property to visibilitySettings if it doesn't exist
    if (typeof visibilitySettings.showUI === 'undefined') {
        visibilitySettings.showUI = true; // Default to visible
    }

    // Apply the visibility setting
    uiWrapper.style.opacity = visibilitySettings.showUI ? '1' : '0';
    uiWrapper.style.pointerEvents = visibilitySettings.showUI ? 'auto' : 'none';
} else {
    console.error("UI wrapper element 'ui-wrapper' not found.");
}
