/**
 * Velocity X — app.js
 * ---------------------------------------------------------------------------
 * Application bootstrapper. This is the single entry point wired up by
 * assets/js/main.js:
 *
 *     import { bootstrap } from './modules/app.js';
 *     bootstrap();
 *
 * Responsibilities:
 *   - Deterministic module boot order
 *   - Feature/environment flags on <html>
 *   - Cross-module event wiring (cars ⇄ forms, preloader ⇄ animations)
 *   - Global error safety net so one failing module never blanks the site
 * ---------------------------------------------------------------------------
 */

import { $, $$, prefersReducedMotion, debounce } from './utils.js';

import { initPreloader } from './preloader.js';
import { initNav } from './nav.js';
import { initUI } from './ui.js';
import { initAnimations, refreshAnimations } from './animations.js';
import { initCars, getCars } from './cars.js';
import { initSliders } from './slider.js';
import { initForms, populateCarOptions, prefillBooking } from './forms.js';

/* -------------------------------------------------------------------------- */
/* Metadata                                                                    */
/* -------------------------------------------------------------------------- */

export const APP = Object.freeze({
  name: 'Velocity X',
  version: '1.0.0',
  buildDate: '2026-08-01',
});

const state = {
  booted: false,
  modules: new Map(),
  errors: [],
};

/* -------------------------------------------------------------------------- */
/* Environment flags                                                           */
/* -------------------------------------------------------------------------- */

function applyEnvironmentFlags() {
  const html = document.documentElement;
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  html.classList.remove('no-js');
  html.classList.add('js');
  html.classList.toggle('is-touch', touch);
  html.classList.toggle('is-hoverable', !touch);
  html.classList.toggle('reduced-motion', prefersReducedMotion());
  html.classList.toggle('has-webp', supportsWebp());

  setViewportUnit();
  window.addEventListener('resize', debounce(setViewportUnit, 150), { passive: true });
}

function supportsWebp() {
  const canvas = document.createElement('canvas');
  return canvas.toDataURL?.('image/webp').startsWith('data:image/webp') ?? false;
}

/** Fixes the mobile 100vh problem used by the hero section in main.css. */
function setViewportUnit() {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
}

/* -------------------------------------------------------------------------- */
/* Safe module runner                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Executes a module initializer, isolating failures.
 * @param {string} name
 * @param {Function} initializer
 * @returns {*} whatever the initializer returned, or null on failure
 */
function run(name, initializer) {
  if (typeof initializer !== 'function') return null;

  try {
    const result = initializer();
    state.modules.set(name, result ?? true);
    return result ?? null;
  } catch (error) {
    state.errors.push({ name, error });
    // eslint-disable-next-line no-console
    console.error(`[${APP.name}] "${name}" failed to initialise:`, error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Cross-module wiring                                                         */
/* -------------------------------------------------------------------------- */

function wireModules() {
  // Keep the booking dropdown in sync with the catalogue rendered by cars.js.
  try {
    const cars = typeof getCars === 'function' ? getCars() : [];
    if (cars.length) populateCarOptions(cars);
  } catch {
    /* catalogue not exposed — dropdown stays as authored in the HTML */
  }

  // "Book a test drive" buttons rendered inside car cards / modals.
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-book-car]');
    if (!trigger) return;
    event.preventDefault();
    prefillBooking(trigger.dataset.bookCar);
  });

  // Cars grid re-renders on filter/sort → refresh scroll-triggered animations
  // and boot any slider markup that arrived with the new nodes.
  document.addEventListener('cars:rendered', (event) => {
    const scope = event.detail?.container || document;
    refreshAnimations?.(scope);
    initSliders(scope);
  });

  // Once the preloader finishes, let the hero entrance animation take over.
  document.addEventListener('preloader:complete', () => {
    document.documentElement.classList.add('is-loaded');
    refreshAnimations?.(document);
  });

  // Sliders inside a modal need re-measuring when the modal opens.
  document.addEventListener('modal:open', (event) => {
    const scope = event.detail?.modal || document;
    initSliders(scope).forEach((slider) => slider.measure?.());
  });

  // Footer year, used across every page.

  $$('[data-current-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
}

/* -------------------------------------------------------------------------- */
/* Global safety net                                                           */
/* -------------------------------------------------------------------------- */

function registerGlobalHandlers() {
  window.addEventListener('error', (event) => {
    state.errors.push({ name: 'window', error: event.error || event.message });
  });

  window.addEventListener('unhandledrejection', (event) => {
    state.errors.push({ name: 'promise', error: event.reason });
    // eslint-disable-next-line no-console
    console.warn(`[${APP.name}] unhandled rejection:`, event.reason);
  });

  // Failsafe: never let a stalled preloader trap the user on a blank screen.
  window.setTimeout(() => {
    document.documentElement.classList.add('is-loaded');
    $('[data-preloader]')?.classList.add('is-hidden');
  }, 8000);
}

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Boots the whole application. Safe to call more than once.
 * @returns {typeof state}
 */
export function bootstrap() {
  if (state.booted) return state;
  state.booted = true;

  applyEnvironmentFlags();
  registerGlobalHandlers();

  // Order matters: preloader first, then chrome, then content, then behaviour.
  run('preloader', initPreloader);
  run('nav', initNav);
  run('ui', initUI);
  run('cars', initCars);
  run('sliders', () => initSliders(document));
  run('forms', () => initForms(document));
  run('animations', initAnimations);

  wireModules();

  document.dispatchEvent(
    new CustomEvent('app:ready', { detail: { app: APP, modules: [...state.modules.keys()] } })
  );

  // eslint-disable-next-line no-console
  console.info(
    `%c ${APP.name} v${APP.version} `,
    'background:#0b0b0f;color:#e10600;font-weight:700;border-radius:3px;',
    `${state.modules.size} modules ready`
  );

  return state;
}

/**
 * Diagnostics helper — `VelocityX.status()` in the console.
 * @returns {{ version: string, modules: string[], errors: object[] }}
 */
export function status() {
  return {
    version: APP.version,
    modules: [...state.modules.keys()],
    errors: state.errors,
  };
}

/* Expose a minimal, read-only namespace for debugging. */
Object.defineProperty(window, 'VelocityX', {
  value: Object.freeze({ ...APP, bootstrap, status }),
  writable: false,
  configurable: false,
});

export default bootstrap;
