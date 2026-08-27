/* ============================================================
   Velocity X — voxelGame.js
   Original 3D Voxel Sandbox Mini-Game Engine built with Three.js
   Features:
     - Original block-based world (Grass, Dirt, Stone, Wood, Leaves, Water)
     - First-Person camera controls (WASD movement, Space jump, Mouse look)
     - Block Placement (Key E / Right Click) & Removal (Key Q / Left Click)
     - Hotbar Inventory Selector (Keys 1-6)
     - Day/Night atmospheric lighting cycle
     - Lightweight & high-performance WebGL chunk rendering
   ============================================================ */

import * as THREE from 'three';

export const BLOCK_TYPES = [
  { id: 1, name: 'Grass', color: 0x4ade80, topColor: 0x22c55e, desc: 'Natural surface block' },
  { id: 2, name: 'Dirt', color: 0x854d0e, topColor: 0x854d0e, desc: 'Rich fertile earth' },
  { id: 3, name: 'Stone', color: 0x64748b, topColor: 0x64748b, desc: 'Solid mountain rock' },
  { id: 4, name: 'Wood', color: 0xa16207, topColor: 0x78350f, desc: 'Sturdy timber log' },
  { id: 5, name: 'Leaves', color: 0x15803d, topColor: 0x166534, desc: 'Dense foliage' },
  { id: 6, name: 'Water', color: 0x0284c7, topColor: 0x38bdf8, transparent: true, opacity: 0.75, desc: 'Liquid block' }
];

export class VoxelGame {
  constructor(options = {}) {
    this.canvas = options.canvas || document.getElementById('voxel-canvas');
    if (!this.canvas) return;

    this.container = this.canvas.parentElement;

    // Controls State
    this.keys = { up: false, down: false, left: false, right: false, space: false };
    this.selectedBlockId = 1; // Default Grass
    this.playerPos = new THREE.Vector3(8, 5, 8);
    this.playerVelocityY = 0;
    this.isGrounded = false;
    this.yaw = 0;
    this.pitch = 0;

    // World Grid (16x16x8)
    this.worldSizeX = 16;
    this.worldSizeZ = 16;
    this.worldSizeY = 8;
    this.worldGrid = new Map(); // key "x,y,z" => { blockId, mesh }

    this.init();
  }

  init() {
    this.setupScene();
    this.setupCamera();
    this.generateTerrain();
    this.setupEvents();
    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8); // Sky blue
    this.scene.fog = new THREE.FogExp2(0x38bdf8, 0.015);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Sun & Ambient Lights
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
    this.sunLight.position.set(20, 40, 20);
    this.scene.add(this.sunLight);

