/* ==========================================================================
   Velocity-X — assets/js/modules/animations.js
   Scroll-driven reveals, parallax, counters, text splitting, tilt & magnetics.
   Single shared RAF ticker + IntersectionObserver pool for performance.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   Local micro-helpers (module scoped, no external dependencies)
   -------------------------------------------------------------------------- */

const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

const lerp = (a, b, t) => a + (b - a) * t;

const round = (v, p = 3) => {
  const f = 10 ** p;
  return Math.round(v * f) / f;
};

const num = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const motionQuery =
  typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_QUERY) : null;

let reducedMotion = motionQuery ? motionQuery.matches : false;

/* Easing functions used by the counter / manual tweens. */
const EASINGS = {
  linear: (t) => t,
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/* --------------------------------------------------------------------------
   Shared ticker — one requestAnimationFrame loop for every animated feature
   -------------------------------------------------------------------------- */

const ticker = (() => {
  const tasks = new Set();
  let rafId = null;
  let last = 0;

  const frame = (time) => {
    const delta = last ? Math.min(time - last, 64) : 16.667;
    last = time;

    tasks.forEach((task) => {
      try {
        task(time, delta);
      } catch (error) {
        /* A single faulty task must never break the whole loop. */
        console.error('[animations] ticker task failed', error);
        tasks.delete(task);
      }
    });

    rafId = tasks.size ? window.requestAnimationFrame(frame) : null;
    if (!rafId) last = 0;
  };

  return {
    add(task) {
      if (typeof task !== 'function') return () => {};
      tasks.add(task);
      if (rafId === null) rafId = window.requestAnimationFrame(frame);
      return () => ticker.remove(task);
    },
    remove(task) {
      tasks.delete(task);
      if (!tasks.size && rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
        last = 0;
      }
    },
    clear() {
      tasks.clear();
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      last = 0;
    },
    get size() {
      return tasks.size;
    },
  };
})();

/* --------------------------------------------------------------------------
   Viewport state — resize / scroll observed once, shared by all features
   -------------------------------------------------------------------------- */

const viewport = {
  width: window.innerWidth,
  height: window.innerHeight,
  scrollY: window.scrollY || window.pageYOffset || 0,
  docHeight: document.documentElement.scrollHeight,
};

const viewportListeners = new Set();

const measureViewport = () => {
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  viewport.docHeight = document.documentElement.scrollHeight;
  viewport.scrollY = window.scrollY || window.pageYOffset || 0;
  viewportListeners.forEach((fn) => fn(viewport));
};

const readScroll = () => {
  viewport.scrollY = window.scrollY || window.pageYOffset || 0;
};

/* --------------------------------------------------------------------------
   Reveal engine
   -------------------------------------------------------------------------- */

const REVEAL_SELECTOR = '[data-reveal]';
const STAGGER_SELECTOR = '[data-reveal-group]';

const revealRegistry = new Map();
let revealObserver = null;

const applyRevealPrep = (el) => {
  const distance = num(el.dataset.revealDistance, 32);
  const duration = num(el.dataset.revealDuration, 900);
  const delay = num(el.dataset.revealDelay, 0);
  const scale = num(el.dataset.revealScale, 1);
  const blur = num(el.dataset.revealBlur, 0);
  const type = (el.dataset.reveal || 'up').trim().toLowerCase();

  let x = 0;
  let y = 0;

  switch (type) {
    case 'down':
      y = -distance;
      break;
    case 'left':
      x = distance;
      break;
    case 'right':
      x = -distance;
      break;
    case 'zoom':
    case 'scale':
      y = 0;
      break;
    case 'fade':
      y = 0;
      break;
    case 'up':
    default:
      y = distance;
      break;
  }

  el.style.setProperty('--reveal-x', `${x}px`);
  el.style.setProperty('--reveal-y', `${y}px`);
  el.style.setProperty('--reveal-scale', String(type === 'zoom' || type === 'scale' ? scale || 0.92 : 1));
  el.style.setProperty('--reveal-blur', `${blur}px`);
  el.style.setProperty('--reveal-duration', `${duration}ms`);
  el.style.setProperty('--reveal-delay', `${delay}ms`);
  el.classList.add('is-reveal-pending');
};

const commitReveal = (el) => {
  el.classList.remove('is-reveal-pending');
  el.classList.add('is-revealed');
  el.dispatchEvent(new CustomEvent('vx:reveal', { bubbles: true, detail: { element: el } }));
};

const resetReveal = (el) => {
  el.classList.remove('is-revealed');
  el.classList.add('is-reveal-pending');
};

const registerReveal = (el) => {
  if (!(el instanceof Element) || revealRegistry.has(el)) return;

  const once = el.dataset.revealOnce !== 'false';
  revealRegistry.set(el, { once });

  if (reducedMotion) {
    el.classList.add('is-revealed');
    return;
  }

  applyRevealPrep(el);
  if (revealObserver) revealObserver.observe(el);
};

const registerRevealGroup = (group) => {
  if (!(group instanceof Element)) return;

  const step = num(group.dataset.revealStagger, 90);
  const base = num(group.dataset.revealDelay, 0);
  const childSelector = group.dataset.revealChildren || ':scope > *';
  let children;

  try {
    children = qsa(childSelector, group);
  } catch (error) {
    children = Array.from(group.children);
  }

  children.forEach((child, index) => {
    if (!child.hasAttribute('data-reveal')) {
      child.setAttribute('data-reveal', group.dataset.revealGroup || 'up');
    }
    if (!child.dataset.revealDelay) {
      child.dataset.revealDelay = String(base + index * step);
    }
    registerReveal(child);
  });
};

const initReveals = (root = document) => {
  if (!('IntersectionObserver' in window)) {
    qsa(REVEAL_SELECTOR, root).forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const record = revealRegistry.get(entry.target);
          if (!record) return;

          if (entry.isIntersecting) {
            commitReveal(entry.target);
            if (record.once) {
              revealObserver.unobserve(entry.target);
              revealRegistry.delete(entry.target);
            }
          } else if (!record.once) {
            resetReveal(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -12% 0px', threshold: 0.12 }
    );
  }

  qsa(STAGGER_SELECTOR, root).forEach(registerRevealGroup);
  qsa(REVEAL_SELECTOR, root).forEach(registerReveal);
};

/* --------------------------------------------------------------------------
   Counters — [data-count-to]
   -------------------------------------------------------------------------- */

const counterObserverOptions = { threshold: 0.4, rootMargin: '0px 0px -10% 0px' };
let counterObserver = null;
const activeCounters = new Set();

const formatCounter = (value, el) => {
  const decimals = num(el.dataset.countDecimals, 0);
  const separator = el.dataset.countSeparator;
  const prefix = el.dataset.countPrefix || '';
  const suffix = el.dataset.countSuffix || '';

  let output = value.toFixed(decimals);

  if (separator !== undefined) {
    const [int, dec] = output.split('.');
    const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator || ',');
    output = dec ? `${grouped}.${dec}` : grouped;
  }

  return `${prefix}${output}${suffix}`;
};

const runCounter = (el) => {
  if (el.dataset.countDone === 'true') return;
  el.dataset.countDone = 'true';

  const to = num(el.dataset.countTo, 0);
  const from = num(el.dataset.countFrom, 0);
  const duration = Math.max(200, num(el.dataset.countDuration, 1800));
  const ease = EASINGS[el.dataset.countEase] || EASINGS.easeOutExpo;

  if (reducedMotion) {
    el.textContent = formatCounter(to, el);
    return;
  }

  const start = performance.now();

  const task = (time) => {
    const t = clamp((time - start) / duration, 0, 1);
    el.textContent = formatCounter(lerp(from, to, ease(t)), el);
    if (t >= 1) {
      ticker.remove(task);
      activeCounters.delete(task);
    }
  };

  activeCounters.add(task);
  ticker.add(task);
};

const initCounters = (root = document) => {
  const nodes = qsa('[data-count-to]', root);
  if (!nodes.length) return;

  nodes.forEach((el) => {
    if (!el.dataset.countFrom) el.dataset.countFrom = '0';
    el.textContent = formatCounter(num(el.dataset.countFrom, 0), el);
  });

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(runCounter);
    return;
  }

  if (!counterObserver) {
    counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        counterObserver.unobserve(entry.target);
      });
    }, counterObserverOptions);
  }

  nodes.forEach((el) => counterObserver.observe(el));
};

