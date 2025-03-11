import * as THREE from 'three';

export class Controls {
    constructor(player, physics) {
        this.player = player;
        this.physics = physics;
        this.mouseTime = 0;
        this.keyStates = {};
        // Cache vectors to avoid creating new ones each frame
        this.forwardVector = new THREE.Vector3();
        this.sideVector = new THREE.Vector3();
        
        this.initEventListeners();
    }

    initEventListeners() {
        document.addEventListener('keydown', (event) => {
            this.keyStates[event.code] = true;
        });

        document.addEventListener('keyup', (event) => {
            this.keyStates[event.code] = false;
        });

        document.addEventListener('mousedown', () => {
            document.body.requestPointerLock();
            this.mouseTime = performance.now();
        });

        document.addEventListener('mouseup', () => {
            if (document.pointerLockElement) {
                try {
                    this.throwBall();
                } catch (error) {
                    if (error.name === 'SecurityError') {
                        console.warn('Pointer lock was exited before the request was completed.');
                    } else {
                        throw error;
                    }
                }
            }
        });

        document.addEventListener('mousemove', (event) => {
            if (document.pointerLockElement === document.body) {
                this.player.camera.rotation.y -= event.movementX / 500;
                this.player.camera.rotation.x -= event.movementY / 500;
            }
        });
    }

    update(deltaTime) {
        const speedDelta = deltaTime * (this.player.onFloor ? 25 : 8);

        // Use cached vectors and combine movement logic to reduce redundant calculations
        if (this.keyStates['KeyW'] || this.keyStates['KeyS'] || this.keyStates['KeyA'] || this.keyStates['KeyD']) {
            if (this.keyStates['KeyW']) {
                this.getForwardVector().multiplyScalar(speedDelta);
                this.player.velocity.add(this.forwardVector);
            }
            if (this.keyStates['KeyS']) {
                this.getForwardVector().multiplyScalar(-speedDelta);
                this.player.velocity.add(this.forwardVector);
            }
            if (this.keyStates['KeyA']) {
                this.getSideVector().multiplyScalar(-speedDelta);
                this.player.velocity.add(this.sideVector);
            }
            if (this.keyStates['KeyD']) {
                this.getSideVector().multiplyScalar(speedDelta);
                this.player.velocity.add(this.sideVector);
            }
        }
        
        if (this.player.onFloor && this.keyStates['Space']) {
            this.player.velocity.y = 15;
        }
    }

    getForwardVector() {
        this.player.camera.getWorldDirection(this.forwardVector);
        this.forwardVector.y = 0;
        this.forwardVector.normalize();
        return this.forwardVector;
    }

    getSideVector() {
        this.player.camera.getWorldDirection(this.sideVector);
        this.sideVector.y = 0;
        this.sideVector.normalize();
        this.sideVector.cross(this.player.camera.up);
        return this.sideVector;
    }

    throwBall() {
        const direction = new THREE.Vector3();
        this.player.camera.getWorldDirection(direction);
        this.physics.throwBall(
            this.player.collider.end.clone().addScaledVector(direction, this.player.collider.radius * 1.5),
            direction,
            this.player.velocity
        );
    }
}
