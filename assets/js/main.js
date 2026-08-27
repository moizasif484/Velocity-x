/* ============================================================
   VELOCITY X — main.js
   Application bootstrapper.
   Strategy:
     1. Boot lightweight UI modules immediately (fast LCP).
     2. Boot core features (Auth, Chat, Profile, Gallery, Videos, Hub, Pricing, Missions, Settings, BubbleShooter, ShootingArena).
     3. Boot 3D WebGL game engine & 3D Immersive Shooting Game.
   ============================================================ */

import { $, bus, deviceTier, prefersReducedMotion, whenIdle } from './modules/utils.js';
import { initPreloader }     from './modules/preloader.js';
import { initNav }           from './modules/nav.js';
import { initAnimations }    from './modules/animations.js';
import { initUI }            from './modules/ui.js';
import { initCars }          from './modules/cars.js';
import { initGallery }       from './modules/gallery.js';
import { initVideos }        from './modules/videos.js';
import { initGameHub }       from './modules/hub.js';
import { initTrailer }       from './modules/trailer.js';
import { initLeaderboard }   from './modules/leaderboard.js';
import { initContact }       from './modules/contact.js';
import { initAuth }          from './modules/auth.js';
import { initChat }          from './modules/chat.js';
import { initProfile }       from './modules/profile.js';
import { initMissions }      from './modules/missions.js';
import { initPricing }       from './modules/pricing.js';
import { initSettings }      from './modules/settings.js';
import { initBubbleShooter } from './modules/bubbleShooter.js';
import { initShootingArena } from './modules/shootingArena.js';

/** Run a module without letting an error cascade. */
const safe = (name, fn) => {
  try { return fn(); }
  catch (err) { console.warn(`[VelocityX] ${name} failed:`, err); return null; }
};

const boot = async () => {
  const tier = deviceTier();
  document.documentElement.dataset.tier = tier.tier;
  document.documentElement.dataset.pointer = tier.hasHover ? 'fine' : 'coarse';

  const preloader = safe('preloader', initPreloader);

  /* ---- Instant, DOM-only modules ---------------------- */
  safe('nav',           initNav);
  safe('auth',          initAuth);
  safe('profile',       initProfile);
  safe('chat',          initChat);
  safe('hub',           initGameHub);
  safe('missions',      initMissions);
  safe('pricing',       initPricing);
  safe('settings',      initSettings);
  safe('bubbleShooter', initBubbleShooter);
  safe('shootingArena', initShootingArena);
  safe('ui',            initUI);
  safe('animations',    initAnimations);
  safe('cars',          initCars);
  safe('gallery',       initGallery);
  safe('videos',        initVideos);
  safe('trailer',       initTrailer);
  safe('leaderboard',   initLeaderboard);
  safe('contact',       initContact);

  /* Boot 3D City Racing Engine */
  safe('racingGame', async () => {
    const { initRacingGame } = await import('./three/racingGame.js');
    initRacingGame();
  });

  /* Boot 3D Immersive Shooting Game */
  safe('immersiveShooter', async () => {
    const { initImmersiveShooter } = await import('./three/immersiveShooter.js');
    initImmersiveShooter();
  });

  preloader?.setProgress(0.35, 'Building interface');

  /* ---- Deferred WebGL --------------------------------- */
  const canvas = $('#hero-canvas');
  const skip3D = !canvas || prefersReducedMotion() || !tier.webgl;

  if (skip3D) {
    canvas?.remove();
    document.querySelector('.hero__hint')?.remove();
    preloader?.setProgress(1, 'Ready');
    preloader?.done();
    return;
  }

  await whenIdle();

  try {
    const { HeroScene } = await import('./three/scene.js');

    const scene = new HeroScene({
      canvas,
      tier,
      onProgress: (p, label) => preloader?.setProgress(0.35 + p * 0.6, label)
    });

    await scene.init();

    bus.on('car:select', (car) => scene.setPaint(car.paint, car.accent));
    window.__velocityX = { scene, bus };

    canvas.classList.add('is-ready');
    preloader?.setProgress(1, 'Ready');
    preloader?.done();
  } catch (err) {
    console.warn('[VelocityX] 3D scene unavailable:', err);
    canvas.remove();
    preloader?.setProgress(1, 'Ready');
    preloader?.done();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
