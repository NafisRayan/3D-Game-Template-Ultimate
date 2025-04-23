import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GRAVITY } from '../physics/physics.js'; // Import GRAVITY

// --- Player State ---
const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = false;
let mouseTime = 0;
const keyStates = {};

// Temporary vectors for calculations
const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

let _camera, _playerCollider, _playerDirection, _spheres; // Local references set during init
let sphereIdx = 0; // Keep track of which sphere to throw next

// --- Input Handling ---
function initPlayerControls(camera, collider, direction, spheres) {
    _camera = camera;
    _playerCollider = collider;
    _playerDirection = direction;
    _spheres = spheres; // Store reference to spheres array

    document.addEventListener('keydown', (event) => {
        keyStates[event.code] = true;
    });

    document.addEventListener('keyup', (event) => {
        keyStates[event.code] = false;
    });

    document.getElementById('container').addEventListener('mousedown', () => {
        document.body.requestPointerLock();
        mouseTime = performance.now();
    });

    document.addEventListener('mouseup', () => {
        if (document.pointerLockElement !== null) throwBall();
    });

    document.body.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement === document.body) {
            _camera.rotation.y -= event.movementX / 500;
            _camera.rotation.x -= event.movementY / 500;
            // Clamp vertical rotation to prevent flipping
             _camera.rotation.x = Math.max( - Math.PI / 2, Math.min( Math.PI / 2, _camera.rotation.x ) );
        }
    });
}

// --- Ball Throwing ---
function throwBall() {
    if (!_spheres || _spheres.length === 0) return; // Guard against no spheres

    const sphere = _spheres[sphereIdx];

    _camera.getWorldDirection(_playerDirection);

    sphere.collider.center.copy(_playerCollider.end).addScaledVector(_playerDirection, _playerCollider.radius * 1.5);

    // throw the ball with more force if we hold the button longer, and if we move forward
    const impulse = 15 + 30 * (1 - Math.exp((mouseTime - performance.now()) * 0.001));

    sphere.velocity.copy(_playerDirection).multiplyScalar(impulse);
    sphere.velocity.addScaledVector(playerVelocity, 2); // Add player's velocity

    sphereIdx = (sphereIdx + 1) % _spheres.length;
}


// --- Player Movement & Collision ---

function playerCollisions(worldOctree) {
    const result = worldOctree.capsuleIntersect(_playerCollider);
    playerOnFloor = false;

    if (result) {
        playerOnFloor = result.normal.y > 0;

        if (!playerOnFloor) {
            // Keep player velocity parallel to the slope
            playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
        }

        // Prevent penetration
        if (result.depth >= 1e-10) { // Use a small epsilon
             _playerCollider.translate(result.normal.multiplyScalar(result.depth));
        }
    }
}

function updatePlayer(deltaTime, worldOctree) {
    let damping = Math.exp(-4 * deltaTime) - 1;

    if (!playerOnFloor) {
        playerVelocity.y -= GRAVITY * deltaTime;
        // Small air resistance
        damping *= 0.1;
    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    // Apply controls based on key states
    controls(deltaTime);

    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
    _playerCollider.translate(deltaPosition);

    playerCollisions(worldOctree); // Check collisions against the world

    // Update camera position to match player collider
    _camera.position.copy(_playerCollider.end);
}

function getForwardVector() {
    _camera.getWorldDirection(_playerDirection);
    _playerDirection.y = 0;
    _playerDirection.normalize();
    return _playerDirection;
}

function getSideVector() {
    _camera.getWorldDirection(_playerDirection);
    _playerDirection.y = 0;
    _playerDirection.normalize();
    _playerDirection.cross(_camera.up);
    return _playerDirection;
}

function controls(deltaTime) {
    // Gives a bit of air control
    const speedDelta = deltaTime * (playerOnFloor ? 25 : 8);

    if (keyStates['KeyW']) {
        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    }
    if (keyStates['KeyS']) {
        playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
    }
    if (keyStates['KeyA']) {
        playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
    }
    if (keyStates['KeyD']) {
        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
    }
    if (playerOnFloor) {
        if (keyStates['Space']) {
            playerVelocity.y = 15; // Jump impulse
        }
    }
}

// --- Teleport ---
function teleportPlayerIfOob() {
    if (_camera.position.y <= -25) {
        console.log("Player fell out of bounds, teleporting...");
        _playerCollider.start.set(0, 0.35, 0);
        _playerCollider.end.set(0, 1, 0);
        _playerCollider.radius = 0.35;
        _camera.position.copy(_playerCollider.end);
        _camera.rotation.set(0, 0, 0);
        playerVelocity.set(0, 0, 0); // Reset velocity
    }
}

// --- Export ---
export {
    playerCollider,
    playerVelocity,
    playerDirection,
    keyStates,
    initPlayerControls,
    updatePlayer,
    teleportPlayerIfOob
};
