/* ============================================================
   VELOCITY X — utils.js
   Shared helpers: DOM, math, device capability detection,
   a single shared RAF loop, IntersectionObserver sugar and a
   tiny event bus for cross-module messaging.
   ============================================================ */

/* ---------- DOM --------------------------------------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element with attributes + children in one call. */
export const el = (tag, attrs = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style') node.setAttribute('style', v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(k => node.append(k?.nodeType ? k : document.createTextNode(String(k))));
  return node;
};

/** Passive-by-default listener helper returning an unbind function. */
export const on = (target, type, fn, opts = {}) => {
  const options = { passive: true, ...opts };
  target.addEventListener(type, fn, options);
  return () => target.removeEventListener(type, fn, options);
};

/* ---------- Math -------------------------------------- */
export const clamp  = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp   = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent smoothing (exponential damp). */
export const damp   = (a, b, smoothing, dt) => lerp(a, b, 1 - Math.pow(smoothing, dt * 60));
export const mapRange = (v, a1, a2, b1, b2) => b1 + ((v - a1) / (a2 - a1)) * (b2 - b1);
export const rand   = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));

/* ---------- Formatting -------------------------------- */
export const formatNumber = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K';
  return String(Math.round(n));
};

export const formatTime = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

/* ---------- Timing ----------------------------------- */
export const debounce = (fn, wait = 150) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
};

export const throttle = (fn, wait = 100) => {
  let last = 0, queued = null;
  return (...args) => {
    const now = performance.now();
    if (now - last >= wait) { last = now; fn(...args); }
    else {
      clearTimeout(queued);
      queued = setTimeout(() => { last = performance.now(); fn(...args); }, wait - (now - last));
    }
  };
};

/** Resolve when the browser is idle (or after a short timeout). */
export const whenIdle = (timeout = 900) => new Promise(res => {
  if ('requestIdleCallback' in window) requestIdleCallback(() => res(), { timeout });
  else setTimeout(res, 120);
});

/* ---------- Preferences / capability ------------------ */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let _tier = null;
/**
 * Classify the device so the 3D scene can scale quality.
 * Returns { tier, isMobile, hasHover, dpr, cores, memory, webgl }.
 */
export const deviceTier = () => {
  if (_tier) return _tier;

  const isMobile = /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
  const hasHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const cores  = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || navigator.deviceMemory === 0 ? navigator.deviceMemory : (navigator.deviceMemory ?? 4);
  const ram    = navigator.deviceMemory ?? navigator.deviceMemory ?? (navigator.deviceMemory || 4);
  const dpr    = Math.min(window.devicePixelRatio || 1, 2);

  // WebGL2 capability probe (cheap, disposed immediately).
  let webgl = false;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { webgl = false; }

  let tier = 'high';
  if (isMobile || cores <= 4 || window.innerWidth < 700) tier = 'mid';
  if (cores <= 2 || (isMobile && dpr >= 3 && cores <= 4)) tier = 'low';

  _tier = { tier, isMobile, hasHover, dpr, cores, memory: ram, webgl };
  return _tier;
};

/* ---------- Shared RAF loop --------------------------
   One loop for the whole site. Modules subscribe with
   addTick(fn) and receive (deltaSeconds, elapsedSeconds).
   Auto-pauses when the tab is hidden to save battery.
   ---------------------------------------------------- */
const ticks = new Set();
let rafId = null, last = 0, elapsed = 0;

const loop = (now) => {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.1); // clamp big tab-switch gaps
  last = now;
  elapsed += dt;
  for (const fn of ticks) {
    try { fn(dt, elapsed); } catch (e) { console.warn('[tick]', e); ticks.delete(fn); }
  }
};

export const addTick = (fn) => {
  ticks.add(fn);
  if (rafId === null) { last = performance.now(); rafId = requestAnimationFrame(loop); }
  return () => removeTick(fn);
};

export const removeTick = (fn) => {
  ticks.delete(fn);
  if (!ticks.size && rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }
  else if (ticks.size && rafId === null) { last = performance.now(); rafId = requestAnimationFrame(loop); }
});

/* ---------- IntersectionObserver sugar ---------------- */
/**
 * Fire cb(entry) the first time el enters the viewport.
 * Falls back to immediate invocation when IO is unsupported.
 */
export const onVisible = (target, cb, { threshold = 0.15, rootMargin = '0px 0px -8% 0px', once = true } = {}) => {
  const nodes = Array.isArray(target) ? target : [target];
  if (!('IntersectionObserver' in window)) { nodes.forEach(n => cb(n)); return () => {}; }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      cb(entry.target, entry);
      if (once) io.unobserve(entry.target);
    });
  }, { threshold, rootMargin });

  nodes.forEach(n => n && io.observe(n));
  return () => io.disconnect();
};

/* ---------- Event bus -------------------------------- */
export const bus = {
  _m: new Map(),
  on(type, fn) {
    if (!this._m.has(type)) this._m.set(type, new Set());
    this._m.get(type).add(fn);
    return () => this.off(type, fn);
  },
  off(type, fn) { this._m.get(type)?.delete(fn); },
  emit(type, payload) { this._m.get(type)?.forEach(fn => { try { fn(payload); } catch (e) { console.warn(e); } }); }
};

/* ---------- Colour helper ---------------------------- */
/** '#22d3ff' -> {r,g,b} normalised 0..1 (used by the shaders). */
export const hexToRgb01 = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};