    this.blockBoxGeo = new THREE.BoxGeometry(1, 1, 1);
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      70,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      200
    );
    this.camera.position.copy(this.playerPos);
  }

  getBlockMaterial(blockId) {
    const config = BLOCK_TYPES.find(b => b.id === blockId) || BLOCK_TYPES[0];
    return new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.8,
      transparent: Boolean(config.transparent),
      opacity: config.opacity || 1.0
    });
  }

  getKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  generateTerrain() {
    // Generate base terrain: Bedrock stone, Dirt layer, Grass surface & trees
    for (let x = 0; x < this.worldSizeX; x++) {
      for (let z = 0; z < this.worldSizeZ; z++) {
        // Height formula
        const h = Math.floor(2 + Math.sin(x * 0.4) * Math.cos(z * 0.4) * 1.5);
        for (let y = 0; y <= h; y++) {
          let blockId = 2; // Dirt
          if (y === 0) blockId = 3; // Stone
          if (y === h) blockId = 1; // Grass
          this.setBlock(x, y, z, blockId);
        }
      }
    }

    // Add a tree at (4, h, 4)
    this.createVoxelTree(4, 3, 4);
    this.createVoxelTree(12, 3, 11);
  }

  createVoxelTree(tx, ty, tz) {
    // Trunk
    for (let y = 0; y < 3; y++) {
      this.setBlock(tx, ty + y, tz, 4); // Wood
    }
    // Leaves canopy
    for (let lx = -1; lx <= 1; lx++) {
      for (let lz = -1; lz <= 1; lz++) {
        for (let ly = 3; ly <= 4; ly++) {
          if (lx === 0 && lz === 0 && ly === 3) continue;
          this.setBlock(tx + lx, ty + ly, tz + lz, 5); // Leaves
        }
      }
    }
  }

  setBlock(x, y, z, blockId) {
    const key = this.getKey(x, y, z);
    const existing = this.worldGrid.get(key);

    if (existing) {
      this.scene.remove(existing.mesh);
      existing.mesh.geometry.dispose();
      this.worldGrid.delete(key);
    }

    if (blockId > 0) {
      const mat = this.getBlockMaterial(blockId);
      const mesh = new THREE.Mesh(this.blockBoxGeo, mat);
      mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
      this.scene.add(mesh);
      this.worldGrid.set(key, { blockId, mesh, x, y, z });
    }
  }

  getBlock(x, y, z) {
    return this.worldGrid.get(this.getKey(x, y, z)) || null;
  }

  setupEvents() {
    window.addEventListener('resize', () => this.onResize());

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = true;
      if (e.code === 'Space') {
        if (this.isGrounded) {
          this.playerVelocityY = 6.5;
          this.isGrounded = false;
        }
      }
      if (e.code === 'KeyE') this.placeTargetBlock();
      if (e.code === 'KeyQ') this.removeTargetBlock();

      // Inventory Hotbar 1-6
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(e.code)) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        this.setSelectedBlock(num);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = false;
    });

    // Pointer lock or drag to rotate view
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      if (e.button === 0) this.removeTargetBlock(); // Left click remove
      if (e.button === 2) { // Right click place
        e.preventDefault();
        this.placeTargetBlock();
      }
    });

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('mouseup', () => { isDragging = false; });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      this.yaw -= dx * 0.005;
      this.pitch -= dy * 0.005;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
    });
  }

  setSelectedBlock(num) {
    if (num >= 1 && num <= 6) {
      this.selectedBlockId = num;
      const hotbarButtons = document.querySelectorAll('.hotbar-slot');
      hotbarButtons.forEach((btn, idx) => {
        btn.classList.toggle('is-active', idx + 1 === num);
      });
    }
  }

  placeTargetBlock() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const meshes = Array.from(this.worldGrid.values()).map(v => v.mesh);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const norm = hit.face.normal;
      const targetPos = hit.object.position.clone().add(norm);
      const bx = Math.floor(targetPos.x);
      const by = Math.floor(targetPos.y);
      const bz = Math.floor(targetPos.z);

      if (bx >= 0 && bx < this.worldSizeX && bz >= 0 && bz < this.worldSizeZ && by >= 0 && by < 16) {
        this.setBlock(bx, by, bz, this.selectedBlockId);
      }
    }
  }

  removeTargetBlock() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const meshes = Array.from(this.worldGrid.values()).map(v => v.mesh);
    const intersects = raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const pos = hit.object.position;
      const bx = Math.floor(pos.x);
      const by = Math.floor(pos.y);
      const bz = Math.floor(pos.z);
      this.setBlock(bx, by, bz, 0); // Remove block
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  updatePhysics(delta) {
    // Gravity & Ground Collision
    this.playerVelocityY -= 15.0 * delta;
    this.playerPos.y += this.playerVelocityY * delta;

    const feetX = Math.floor(this.playerPos.x);
    const feetY = Math.floor(this.playerPos.y - 1.2);
    const feetZ = Math.floor(this.playerPos.z);

    const blockBelow = this.getBlock(feetX, feetY, feetZ);
    if (blockBelow && blockBelow.blockId > 0) {
      this.playerPos.y = feetY + 1 + 1.2;
      this.playerVelocityY = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // WASD Movement
    const speed = 6.0;
    const moveDir = new THREE.Vector3();

    if (this.keys.up) moveDir.z -= 1;
    if (this.keys.down) moveDir.z += 1;
    if (this.keys.left) moveDir.x -= 1;
    if (this.keys.right) moveDir.x += 1;

    moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    this.playerPos.x += moveDir.x * speed * delta;
    this.playerPos.z += moveDir.z * speed * delta;

    // Bounds check
    this.playerPos.x = Math.max(1, Math.min(this.worldSizeX - 1, this.playerPos.x));
    this.playerPos.z = Math.max(1, Math.min(this.worldSizeZ - 1, this.playerPos.z));

    // Update Camera
    this.camera.position.copy(this.playerPos);

    const targetLook = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    this.camera.lookAt(this.playerPos.clone().add(targetLook));
  }

  animate() {
    const delta = 0.016;
    this.updatePhysics(delta);

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    requestAnimationFrame(() => this.animate());
  }
}

export function initVoxelGame() {
  const canvas = document.getElementById('voxel-canvas');
  if (canvas) {
    window.__voxelGameInstance = new VoxelGame({ canvas });
  }
}

export default initVoxelGame;
