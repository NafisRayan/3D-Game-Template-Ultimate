import * as THREE from 'three';

export class PhysicsWorld {
    constructor(scene, worldOctree) {
        this.scene = scene;
        this.worldOctree = worldOctree;
        this.GRAVITY = 30;
        this.NUM_SPHERES = 100;
        this.SPHERE_RADIUS = 0.2;
        
        // Add reusable vectors to avoid creating new ones each frame
        this.tempVector = new THREE.Vector3();
        this.damping = 0;
        
        this.initSpheres();
    }

    initSpheres() {
        const sphereGeometry = new THREE.IcosahedronGeometry(this.SPHERE_RADIUS, 5);
        const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xdede8d });
        
        this.spheres = [];
        this.sphereIdx = 0;

        for (let i = 0; i < this.NUM_SPHERES; i++) {
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.castShadow = true;
            sphere.receiveShadow = true;
            this.scene.add(sphere);
            
            this.spheres.push({
                mesh: sphere,
                collider: new THREE.Sphere(new THREE.Vector3(0, -100, 0), this.SPHERE_RADIUS),
                velocity: new THREE.Vector3()
            });
        }
    }

    update(deltaTime) {
        // Precalculate damping outside the loop
        this.damping = Math.exp(-1.5 * deltaTime) - 1;
        
        // Use for loop instead of forEach for better performance
        for (let i = 0; i < this.spheres.length; i++) {
            const sphere = this.spheres[i];
            
            // Use tempVector to avoid creating new vectors
            this.tempVector.copy(sphere.velocity).multiplyScalar(deltaTime);
            sphere.collider.center.add(this.tempVector);
            
            const result = this.worldOctree.sphereIntersect(sphere.collider);
            
            if (result) {
                // Calculate dot product once
                const dot = result.normal.dot(sphere.velocity);
                this.tempVector.copy(result.normal).multiplyScalar(-dot * 1.5);
                sphere.velocity.add(this.tempVector);
                
                this.tempVector.copy(result.normal).multiplyScalar(result.depth);
                sphere.collider.center.add(this.tempVector);
            } else {
                sphere.velocity.y -= this.GRAVITY * deltaTime;
            }

            // Apply damping
            sphere.velocity.addScaledVector(sphere.velocity, this.damping);
            
            // Update mesh position
            sphere.mesh.position.copy(sphere.collider.center);
        }
    }

    throwBall(position, direction, velocity) {
        const sphere = this.spheres[this.sphereIdx];
        sphere.collider.center.copy(position);
        sphere.velocity.copy(direction).multiplyScalar(15);
        sphere.velocity.addScaledVector(velocity, 2);
        this.sphereIdx = (this.sphereIdx + 1) % this.spheres.length;
    }
}
