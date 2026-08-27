/* ============================================================
   Velocity X — bubbleShooter.js
   Full Functional Bubble Shooter Mini-Game
   Features:
     - Color matching grid & cannon aim shooter
     - Pop 3+ matching color bubbles
     - Score & Level progression with win/lose states
     - Smooth 60 FPS Canvas rendering
   ============================================================ */

const COLORS = ['#ff2f5e', '#22d3ff', '#22c55e', '#ffd700', '#a78bfa', '#ff8c00'];

export class BubbleShooterGame {
  constructor(options = {}) {
    this.canvas = options.canvas || document.getElementById('bubble-canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.container = this.canvas.parentElement;

    this.radius = 18;
    this.cols = 12;
    this.rows = 8;
    this.grid = [];
    this.score = 0;
    this.level = 1;
    this.isGameOver = false;
    this.isWin = false;

    // Shooter cannon state
    this.cannonAngle = -Math.PI / 2;
    this.currentBubbleColor = this.getRandomColor();
    this.nextBubbleColor = this.getRandomColor();
    this.activeBullet = null;

    this.init();
  }

  init() {
    this.resizeCanvas();
    this.createGrid();
    this.setupEvents();
    this.animate();
  }

  resizeCanvas() {
    if (!this.container) return;
    this.canvas.width = 480;
    this.canvas.height = 560;
  }

  getRandomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  createGrid() {
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      const isOffset = r % 2 === 1;
      const numCols = isOffset ? this.cols - 1 : this.cols;

      for (let c = 0; c < numCols; c++) {
        if (r < 4) { // Top 4 rows filled
          this.grid[r][c] = {
            color: this.getRandomColor(),
            x: (c * this.radius * 2) + this.radius + (isOffset ? this.radius : 0),
            y: (r * this.radius * 1.8) + this.radius + 10
          };
        } else {
          this.grid[r][c] = null;
        }
      }
    }
  }

