import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { Octree } from 'three/addons/math/Octree.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import { setupScene, camera, renderer, stats } from './core/sceneSetup.js';
import { playerCollider, playerVelocity, playerDirection, keyStates, initPlayerControls, updatePlayer, teleportPlayerIfOob } from './core/player.js';
import { worldOctree, spheres, initSpheres, updateSpheres } from './physics/physics.js';
import { loadCollisionWorld } from './utils/loader.js';

const clock = new THREE.Clock();
const scene = setupScene(); // Get the scene from sceneSetup

const STEPS_PER_FRAME = 5;

// --- Initialization ---

initSpheres(scene); // Pass scene to sphere initialization
initPlayerControls(camera, playerCollider, playerDirection, spheres); // Pass necessary objects

// Load the world model and build Octree
loadCollisionWorld(scene, worldOctree, './assets/low_poly_industrial_zone.glb', renderer) // Pass renderer
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
        updatePlayer(deltaTime, worldOctree, keyStates, playerVelocity, playerCollider, camera, playerDirection); // Pass necessary state
        updateSpheres(deltaTime, worldOctree, spheres, playerCollider, playerVelocity); // Pass necessary state
        teleportPlayerIfOob(camera, playerCollider); // Pass necessary state
    }

    renderer.render(scene, camera);
    stats.update();
}

// --- Initial Setup ---
// Append renderer and stats to the container
const container = document.getElementById('container');
if (container) {
    container.appendChild(renderer.domElement);
    container.appendChild(stats.domElement);
} else {
    console.error("Container element 'container' not found.");
}
