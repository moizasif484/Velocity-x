/* ============================================================
   Velocity X — shootingArena.js
   Original Action Shooting Arena Mini-Game
   Features:
     - Arcade target shooter with crosshair mouse aiming
     - Wave-based target drones & obstacles
     - Health, Score, Ammo & Reload mechanics
     - Win/Lose state screens & 60 FPS Canvas rendering
   ============================================================ */

export class ShootingArenaGame {
  constructor(options = {}) {
    this.canvas = options.canvas || document.getElementById('shooter-canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.container = this.canvas.parentElement;

    this.score = 0;
    this.health = 100;
    this.ammo = 10;
    this.maxAmmo = 10;
    this.wave = 1;
    this.isReloading = false;
    this.isGameOver = false;

    this.crosshair = { x: 240, y: 280 };
    this.targets = [];
    this.particles = [];

    this.init();
  }

  init() {
    this.resizeCanvas();
    this.spawnWave();
    this.setupEvents();
    this.animate();
  }

  resizeCanvas() {
    if (!this.container) return;
    this.canvas.width = 640;
    this.canvas.height = 420;
  }

  spawnWave() {
    this.targets = [];
    const count = 4 + this.wave * 2;
    for (let i = 0; i < count; i++) {
      this.targets.push({
        x: Math.random() * (this.canvas.width - 60) + 30,
        y: Math.random() * (this.canvas.height - 180) + 40,
        vx: (Math.random() - 0.5) * (2 + this.wave * 0.5),
        vy: (Math.random() - 0.5) * (1.5 + this.wave * 0.3),
        radius: 18 + Math.random() * 8,
        color: i % 2 === 0 ? '#ff2f5e' : '#22d3ff',
        hp: 1
      });
    }
  }

  setupEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.crosshair.x = e.clientX - rect.left;
      this.crosshair.y = e.clientY - rect.top;
    });

    this.canvas.addEventListener('click', () => {
      if (this.isGameOver) return;
      if (this.isReloading) return;

      if (this.ammo <= 0) {
        this.reloadAmmo();
        return;
      }

      this.ammo--;
      this.updateHUD();

      // Check hit targets
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        const dist = Math.hypot(this.crosshair.x - t.x, this.crosshair.y - t.y);
        if (dist <= t.radius) {
          this.score += 150;
          this.createExplosion(t.x, t.y, t.color);
          this.targets.splice(i, 1);
          break;
        }
      }

      if (this.targets.length === 0) {
        this.wave++;
        this.ammo = this.maxAmmo;
        this.spawnWave();
      }

      if (this.ammo === 0) {
        this.reloadAmmo();
      }
    });

    document.getElementById('btn-restart-shooter')?.addEventListener('click', () => this.restartGame());
  }

  reloadAmmo() {
    this.isReloading = true;
    const statusText = document.getElementById('shooter-status-text');
    if (statusText) statusText.textContent = 'RELOADING...';

    setTimeout(() => {
      this.ammo = this.maxAmmo;
      this.isReloading = false;
      if (statusText) statusText.textContent = 'READY';
      this.updateHUD();
    }, 1000);
  }

  createExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        radius: Math.random() * 4 + 2,
        color,
        life: 1.0
      });
    }
  }

  restartGame() {
    this.score = 0;
    this.health = 100;
    this.ammo = this.maxAmmo;
    this.wave = 1;
    this.isGameOver = false;
    this.isReloading = false;
    this.spawnWave();
    this.updateHUD();
    document.getElementById('shooter-overlay')?.classList.add('is-hidden');
  }

  updateHUD() {
    const scoreVal = document.getElementById('shooter-score-val');
    const healthVal = document.getElementById('shooter-health-val');
    const ammoVal = document.getElementById('shooter-ammo-val');
    const waveVal = document.getElementById('shooter-wave-val');

    if (scoreVal) scoreVal.textContent = this.score;
    if (healthVal) healthVal.textContent = `${this.health} HP`;
    if (ammoVal) ammoVal.textContent = `${this.ammo} / ${this.maxAmmo}`;
    if (waveVal) waveVal.textContent = `WAVE ${this.wave}`;
  }

  update(delta) {
    if (this.isGameOver) return;

    // Update Targets
    this.targets.forEach(t => {
      t.x += t.vx;
      t.y += t.vy;

      if (t.x - t.radius < 0 || t.x + t.radius > this.canvas.width) t.vx *= -1;
      if (t.y - t.radius < 0 || t.y + t.radius > this.canvas.height - 60) t.vy *= -1;
    });

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= delta * 2;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Grid Background
    this.ctx.strokeStyle = 'rgba(34, 211, 255, 0.08)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.canvas.width; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // Draw Targets
    this.targets.forEach(t => {
      this.ctx.beginPath();
      this.ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = t.color;
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    });

    // Draw Particles
    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.fill();
      this.ctx.globalAlpha = 1.0;
    });

    // Draw Crosshair
    this.ctx.strokeStyle = '#22d3ff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(this.crosshair.x, this.crosshair.y, 12, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(this.crosshair.x - 18, this.crosshair.y);
    this.ctx.lineTo(this.crosshair.x + 18, this.crosshair.y);
    this.ctx.moveTo(this.crosshair.x, this.crosshair.y - 18);
    this.ctx.lineTo(this.crosshair.x, this.crosshair.y + 18);
    this.ctx.stroke();
  }

  animate() {
    this.update(0.016);
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

export function initShootingArena() {
  const canvas = document.getElementById('shooter-canvas');
  if (canvas) {
    window.__shootingArenaInstance = new ShootingArenaGame({ canvas });
  }
}

export default initShootingArena;
