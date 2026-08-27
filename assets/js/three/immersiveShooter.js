/* ============================================================
   Velocity X — immersiveShooter.js
   3D Immersive Mission-Based Shooting Game (Three.js Engine)
   Features:
     - First-Person Camera (WASD, Space jump, Mouse look)
     - Multi-floor building & rooftop night environment with neon lighting
     - Fictional NPC target identification (Red Hat, Black Shirt, Blue Shirt)
     - Fictional Weapons System (Pulse Pistol, Vector SMG, Plasma Shotgun, Velocity Rifle)
     - Target identification missions with wrong target penalty & timer
     - Graphics Presets (Low, Medium, High) for 60 FPS performance
   ============================================================ */

import * as THREE from 'three';
import { saveSystem } from '../modules/saveSystem.js';

export const WEAPONS = [
  { id: 'pistol', name: 'Pulse Pistol', maxAmmo: 12, damage: 35, fireRate: 300 },
  { id: 'smg', name: 'Vector SMG', maxAmmo: 30, damage: 20, fireRate: 120 },
  { id: 'shotgun', name: 'Plasma Shotgun', maxAmmo: 8, damage: 80, fireRate: 750 },
  { id: 'rifle', name: 'Velocity Rifle', maxAmmo: 20, damage: 50, fireRate: 200 }
];

export const MISSIONS = [
  { id: 1, title: 'Mission 1', objective: 'ELIMINATE TARGET WITH RED HAT', targetType: 'red_hat', timeLimit: 45, reward: 15000 },
  { id: 2, title: 'Mission 2', objective: 'ELIMINATE TARGET WEARING BLACK SHIRT', targetType: 'black_shirt', timeLimit: 40, reward: 20000 },
  { id: 3, title: 'Mission 3', objective: 'ELIMINATE TARGET WEARING BLUE SHIRT', targetType: 'blue_shirt', timeLimit: 35, reward: 25000 },
  { id: 4, title: 'Mission 4', objective: 'ELIMINATE TARGET ON HIGH ROOFTOP', targetType: 'rooftop_target', timeLimit: 30, reward: 30000 },
  { id: 5, title: 'Mission 5', objective: 'SPEED RUN — CLEAR ALL TARGETS IN 30S', targetType: 'clear_all', timeLimit: 30, reward: 50000 }
];

export class ImmersiveShooterGame {
  constructor(options = {}) {
    this.canvas = options.canvas || document.getElementById('shooter-3d-canvas');
    if (!this.canvas) return;

    this.container = this.canvas.parentElement;

    // Game state
    this.currentMissionIndex = 0;
    this.score = 0;
    this.health = 100;
    this.selectedWeaponIndex = 0;
    this.ammo = WEAPONS[0].maxAmmo;
    this.isReloading = false;
    this.timer = MISSIONS[0].timeLimit;
    this.isTimerRunning = false;
    this.graphicsQuality = 'medium'; // low, medium, high

    // Controls
    this.keys = { up: false, down: false, left: false, right: false, space: false };
    this.playerPos = new THREE.Vector3(0, 3, 12);
    this.playerVelocityY = 0;
    this.isGrounded = true;
    this.yaw = 0;
    this.pitch = 0;

    this.targets = []; // array of { mesh, type, id, isAlive }

    this.init();
  }

  init() {
    this.setupScene();
    this.setupCamera();
    this.buildEnvironment();
    this.spawnNPCs();
    this.setupEvents();
    this.startMission(0);
    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c1026);
    this.scene.fog = new THREE.FogExp2(0x0c1026, 0.012);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    // Ambient & Neon Lighting
    this.ambientLight = new THREE.AmbientLight(0x6078d0, 0.8);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
    this.sunLight.position.set(30, 50, 30);
    this.scene.add(this.sunLight);

