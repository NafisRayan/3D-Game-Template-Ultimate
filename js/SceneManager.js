import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class SceneManager {
    constructor(onLoadComplete) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x88ccee);
        this.scene.fog = new THREE.Fog(0x88ccee, 0, 50);
        
        this.worldOctree = new Octree();
        this.setupLights();
        
        // Track loading state
        this.isWorldLoaded = false;
        this.onLoadComplete = onLoadComplete || function() {};
        
        // Start loading the world
        this.loadWorldFromGLB();
    }

    setupLights() {
        const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
        fillLight1.position.set(2, 1, 1);
        this.scene.add(fillLight1);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
        directionalLight.position.set(-5, 25, -1);
        directionalLight.castShadow = true;
        this.setupShadowProperties(directionalLight);
        this.scene.add(directionalLight);
    }

    setupShadowProperties(light) {
        light.shadow.camera.near = 0.01;
        light.shadow.camera.far = 500;
        light.shadow.camera.right = 30;
        light.shadow.camera.left = -30;
        light.shadow.camera.top = 30;
        light.shadow.camera.bottom = -30;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;
        light.shadow.radius = 4;
        light.shadow.bias = -0.00006;
    }

    loadWorldFromGLB() {
        return new Promise((resolve) => {
            // First create and add the floor to ensure it's available
            const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const floorGeometry = new THREE.BoxGeometry(100, 1, 100); 
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.set(0, -0.5, 0);
            floor.castShadow = false;
            floor.receiveShadow = true;
            floor.name = "floor";
            floor.userData.solid = true;
            this.scene.add(floor);
            
            // Add the floor to the octree
            this.worldOctree.fromGraphNode(floor);
            console.log("Floor added to scene and octree");
            
            // Create a loading manager for tracking overall loading progress
            const loadingManager = new THREE.LoadingManager();
            loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
                console.log(`Loading world: ${Math.round(itemsLoaded / itemsTotal * 100)}%`);
            };
            
            // Now load the GLB model - create loader with the manager
            const loader = new GLTFLoader(loadingManager);
            
            loader.load('./assets/low_poly_industrial_zone.glb', (gltf) => {
                const worldGroup = gltf.scene;
                worldGroup.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (!child.name) child.name = `mesh_${Math.floor(Math.random() * 1000)}`;
                        
                        if (!child.geometry.boundingBox) {
                            child.geometry.computeBoundingBox();
                        }
                    }
                });
                
                // Add the GLB model to the scene
                this.scene.add(worldGroup);
                console.log("GLB model added to scene");
                
                // Update the octree with the GLB model
                this.worldOctree.fromGraphNode(worldGroup);
                console.log("GLB model added to octree");
                
                // Set up helpers and debug UI
                const helper = new OctreeHelper(this.worldOctree);
                helper.visible = false;
                this.scene.add(helper);

                const gui = new GUI({ width: 200 });
                gui.add({ debug: false }, "debug").onChange((value) => {
                    helper.visible = value;
                });

                // Set up collision detection
                this.setupCollisionDetection();
                
                // Mark world as loaded
                this.isWorldLoaded = true;
                console.log("World loading complete");
                
                // Call the onLoadComplete callback
                if (typeof this.onLoadComplete === 'function') {
                    this.onLoadComplete();
                }
                
                resolve();
            }, 
            // Progress callback
            (xhr) => {
                const percent = xhr.loaded / xhr.total * 100;
                console.log(`GLB Loading: ${Math.round(percent)}%`);
            },
            // Error callback
            (error) => {
                console.error('Error loading GLB:', error);
                // Add floor anyway so game can start
                this.setupCollisionDetection();
                this.isWorldLoaded = true;
                if (typeof this.onLoadComplete === 'function') {
                    this.onLoadComplete();
                }
                resolve();
            });
        });
    }

    // Method to check if world is ready
    isReady() {
        return this.isWorldLoaded;
    }

    checkCollisions() {
        // Forward to the enhanced collision detection system
        this.setupCollisionDetection();
    }
    
    // This method checks if a point is colliding with any object in the octree
    checkPointCollision(point) {
        // Use the octree for faster collision detection
        return this.worldOctree.containsPoint(point);
    }

    // This method handles player collisions with the world
    handlePlayerCollision(player, deltaTime) {
        // Get the player's current position
        const playerPosition = player.position.clone();
        
        // Check if player is inside objects and push them out
        const result = this.worldOctree.capsuleIntersect({
            start: playerPosition.clone().add(new THREE.Vector3(0, 0.35, 0)),
            end: playerPosition.clone().add(new THREE.Vector3(0, 1.85, 0)),
            radius: 0.35
        });
        
        if (result) {
            // Move the player out of the collision
            player.position.add(result.normal.multiplyScalar(result.depth));
            return true; // Collision occurred
        }
        
        // Check if player is above the ground
        const groundCheck = new THREE.Vector3(
            playerPosition.x,
            playerPosition.y - 0.5, // Check slightly below player
            playerPosition.z
        );
        
        // Check for ground collision
        const onGround = this.checkPointCollision(groundCheck);
        return onGround;
    }

    setupCollisionDetection() {
        // Enhanced collision detection system
        const objects = [];
        this.scene.traverse((child) => {
            if (child.isMesh) {
                if (!child.geometry.boundingBox) {
                    child.geometry.computeBoundingBox();
                }
                objects.push(child);
            }
        });

        // Store objects for future collision checks
        this.collisionObjects = objects;
        
        // Log initial scene objects
        console.log(`Initialized collision system with ${objects.length} objects`);
        
        // Enhanced check for object collisions using octree
        this.checkObjectCollisions = (object) => {
            if (!object.geometry.boundingBox) {
                object.geometry.computeBoundingBox();
            }
            
            // Create a temp matrix to get world position
            const tempMatrix = new THREE.Matrix4();
            tempMatrix.copy(object.matrixWorld);
            
            // Get bounding box in world space
            const objectBox = object.geometry.boundingBox.clone();
            objectBox.applyMatrix4(tempMatrix);
            
            // Check against the octree first for performance
            const collisions = [];
            
            // For simple objects, we can check if their corners are inside the octree
            const corners = [
                new THREE.Vector3(objectBox.min.x, objectBox.min.y, objectBox.min.z),
                new THREE.Vector3(objectBox.min.x, objectBox.min.y, objectBox.max.z),
                new THREE.Vector3(objectBox.min.x, objectBox.max.y, objectBox.min.z),
                new THREE.Vector3(objectBox.min.x, objectBox.max.y, objectBox.max.z),
                new THREE.Vector3(objectBox.max.x, objectBox.min.y, objectBox.min.z),
                new THREE.Vector3(objectBox.max.x, objectBox.min.y, objectBox.max.z),
                new THREE.Vector3(objectBox.max.x, objectBox.max.y, objectBox.min.z),
                new THREE.Vector3(objectBox.max.x, objectBox.max.y, objectBox.max.z)
            ];
            
            // Use the octree to quickly check for collisions
            for (const corner of corners) {
                if (this.worldOctree.containsPoint(corner)) {
                    // Find which object in the octree we're colliding with
                    for (const sceneObject of this.collisionObjects) {
                        // Skip self-collision
                        if (sceneObject === object) continue;
                        
                        const sceneObjectBox = sceneObject.geometry.boundingBox.clone();
                        sceneObjectBox.applyMatrix4(sceneObject.matrixWorld);
                        
                        if (objectBox.intersectsBox(sceneObjectBox)) {
                            collisions.push(sceneObject);
                            break; // We found a colliding object for this corner
                        }
                    }
                }
            }
            
            return collisions;
        };
    }
}
