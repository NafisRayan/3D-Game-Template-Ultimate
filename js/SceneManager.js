import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class SceneManager {
    constructor(useGLB = false) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x88ccee);
        this.scene.fog = new THREE.Fog(0x88ccee, 0, 50);
        
        this.worldOctree = new Octree();
        this.setupLights();
        
        // Track loading state
        this.isWorldLoaded = false;
        
        // Use a loading manager to track progress
        this.loadingManager = new THREE.LoadingManager();
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            console.log(`Loading: ${Math.round(itemsLoaded / itemsTotal * 100)}%`);
        };
        
        // Reusable objects
        this.tempMatrix = new THREE.Matrix4();
        this.tempBox = new THREE.Box3();
        
        // Start loading the world
        if (useGLB) {
            this.loadWorldFromGLB();
        } else {
            this.createBasicWorld();
        }
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
        // Create a temporary floor while GLB loads
        this.createBasicFloor();
        
        const loader = new GLTFLoader(this.loadingManager);
        
        loader.load('./assets/low_poly_industrial_zone.glb', 
            (gltf) => {
                const worldGroup = gltf.scene;
                
                // Use traverse only once for optimization
                worldGroup.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (!child.name) child.name = `mesh_${Math.floor(Math.random() * 1000)}`;
                        
                        // Compute bounding box once
                        child.geometry.computeBoundingBox();
                        
                        // Optimize geometry if possible
                        if (child.geometry) {
                            child.geometry.attributes.position.usage = THREE.StaticDrawUsage;
                            // Merge small objects into batches when possible
                            // (This would require further implementation depending on scene structure)
                        }
                    }
                });
                
                this.scene.add(worldGroup);
                console.log("GLB model added to scene");
                
                // Update the octree with the GLB model
                this.worldOctree.fromGraphNode(worldGroup);
                
                // Mark world as loaded
                this.isWorldLoaded = true;
                
                // Set up helpers and debug UI
                this.setupHelperAndGUI();
            },
            // Progress callback already handled by loading manager
            undefined,
            (error) => {
                console.error('Error loading GLB:', error);
                // Create a basic world if GLB fails
                this.createBasicWorld();
                this.isWorldLoaded = true;
            }
        );
    }

    createBasicFloor() {
        // Basic floor implementation...
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
    }

    createBasicWorld() {
        // Create a basic world with walls and obstacles
        const worldGroup = new THREE.Group();
        
        // Create floor
        const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const floorGeometry = new THREE.BoxGeometry(20, 0.1, 20);
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(0, -0.05, 0);
        floor.receiveShadow = true;
        
        // Create walls
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x4444ff });
        const wallGeometry = new THREE.BoxGeometry(20, 5, 0.1);
        const sideWallGeometry = new THREE.BoxGeometry(0.1, 5, 20);
        
        const frontWall = new THREE.Mesh(wallGeometry, wallMaterial);
        frontWall.position.set(0, 2.5, -10);
        frontWall.castShadow = true;
        frontWall.receiveShadow = true;
        
        const backWall = new THREE.Mesh(wallGeometry, wallMaterial);
        backWall.position.set(0, 2.5, 10);
        backWall.castShadow = true;
        backWall.receiveShadow = true;
        
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.position.set(-10, 2.5, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        
        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.position.set(10, 2.5, 0);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        
        // Add obstacles
        const obstacle1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMaterial);
        obstacle1.position.set(-5, 0.5, -5);
        obstacle1.castShadow = true;
        obstacle1.receiveShadow = true;
        
        const obstacle2 = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), wallMaterial);
        obstacle2.position.set(5, 0.5, 5);
        obstacle2.castShadow = true;
        obstacle2.receiveShadow = true;
        
        worldGroup.add(floor, frontWall, backWall, leftWall, rightWall, obstacle1, obstacle2);
        this.scene.add(worldGroup);
        
        this.worldOctree.fromGraphNode(worldGroup);
        this.setupHelperAndGUI();
        this.isWorldLoaded = true;
    }

    setupHelperAndGUI() {
        try {
            const helper = new OctreeHelper(this.worldOctree);
            helper.visible = false;
            this.scene.add(helper);
    
            const gui = new GUI({ width: 200 });
            gui.add({ debug: false }, "debug").onChange((value) => {
                helper.visible = value;
            });
            console.log("Debug GUI initialized");
        } catch (error) {
            console.error("Error setting up helper/GUI:", error);
        }
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
