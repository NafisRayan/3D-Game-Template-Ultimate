import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { SceneManager } from './SceneManager.js';
import { Player } from './Player.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { Controls } from './Controls.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';

class Game {
    constructor(useGLB = false) {
        this.clock = new THREE.Clock();
        this.container = document.getElementById('container');
        this.STEPS_PER_FRAME = 5;
        this.deltaTime = 0;
        
        // Initialize performance monitor
        this.performanceMonitor = new PerformanceMonitor();
        
        this.initRenderer();
        this.initStats();
        this.initScene(useGLB);
        this.initPhysics();
        this.initPlayer();
        this.initControls();
        
        // Handle resize events efficiently with debounce
        this.resizeTimeout = null;
        window.addEventListener('resize', () => this.handleResize());
        
        // Start render loop
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

    handleResize() {
        // Debounce resize events for better performance
        if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
        
        this.resizeTimeout = setTimeout(() => {
            this.player.camera.aspect = window.innerWidth / window.innerHeight;
            this.player.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }, 100);
    }

    animate() {
        // Request next frame first to optimize frame timing
        requestAnimationFrame(() => this.animate());
        
        // Calculate delta time with clamping to avoid large jumps
        this.deltaTime = Math.min(0.05, this.clock.getDelta()) / this.STEPS_PER_FRAME;
        
        // Update game state with fixed time steps
        for (let i = 0; i < this.STEPS_PER_FRAME; i++) {
            this.controls.update(this.deltaTime);
            this.player.update(this.deltaTime);
            this.physics.update(this.deltaTime);
        }

        // Render and update stats
        this.renderer.render(this.sceneManager.scene, this.player.camera);
        this.stats.update();
        
        // Update performance monitor
        this.performanceMonitor.frameRendered();
    }
}

// Create a new instance of the game
// Add a global loading indicator
document.body.insertAdjacentHTML('beforeend', 
    '<div id="loadingScreen" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;justify-content:center;align-items:center;z-index:1000;color:white;font-family:Arial;">' +
    '<div>Loading Game World...<br><progress style="width:200px"></progress></div>' +
    '</div>'
);

// Initialize game when DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game(true);
    
    // Simple way to hide loading screen when scene is ready
    const checkLoading = setInterval(() => {
        if (game.sceneManager.isWorldLoaded) {
            document.getElementById('loadingScreen').style.display = 'none';
            clearInterval(checkLoading);
        }
    }, 100);
});
