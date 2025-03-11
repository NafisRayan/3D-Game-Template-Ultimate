import * as THREE from 'three';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let useGLB = 0;
export class SceneManager {
    constructor(useGLB = 0) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x88ccee);
        this.scene.fog = new THREE.Fog(0x88ccee, 0, 50);
        
        this.worldOctree = new Octree();
        this.setupLights();
        
        if (useGLB == 1) {
            this.loadWorldFromGLB();
        } else {
            this.setupWorldManually();
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
        const loader = new GLTFLoader();
        loader.load('./assets/low_poly_industrial_zone.glb', (gltf) => {
            const worldGroup = gltf.scene;
            worldGroup.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // Assign a name if it doesn't have one
                    if (!child.name) child.name = `mesh_${Math.floor(Math.random() * 1000)}`;
                }
            });
            this.scene.add(worldGroup);
            this.worldOctree.fromGraphNode(worldGroup);

            // Add a floor with proper dimensions
            const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const floorGeometry = new THREE.BoxGeometry(100, 0.1, 100); // Larger floor to ensure coverage
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.set(0, -0.05, 0);
            floor.castShadow = false;
            floor.receiveShadow = true;
            floor.name = "floor";
            this.scene.add(floor);
            this.worldOctree.fromGraphNode(floor);

            const helper = new OctreeHelper(this.worldOctree);
            helper.visible = false;
            this.scene.add(helper);

            const gui = new GUI({ width: 200 });
            gui.add({ debug: false }, "debug").onChange((value) => {
                helper.visible = value;
            });

            // Enhanced collision logic
            this.setupCollisionDetection();
        });
    }

    checkCollisions() {
        // This method is now replaced by setupCollisionDetection
        // Keeping it for backward compatibility
        this.setupCollisionDetection();
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
        
        // Set up a method that can be called from the game loop
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
            
            // Check against all scene objects
            const collisions = [];
            for (const sceneObject of this.collisionObjects) {
                // Skip self-collision
                if (sceneObject === object) continue;
                
                const sceneObjectBox = sceneObject.geometry.boundingBox.clone();
                sceneObjectBox.applyMatrix4(sceneObject.matrixWorld);
                
                if (objectBox.intersectsBox(sceneObjectBox)) {
                    collisions.push(sceneObject);
                }
            }
            
            return collisions;
        };
    }

    setupWorldManually() {
        const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x4444ff });

        const floorGeometry = new THREE.BoxGeometry(20, 0.1, 20);
        const wallGeometry = new THREE.BoxGeometry(20, 5, 0.1);
        const sideWallGeometry = new THREE.BoxGeometry(0.1, 5, 20);

        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(0, -0.05, 0);
        floor.castShadow = true;
        floor.receiveShadow = true;

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

        const obstacle1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMaterial);
        obstacle1.position.set(-5, 0.5, -5);
        obstacle1.castShadow = true;
        obstacle1.receiveShadow = true;

        const obstacle2 = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), wallMaterial);
        obstacle2.position.set(5, 0.5, 5);
        obstacle2.castShadow = true;
        obstacle2.receiveShadow = true;

        const worldGroup = new THREE.Group();
        worldGroup.add(floor, frontWall, backWall, leftWall, rightWall, obstacle1, obstacle2);
        this.scene.add(worldGroup);

        this.worldOctree.fromGraphNode(worldGroup);

        const helper = new OctreeHelper(this.worldOctree);
        helper.visible = false;
        this.scene.add(helper);

        const gui = new GUI({ width: 200 });
        gui.add({ debug: false }, "debug").onChange((value) => {
            helper.visible = value;
        });
    }
}
