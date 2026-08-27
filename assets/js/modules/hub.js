/* ============================================================
   Velocity X — hub.js
   Games Hub Module featuring 5 Arcade Cards:
     1. CITY RACING (Preserved Existing Game)
     2. IMMERSIVE 3D GAME (Rooftop Exploration)
     3. SHOOTING MISSIONS (Target Identification Mini-Game)
     4. BUBBLE SHOOTER (Color Match Arcade)
     5. GAMING VIDEOS (Official YouTube Cinema)
   ============================================================ */

import { $, $$ } from './utils.js';

export const HUB_GAMES = [
  {
    id: 'game-city-racing',
    title: 'City Racing 3D',
    category: '3D WebGL Engine',
    desc: 'High-speed street racing through Aurora City with ray-traced neon visuals, explorable streets, 3-Lap missions, and 400K CR showdown.',
    poster: 'assets/img/cars/apex-zero.jpg',
    target: '#racing',
    btnText: 'PLAY CITY RACING'
  },
  {
    id: 'game-immersive-3d',
    title: 'Immersive 3D Rooftop',
    category: '3D Exploration',
    desc: 'Explore a multi-floor skyscraper rooftop environment with atmospheric neon lights, glass observation decks, and smooth 60 FPS movement.',
    poster: 'assets/img/cars/nomad-st.jpg',
    target: '#shooting-game',
    btnText: 'EXPLORE 3D WORLD'
  },
  {
    id: 'game-shooting-missions',
    title: 'Shooting Missions',
    category: 'Target Identification',
    desc: 'Fictional mission-based target shooter. Identify target NPCs (Red Hat, Black Shirt, Blue Shirt), choose weapons, and hit targets under time limits.',
    poster: 'assets/img/cars/kestrel-r.jpg',
    target: '#shooting-game',
    btnText: 'PLAY SHOOTING MISSIONS'
  },
  {
    id: 'game-bubble-shooter',
    title: 'Bubble Shooter',
    category: 'Canvas Color Match',
    desc: 'Aim your cannon, shoot colored bubbles, pop 3+ matching colors, and progress through challenging levels.',
    poster: 'assets/img/cars/rune-gtx.jpg',
    target: '#bubble',
    btnText: 'PLAY BUBBLE SHOOTER'
  },
  {
    id: 'game-videos',
    title: 'Gaming Video Cinema',
    category: 'YouTube Cinema',
    desc: 'Watch official gaming videos, high-speed 4K showcases, lap guides, and open-world gameplay duels via official YouTube embeds.',
    poster: 'assets/img/cars/vantage-drift.jpg',
    target: '#videos',
    btnText: 'WATCH VIDEOS'
  }
];

export function renderGameHub() {
  const container = $('#hub-grid');
  if (!container) return;

  container.innerHTML = HUB_GAMES.map(game => `
    <article class="card glass hub-card" data-hub-id="${game.id}">
      <div class="hub-thumb-wrap">
        <img src="${game.poster}" alt="${game.title}" loading="lazy" class="hub-thumb-img" />
        <span class="hub-category-badge">${game.category}</span>
      </div>
      <div class="hub-card-body">
        <h3 class="hub-title">${game.title}</h3>
        <p class="hub-desc">${game.desc}</p>
        <a href="${game.target}" class="btn btn--primary btn--block hub-launch-btn" data-ripple>
          <span>${game.btnText}</span>
        </a>
      </div>
    </article>
  `).join('');
}

export function initGameHub() {
  renderGameHub();
}

export default initGameHub;
