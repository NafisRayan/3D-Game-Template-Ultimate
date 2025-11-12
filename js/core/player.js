import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GRAVITY } from '../physics/physics.js';
import { visibilitySettings } from '../utils/loader.js';

// --- Player State ---
const playerCollider = new Capsule(new THREE.Vector3(0, 0.35, 0), new THREE.Vector3(0, 1, 0), 0.35);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
const keyStates = {};

let playerOnFloor = false;
let mouseTime = 0;
let isRunning = false;

// Scene references
let _scene;
let _camera;
let _playerCollider;
let _playerDirection;
let _spheres;

// Third-person helpers
const cameraTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const cameraUp = new THREE.Vector3(0, 1, 0);
const desiredForward = new THREE.Vector3();
const horizontalVelocity = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempVector = new THREE.Vector3();

let _cameraYaw = 0;
let _cameraPitch = 0.15;

// Character model
const playerGroup = new THREE.Group();
let playerModel = null;
let mixer = null;
let actions = {};
let currentAction = null;
let modelReady = false;

// Sphere throwing state
let sphereIdx = 0;

const MODEL_OFFSET = new THREE.Vector3(0, -1.0, 0); // Roughly align model feet with collider
const CAMERA_DISTANCE_THIRD = 6;
const CAMERA_HEIGHT_THIRD = 2.8;
const CAMERA_DISTANCE_FIRST = 0.2;
const CAMERA_HEIGHT_FIRST = 1.0;
const CAMERA_MIN_PITCH_THIRD = -Math.PI / 3;
const CAMERA_MAX_PITCH_THIRD = Math.PI / 4;
const CAMERA_MIN_PITCH_FIRST = -Math.PI / 2 + 0.1;
const CAMERA_MAX_PITCH_FIRST = Math.PI / 2 - 0.1;
const CAMERA_PITCH_THIRD = 0.18;
const CAMERA_PITCH_FIRST = 1;
const CAMERA_DISTANCE_THIRD_MIN = 2.5;
const CAMERA_DISTANCE_THIRD_MAX = 12;
const ANIMATION_FADE_DURATION = 0.35;

let thirdPersonDistance = CAMERA_DISTANCE_THIRD;

let viewMode = visibilitySettings.viewMode || 'third';

function isMovementInputActive() {
    return !!(
        keyStates['KeyW'] || keyStates['ArrowUp'] ||
        keyStates['KeyS'] || keyStates['ArrowDown'] ||
        keyStates['KeyA'] || keyStates['ArrowLeft'] ||
        keyStates['KeyD'] || keyStates['ArrowRight']
    );
}

function getPitchLimits(mode = viewMode) {
    if (mode === 'first') {
        return { min: CAMERA_MIN_PITCH_FIRST, max: CAMERA_MAX_PITCH_FIRST };
    }
    return { min: CAMERA_MIN_PITCH_THIRD, max: CAMERA_MAX_PITCH_THIRD };
}

function clampCameraPitch() {
    const { min, max } = getPitchLimits();
    _cameraPitch = THREE.MathUtils.clamp(_cameraPitch, min, max);
}

// --- Input Handling ---
function initPlayerControls(scene, camera, collider, direction, spheres) {
    _scene = scene;
    _camera = camera;
    _playerCollider = collider;
    _playerDirection = direction;
    _spheres = spheres;

    loadCharacter();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    const container = document.getElementById('container');
    if (container) {
        container.addEventListener('mousedown', () => {
            document.body.requestPointerLock();
            mouseTime = performance.now();
        });
    }

    document.addEventListener('mouseup', () => {
        if (document.pointerLockElement !== null) throwBall();
    });

    document.body.addEventListener('mousemove', (event) => {
        if (document.pointerLockElement === document.body) {
            _cameraYaw -= event.movementX / 500;
            _cameraPitch -= event.movementY / 500;
            clampCameraPitch();
        }
    });

    window.addEventListener('wheel', (event) => {
        if (viewMode !== 'third') return;
        const zoomDelta = event.deltaY * 0.0025;
        if (zoomDelta !== 0) {
            thirdPersonDistance = THREE.MathUtils.clamp(
                thirdPersonDistance + zoomDelta,
                CAMERA_DISTANCE_THIRD_MIN,
                CAMERA_DISTANCE_THIRD_MAX
            );
            event.preventDefault();
        }
    }, { passive: false });

    window.addEventListener('player-view-change', (event) => {
        setViewMode(event.detail, { persist: true });
    });

    setViewMode(viewMode, { immediate: true });
}

