import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

const loader = new GLTFLoader();

/**
 * Loads the collision world GLTF model, adds it to the scene,
 * and builds the world Octree from its geometry.
 * @param {THREE.Scene} scene The main scene object.
 * @param {Octree} worldOctree The Octree instance to populate.
 * @param {string} modelPath Path to the GLTF model file.
 * @param {THREE.WebGLRenderer} renderer The WebGL renderer instance.
 * @returns {Promise<void>} A promise that resolves when loading and setup is complete.
 */
export function loadCollisionWorld(scene, worldOctree, modelPath, renderer) {
    return new Promise((resolve, reject) => {
        const loadingManager = new THREE.LoadingManager();
        const loadingScreen = document.getElementById('loading-screen');
        const loadingProgress = document.querySelector('.loading-progress');

        loadingManager.onProgress = (url, loaded, total) => {
            const progress = Math.round((loaded / total) * 100);
            if (loadingProgress) {
                loadingProgress.textContent = `${progress}%`;
            }
        };

        loadingManager.onLoad = () => {
            if (loadingScreen) {
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
        };

        const gltfLoader = new GLTFLoader(loadingManager);
        gltfLoader.load(modelPath, (gltf) => {
            scene.add(gltf.scene);

            // Build Octree from the loaded model
            worldOctree.fromGraphNode(gltf.scene);

            // Configure shadows and materials for meshes in the loaded model
            gltf.scene.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    // Improve texture quality if a map exists
                    if (child.material.map) {
                        child.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); // Use max supported anisotropy
                        child.material.map.needsUpdate = true; // Ensure update takes effect
                    }
                }
            });

            // Optional: Add Octree visual helper
            const helper = new OctreeHelper(worldOctree);
            helper.visible = false; // Initially hidden
            scene.add(helper);

            // Optional: Add GUI control for helper visibility
            try {
                const gui = new GUI({ width: 200 });
                gui.add({ debug: false }, 'debug')
                    .name('Octree Helper')
                    .onChange(function (value) {
                        helper.visible = value;
                    });
            } catch (error) {
                console.warn("Could not initialize lil-gui:", error);
                // GUI is optional, continue without it
            }


            resolve(); // Resolve the promise indicating success

        }, undefined, (error) => {
            console.error('An error happened during GLTF loading:', error);
            reject(error); // Reject the promise on error
        });
    });
}
