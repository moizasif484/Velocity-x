/* ============================================================
   VELOCITY X — nav.js
   Sticky/condensing navbar, scroll progress rail, mobile menu
   with focus trapping, smooth anchor scrolling with nav offset,
   scroll-spy active link and the back-to-top control.
   ============================================================ */

import { $, $$, on, clamp, throttle, prefersReducedMotion } from './utils.js';

export const initNav = () => {
  const nav      = $('#nav');
  const links    = $('#nav-links');
  const burger   = $('#burger');
  const progress = $('#nav-progress');
  const toTop    = $('#to-top');
  const anchors  = $$('a[href^="#"]');
  const navLinks = $$('[data-nav]');

  /* ---------- 1. Sticky state + progress rail ---------- */
  const onScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop;

    nav?.classList.toggle('is-stuck', y > 40);
    toTop?.classList.toggle('is-on', y > window.innerHeight * 0.9);

    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? clamp(y / max) * 100 : 0) + '%';
    }
  };
  on(window, 'scroll', onScroll);
  onScroll();

  /* ---------- 2. Mobile menu -------------------------- */
  const setMenu = (open) => {
    if (!links || !burger) return;
    links.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    // Only lock the body on small screens where the panel is full-bleed.
    if (window.innerWidth <= 1080) document.body.classList.toggle('is-locked', open);
  };

  burger && on(burger, 'click', () => setMenu(!links.classList.contains('is-open')));

  // Close on link tap, Escape, or resize into desktop layout.
  links && on(links, 'click', (e) => { if (e.target.closest('a')) setMenu(false); });
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && links?.classList.contains('is-open')) { setMenu(false); burger?.focus(); }
  });
  on(window, 'resize', throttle(() => { if (window.innerWidth > 1080) setMenu(false); }, 200));

  // Simple focus trap while the mobile panel is open.
  on(document, 'keydown', (e) => {
    if (e.key !== 'Tab' || !links?.classList.contains('is-open')) return;
    const focusables = $$('a, button, input, select, textarea', links)
      .filter(n => !n.hasAttribute('disabled'));
    if (!focusables.length) return;
    const first = focusables[0], lastEl = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  }, { passive: false });

  /* ---------- 3. Smooth anchor scrolling -------------- */
  const scrollToTarget = (target) => {
    const navH = nav?.classList.contains('is-stuck') ? 64 : 76;
    const top = target.getBoundingClientRect().top + window.scrollY - navH + 1;
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  anchors.forEach(a => {
    on(a, 'click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      setMenu(false);
      scrollToTarget(target);
      // Keep the URL shareable without a jarring jump.
      history.pushState(null, '', id);
      // Move focus for keyboard/screen-reader users.
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }, { passive: false });
  });

  toTop && on(toTop, 'click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });

  /* ---------- 4. Scroll spy --------------------------- */
  const sections = navLinks
    .map(l => document.querySelector(l.getAttribute('href')))
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    const setActive = (id) => navLinks.forEach(l => {
      const isActive = l.getAttribute('href') === '#' + id;
      l.classList.toggle('is-active', isActive);
      isActive ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current');
    });

    // Track the section occupying the middle band of the viewport.
    const spy = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.25, 0.6, 1] });

    sections.forEach(s => spy.observe(s));
  }

  return { setMenu };
};