function toggleViewMode() {
    setViewMode(viewMode === 'third' ? 'first' : 'third', { persist: true });
}

function setViewMode(mode, options = {}) {
    viewMode = mode === 'first' ? 'first' : 'third';
    visibilitySettings.viewMode = viewMode;
    _cameraPitch = viewMode === 'third' ? CAMERA_PITCH_THIRD : CAMERA_PITCH_FIRST;
    clampCameraPitch();
    if (viewMode === 'third') {
        thirdPersonDistance = THREE.MathUtils.clamp(
            thirdPersonDistance,
            CAMERA_DISTANCE_THIRD_MIN,
            CAMERA_DISTANCE_THIRD_MAX
        );
    }
    if (modelReady) {
        playerGroup.visible = viewMode === 'third';
    }

    if (options.persist) {
        persistViewMode();
    }
}

function persistViewMode() {
    try {
        localStorage.setItem('visibilitySettings', JSON.stringify(visibilitySettings));
    } catch (error) {
        console.warn('Failed to persist view mode:', error);
    }
}

function onKeyDown(event) {
    keyStates[event.code] = true;

    if (event.code === 'KeyV' && !event.repeat) {
        toggleViewMode();
    }
}

function onKeyUp(event) {
    keyStates[event.code] = false;
}

// --- Character Loading ---
function loadCharacter() {
    const loader = new GLTFLoader();
    loader.load(
        'https://threejs.org/examples/models/gltf/Soldier.glb',
        (gltf) => {
            playerModel = gltf.scene;
            playerModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Align initial orientation to face forward (positive Z)
            playerModel.rotation.y = Math.PI;

            playerGroup.add(playerModel);
            playerGroup.visible = true;
            _scene.add(playerGroup);

            mixer = new THREE.AnimationMixer(playerModel);
            actions = {
                Idle: mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'Idle')),
                Walk: mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'Walk')),
                Run: mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'Run'))
            };

            Object.values(actions).forEach((action) => {
                if (action) {
                    action.enabled = true;
                    action.setEffectiveTimeScale(1);
                    action.setEffectiveWeight(0);
                }
            });

            setAction('Idle');
            modelReady = true;
            setViewMode(viewMode, { immediate: true });
        },
        undefined,
        (error) => {
            console.error('Failed to load character model:', error);
        }
    );
}

function setAction(name) {
    if (!actions || !actions[name]) return;
    if (currentAction === name) return;

    const previousName = currentAction;
    const previous = previousName ? actions[previousName] : null;
    const nextAction = actions[name];

    currentAction = name;

    nextAction.enabled = true;
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    nextAction.play();

    if (previous && previous !== nextAction) {
        if (previousName !== 'Idle' && name !== 'Idle') {
            const prevDuration = previous.getClip().duration || 1;
            const nextDuration = nextAction.getClip().duration || prevDuration;
            nextAction.time = (previous.time || 0) * (nextDuration / prevDuration);
        } else {
            nextAction.reset();
        }

        previous.crossFadeTo(nextAction, ANIMATION_FADE_DURATION, true);
    } else {
        nextAction.reset();
        nextAction.fadeIn(ANIMATION_FADE_DURATION);
    }
}

// --- Ball Throwing ---
function throwBall() {
    if (!_spheres || _spheres.length === 0) return;

    const sphere = _spheres[sphereIdx];

    const aimDirection = getForwardVector();
    sphere.collider.center.copy(_playerCollider.end).addScaledVector(aimDirection, _playerCollider.radius * 1.5);

    const impulse = 15 + 30 * (1 - Math.exp((mouseTime - performance.now()) * 0.001));

    sphere.velocity.copy(aimDirection).multiplyScalar(impulse);
    sphere.velocity.addScaledVector(playerVelocity, 2);

    sphereIdx = (sphereIdx + 1) % _spheres.length;
}

// --- Player Movement & Collision ---
function playerCollisions(worldOctree) {
    const result = worldOctree.capsuleIntersect(_playerCollider);
    playerOnFloor = false;

    if (result) {
        playerOnFloor = result.normal.y > 0;

        if (!playerOnFloor) {
            playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
        }

        if (result.depth >= 1e-10) {
            _playerCollider.translate(result.normal.multiplyScalar(result.depth));
        }
    }
}

