import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';

export class Player {
    constructor(worldOctree) {
        this.worldOctree = worldOctree;
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.rotation.order = 'YXZ';

        this.collider = new Capsule(
            new THREE.Vector3(0, 0.35, 0),
            new THREE.Vector3(0, 1, 0),
            0.35
        );
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.onFloor = false;
        
        // Add reusable vectors
        this.deltaPosition = new THREE.Vector3();
        this.GRAVITY = 30; // Constants should be class properties
    }

    update(deltaTime) {
        let damping = Math.exp(-4 * deltaTime) - 1;
        if (!this.onFloor) {
            this.velocity.y -= this.GRAVITY * deltaTime;
            damping *= 0.1;
        }
        
        this.velocity.addScaledVector(this.velocity, damping);
        
        // Use cached vector instead of creating new one
        this.deltaPosition.copy(this.velocity).multiplyScalar(deltaTime);
        this.collider.translate(this.deltaPosition);
        this.handleCollisions();
        
        this.camera.position.copy(this.collider.end);
        
        // Reset player if they fall below the world
        if (this.collider.end.y < -25) {
            this.resetPosition();
        }
    }

    resetPosition() {
        this.velocity.set(0, 0, 0);
        this.collider.start.set(0, 0.35, 0);
        this.collider.end.set(0, 1, 0);
        this.camera.position.copy(this.collider.end);
        this.camera.rotation.set(0, 0, 0);
    }

    handleCollisions() {
        const result = this.worldOctree.capsuleIntersect(this.collider);
        this.onFloor = false;

        if (result) {
            this.onFloor = result.normal.y > 0;
            if (!this.onFloor) {
                this.velocity.addScaledVector(result.normal, -result.normal.dot(this.velocity));
            }
            this.collider.translate(result.normal.multiplyScalar(result.depth));
        }
    }
}
