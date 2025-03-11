import * as THREE from 'three';

export class PhysicsWorld {
    constructor(scene, worldOctree) {
        this.scene = scene;
        this.worldOctree = worldOctree;
        this.GRAVITY = 30;
        this.NUM_SPHERES = 100;
        this.SPHERE_RADIUS = 0.2;
        
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
        // Update sphere positions and handle collisions
        this.spheres.forEach(sphere => {
            sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);
            const result = this.worldOctree.sphereIntersect(sphere.collider);
            
            if (result) {
                sphere.velocity.addScaledVector(
                    result.normal,
                    -result.normal.dot(sphere.velocity) * 1.5
                );
                sphere.collider.center.add(result.normal.multiplyScalar(result.depth));
            } else {
                sphere.velocity.y -= this.GRAVITY * deltaTime;
            }

            const damping = Math.exp(-1.5 * deltaTime) - 1;
            sphere.velocity.addScaledVector(sphere.velocity, damping);
            sphere.mesh.position.copy(sphere.collider.center);
        });
    }

    throwBall(position, direction, velocity) {
        const sphere = this.spheres[this.sphereIdx];
        sphere.collider.center.copy(position);
        sphere.velocity.copy(direction).multiplyScalar(15);
        sphere.velocity.addScaledVector(velocity, 2);
        this.sphereIdx = (this.sphereIdx + 1) % this.spheres.length;
    }
}
