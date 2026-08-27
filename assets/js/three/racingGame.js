/* ============================================================
   Velocity X — racingGame.js
   Full 3D WebGL Car Racing Engine powered by Three.js
   Features:
     - Interactive In-Game Garage Car Selector (Live 3D Model Swap)
     - 3-Lap Mission Engine & Lap Detection
     - Rich Cinematic Night City Visuals (Indigo Sky, Reflective Road, Streetlamps, Skyscrapers, Headlights & Underglow)
     - Virtual CR Rewards & 400,000 CR Final Challenge Trigger
   ============================================================ */

import * as THREE from 'three';
import { bus } from '../modules/utils.js';
import { saveSystem } from '../modules/saveSystem.js';
import { getCarById } from '../data/cars.js';

export class RacingGame {
  constructor(options = {}) {
    this.canvas = options.canvas || document.getElementById('racing-canvas');
    if (!this.canvas) return;

    this.container = this.canvas.parentElement;

    // Game state
    this.isStarted = false;
    this.isFinished = false;
    this.isFinalMode = false;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.lap = 1;
    this.totalLaps = 3;
    this.nextCheckpointIndex = 1;
    this.checkpointPassed = [true, false, false, false];

    // Controls
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      space: false,
    };

    // Physics
    this.speed = 0;
    this.maxSpeed = 58.0;
    this.maxReverseSpeed = -18.0;
    this.acceleration = 28.0;
    this.braking = 36.0;
    this.friction = 12.0;
    this.steeringAngle = 0;
    this.maxSteerAngle = 0.55;
    this.steerSpeed = 2.8;
    this.carHeading = 0;
    this.carPosition = new THREE.Vector3();

    this.trackWidth = 24.0;
    this.trackCurve = null;

    this.animationFrameId = null;
    this.lastFrameTime = performance.now();

