import * as THREE from 'three';

export class Controls {
    constructor(player, physics) {
        this.player = player;
        this.physics = physics;
        this.mouseTime = 0;
        this.keyStates = {};
        
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

        if (this.keyStates['KeyW']) {
            this.player.velocity.add(this.getForwardVector().multiplyScalar(speedDelta));
        }
        if (this.keyStates['KeyS']) {
            this.player.velocity.add(this.getForwardVector().multiplyScalar(-speedDelta));
        }
        if (this.keyStates['KeyA']) {
            this.player.velocity.add(this.getSideVector().multiplyScalar(-speedDelta));
        }
        if (this.keyStates['KeyD']) {
            this.player.velocity.add(this.getSideVector().multiplyScalar(speedDelta));
        }
        if (this.player.onFloor && this.keyStates['Space']) {
            this.player.velocity.y = 15;
        }
    }

    getForwardVector() {
        this.player.camera.getWorldDirection(this.player.direction);
        this.player.direction.y = 0;
        this.player.direction.normalize();
        return this.player.direction;
    }

    getSideVector() {
        this.player.camera.getWorldDirection(this.player.direction);
        this.player.direction.y = 0;
        this.player.direction.normalize();
        this.player.direction.cross(this.player.camera.up);
        return this.player.direction;
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
