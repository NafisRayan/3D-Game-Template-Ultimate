import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// Configurable visibility and scale settings
export const visibilitySettings = {
    fogNear: 0,           // Near fog distance
    fogFar: 500,          // Far fog distance (default: 50)
    modelScale: 0.7,      // Scale factor for the model (default: 1.0)
    cameraFar: 1000,      // Camera far plane distance (default: 1000)
    showGUI: true,       // Whether to show the GUI (default: false)
    showUI: true          // Whether to show the UI elements (FPS counter, info text) (default: true)
};

// We'll create the loader inside the loadCollisionWorld function

/**
 * Loads the collision world GLTF model, adds it to the scene,
 * and builds the world Octree from its geometry.
 * @param {THREE.Scene} scene The main scene object.
 * @param {Octree} worldOctree The Octree instance to populate.
 * @param {string} modelPath Path to the GLTF model file.
 * @param {THREE.WebGLRenderer} renderer The WebGL renderer instance.
 * @param {THREE.Camera} camera The main camera instance.
 * @returns {Promise<void>} A promise that resolves when loading and setup is complete.
 */
export function loadCollisionWorld(scene, worldOctree, modelPath, renderer, camera) {
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

        // Apply fog settings to the scene
        if (scene.fog) {
            scene.fog.near = visibilitySettings.fogNear;
            scene.fog.far = visibilitySettings.fogFar;
        }

        const gltfLoader = new GLTFLoader(loadingManager);
        gltfLoader.load(modelPath, (gltf) => {
            // Apply scale to the model
            gltf.scene.scale.set(
                visibilitySettings.modelScale,
                visibilitySettings.modelScale,
                visibilitySettings.modelScale
            );

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

            // Add GUI controls for visibility and scale settings if enabled
            if (visibilitySettings.showGUI) {
                try {
                    const gui = new GUI({ width: 250 });

                    // Helper function to save settings to localStorage
                    const saveSettings = () => {
                        try {
                            localStorage.setItem('visibilitySettings', JSON.stringify(visibilitySettings));
                            console.log('Saved visibility settings to localStorage');
                        } catch (error) {
                            console.warn('Failed to save settings to localStorage:', error);
                        }
                    };

                    // Debug folder for Octree helper
                    const debugFolder = gui.addFolder('Debug');
                    debugFolder.add({ debug: false }, 'debug')
                        .name('Octree Helper')
                        .onChange(function (value) {
                            helper.visible = value;
                        });

                    // Visibility settings folder
                    const visibilityFolder = gui.addFolder('Visibility Settings');

                    // Fog controls
                    visibilityFolder.add(visibilitySettings, 'fogNear', 0, 100)
                        .name('Fog Near')
                        .onChange(value => {
                            if (scene.fog) {
                                scene.fog.near = value;
                            }
                            saveSettings();
                        });

                    visibilityFolder.add(visibilitySettings, 'fogFar', 10, 500)
                        .name('Fog Far')
                        .onChange(value => {
                            if (scene.fog) {
                                scene.fog.far = value;
                            }
                            saveSettings();
                        });

                    // Model scale control
                    visibilityFolder.add(visibilitySettings, 'modelScale', 0.1, 5)
                        .name('Model Scale')
                        .onChange(value => {
                            gltf.scene.scale.set(value, value, value);
                            // Rebuild octree when scale changes
                            worldOctree.fromGraphNode(gltf.scene);
                            saveSettings();
                        });

                    // Camera far plane control
                    visibilityFolder.add(visibilitySettings, 'cameraFar', 100, 5000)
                        .name('View Distance')
                        .onChange(value => {
                            // Update the camera far plane
                            if (camera) {
                                camera.far = value;
                                camera.updateProjectionMatrix();
                            }
                            saveSettings();
                        });

                    // Add GUI visibility toggle
                    visibilityFolder.add(visibilitySettings, 'showGUI')
                        .name('Show GUI')
                        .onChange(() => {
                            saveSettings();
                            console.log('GUI visibility will change on next reload');
                        });

                    // Add UI visibility toggle
                    visibilityFolder.add(visibilitySettings, 'showUI')
                        .name('Show UI Elements')
                        .onChange(value => {
                            // Update UI visibility immediately
                            const uiWrapper = document.getElementById('ui-wrapper');
                            if (uiWrapper) {
                                uiWrapper.style.opacity = value ? '1' : '0';
                                uiWrapper.style.pointerEvents = value ? 'auto' : 'none';
                            }
                            saveSettings();
                        });

                    // Open the visibility folder by default
                    visibilityFolder.open();

                } catch (error) {
                    console.warn("Could not initialize lil-gui:", error);
                    // GUI is optional, continue without it
                }
            } else {
                console.log('GUI is disabled. Set visibilitySettings.showGUI to true to enable it.');
            }

            resolve(); // Resolve the promise indicating success

        }, undefined, (error) => {
            console.error('An error happened during GLTF loading:', error);
            reject(error); // Reject the promise on error
        });
    });
}