/* --------------------------------------------------------------------------
   Parallax — [data-parallax]
   -------------------------------------------------------------------------- */

const parallaxItems = [];
let parallaxTask = null;

const measureParallaxItem = (item) => {
  const rect = item.el.getBoundingClientRect();
  item.top = rect.top + viewport.scrollY;
  item.height = rect.height;
};

const updateParallax = () => {
  const { scrollY, height } = viewport;

  for (let i = 0; i < parallaxItems.length; i += 1) {
    const item = parallaxItems[i];
    const center = item.top + item.height / 2;
    const raw = (scrollY + height / 2 - center) / (height + item.height);
    const progress = clamp(raw, -1, 1);

    item.current = lerp(item.current, progress, item.smooth);

    const y = round(item.current * item.speed * -100, 2);
    const x = round(item.current * item.speedX * -100, 2);
    const rotate = round(item.current * item.rotate, 3);
    const scale = round(1 + Math.abs(item.current) * item.scale, 4);

    item.el.style.transform =
      `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`;

    if (item.fade) {
      item.el.style.opacity = String(round(clamp(1 - Math.abs(item.current) * item.fade, 0, 1), 3));
    }
  }
};

const initParallax = (root = document) => {
  const nodes = qsa('[data-parallax]', root);
  if (!nodes.length || reducedMotion) return;

  nodes.forEach((el) => {
    const item = {
      el,
      speed: num(el.dataset.parallax, 0.15),
      speedX: num(el.dataset.parallaxX, 0),
      rotate: num(el.dataset.parallaxRotate, 0),
      scale: num(el.dataset.parallaxScale, 0),
      fade: num(el.dataset.parallaxFade, 0),
      smooth: clamp(num(el.dataset.parallaxSmooth, 0.12), 0.02, 1),
      current: 0,
      top: 0,
      height: 0,
    };
    el.style.willChange = 'transform';
    parallaxItems.push(item);
    measureParallaxItem(item);
  });

  if (!parallaxTask) {
    parallaxTask = () => updateParallax();
    ticker.add(parallaxTask);
  }

  viewportListeners.add(() => parallaxItems.forEach(measureParallaxItem));
};