    const neonLight = new THREE.PointLight(0xff2f5e, 2.0, 40);
    neonLight.position.set(0, 10, 0);
    this.scene.add(neonLight);
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      70,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      300
    );
    this.camera.position.copy(this.playerPos);
  }

  buildEnvironment() {
    // Rooftop Floor (Concrete Slate)
    const floorGeo = new THREE.BoxGeometry(60, 1, 60);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e2638, roughness: 0.5 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.5;
    this.scene.add(floor);

    // Multi-floor Rooftop Barriers & Structures
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x111728, roughness: 0.3 });

    // Perimeter Glass Walls
    const wallGeo = new THREE.BoxGeometry(60, 4, 1);
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 2, -30);
    this.scene.add(backWall);

    const frontWall = new THREE.Mesh(wallGeo, wallMat);
    frontWall.position.set(0, 2, 30);
    this.scene.add(frontWall);

    // Central Elevated Observation Platform
    const platformGeo = new THREE.BoxGeometry(20, 3, 20);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x1e1b38 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(0, 1.5, -10);
    this.scene.add(platform);

    // Helipad / Target Ring
    const ringGeo = new THREE.RingGeometry(4, 5, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x22d3ff, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 3.01, -10);
    this.scene.add(ring);

    // Neon Skyscraper Background Columns
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const bGeo = new THREE.BoxGeometry(10, 40, 10);
      const bMat = new THREE.MeshStandardMaterial({ color: 0x0c1428, metalness: 0.8 });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(i * 35, 20, -50);
      this.scene.add(bMesh);

      // Glowing Neon Accent Lines
      const lineGeo = new THREE.BoxGeometry(10.2, 1, 10.2);
      const lineMat = new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x22d3ff : 0xff2f5e });
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.position.set(i * 35, 25, -50);
      this.scene.add(lineMesh);
    }
  }

  spawnNPCs() {
    // Clear old targets
    this.targets.forEach(t => this.scene.remove(t.mesh));
    this.targets = [];

    const npcConfigs = [
      { id: 1, type: 'red_hat', color: 0xff2f5e, hatColor: 0xff2f5e, pos: new THREE.Vector3(-12, 1.6, -15) },
      { id: 2, type: 'black_shirt', color: 0x151821, hatColor: null, pos: new THREE.Vector3(0, 4.6, -10) },
      { id: 3, type: 'blue_shirt', color: 0x22d3ff, hatColor: null, pos: new THREE.Vector3(14, 1.6, -12) },
      { id: 4, type: 'rooftop_target', color: 0xa78bfa, hatColor: 0xffd700, pos: new THREE.Vector3(0, 4.6, -18) },
      { id: 5, type: 'white_shirt', color: 0xf8fafc, hatColor: null, pos: new THREE.Vector3(-18, 1.6, 5) }
    ];

    npcConfigs.forEach(config => {
      const npcGroup = new THREE.Group();
      npcGroup.position.copy(config.pos);

      // Body (Torso)
      const bodyGeo = new THREE.BoxGeometry(1.2, 1.8, 0.8);
      const bodyMat = new THREE.MeshStandardMaterial({ color: config.color, roughness: 0.4 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.9;
      npcGroup.add(body);

      // Head
      const headGeo = new THREE.SphereGeometry(0.45, 12, 12);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xfde047 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 2.1;
      npcGroup.add(head);

      // Hat (if config has hatColor)
      if (config.hatColor) {
        const hatGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.2, 12);
        const hatMat = new THREE.MeshBasicMaterial({ color: config.hatColor });
        const hat = new THREE.Mesh(hatGeo, hatMat);
        hat.position.y = 2.5;
        npcGroup.add(hat);
      }

      this.scene.add(npcGroup);
      this.targets.push({
        id: config.id,
        type: config.type,
        mesh: npcGroup,
        isAlive: true
      });
    });
  }

  setupEvents() {
    window.addEventListener('resize', () => this.onResize());

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = true;
      if (e.code === 'Space' && this.isGrounded) {
        this.playerVelocityY = 6.0;
        this.isGrounded = false;
      }
      if (e.code === 'KeyR') this.reloadWeapon();

      // Weapon Select 1-4
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
        this.selectWeapon(idx);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = false;
    });

    let isDragging = false;
    let lastX = 0, lastY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      if (e.button === 0) this.shoot();
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      this.yaw -= dx * 0.005;
      this.pitch -= dy * 0.005;
      this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
    });

    // Weapon buttons & graphics preset handlers
    document.querySelectorAll('.weapon-select-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => this.selectWeapon(idx));
    });

    document.getElementById('btn-gfx-low')?.addEventListener('click', () => this.setGraphicsQuality('low'));
    document.getElementById('btn-gfx-med')?.addEventListener('click', () => this.setGraphicsQuality('medium'));
    document.getElementById('btn-gfx-high')?.addEventListener('click', () => this.setGraphicsQuality('high'));
    document.getElementById('btn-restart-3d-shooter')?.addEventListener('click', () => this.startMission(this.currentMissionIndex));
  }

  setGraphicsQuality(quality) {
    this.graphicsQuality = quality;
    if (quality === 'low') {
      this.renderer.setPixelRatio(0.8);
      this.scene.fog.density = 0.025;
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(1.2);
      this.scene.fog.density = 0.012;
    } else if (quality === 'high') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.scene.fog.density = 0.008;
    }

    document.querySelectorAll('.gfx-preset-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.quality === quality);
    });
  }

  selectWeapon(index) {
    if (index >= 0 && index < WEAPONS.length) {
      this.selectedWeaponIndex = index;
      this.ammo = WEAPONS[index].maxAmmo;
      this.updateHUD();

      document.querySelectorAll('.weapon-select-btn').forEach((btn, idx) => {
        btn.classList.toggle('is-active', idx === index);
      });
    }
  }

  reloadWeapon() {
    if (this.isReloading) return;
    this.isReloading = true;
    const ammoLabel = document.getElementById('hud-3d-ammo');
    if (ammoLabel) ammoLabel.textContent = 'RELOADING...';

    setTimeout(() => {
      this.ammo = WEAPONS[this.selectedWeaponIndex].maxAmmo;
      this.isReloading = false;
      this.updateHUD();
    }, 1000);
  }

  startMission(index) {
    this.currentMissionIndex = index % MISSIONS.length;
    const mission = MISSIONS[this.currentMissionIndex];

    this.timer = mission.timeLimit;
    this.isTimerRunning = true;
    this.spawnNPCs();

    const objLabel = document.getElementById('hud-3d-objective');
    if (objLabel) objLabel.textContent = mission.objective;

    document.getElementById('shooter-3d-overlay')?.classList.add('is-hidden');
    this.updateHUD();
  }

  shoot() {
    if (this.isReloading) return;
    if (this.ammo <= 0) {
      this.reloadWeapon();
      return;
    }

    this.ammo--;
    this.updateHUD();

    // Raycast from camera center
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    const activeMeshes = this.targets.filter(t => t.isAlive).flatMap(t => t.mesh.children);
    const intersects = raycaster.intersectObjects(activeMeshes);

    const warnLabel = document.getElementById('hud-3d-warning');

    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      const targetObj = this.targets.find(t => t.mesh.children.includes(hitObj));

      if (targetObj) {
        const currentMission = MISSIONS[this.currentMissionIndex];
        const isCorrectTarget = (currentMission.targetType === 'clear_all') || (targetObj.type === currentMission.targetType);

        if (isCorrectTarget) {
          // Correct target! Disintegrate NPC
          targetObj.isAlive = false;
          this.scene.remove(targetObj.mesh);
          this.score += 500;
          saveSystem.addCurrency(5000);

          if (warnLabel) {
            warnLabel.textContent = '🎯 TARGET ELIMINATED! +500 PTS';
            warnLabel.style.color = '#4ade80';
          }

          // Check mission win condition
          const remainingRequired = this.targets.filter(t => t.isAlive && (currentMission.targetType === 'clear_all' || t.type === currentMission.targetType));
          if (remainingRequired.length === 0) {
            this.completeMission();
          }
        } else {
          // Wrong target penalty
          this.score = Math.max(0, this.score - 200);
          if (warnLabel) {
            warnLabel.textContent = '⚠️ WRONG TARGET HIT! -200 PTS PENALTY';
            warnLabel.style.color = '#ff2f5e';
          }
        }
      }
    }
  }

  completeMission() {
    this.isTimerRunning = false;
    const mission = MISSIONS[this.currentMissionIndex];
    saveSystem.addCurrency(mission.reward);

    const overlay = document.getElementById('shooter-3d-overlay');
    const title = document.getElementById('shooter-3d-overlay-title');
    if (title) title.textContent = `MISSION COMPLETE! +${mission.reward.toLocaleString()} CR`;
    if (overlay) overlay.classList.remove('is-hidden');
  }

  updateHUD() {
    const weapon = WEAPONS[this.selectedWeaponIndex];
    const scoreLabel = document.getElementById('hud-3d-score');
    const ammoLabel = document.getElementById('hud-3d-ammo');
    const timerLabel = document.getElementById('hud-3d-timer');
    const weaponLabel = document.getElementById('hud-3d-weapon');

    if (scoreLabel) scoreLabel.textContent = this.score;
    if (ammoLabel && !this.isReloading) ammoLabel.textContent = `${this.ammo} / ${weapon.maxAmmo}`;
    if (timerLabel) timerLabel.textContent = `${Math.ceil(this.timer)}s`;
    if (weaponLabel) weaponLabel.textContent = weapon.name;
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  updatePhysics(delta) {
    // Gravity & Ground
    this.playerVelocityY -= 15.0 * delta;
    this.playerPos.y += this.playerVelocityY * delta;

    if (this.playerPos.y <= 2.2) {
      this.playerPos.y = 2.2;
      this.playerVelocityY = 0;
      this.isGrounded = true;
    }

    // WASD Movement
    const speed = 8.0;
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
    this.playerPos.x = Math.max(-25, Math.min(25, this.playerPos.x));
    this.playerPos.z = Math.max(-25, Math.min(25, this.playerPos.z));

    this.camera.position.copy(this.playerPos);

    const lookTarget = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    this.camera.lookAt(this.playerPos.clone().add(lookTarget));

    // Timer update
    if (this.isTimerRunning) {
      this.timer -= delta;
      if (this.timer <= 0) {
        this.timer = 0;
        this.isTimerRunning = false;
        const overlay = document.getElementById('shooter-3d-overlay');
        const title = document.getElementById('shooter-3d-overlay-title');
        if (title) title.textContent = 'TIME EXPIRED! MISSION FAILED';
        if (overlay) overlay.classList.remove('is-hidden');
      }
      this.updateHUD();
    }
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

export function initImmersiveShooter() {
  const canvas = document.getElementById('shooter-3d-canvas');
  if (canvas) {
    window.__immersiveShooterInstance = new ImmersiveShooterGame({ canvas });
  }
}

export default initImmersiveShooter;
