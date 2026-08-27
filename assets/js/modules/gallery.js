/* ============================================================
   Velocity X — gallery.js
   Instagram-Inspired Modern Social Feed & Gallery
   Features:
     - Grid & Feed view of captured hypercars and Aurora City
     - Lightbox image viewer
     - Interactive Heart Like buttons with persistent counters
     - Interactive Comment section (users can post real comments!)
     - Share button action
   ============================================================ */

import { $, $$, bus } from './utils.js';
import { saveSystem } from './saveSystem.js';
import { getCurrentUser } from './auth.js';
import { toast } from './ui.js';

const GALLERY_POSTS = [
  {
    id: 'post-1',
    author: 'Kaito Rensu',
    avatar: 'K',
    handle: '@kaito_apex',
    title: 'Aurora Downtown at Midnight',
    image: 'assets/img/cars/apex-zero.jpg',
    likes: 1240,
    caption: 'Testing active aerodynamics on the Apex Zero through downtown neon straights. Ray tracing on Nova Engine 5 is insane! ⚡',
    timestamp: '2 hours ago',
    category: 'hypercar'
  },
  {
    id: 'post-2',
    author: 'Yuki Kaido',
    avatar: 'Y',
    handle: '@driftrider_yuki',
    title: 'Harbour Bay Drift Chain',
    image: 'assets/img/cars/vantage-drift.jpg',
    likes: 980,
    caption: '65 degrees of steering lock. Holding the slide along the harbor docks at 180 km/h. #VelocityX #Drift',
    timestamp: '5 hours ago',
    category: 'drift'
  },
  {
    id: 'post-3',
    author: 'Elena Nova',
    avatar: 'E',
    handle: '@elena_track',
    title: 'Kestrel R Wind Tunnel Spec',
    image: 'assets/img/cars/kestrel-r.jpg',
    likes: 760,
    caption: '1,040 kg dry weight, carbon monocoque, zero compromism. Pure track weapon ready for Season 04.',
    timestamp: '1 day ago',
    category: 'track'
  },
  {
    id: 'post-4',
    author: 'Marcus Vance',
    avatar: 'M',
    handle: '@vance_muscle',
    title: 'Supercharged V8 Cinder',
    image: 'assets/img/cars/cinder-v8.jpg',
    likes: 1120,
    caption: 'Synthetic fuel V8 roaring through the rain. Nothing beats raw mechanical power.',
    timestamp: '2 days ago',
    category: 'muscle'
  }
];

export function renderGallery() {
  const container = $('#gallery-feed-root');
  if (!container) return;

  const likesState = saveSystem.getGalleryLikes();

  container.innerHTML = `
    <div class="instagram-feed grid grid--2 stagger">
      ${GALLERY_POSTS.map(post => {
        const isLiked = Boolean(likesState[post.id]);
        const count = post.likes + (isLiked ? 1 : 0);
        const comments = saveSystem.getGalleryComments(post.id);

        return `
          <article class="card glass insta-post" data-post-id="${post.id}">
            <!-- Header -->
            <div class="insta-head">
              <div class="insta-author-avatar">${post.avatar}</div>
              <div class="insta-author-info">
                <strong>${post.author}</strong>
                <small>${post.handle} · ${post.timestamp}</small>
              </div>
            </div>

            <!-- Image Stage -->
            <div class="insta-stage" data-full="${post.image}" data-caption="${post.caption}">
              <img src="${post.image}" alt="${post.title}" loading="lazy" class="insta-img" />
              <div class="insta-overlay-hint">Click to enlarge</div>
            </div>

            <!-- Actions Bar -->
            <div class="insta-actions">
              <button class="insta-btn btn-like ${isLiked ? 'is-liked' : ''}" data-post-id="${post.id}" type="button" aria-label="Like post">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="${isLiked ? '#ff2f5e' : 'none'}" stroke="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.78-8.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span class="like-count">${count.toLocaleString()}</span>
              </button>

              <button class="insta-btn btn-comment-toggle" data-post-id="${post.id}" type="button" aria-label="Comments">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span>${comments.length}</span>
              </button>

              <button class="insta-btn btn-share" data-title="${post.title}" type="button" aria-label="Share">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
              </button>
            </div>

            <!-- Caption -->
            <p class="insta-caption">
              <strong>${post.author}</strong> ${post.caption}
            </p>

            <!-- Comments Section -->
            <div class="insta-comments-wrap" id="comments-${post.id}">
              <div class="insta-comments-list">
                ${comments.map(c => `
                  <div class="comment-line">
                    <strong>${c.user}:</strong> <span>${escapeHtml(c.text)}</span>
                  </div>
                `).join('')}
              </div>

              <form class="comment-form" data-post-id="${post.id}">
                <input type="text" class="comment-input" placeholder="Add a comment..." required />
                <button type="submit" class="btn btn--primary btn--sm">Post</button>
              </form>
            </div>
          </article>
        `;
      }).join('')}
    </div>
  `;

  // Attach Like Handlers
  $$('.btn-like', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const postId = btn.dataset.postId;
      const isNowLiked = saveSystem.toggleGalleryLike(postId);
      renderGallery();
      toast(isNowLiked ? 'Liked post!' : 'Unliked post.', { type: 'info' });
    });
  });

  // Attach Comment Submission
  $$('.comment-form', container).forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const postId = form.dataset.postId;
      const input = form.querySelector('.comment-input');
      const text = input?.value.trim();

      if (!text) return;

      const user = getCurrentUser() || { username: 'Racer' };
      const commentObj = { user: user.username || 'Driver', text, timestamp: new Date().toLocaleTimeString() };

      saveSystem.addGalleryComment(postId, commentObj);
      toast('Comment posted!', { type: 'success' });
      renderGallery();
    });
  });

  // Attach Share Button
  $$('.btn-share', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.title;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        toast(`Link to "${title}" copied to clipboard!`, { type: 'success' });
      } else {
        toast(`Shared "${title}"!`, { type: 'success' });
      }
    });
  });

  // Attach Image Lightbox click
  $$('.insta-stage', container).forEach(stage => {
    stage.addEventListener('click', () => {
      const full = stage.dataset.full;
      const caption = stage.dataset.caption;
      openGalleryLightbox(full, caption);
    });
  });
}

function openGalleryLightbox(imgSrc, captionText) {
  let lightbox = $('#gallery-lightbox');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'gallery-lightbox';
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
      <button class="lightbox__close" type="button" aria-label="Close">&times;</button>
      <figure class="lightbox__figure">
        <img class="lightbox__image" src="" alt="">
        <figcaption class="lightbox__caption"></figcaption>
      </figure>
    `;
    document.body.appendChild(lightbox);

    $('.lightbox__close', lightbox).addEventListener('click', () => {
      lightbox.classList.remove('is-open');
      document.body.style.overflow = '';
    });
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) {
        lightbox.classList.remove('is-open');
        document.body.style.overflow = '';
      }
    });
  }

  $('.lightbox__image', lightbox).src = imgSrc;
  $('.lightbox__caption', lightbox).textContent = captionText || '';
  lightbox.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

export function initGallery() {
  renderGallery();
  bus.on('auth:changed', renderGallery);
}

export default initGallery;
