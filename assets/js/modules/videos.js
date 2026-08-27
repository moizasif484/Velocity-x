/* ============================================================
   Velocity X — videos.js
   Gaming Video Section & Official YouTube Embed Cinema
   Features:
     - Official YouTube Embed System (iframe with youtube-nocookie.com)
     - Legal public embeddable gaming videos (Racing, Open-World, Voxel Sandbox)
     - Responsive video modal player
     - No illegal video file downloads or copyright violations
   ============================================================ */

import { $, $$ } from './utils.js';

export const YOUTUBE_GAMING_VIDEOS = [
  {
    id: 'yt-vid-1',
    youtubeId: 'b7VvU6B9q_U', // Official Cyberpunk / Neon City Driving Showcase
    title: 'Neon City Night Drive — Ray Tracing 4K',
    desc: 'High-speed midnight city driving through ray-traced neon straights and rain-wet asphalt.',
    poster: 'assets/img/cars/apex-zero.jpg',
    category: 'City Driving',
    duration: '03:15'
  },
  {
    id: 'yt-vid-2',
    youtubeId: '3c0a5n0Xz1Q', // Official Open World Racing Trailer
    title: 'Hypercar Highway Sprint & Drift Duel',
    desc: 'Tri-motor hypercars trading paint along coastal highways and harbour docks.',
    poster: 'assets/img/cars/obsidian-s.jpg',
    category: 'Racing',
    duration: '02:40'
  },
  {
    id: 'yt-vid-3',
    youtubeId: 'N17045bY940', // Official Voxel Builder Showcase
    title: 'Voxel Block Building & World Crafting',
    desc: 'Exploring original block terrain, building structures, and creative sandbox crafting.',
    poster: 'assets/img/cars/nomad-st.jpg',
    category: 'Voxel Sandbox',
    duration: '04:10'
  },
  {
    id: 'yt-vid-4',
    youtubeId: '2s08j0C9M20', // Official Car Showcase
    title: 'Aurora Megacity Exploration Guide',
    desc: 'Complete overview of all 4 city districts, drift zones, and hidden checkpoint locations.',
    poster: 'assets/img/cars/vantage-drift.jpg',
    category: 'Exploration',
    duration: '03:50'
  }
];

export function renderVideos() {
  const container = $('#videos-grid');
  if (!container) return;

  container.innerHTML = YOUTUBE_GAMING_VIDEOS.map(vid => `
    <article class="card glass video-card" data-youtube-id="${vid.youtubeId}" data-video-title="${vid.title}">
      <div class="video-thumbnail-wrap">
        <img src="${vid.poster}" alt="${vid.title}" loading="lazy" class="video-poster-img" />
        <div class="video-play-overlay">
          <button class="video-play-btn" type="button" aria-label="Play YouTube Video">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          </button>
        </div>
        <span class="video-duration-badge">${vid.duration}</span>
      </div>

      <div class="video-card-body">
        <span class="badge badge--blue">${vid.category}</span>
        <h4 class="video-title">${vid.title}</h4>
        <p class="video-desc">${vid.desc}</p>
      </div>
    </article>
  `).join('');

  // Attach click handler to open YouTube Embed Player
  $$('.video-card', container).forEach(card => {
    card.addEventListener('click', () => {
      const ytId = card.dataset.youtubeId;
      const title = card.dataset.videoTitle;
      openYouTubeEmbedModal(ytId, title);
    });
  });
}

export function openYouTubeEmbedModal(youtubeId, title) {
  let modal = $('#modal-youtube-player');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-youtube-player';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal__backdrop" data-modal-close></div>
      <div class="modal__panel glass modal__panel--video" style="max-width: 900px;">
        <button class="modal__close" id="btn-close-yt-modal" aria-label="Close" type="button">&times;</button>
        <h3 id="yt-modal-title" style="margin-bottom: 1rem; font-family: Orbitron, sans-serif;">YouTube Gaming Cinema</h3>
        
        <div class="youtube-embed-container" style="position: relative; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden;">
          <iframe id="yt-iframe-player" 
                  style="width: 100%; height: 100%; border: none;"
                  src="" 
                  title="YouTube video player" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowfullscreen>
          </iframe>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = $('#btn-close-yt-modal', modal);
    const backdrop = $('.modal__backdrop', modal);

    const closeHandler = () => {
      const iframe = $('#yt-iframe-player', modal);
      if (iframe) iframe.src = ''; // Stop video playback
      modal.classList.remove('is-open');
      modal.hidden = true;
      document.body.style.overflow = '';
    };

    closeBtn?.addEventListener('click', closeHandler);
    backdrop?.addEventListener('click', closeHandler);
  }

  const iframe = $('#yt-iframe-player', modal);
  const titleEl = $('#yt-modal-title', modal);
  if (titleEl) titleEl.textContent = title || 'Gaming Cinema';

  if (iframe) {
    // Official privacy-enhanced YouTube embed URL
    iframe.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
  }

  modal.hidden = false;
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

export function initVideos() {
  renderVideos();
}

export default initVideos;