    this.init();
  }

  init() {
    this.setupScene();
    this.setupTrack();
    this.setupCityEnvironment();
    this.setupCar();
    this.setupCamera();
    this.setupEvents();

    this.updateCarFromSave();
    this.resetRace();
    this.animate();

    bus.on('car:selected', () => this.updateCarFromSave());
    bus.on('game:start-final', () => {
      this.isFinalMode = true;
      this.totalLaps = 5;
      this.resetRace();
      this.startRace();
    });
  }

  updateCarFromSave() {
    const carId = saveSystem.getSelectedCar();
    const carData = getCarById(carId) || getCarById('vx-01-apex');
    if (carData && this.carBodyMaterial) {
      this.carBodyMaterial.color.set(carData.paint || 0x22d3ff);
      if (this.underglowMaterial) {
        this.underglowMaterial.color.set(carData.accent || 0x22d3ff);
      }
      // Sync performance stats
      const speedMultiplier = (carData.topSpeed || 350) / 350;
      this.maxSpeed = 52.0 * speedMultiplier;
      this.acceleration = 28.0 * ((carData.horsepower || 1000) / 1000);

      const activeCarLabel = document.getElementById('hud-car-val');
      if (activeCarLabel) {
        activeCarLabel.textContent = carData.name;
      }
    }
  }

  setupScene() {
    this.scene = new THREE.Scene();
    
    // Atmospheric Night Sky & Fog
    this.scene.background = new THREE.Color(0x0a0e28);
    this.scene.fog = new THREE.FogExp2(0x0a0e28, 0.0025);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // Cinematic Lighting System
    const ambientLight = new THREE.AmbientLight(0x7090dd, 0.8);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x3b4c9e, 0x11162b, 1.2);
    this.scene.add(hemiLight);

    const mainMoonLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    mainMoonLight.position.set(120, 180, 80);
    mainMoonLight.castShadow = true;
    this.scene.add(mainMoonLight);

    const neonAccentLight = new THREE.DirectionalLight(0xff2f5e, 1.2);
    neonAccentLight.position.set(-120, 100, -100);
    this.scene.add(neonAccentLight);
  }

  setupTrack() {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(140, 0, 50),
      new THREE.Vector3(280, 0, 180),
      new THREE.Vector3(300, 0, 360),
      new THREE.Vector3(160, 0, 480),
      new THREE.Vector3(-60, 0, 420),
      new THREE.Vector3(-220, 0, 280),
      new THREE.Vector3(-260, 0, 140),
      new THREE.Vector3(-140, 0, -30),
    ];

    this.trackCurve = new THREE.CatmullRomCurve3(points, true, 'centripetal');

    const samples = 400;
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];

    const halfWidth = this.trackWidth / 2;
    const innerPoints = [];
    const outerPoints = [];

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = this.trackCurve.getPointAt(t);
      const tangent = this.trackCurve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const left = point.clone().add(normal.clone().multiplyScalar(halfWidth));
      const right = point.clone().add(normal.clone().multiplyScalar(-halfWidth));

      vertices.push(left.x, left.y + 0.05, left.z);
      vertices.push(right.x, right.y + 0.05, right.z);

      uvs.push(0, i * 2);
      uvs.push(1, i * 2);

      if (i < samples) {
        const row = i * 2;
        indices.push(row, row + 1, row + 2);
        indices.push(row + 1, row + 3, row + 2);
      }

      innerPoints.push(point.clone().add(normal.clone().multiplyScalar(halfWidth + 0.4)));
      outerPoints.push(point.clone().add(normal.clone().multiplyScalar(-halfWidth - 0.4)));
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e2738,
      roughness: 0.45,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });

    const roadMesh = new THREE.Mesh(geometry, roadMaterial);
    roadMesh.receiveShadow = true;
    this.scene.add(roadMesh);

    // Glowing Neon Curbs
    const innerCurve = new THREE.CatmullRomCurve3(innerPoints, true);
    const outerCurve = new THREE.CatmullRomCurve3(outerPoints, true);
    const innerGeo = new THREE.TubeGeometry(innerCurve, 250, 0.45, 8, true);
    const outerGeo = new THREE.TubeGeometry(outerCurve, 250, 0.45, 8, true);

    const cyanNeonMat = new THREE.MeshBasicMaterial({ color: 0x22d3ff });
    const magentaNeonMat = new THREE.MeshBasicMaterial({ color: 0xff2f5e });

    this.scene.add(new THREE.Mesh(innerGeo, cyanNeonMat));
    this.scene.add(new THREE.Mesh(outerGeo, magentaNeonMat));

    // Center Dashed Line Markings
    for (let i = 0; i < samples; i += 4) {
      const t = i / samples;
      const point = this.trackCurve.getPointAt(t);
      const tangent = this.trackCurve.getTangentAt(t);
      
      const lineGeo = new THREE.BoxGeometry(0.4, 0.08, 2.5);
      const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
      const dash = new THREE.Mesh(lineGeo, lineMat);
      dash.position.copy(point);
      dash.position.y += 0.08;
      dash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      this.scene.add(dash);
    }

    // Checkpoints Setup
    this.checkpoints = [
      { index: 0, t: 0.0, name: 'Finish / Start', pos: this.trackCurve.getPointAt(0.0) },
      { index: 1, t: 0.25, name: 'Checkpoint 1', pos: this.trackCurve.getPointAt(0.25) },
      { index: 2, t: 0.5, name: 'Checkpoint 2', pos: this.trackCurve.getPointAt(0.5) },
      { index: 3, t: 0.75, name: 'Checkpoint 3', pos: this.trackCurve.getPointAt(0.75) },
    ];

    this.checkpoints.forEach((cp, idx) => {
      this.createCheckpointArch(cp, idx === 0);
    });

    // Street Lamps along track
    for (let i = 0; i < samples; i += 16) {
      const t = i / samples;
      const point = this.trackCurve.getPointAt(t);
      const tangent = this.trackCurve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const pos = point.clone().add(normal.clone().multiplyScalar(halfWidth + 3.0));

      this.createStreetLamp(pos, tangent);
    }
  }

  createStreetLamp(pos, tangent) {
    const lampGroup = new THREE.Group();
    lampGroup.position.copy(pos);

    const poleGeo = new THREE.CylinderGeometry(0.2, 0.3, 10, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 5;

    const headGeo = new THREE.BoxGeometry(1.2, 0.4, 2.0);
    const headMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 10, 0);

    lampGroup.add(pole);
    lampGroup.add(head);

    this.scene.add(lampGroup);
  }

  createCheckpointArch(cp, isStartFinish) {
    const point = cp.pos;
    const tangent = this.trackCurve.getTangentAt(cp.t);
    const archGroup = new THREE.Group();
    archGroup.position.copy(point);
    archGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);

    const width = this.trackWidth + 6;
    const height = 13;

    const pillarGeo = new THREE.BoxGeometry(1.8, height, 1.8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });

    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(-width / 2, height / 2, 0);

    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(width / 2, height / 2, 0);

    const crossGeo = new THREE.BoxGeometry(width + 2, 2.5, 2.2);
    const neonColor = isStartFinish ? 0xff2f5e : 0x22d3ff;
    const crossMat = new THREE.MeshBasicMaterial({ color: neonColor });
    const crossbar = new THREE.Mesh(crossGeo, crossMat);
    crossbar.position.set(0, height, 0);

    archGroup.add(leftPillar);
    archGroup.add(rightPillar);
    archGroup.add(crossbar);

    this.scene.add(archGroup);
  }

  setupCityEnvironment() {
    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f1526, roughness: 0.85 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const numBuildings = 150;
    const buildingColors = [0x162036, 0x1e1b38, 0x13263b, 0x1c2438];

    for (let i = 0; i < numBuildings; i++) {
      const t = i / numBuildings;
      const point = this.trackCurve.getPointAt(t);
      const tangent = this.trackCurve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const side = (i % 2 === 0 ? 1 : -1);
      const offsetDist = this.trackWidth / 2 + 14 + Math.random() * 32;
      const pos = point.clone().add(normal.clone().multiplyScalar(side * offsetDist));

      const bColor = buildingColors[i % buildingColors.length];
      const bMat = new THREE.MeshStandardMaterial({ color: bColor, metalness: 0.6, roughness: 0.3 });
      const building = new THREE.Mesh(buildingGeo, bMat);

      const bWidth = 20 + Math.random() * 28;
      const bHeight = 55 + Math.random() * 120;
      const bDepth = 20 + Math.random() * 28;

      building.scale.set(bWidth, bHeight, bDepth);
      building.position.set(pos.x, bHeight / 2, pos.z);
      building.castShadow = true;
      this.scene.add(building);

      const numWindows = 2 + (i % 4);
      for (let w = 0; w < numWindows; w++) {
        const windowGeo = new THREE.BoxGeometry(bWidth + 0.3, 1.8, bDepth + 0.3);
        const winColor = (i + w) % 4 === 0 ? 0x22d3ff : ((i + w) % 4 === 1 ? 0xff2f5e : ((i + w) % 4 === 2 ? 0xffcc00 : 0xa78bfa));
        const windowMat = new THREE.MeshBasicMaterial({ color: winColor });
        const accent = new THREE.Mesh(windowGeo, windowMat);
        const heightLevel = bHeight * (0.3 + w * 0.2);
        accent.position.set(pos.x, heightLevel, pos.z);
        this.scene.add(accent);
      }
    }
  }

  setupCar() {
    this.carGroup = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(2.4, 1.1, 5.0);
    this.carBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x22d3ff,
      metalness: 0.85,
      roughness: 0.2,
    });
    const body = new THREE.Mesh(bodyGeo, this.carBodyMaterial);
    body.position.y = 0.8;
    body.castShadow = true;
    this.carGroup.add(body);

    const cabinGeo = new THREE.BoxGeometry(2.0, 0.85, 2.6);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x05060b, metalness: 0.95, roughness: 0.05 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.6, -0.2);
    this.carGroup.add(cabin);

    // Headlights
    const hlGeo = new THREE.BoxGeometry(0.6, 0.25, 0.1);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hlLeft = new THREE.Mesh(hlGeo, hlMat);
    hlLeft.position.set(-0.8, 0.8, 2.51);
    const hlRight = new THREE.Mesh(hlGeo, hlMat);
    hlRight.position.set(0.8, 0.8, 2.51);

    this.carGroup.add(hlLeft);
    this.carGroup.add(hlRight);

    // Taillights
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const tlLeft = new THREE.Mesh(hlGeo, tlMat);
    tlLeft.position.set(-0.8, 0.8, -2.51);
    const tlRight = new THREE.Mesh(hlGeo, tlMat);
    tlRight.position.set(0.8, 0.8, -2.51);

    this.carGroup.add(tlLeft);
    this.carGroup.add(tlRight);

    // Underglow
    const glowGeo = new THREE.PlaneGeometry(3.0, 5.5);
    this.underglowMaterial = new THREE.MeshBasicMaterial({ color: 0x22d3ff, side: THREE.DoubleSide });
    const underglow = new THREE.Mesh(glowGeo, this.underglowMaterial);
    underglow.rotation.x = Math.PI / 2;
    underglow.position.y = 0.1;
    this.carGroup.add(underglow);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 18);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151821, roughness: 0.8 });

    this.wheels = {
      fl: new THREE.Mesh(wheelGeo, wheelMat),
      fr: new THREE.Mesh(wheelGeo, wheelMat),
      rl: new THREE.Mesh(wheelGeo, wheelMat),
      rr: new THREE.Mesh(wheelGeo, wheelMat),
    };

    this.wheels.fl.position.set(-1.3, 0.5, 1.6);
    this.wheels.fr.position.set(1.3, 0.5, 1.6);
    this.wheels.rl.position.set(-1.3, 0.5, -1.6);
    this.wheels.rr.position.set(1.3, 0.5, -1.6);

    Object.values(this.wheels).forEach(w => this.carGroup.add(w));

    this.scene.add(this.carGroup);
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
  }

  setupEvents() {
    window.addEventListener('resize', () => this.onWindowResize());

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = true;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = true;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = true;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = true;
      if (e.code === 'Space') this.keys.space = true;
      if (e.code === 'KeyR') this.resetRace();
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) this.keys.up = false;
      if (['ArrowDown', 'KeyS'].includes(e.code)) this.keys.down = false;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) this.keys.left = false;
      if (['ArrowRight', 'KeyD'].includes(e.code)) this.keys.right = false;
      if (e.code === 'Space') this.keys.space = false;
    });

    document.getElementById('btn-start-race')?.addEventListener('click', () => this.startRace());
    document.getElementById('btn-restart-race')?.addEventListener('click', () => this.resetRace());
    document.getElementById('btn-manual-restart')?.addEventListener('click', () => this.resetRace());
    document.getElementById('btn-in-game-garage')?.addEventListener('click', () => this.openInGameGarage());
  }

  openInGameGarage() {
    let modal = document.getElementById('modal-in-game-garage');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-in-game-garage';
      modal.className = 'modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }

    const currentCarId = saveSystem.getSelectedCar();
    const carsList = [
      { id: 'vx-01-apex', name: 'Apex Zero', topSpeed: 412, hp: 1420, paint: '#0b1220', accent: '#22d3ff' },
      { id: 'vx-02-rune', name: 'Rune GTX', topSpeed: 356, hp: 940, paint: '#151b2e', accent: '#7c5cff' },
      { id: 'vx-03-kestrel', name: 'Kestrel R', topSpeed: 328, hp: 780, paint: '#0f172a', accent: '#f5d90a' },
      { id: 'vx-04-nomad', name: 'Nomad ST', topSpeed: 274, hp: 620, paint: '#1a2416', accent: '#4ade80' },
      { id: 'vx-05-vantage', name: 'Vantage Drift', topSpeed: 298, hp: 850, paint: '#2b0f1e', accent: '#ff2d78' },
      { id: 'vx-08-halo', name: 'Halo Prototype', topSpeed: 438, hp: 1650, paint: '#070b14', accent: '#22d3ff' },
    ];

    modal.innerHTML = `
      <div class="modal__backdrop" data-modal-close></div>
      <div class="modal__panel glass" style="max-width: 800px; padding: 2rem;">
        <button class="modal__close" id="btn-close-ig-garage" type="button">&times;</button>
        <h3 style="font-family: Orbitron, sans-serif; margin-bottom: 0.5rem;">🏎️ 3D In-Game Garage</h3>
        <p style="color: #94a3b8; margin-bottom: 1.5rem;">Select a hypercar to dynamically update your vehicle appearance, speed, and handling in the 3D engine.</p>
        
        <div class="grid grid--2 stagger">
          ${carsList.map(car => {
            const isSelected = car.id === currentCarId;
            return `
              <div class="card glass car-ig-card ${isSelected ? 'is-selected' : ''}" style="padding: 1.2rem; border: 1px solid ${isSelected ? '#22d3ff' : 'rgba(255,255,255,0.1)'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <strong style="font-size: 1.1rem; font-family: Orbitron, sans-serif;">${car.name}</strong>
                  <span style="width: 16px; height: 16px; border-radius: 50%; background: ${car.accent}; border: 1px solid #fff;"></span>
                </div>
                <div style="font-size: 0.85rem; color: #94a3b8; margin: 0.6rem 0;">
                  <span>Top Speed: <b style="color: #fff;">${car.topSpeed} km/h</b></span> · 
                  <span>Power: <b style="color: #fff;">${car.hp} HP</b></span>
                </div>
                <button class="btn ${isSelected ? 'btn--ghost' : 'btn--primary'} btn--sm btn--block btn-select-ig-car" 
                        data-car-id="${car.id}" 
                        ${isSelected ? 'disabled' : ''} 
                        type="button">
                  <span>${isSelected ? 'Active Car' : 'SELECT / USE CAR'}</span>
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    const closeBtn = document.getElementById('btn-close-ig-garage');
    const backdrop = modal.querySelector('.modal__backdrop');

    const closeHandler = () => {
      modal.classList.remove('is-open');
      modal.hidden = true;
      document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeHandler);
    backdrop?.addEventListener('click', closeHandler);

    modal.querySelectorAll('.btn-select-ig-car').forEach(btn => {
      btn.addEventListener('click', () => {
        const carId = btn.dataset.carId;
        saveSystem.setSelectedCar(carId);
        bus.emit('car:selected', carId);
        this.updateCarFromSave();
        closeHandler();
      });
    });
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  resetRace() {
    this.isStarted = false;
    this.isFinished = false;
    this.lap = 1;
    this.elapsedTime = 0;
    this.speed = 0;
    this.steeringAngle = 0;

    const startPos = this.checkpoints[0].pos;
    const tangent = this.trackCurve.getTangentAt(0);

    this.carPosition.copy(startPos);
    this.carPosition.y = 0;
    this.carHeading = Math.atan2(tangent.x, tangent.z);

    this.carGroup.position.copy(this.carPosition);
    this.carGroup.rotation.y = this.carHeading;

    this.checkpointPassed = [true, false, false, false];
    this.nextCheckpointIndex = 1;

    document.getElementById('racing-start-overlay')?.classList.remove('is-hidden');
    document.getElementById('racing-finish-overlay')?.classList.add('is-hidden');

    this.updateHUD();
  }

  startRace() {
    this.isStarted = true;
    this.isFinished = false;
    this.startTime = performance.now();
    document.getElementById('racing-start-overlay')?.classList.add('is-hidden');
  }

  updatePhysics(delta) {
    if (!this.isStarted || this.isFinished) return;

    if (this.keys.up) {
      this.speed += this.acceleration * delta;
    } else if (this.keys.down) {
      this.speed -= this.braking * delta;
    } else {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.friction * delta);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.friction * delta);
      }
    }

    if (this.keys.space) {
      this.speed *= (1 - 2.5 * delta);
    }

    this.speed = Math.max(this.maxReverseSpeed, Math.min(this.maxSpeed, this.speed));

    if (this.keys.left) {
      this.steeringAngle = Math.min(this.maxSteerAngle, this.steeringAngle + this.steerSpeed * delta);
    } else if (this.keys.right) {
      this.steeringAngle = Math.max(-this.maxSteerAngle, this.steeringAngle - this.steerSpeed * delta);
    } else {
      this.steeringAngle *= (1 - 8.0 * delta);
    }

    if (Math.abs(this.speed) > 0.5) {
      const dir = this.speed >= 0 ? 1 : -1;
      this.carHeading += this.steeringAngle * (this.speed / this.maxSpeed) * delta * dir;
    }

    const moveX = Math.sin(this.carHeading) * this.speed * delta;
    const moveZ = Math.cos(this.carHeading) * this.speed * delta;

    this.carPosition.x += moveX;
    this.carPosition.z += moveZ;

    this.carGroup.position.copy(this.carPosition);
    this.carGroup.rotation.y = this.carHeading;

    this.checkCheckpoints();
    this.elapsedTime = (performance.now() - this.startTime) / 1000;
  }

  checkCheckpoints() {
    const cp = this.checkpoints[this.nextCheckpointIndex];
    const dist = this.carPosition.distanceTo(cp.pos);

    if (dist < this.trackWidth * 0.9) {
      this.checkpointPassed[this.nextCheckpointIndex] = true;
      this.nextCheckpointIndex = (this.nextCheckpointIndex + 1) % this.checkpoints.length;

      if (this.nextCheckpointIndex === 1 && this.checkpointPassed[3]) {
        this.lap += 1;
        this.checkpointPassed = [true, false, false, false];

        // Award in-game currency on lap completion
        saveSystem.addCurrency(25000);

        if (this.lap > this.totalLaps) {
          this.finishRace();
        }
      }
    }
  }

  finishRace() {
    this.isFinished = true;
    this.isStarted = false;

    // Complete the 3-Lap Circuit Mission & award 10,000 CR reward!
    saveSystem.completeMission('m2-circuit', 10000);

    const reward = this.isFinalMode ? 200000 : 75000;
    saveSystem.addCurrency(reward);

    if (this.isFinalMode) {
      saveSystem.setFinalChallengeCompleted();
    }

    const finishOverlay = document.getElementById('racing-finish-overlay');
    const finalTimeLabel = document.getElementById('final-race-time');

    if (finalTimeLabel) {
      finalTimeLabel.textContent = this.formatTime(this.elapsedTime);
    }

    if (finishOverlay) {
      finishOverlay.classList.remove('is-hidden');
    }
  }

  updateCamera() {
    const camOffset = new THREE.Vector3(
      -Math.sin(this.carHeading) * 14,
      5.5,
      -Math.cos(this.carHeading) * 14
    );

    const targetCamPos = this.carPosition.clone().add(camOffset);
    this.camera.position.lerp(targetCamPos, 0.1);

    const lookTarget = this.carPosition.clone().add(new THREE.Vector3(0, 1.8, 0));
    this.camera.lookAt(lookTarget);
  }

  updateHUD() {
    const lapVal = document.getElementById('hud-lap-val');
    const timerVal = document.getElementById('hud-timer-val');
    const cpVal = document.getElementById('hud-cp-val');
    const speedVal = document.getElementById('hud-speed-val');
    const speedFill = document.getElementById('hud-speed-fill');
    const crVal = document.getElementById('hud-cr-val');

    if (lapVal) lapVal.textContent = `${Math.min(this.lap, this.totalLaps)} / ${this.totalLaps}`;
    if (timerVal) timerVal.textContent = this.formatTime(this.elapsedTime);
    if (cpVal) cpVal.textContent = `${this.nextCheckpointIndex} / 4`;
    if (crVal) crVal.textContent = `${saveSystem.getCurrency().toLocaleString()} CR`;

    const kmh = Math.round(Math.abs(this.speed) * 3.2);
    if (speedVal) speedVal.textContent = kmh;
    if (speedFill) speedFill.style.width = `${Math.min(100, (kmh / 240) * 100)}%`;
  }

  formatTime(sec) {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  animate() {
    const now = performance.now();
    const delta = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.updatePhysics(delta);
    this.updateCamera();
    this.updateHUD();

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }
}

export function initRacingGame() {
  const canvas = document.getElementById('racing-canvas');
  if (canvas) {
    window.__racingGameInstance = new RacingGame({ canvas });
  }
}

export default initRacingGame;
