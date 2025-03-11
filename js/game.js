import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { SceneManager } from './SceneManager.js';
import { Player } from './Player.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Controls } from './Controls.js';

class Game {
    constructor(useGLB = false) {
        this.clock = new THREE.Clock();
        this.container = document.getElementById('container');
        this.STEPS_PER_FRAME = 5;
        
        this.initRenderer();
        this.initStats();
        this.initScene(useGLB);
        this.initPhysics();
        this.initPlayer();
        this.initControls();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);
    }

    initStats() {
        this.stats = new Stats();
        this.stats.domElement.style.position = 'absolute';
        this.stats.domElement.style.top = '0px';
        this.container.appendChild(this.stats.domElement);
    }

    initScene(useGLB) {
        this.sceneManager = new SceneManager(useGLB);
    }

    initPhysics() {
        this.physics = new PhysicsWorld(this.sceneManager.scene, this.sceneManager.worldOctree);
    }

    initPlayer() {
        this.player = new Player(this.physics.worldOctree);
    }

    initControls() {
        this.controls = new Controls(this.player, this.physics);
    }

    onWindowResize() {
        this.player.camera.aspect = window.innerWidth / window.innerHeight;
        this.player.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        const deltaTime = Math.min(0.05, this.clock.getDelta()) / this.STEPS_PER_FRAME;
        
        for (let i = 0; i < this.STEPS_PER_FRAME; i++) {
            this.controls.update(deltaTime);
            this.player.update(deltaTime);
            this.physics.update(deltaTime);
        }

        this.renderer.render(this.sceneManager.scene, this.player.camera);
        this.stats.update();
        requestAnimationFrame(() => this.animate());
    }
}

// Pass true to use the GLB file, false to use manual setup
new Game(true);