/* --------------------------------------------------------------------------
   Scroll progress — [data-scroll-progress]
   -------------------------------------------------------------------------- */

const initScrollProgress = (root = document) => {
  const bars = qsa('[data-scroll-progress]', root);
  if (!bars.length) return;

  let current = 0;

  const task = () => {
    const max = Math.max(1, viewport.docHeight - viewport.height);
    const target = clamp(viewport.scrollY / max, 0, 1);
    current = reducedMotion ? target : lerp(current, target, 0.16);

    const value = round(current, 4);
    bars.forEach((bar) => {
      bar.style.setProperty('--scroll-progress', String(value));
      if (bar.dataset.scrollProgress === 'scale') {
        bar.style.transform = `scaleX(${value})`;
      }
      if (bar.getAttribute('role') === 'progressbar') {
        bar.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      }
    });
  };

  ticker.add(task);
};

/* --------------------------------------------------------------------------
   Section progress — [data-section-progress] exposes 0→1 as a CSS variable
   -------------------------------------------------------------------------- */

const initSectionProgress = (root = document) => {
  const sections = qsa('[data-section-progress]', root);
  if (!sections.length) return;

  const items = sections.map((el) => ({ el, top: 0, height: 0 }));

  const measure = () => {
    items.forEach((item) => {
      const rect = item.el.getBoundingClientRect();
      item.top = rect.top + viewport.scrollY;
      item.height = rect.height || 1;
    });
  };

  measure();
  viewportListeners.add(measure);

  ticker.add(() => {
    items.forEach((item) => {
      const start = item.top - viewport.height;
      const end = item.top + item.height;
      const progress = clamp((viewport.scrollY - start) / Math.max(1, end - start), 0, 1);
      item.el.style.setProperty('--section-progress', String(round(progress, 4)));
    });
  });
};

/* --------------------------------------------------------------------------
   Text splitting — [data-split="chars|words|lines"]
   -------------------------------------------------------------------------- */

const splitText = (el) => {
  if (el.dataset.splitDone === 'true') return;

  const mode = (el.dataset.split || 'chars').toLowerCase();
  const source = el.textContent.replace(/\s+/g, ' ').trim();
  if (!source) return;

  el.setAttribute('aria-label', el.getAttribute('aria-label') || source);
  el.textContent = '';

  const fragment = document.createDocumentFragment();
  const words = source.split(' ');
  let index = 0;

  words.forEach((word, wordIndex) => {
    const wordEl = document.createElement('span');
    wordEl.className = 'split-word';
    wordEl.setAttribute('aria-hidden', 'true');

    if (mode === 'chars') {
      Array.from(word).forEach((char) => {
        const charEl = document.createElement('span');
        charEl.className = 'split-char';
        charEl.textContent = char;
        charEl.style.setProperty('--split-index', String(index));
        wordEl.appendChild(charEl);
        index += 1;
      });
    } else {
      wordEl.textContent = word;
      wordEl.style.setProperty('--split-index', String(index));
      index += 1;
    }

    fragment.appendChild(wordEl);

    if (wordIndex < words.length - 1) {
      const space = document.createElement('span');
      space.className = 'split-space';
      space.setAttribute('aria-hidden', 'true');
      space.innerHTML = '&nbsp;';
      fragment.appendChild(space);
    }
  });

  el.appendChild(fragment);
  el.dataset.splitDone = 'true';
  el.style.setProperty('--split-total', String(index));
  el.classList.add('is-split');
};

