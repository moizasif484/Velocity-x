/* ============================================================
   VELOCITY X — preloader.js
   Boot screen with an eased progress bar. Progress only ever
   moves forward, and the bar visually catches up smoothly so
   fast loads still feel deliberate rather than glitchy.
   ============================================================ */

import { $, clamp, addTick, damp, removeTick } from './utils.js';

export const initPreloader = () => {
  const root  = $('#preloader');
  const fill  = $('#preloader-fill');
  const pct   = $('#preloader-pct');
  const label = $('#preloader-label');
  if (!root) return null;

  let target = 0;   // requested progress 0..1
  let shown  = 0;   // eased progress 0..1
  let done   = false;

  const tick = (dt) => {
    shown = damp(shown, target, 0.12, dt);
    if (Math.abs(target - shown) < 0.002) shown = target;
    const v = Math.round(shown * 100);
    fill.style.width = v + '%';
    pct.textContent  = v + '%';
  };

  const unbind = addTick(tick);

  /** Advance the bar. Ignores backwards values. */
  const setProgress = (p, text) => {
    if (done) return;
    target = clamp(Math.max(target, p));
    if (text) label.textContent = text;
  };

  /** Fade out and remove from the a11y tree + DOM. */
  const finish = () => {
    if (done) return;
    done = true;
    target = 1;
    label.textContent = 'Ready';
    fill.style.width = '100%';
    pct.textContent = '100%';

    root.classList.add('is-done');
    document.body.classList.remove('is-locked');
    document.dispatchEvent(new CustomEvent('vx:loaded'));

    setTimeout(() => { removeTick(tick); root.remove(); }, 800);
  };

  // Lock scroll while the boot screen is visible.
  document.body.classList.add('is-locked');

  // Report real document load progress as a baseline signal.
  window.addEventListener('load', () => setProgress(0.3, 'Assets decoded'), { once: true });

  // Hard safety valve: never trap the user behind the preloader.
  const bail = setTimeout(finish, 9000);

  return {
    setProgress,
    done: () => { clearTimeout(bail); setTimeout(finish, 220); },
    destroy: () => { clearTimeout(bail); unbind(); root.remove(); }
  };
};