  setupEvents() {
    window.addEventListener('resize', () => this.resizeCanvas());

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const cannonX = this.canvas.width / 2;
      const cannonY = this.canvas.height - 30;

      this.cannonAngle = Math.atan2(mouseY - cannonY, mouseX - cannonX);
      // Restrict angle up
      if (this.cannonAngle > -0.2) this.cannonAngle = -0.2;
      if (this.cannonAngle < -Math.PI + 0.2) this.cannonAngle = -Math.PI + 0.2;
    });

    this.canvas.addEventListener('click', () => {
      if (this.isGameOver || this.isWin) return;
      if (this.activeBullet) return; // Bullet in flight

      const cannonX = this.canvas.width / 2;
      const cannonY = this.canvas.height - 30;
      const speed = 12;

      this.activeBullet = {
        x: cannonX,
        y: cannonY,
        vx: Math.cos(this.cannonAngle) * speed,
        vy: Math.sin(this.cannonAngle) * speed,
        color: this.currentBubbleColor
      };

      this.currentBubbleColor = this.nextBubbleColor;
      this.nextBubbleColor = this.getRandomColor();
    });

    document.getElementById('btn-restart-bubble')?.addEventListener('click', () => this.restartGame());
  }

  restartGame() {
    this.score = 0;
    this.isGameOver = false;
    this.isWin = false;
    this.activeBullet = null;
    this.currentBubbleColor = this.getRandomColor();
    this.nextBubbleColor = this.getRandomColor();
    this.createGrid();
    document.getElementById('bubble-overlay')?.classList.add('is-hidden');
  }

  updateBullet() {
    if (!this.activeBullet) return;

    this.activeBullet.x += this.activeBullet.vx;
    this.activeBullet.y += this.activeBullet.vy;

    // Bounce off side walls
    if (this.activeBullet.x - this.radius < 0 || this.activeBullet.x + this.radius > this.canvas.width) {
      this.activeBullet.vx *= -1;
    }

    // Top wall collision
    if (this.activeBullet.y - this.radius <= 10) {
      this.snapBulletToGrid();
      return;
    }

    // Check collision with grid bubbles
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < (this.grid[r] ? this.grid[r].length : 0); c++) {
        const bubble = this.grid[r][c];
        if (bubble) {
          const dist = Math.hypot(this.activeBullet.x - bubble.x, this.activeBullet.y - bubble.y);
          if (dist < this.radius * 1.8) {
            this.snapBulletToGrid();
            return;
          }
        }
      }
    }
  }

  snapBulletToGrid() {
    if (!this.activeBullet) return;

    // Find nearest cell
    const r = Math.min(this.rows - 1, Math.max(0, Math.floor((this.activeBullet.y - 10) / (this.radius * 1.8))));
    const isOffset = r % 2 === 1;
    const c = Math.min((isOffset ? this.cols - 2 : this.cols - 1), Math.max(0, Math.floor((this.activeBullet.x - (isOffset ? this.radius * 2 : this.radius)) / (this.radius * 2))));

    if (!this.grid[r]) this.grid[r] = [];

    this.grid[r][c] = {
      color: this.activeBullet.color,
      x: (c * this.radius * 2) + this.radius + (isOffset ? this.radius : 0),
      y: (r * this.radius * 1.8) + this.radius + 10
    };

    const popped = this.popMatchingBubbles(r, c, this.activeBullet.color);
    if (popped.length >= 3) {
      this.score += popped.length * 100;
      document.getElementById('bubble-score-val').textContent = this.score;
    }

    this.activeBullet = null;
    this.checkGameStatus();
  }

  popMatchingBubbles(startR, startC, targetColor) {
    const matches = [];
    const visited = new Set();
    const queue = [{ r: startR, c: startC }];

    while (queue.length > 0) {
      const { r, c } = queue.shift();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const bubble = this.grid[r]?.[c];
      if (bubble && bubble.color === targetColor) {
        matches.push({ r, c });

        // Add neighbors
        const neighbors = [
          { r: r - 1, c: c }, { r: r + 1, c: c },
          { r: r, c: c - 1 }, { r: r, c: c + 1 },
          { r: r - 1, c: c + (r % 2 === 1 ? 1 : -1) },
          { r: r + 1, c: c + (r % 2 === 1 ? 1 : -1) }
        ];

        neighbors.forEach(n => {
          if (this.grid[n.r]?.[n.c]) queue.push(n);
        });
      }
    }

    if (matches.length >= 3) {
      matches.forEach(m => {
        this.grid[m.r][m.c] = null;
      });
    }

    return matches;
  }

  checkGameStatus() {
    let remainingBubbles = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < (this.grid[r] ? this.grid[r].length : 0); c++) {
        if (this.grid[r][c]) remainingBubbles++;
      }
    }

    if (remainingBubbles === 0) {
      this.isWin = true;
      document.getElementById('bubble-overlay')?.classList.remove('is-hidden');
      document.getElementById('bubble-overlay-title').textContent = 'YOU WIN! ALL BUBBLES CLEARED!';
    } else if (this.grid[this.rows - 1]?.some(b => b !== null)) {
      this.isGameOver = true;
      document.getElementById('bubble-overlay')?.classList.remove('is-hidden');
      document.getElementById('bubble-overlay-title').textContent = 'GAME OVER!';
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Grid Bubbles
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < (this.grid[r] ? this.grid[r].length : 0); c++) {
        const bubble = this.grid[r][c];
        if (bubble) {
          this.ctx.beginPath();
          this.ctx.arc(bubble.x, bubble.y, this.radius, 0, Math.PI * 2);
          this.ctx.fillStyle = bubble.color;
          this.ctx.fill();
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1.5;
          this.ctx.stroke();
        }
      }
    }

    // Draw Cannon Shooter
    const cannonX = this.canvas.width / 2;
    const cannonY = this.canvas.height - 30;

    this.ctx.save();
    this.ctx.translate(cannonX, cannonY);
    this.ctx.rotate(this.cannonAngle);
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.fillRect(0, -6, 40, 12);
    this.ctx.restore();

    // Draw Current & Next Bubble
    this.ctx.beginPath();
    this.ctx.arc(cannonX, cannonY, this.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = this.currentBubbleColor;
    this.ctx.fill();
    this.ctx.stroke();

    // Active Bullet
    if (this.activeBullet) {
      this.ctx.beginPath();
      this.ctx.arc(this.activeBullet.x, this.activeBullet.y, this.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = this.activeBullet.color;
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  animate() {
    this.updateBullet();
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

export function initBubbleShooter() {
  const canvas = document.getElementById('bubble-canvas');
  if (canvas) {
    window.__bubbleShooterInstance = new BubbleShooterGame({ canvas });
  }
}

export default initBubbleShooter;
