/**
 * Velocity X — Trailer Module
 * Lazy-loaded video modal. The iframe/video is only created on demand
 * so the trailer never blocks the initial page load.
 */

const SELECTORS = {
  root: '.trailer',
  playBtn: '.trailer__play'
};

const CLASSES = {
  open: 'is-open'
};

let modal = null;
let frameHolder = null;
let lastFocused = null;

/**
 * Creates the modal shell once.
 */
function buildModal() {
  if (modal) return;

  modal = document.createElement('div');
  modal.className = 'trailer-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Trailer');
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <button class="trailer-modal__close" type="button" aria-label="Close trailer">&times;</button>
    <div class="trailer-modal__frame"></div>
  `;

  document.body.appendChild(modal);
  frameHolder = modal.querySelector('.trailer-modal__frame');

  modal.querySelector('.trailer-modal__close').addEventListener('click', closeTrailer);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeTrailer();
  });
}

/**
 * Builds the player element from the trigger's data attributes.
 * Supports either data-video-id (YouTube) or data-video-src (local file).
 * @param {HTMLElement} trigger
 * @returns {HTMLElement|null}
 */
function createPlayer(trigger) {
  const videoId = trigger.dataset.videoId;
  const videoSrc = trigger.dataset.videoSrc;

  if (videoId) {
    const iframe = document.createElement('iframe');
    iframe.className = 'trailer-modal__video';
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    iframe.title = 'Velocity X trailer';
    iframe.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
    iframe.setAttribute('allowfullscreen', '');
    return iframe;
  }

  if (videoSrc) {
    const video = document.createElement('video');
    video.className = 'trailer-modal__video';
    video.src = videoSrc;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    return video;
  }

  return null;
}

/**
 * @param {HTMLElement} trigger
 */
function openTrailer(trigger) {
  const player = createPlayer(trigger);
  if (!player) return;

  lastFocused = document.activeElement;
  frameHolder.innerHTML = '';
  frameHolder.appendChild(player);

  modal.classList.add(CLASSES.open);
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  modal.querySelector('.trailer-modal__close').focus();
}

function closeTrailer() {
  if (!modal || !modal.classList.contains(CLASSES.open)) return;

  modal.classList.remove(CLASSES.open);
  modal.setAttribute('aria-hidden', 'true');

  // Destroying the node stops playback for both <iframe> and <video>.
  frameHolder.innerHTML = '';
  document.body.style.overflow = '';

  if (lastFocused) lastFocused.focus();
}

function onKeydown(event) {
  if (event.key === 'Escape') closeTrailer();
}

export function initTrailer() {
  const root = document.querySelector(SELECTORS.root);
  const triggers = document.querySelectorAll(SELECTORS.playBtn);
  if (!root && !triggers.length) return;

  buildModal();

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openTrailer(trigger);
    });
  });

  document.addEventListener('keydown', onKeydown);
}

export default initTrailer;