const initSplitText = (root = document) => {
  const nodes = qsa('[data-split]', root);
  if (!nodes.length) return;

  nodes.forEach(splitText);

  if (reducedMotion || !('IntersectionObserver' in window)) {
    nodes.forEach((el) => el.classList.add('is-split-in'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-split-in');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.25, rootMargin: '0px 0px -8% 0px' }
  );

  nodes.forEach((el) => observer.observe(el));
};

/* --------------------------------------------------------------------------
   Tilt — [data-tilt]
   -------------------------------------------------------------------------- */

const tiltCleanups = [];

const initTilt = (root = document) => {
  const nodes = qsa('[data-tilt]', root);
  if (!nodes.length) return;
  if (reducedMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  nodes.forEach((el) => {
    const maxTilt = num(el.dataset.tilt, 8);
    const perspective = num(el.dataset.tiltPerspective, 1000);
    const scale = num(el.dataset.tiltScale, 1.02);
    const glare = el.dataset.tiltGlare === 'true';
    const smooth = clamp(num(el.dataset.tiltSmooth, 0.14), 0.02, 1);

    const state = { tx: 0, ty: 0, cx: 0, cy: 0, active: false, s: 1, cs: 1 };
    let task = null;

    if (glare && !el.querySelector('.tilt-glare')) {
      const glareEl = document.createElement('span');
      glareEl.className = 'tilt-glare';
      glareEl.setAttribute('aria-hidden', 'true');
      el.appendChild(glareEl);
    }

    const render = () => {
      state.cx = lerp(state.cx, state.tx, smooth);
      state.cy = lerp(state.cy, state.ty, smooth);
      state.cs = lerp(state.cs, state.s, smooth);

      el.style.transform =
        `perspective(${perspective}px) rotateX(${round(state.cy, 3)}deg) ` +
        `rotateY(${round(state.cx, 3)}deg) scale(${round(state.cs, 4)})`;

      el.style.setProperty('--tilt-x', String(round(state.cx / maxTilt, 3) || 0));
      el.style.setProperty('--tilt-y', String(round(state.cy / maxTilt, 3) || 0));

      const settled =
        Math.abs(state.cx - state.tx) < 0.01 &&
        Math.abs(state.cy - state.ty) < 0.01 &&
        Math.abs(state.cs - state.s) < 0.001;

      if (settled && !state.active) {
        ticker.remove(task);
        task = null;
        el.style.transform = '';
      }
    };

    const ensureTask = () => {
      if (!task) {
        task = render;
        ticker.add(task);
      }
    };

    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      state.tx = (px - 0.5) * 2 * maxTilt;
      state.ty = (0.5 - py) * 2 * maxTilt;
      el.style.setProperty('--pointer-x', `${round(px * 100, 2)}%`);
      el.style.setProperty('--pointer-y', `${round(py * 100, 2)}%`);
      ensureTask();
    };

    const onEnter = () => {
      state.active = true;
      state.s = scale;
      el.classList.add('is-tilting');
      ensureTask();
    };

    const onLeave = () => {
      state.active = false;
      state.tx = 0;
      state.ty = 0;
      state.s = 1;
      el.classList.remove('is-tilting');
      ensureTask();
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointercancel', onLeave);

    tiltCleanups.push(() => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointercancel', onLeave);
      if (task) ticker.remove(task);
      el.style.transform = '';
    });
  });
};

/* --------------------------------------------------------------------------
   Magnetic elements — [data-magnetic]
   -------------------------------------------------------------------------- */

const magneticCleanups = [];

const initMagnetic = (root = document) => {
  const nodes = qsa('[data-magnetic]', root);
  if (!nodes.length) return;
  if (reducedMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  nodes.forEach((el) => {
    const strength = num(el.dataset.magnetic, 0.25);
    const radius = num(el.dataset.magneticRadius, 120);
    const inner = el.querySelector('[data-magnetic-inner]');
    const state = { tx: 0, ty: 0, cx: 0, cy: 0 };
    let task = null;

    const render = () => {
      state.cx = lerp(state.cx, state.tx, 0.16);
      state.cy = lerp(state.cy, state.ty, 0.16);

      const transform = `translate3d(${round(state.cx, 2)}px, ${round(state.cy, 2)}px, 0)`;
      el.style.transform = transform;
      if (inner) {
        inner.style.transform =
          `translate3d(${round(state.cx * -0.35, 2)}px, ${round(state.cy * -0.35, 2)}px, 0)`;
      }

      if (Math.abs(state.cx - state.tx) < 0.05 && Math.abs(state.cy - state.ty) < 0.05) {
        ticker.remove(task);
        task = null;
        if (state.tx === 0 && state.ty === 0) {
          el.style.transform = '';
          if (inner) inner.style.transform = '';
        }
      }
    };

    const ensureTask = () => {
      if (!task) {
        task = render;
        ticker.add(task);
      }
    };

    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(dx, dy);
      const falloff = clamp(1 - distance / (radius + Math.max(rect.width, rect.height)), 0, 1);
      state.tx = dx * strength * falloff;
      state.ty = dy * strength * falloff;
      ensureTask();
    };

    const onLeave = () => {
      state.tx = 0;
      state.ty = 0;
      ensureTask();
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointercancel', onLeave);
    el.addEventListener('blur', onLeave);

    magneticCleanups.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointercancel', onLeave);
      el.removeEventListener('blur', onLeave);
      if (task) ticker.remove(task);
      el.style.transform = '';
      if (inner) inner.style.transform = '';
    });
  });
};

/* --------------------------------------------------------------------------
   Pointer spotlight — [data-spotlight] tracks cursor into CSS variables
   -------------------------------------------------------------------------- */

const initSpotlight = (root = document) => {
  const nodes = qsa('[data-spotlight]', root);
  if (!nodes.length || reducedMotion) return;

  nodes.forEach((el) => {
    const onMove = (event) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${round(event.clientX - rect.left, 1)}px`);
      el.style.setProperty('--spot-y', `${round(event.clientY - rect.top, 1)}px`);
      el.style.setProperty('--spot-opacity', '1');
    };
    const onLeave = () => el.style.setProperty('--spot-opacity', '0');

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
  });
};

/* --------------------------------------------------------------------------
   Marquee — [data-marquee] duplicates content and animates continuously
   -------------------------------------------------------------------------- */

const initMarquee = (root = document) => {
  const nodes = qsa('[data-marquee]', root);
  if (!nodes.length) return;

  nodes.forEach((el) => {
    const track = el.querySelector('[data-marquee-track]') || el.firstElementChild;
    if (!track || track.dataset.marqueeReady === 'true') return;

    const speed = Math.abs(num(el.dataset.marqueeSpeed, 60));
    const direction = el.dataset.marqueeDirection === 'right' ? 1 : -1;

    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('data-marquee-track');
    el.appendChild(clone);
    track.dataset.marqueeReady = 'true';

    if (reducedMotion) {
      el.classList.add('is-marquee-static');
      return;
    }

    const width = track.scrollWidth || 1;
    const duration = width / speed;

    el.style.setProperty('--marquee-duration', `${round(duration, 2)}s`);
    el.style.setProperty('--marquee-direction', direction === 1 ? 'reverse' : 'normal');
    el.classList.add('is-marquee-running');

    if (el.dataset.marqueePause !== 'false') {
      el.addEventListener('pointerenter', () => el.classList.add('is-marquee-paused'));
      el.addEventListener('pointerleave', () => el.classList.remove('is-marquee-paused'));
    }
  });
};

/* --------------------------------------------------------------------------
   Scroll direction + "scrolled" state flags on <html>
   -------------------------------------------------------------------------- */

const initScrollState = () => {
  const rootEl = document.documentElement;
  let last = viewport.scrollY;
  let direction = '';

  ticker.add(() => {
    const y = viewport.scrollY;
    const delta = y - last;

    if (Math.abs(delta) > 4) {
      const next = delta > 0 ? 'down' : 'up';
      if (next !== direction) {
        direction = next;
        rootEl.dataset.scrollDirection = direction;
      }
      last = y;
    }

    rootEl.classList.toggle('is-scrolled', y > 24);
    rootEl.classList.toggle('is-scrolled-deep', y > viewport.height * 0.75);
    rootEl.style.setProperty('--scroll-y', `${Math.round(y)}px`);
  });
};

/* --------------------------------------------------------------------------
   Public tween helper — reusable by other modules
   -------------------------------------------------------------------------- */

export const tween = ({
  from = 0,
  to = 1,
  duration = 600,
  delay = 0,
  ease = 'easeOutCubic',
  onUpdate,
  onComplete,
} = {}) => {
  const easeFn = typeof ease === 'function' ? ease : EASINGS[ease] || EASINGS.easeOutCubic;

  if (reducedMotion || duration <= 0) {
    if (typeof onUpdate === 'function') onUpdate(to, 1);
    if (typeof onComplete === 'function') onComplete();
    return () => {};
  }

  let start = null;
  let cancelled = false;

  const task = (time) => {
    if (start === null) start = time + delay;
    if (time < start) return;

    const t = clamp((time - start) / duration, 0, 1);
    const value = lerp(from, to, easeFn(t));

    if (typeof onUpdate === 'function') onUpdate(value, t);

    if (t >= 1) {
      ticker.remove(task);
      if (!cancelled && typeof onComplete === 'function') onComplete();
    }
  };

  ticker.add(task);

  return () => {
    cancelled = true;
    ticker.remove(task);
  };
};

/* --------------------------------------------------------------------------
   Programmatic reveal for dynamically injected DOM (cards, gallery, etc.)
   -------------------------------------------------------------------------- */

export const refresh = (root = document) => {
  initReveals(root);
  initCounters(root);
  initSplitText(root);
  initTilt(root);
  initMagnetic(root);
  initSpotlight(root);
  initMarquee(root);
  measureViewport();
};

/* --------------------------------------------------------------------------
   Lifecycle
   -------------------------------------------------------------------------- */

let initialised = false;
let scrollHandler = null;
let resizeHandler = null;
let resizeRaf = 0;

export const init = (options = {}) => {
  if (initialised) return api;
  initialised = true;

  const root = options.root instanceof Element ? options.root : document;

  if (motionQuery) {
    const onMotionChange = (event) => {
      reducedMotion = event.matches;
      document.documentElement.classList.toggle('is-reduced-motion', reducedMotion);
      if (reducedMotion) {
        revealRegistry.forEach((_record, el) => el.classList.add('is-revealed'));
      }
    };
    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', onMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
      motionQuery.addListener(onMotionChange);
    }
  }

  document.documentElement.classList.toggle('is-reduced-motion', reducedMotion);

  scrollHandler = () => readScroll();
  resizeHandler = () => {
    if (resizeRaf) window.cancelAnimationFrame(resizeRaf);
    resizeRaf = window.requestAnimationFrame(() => {
      resizeRaf = 0;
      measureViewport();
    });
  };

  window.addEventListener('scroll', scrollHandler, { passive: true });
  window.addEventListener('resize', resizeHandler, { passive: true });
  window.addEventListener('orientationchange', resizeHandler, { passive: true });

  measureViewport();

  initScrollState();
  initReveals(root);
  initCounters(root);
  initSplitText(root);
  initParallax(root);
  initScrollProgress(root);
  initSectionProgress(root);
  initTilt(root);
  initMagnetic(root);
  initSpotlight(root);
  initMarquee(root);

  if (document.fonts && typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(() => measureViewport()).catch(() => {});
  }

  window.addEventListener('load', () => measureViewport(), { once: true });

  document.dispatchEvent(new CustomEvent('vx:animations:ready'));

  return api;
};

export const destroy = () => {
  if (!initialised) return;
  initialised = false;

  if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    window.removeEventListener('orientationchange', resizeHandler);
  }

  tiltCleanups.splice(0).forEach((fn) => fn());
  magneticCleanups.splice(0).forEach((fn) => fn());

  if (revealObserver) {
    revealObserver.disconnect();
    revealObserver = null;
  }
  if (counterObserver) {
    counterObserver.disconnect();
    counterObserver = null;
  }

  revealRegistry.clear();
  parallaxItems.length = 0;
  parallaxTask = null;
  viewportListeners.clear();
  ticker.clear();
};

export const isReducedMotion = () => reducedMotion;

export const addTickerTask = (task) => ticker.add(task);

export const removeTickerTask = (task) => ticker.remove(task);

export const getViewport = () => ({ ...viewport });

export { EASINGS, viewport };

const api = {
  init,
  destroy,
  refresh,
  tween,
  isReducedMotion,
  addTickerTask,
  removeTickerTask,
  getViewport,
  EASINGS,
};
export const initAnimations = init;
export default api;
