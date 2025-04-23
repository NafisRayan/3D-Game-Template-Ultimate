import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
// Capsule is needed for playerSphereCollision, but playerCollider is passed in
// import { Capsule } from 'three/addons/math/Capsule.js';

// --- Constants ---
export const GRAVITY = 30;
const NUM_SPHERES = 100;
const SPHERE_RADIUS = 0.2;

// --- Physics World ---
const worldOctree = new Octree();
const spheres = [];

// --- Sphere Setup ---
const sphereGeometry = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 5);
const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xdede8d });

function initSpheres(scene) {
    for (let i = 0; i < NUM_SPHERES; i++) {
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        scene.add(sphere);

        spheres.push({
            mesh: sphere,
            collider: new THREE.Sphere(new THREE.Vector3(0, -100, 0), SPHERE_RADIUS), // Start offscreen
            velocity: new THREE.Vector3()
        });
    }
}

// --- Collision Helpers ---
const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();

// --- Collision Logic ---

function playerSphereCollision(sphere, playerCollider, playerVelocity) {
    // Check if playerCollider is valid before proceeding
    if (!playerCollider) return;

    const center = vector1.addVectors(playerCollider.start, playerCollider.end).multiplyScalar(0.5);
    const sphere_center = sphere.collider.center;
    const r = playerCollider.radius + sphere.collider.radius;
    const r2 = r * r;

    // Approximation: player = 3 spheres (start, end, center)
    for (const point of [playerCollider.start, playerCollider.end, center]) {
        const d2 = point.distanceToSquared(sphere_center);

        if (d2 < r2) {
            const normal = vector1.subVectors(point, sphere_center).normalize();
            const v1 = vector2.copy(normal).multiplyScalar(normal.dot(playerVelocity));
            const v2 = vector3.copy(normal).multiplyScalar(normal.dot(sphere.velocity));

            // Reflect velocities
            playerVelocity.add(v2).sub(v1);
            sphere.velocity.add(v1).sub(v2);

            // Separate the objects slightly
            const d = (r - Math.sqrt(d2)) / 2;
            sphere_center.addScaledVector(normal, -d); // Move sphere away
            // Note: Player position is updated in its own loop, avoid double correction
        }
    }
}


function spheresCollisions() {
    for (let i = 0, length = spheres.length; i < length; i++) {
        const s1 = spheres[i];
        for (let j = i + 1; j < length; j++) {
            const s2 = spheres[j];

            const d2 = s1.collider.center.distanceToSquared(s2.collider.center);
            const r = s1.collider.radius + s2.collider.radius;
            const r2 = r * r;

            if (d2 < r2) {
                const normal = vector1.subVectors(s1.collider.center, s2.collider.center).normalize();
                const v1 = vector2.copy(normal).multiplyScalar(normal.dot(s1.velocity));
                const v2 = vector3.copy(normal).multiplyScalar(normal.dot(s2.velocity));

                s1.velocity.add(v2).sub(v1);
                s2.velocity.add(v1).sub(v2);

                // Separate spheres
                const d = (r - Math.sqrt(d2)) / 2;
                s1.collider.center.addScaledVector(normal, d);
                s2.collider.center.addScaledVector(normal, -d);
            }
        }
    }
}

// --- Update Loop ---
function updateSpheres(deltaTime, worldOctree, spheres, playerCollider, playerVelocity) {
    spheres.forEach(sphere => {
        // Move collider
        sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);

        // World collision
        const result = worldOctree.sphereIntersect(sphere.collider);
        if (result) {
            // Reflect velocity upon collision
            sphere.velocity.addScaledVector(result.normal, -result.normal.dot(sphere.velocity) * 1.5); // Bounciness
            // Correct position based on penetration depth
            sphere.collider.center.add(result.normal.multiplyScalar(result.depth));
        } else {
            // Apply gravity if not colliding
            sphere.velocity.y -= GRAVITY * deltaTime;
        }

        // Apply damping (air resistance)
        const damping = Math.exp(-1.5 * deltaTime) - 1;
        sphere.velocity.addScaledVector(sphere.velocity, damping);

        // Player collision
        playerSphereCollision(sphere, playerCollider, playerVelocity);
    });

    // Sphere-sphere collisions
    spheresCollisions();

    // Update mesh positions after all physics calculations
    for (const sphere of spheres) {
        sphere.mesh.position.copy(sphere.collider.center);
    }
}


// --- Export ---
export {
    worldOctree,
    spheres,
    initSpheres,
    updateSpheres
};