function updatePlayer(deltaTime, worldOctree) {
    if (!_camera) return;

    updateCameraTarget();

    let damping = Math.exp(-4 * deltaTime) - 1;

    if (!playerOnFloor) {
        playerVelocity.y -= GRAVITY * deltaTime;
        damping *= 0.1;
    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    controls(deltaTime);

    const deltaPosition = tempVector.copy(playerVelocity).multiplyScalar(deltaTime);
    _playerCollider.translate(deltaPosition);

    playerCollisions(worldOctree);

    alignCharacterWithCollider();
    updateCameraFollow(deltaTime);
    updateAnimations(deltaTime);
}

function updateCameraTarget() {
    cameraTarget.copy(_playerCollider.end);
    cameraTarget.y += 0.2;
}

function alignCharacterWithCollider() {
    if (!modelReady) return;

    const targetPosition = cameraTarget.clone().add(MODEL_OFFSET);
    playerGroup.position.lerp(targetPosition, 0.25);

    horizontalVelocity.copy(playerVelocity);
    horizontalVelocity.y = 0;

    if (horizontalVelocity.lengthSq() > 0.01) {
        desiredForward.copy(horizontalVelocity).normalize();
        tempQuaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), desiredForward);
        playerGroup.quaternion.slerp(tempQuaternion, 0.2);
    }
}

function updateCameraFollow(deltaTime) {
    const isThirdPerson = viewMode === 'third';
    const targetHeight = isThirdPerson ? CAMERA_HEIGHT_THIRD : CAMERA_HEIGHT_FIRST;
    const targetDistance = isThirdPerson ? thirdPersonDistance : CAMERA_DISTANCE_FIRST;

    clampCameraPitch();

    cameraOffset.set(0, targetHeight, targetDistance);
    const offsetEuler = new THREE.Euler(_cameraPitch, _cameraYaw, 0, 'YXZ');
    cameraOffset.applyEuler(offsetEuler);

    const desiredCameraPos = cameraTarget.clone().add(cameraOffset);
    _camera.position.lerp(desiredCameraPos, THREE.MathUtils.clamp(deltaTime * 8, 0, 1));
    _camera.lookAt(cameraTarget);
    _camera.up.copy(cameraUp);

    if (!isThirdPerson && modelReady) {
        playerGroup.visible = false;
    } else if (modelReady) {
        playerGroup.visible = true;
    }
}

function updateAnimations(deltaTime) {
    if (!modelReady || !mixer) return;

    mixer.update(deltaTime);

    if (!playerOnFloor) {
        return;
    }

    const moving = isMovementInputActive();

    if (!moving) {
        setAction('Idle');
        return;
    }

    setAction(isRunning ? 'Run' : 'Walk');
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
    const runKey = keyStates['ShiftLeft'] || keyStates['ShiftRight'];
    const walkSpeed = playerOnFloor ? 18 : 6;
    const runSpeed = playerOnFloor ? 32 : 12;
    const movementActive = isMovementInputActive();
    isRunning = !!(runKey && movementActive);

    const speedDelta = deltaTime * (isRunning ? runSpeed : walkSpeed);

    if (keyStates['KeyW'] || keyStates['ArrowUp']) {
        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    }
    if (keyStates['KeyS'] || keyStates['ArrowDown']) {
        playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
    }
    if (keyStates['KeyA'] || keyStates['ArrowLeft']) {
        playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
    }
    if (keyStates['KeyD'] || keyStates['ArrowRight']) {
        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
    }

    if (playerOnFloor && (keyStates['Space'] || keyStates['KeyX'])) {
        playerVelocity.y = 15;
        setAction('Idle');
    }
}

// --- Teleport ---
function teleportPlayerIfOob() {
    if (!_playerCollider || !_camera) return;

    if (_playerCollider.end.y <= -25) {
        console.log('Player fell out of bounds, teleporting...');
        _playerCollider.start.set(0, 0.35, 0);
        _playerCollider.end.set(0, 1, 0);
        _playerCollider.radius = 0.35;
        playerVelocity.set(0, 0, 0);
        _cameraYaw = 0;
        _cameraPitch = 0.15;
        alignCharacterWithCollider();
        updateCameraTarget();
        updateCameraFollow(0);
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
