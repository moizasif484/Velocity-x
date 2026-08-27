/**
 * Velocity X — slider.js
 * ---------------------------------------------------------------------------
 * Lightweight, dependency-free, accessible slider / carousel engine.
 *
 * Powers:
 *   - Hero showcase slides            [data-slider="hero"]
 *   - Car gallery / thumbnails        [data-slider="gallery"]
 *   - Testimonials                    [data-slider="testimonials"]
 *
 * Markup contract:
 *   <div class="slider" data-slider="testimonials" data-slider-autoplay="6000">
 *     <div class="slider__viewport">
 *       <ul class="slider__track">
 *         <li class="slider__slide"> … </li>
 *       </ul>
 *     </div>
 *     <button class="slider__arrow" data-slider-prev></button>
 *     <button class="slider__arrow" data-slider-next></button>
 *     <div class="slider__dots" data-slider-dots></div>
 *     <div class="slider__progress"><span data-slider-progress></span></div>
 *   </div>
 * ---------------------------------------------------------------------------
 */

import {
  $,

  $$,
  clamp,
  debounce,
  prefersReducedMotion,
} from './utils.js';

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

const DEFAULTS = Object.freeze({
  loop: true,
  autoplay: 0,            // ms — 0 disables autoplay
  pauseOnHover: true,
  pauseOnFocus: true,
  draggable: true,
  keyboard: true,
  dragThreshold: 60,      // px before a drag counts as a swipe
  perView: 1,
  gap: 0,                 // px — read from CSS if left at 0
  speed: 650,             // ms — must mirror --slider-speed in components.css
  startIndex: 0,
});

const SELECTORS = Object.freeze({
  slider: '[data-slider]',
  viewport: '.slider__viewport',
  track: '.slider__track',
  slide: '.slider__slide',
  prev: '[data-slider-prev]',
  next: '[data-slider-next]',
  dots: '[data-slider-dots]',
  progress: '[data-slider-progress]',
});

const CLASSES = Object.freeze({
  ready: 'is-ready',
  dragging: 'is-dragging',
  active: 'is-active',
  disabled: 'is-disabled',
  dot: 'slider__dot',
});

/* -------------------------------------------------------------------------- */
/* Slider                                                                      */
/* -------------------------------------------------------------------------- */

export class Slider {
  /**
   * @param {HTMLElement} root
   * @param {Partial<typeof DEFAULTS>} [options]
   */
  constructor(root, options = {}) {
    this.root = root;
    this.options = { ...DEFAULTS, ...Slider.readDataOptions(root), ...options };

    this.viewport = $(SELECTORS.viewport, root) || root;
    this.track = $(SELECTORS.track, root);
    this.slides = $$(SELECTORS.slide, root);

    if (!this.track || this.slides.length === 0) return;

    this.index = clamp(this.options.startIndex, 0, this.slides.length - 1);
    this.slideWidth = 0;
    this.timer = null;
    this.rafId = null;
    this.isPaused = false;
    this.isDragging = false;
    this.pointerId = null;
    this.startX = 0;
    this.deltaX = 0;
    this.destroyed = false;

    this.reducedMotion = prefersReducedMotion();

    this.onResize = debounce(this.measure.bind(this), 150);

    this.init();
  }

  /* ---------------------------------------------------------------------- */
  /* Setup                                                                   */
  /* ---------------------------------------------------------------------- */

  init() {
    this.cacheControls();
    this.applyA11y();
    this.buildDots();
    this.measure();
    this.bindEvents();
    this.goTo(this.index, { instant: true });
    this.root.classList.add(CLASSES.ready);
    this.play();
  }

  cacheControls() {
    this.prevBtn = $(SELECTORS.prev, this.root);
    this.nextBtn = $(SELECTORS.next, this.root);
    this.dotsHost = $(SELECTORS.dots, this.root);
    this.progressBar = $(SELECTORS.progress, this.root);
    this.dots = [];
  }

  applyA11y() {
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-roledescription', 'carousel');
    if (!this.root.hasAttribute('aria-label')) {
      this.root.setAttribute('aria-label', this.root.dataset.slider || 'carousel');
    }

    this.viewport.setAttribute('aria-live', this.options.autoplay ? 'off' : 'polite');

    this.slides.forEach((slide, i) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${i + 1} of ${this.slides.length}`);
    });
  }

  buildDots() {
    if (!this.dotsHost) return;

    this.dotsHost.innerHTML = '';
    const frag = document.createDocumentFragment();

    this.slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = CLASSES.dot;
      dot.dataset.slideTo = String(i);
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      frag.appendChild(dot);
      this.dots.push(dot);
    });

    this.dotsHost.appendChild(frag);
  }

  /* ---------------------------------------------------------------------- */
  /* Measurement                                                             */
  /* ---------------------------------------------------------------------- */

  measure() {
    if (this.destroyed) return;

    const first = this.slides[0];
    const styles = getComputedStyle(this.track);
    const gap = this.options.gap || parseFloat(styles.columnGap || styles.gap) || 0;

    this.gap = Number.isNaN(gap) ? 0 : gap;
    this.slideWidth = first.getBoundingClientRect().width + this.gap;
    this.perView = this.resolvePerView();
    this.maxIndex = Math.max(0, this.slides.length - this.perView);
    this.index = clamp(this.index, 0, this.maxIndex);

    this.goTo(this.index, { instant: true, silent: true });
  }

  resolvePerView() {
    const declared = Number(this.root.dataset.sliderPerView);
    if (declared > 0) return declared;

    const viewportWidth = this.viewport.getBoundingClientRect().width;
    if (!this.slideWidth) return this.options.perView;

    return Math.max(1, Math.round(viewportWidth / this.slideWidth));
  }

  /* ---------------------------------------------------------------------- */
  /* Navigation                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * @param {number} index
   * @param {{ instant?: boolean, silent?: boolean }} [config]
   */
  goTo(index, config = {}) {
    if (this.destroyed) return;

    const { instant = false, silent = false } = config;
    const last = this.maxIndex ?? this.slides.length - 1;

    if (this.options.loop) {
      if (index < 0) index = last;
      else if (index > last) index = 0;
    } else {
      index = clamp(index, 0, last);
    }

    this.index = index;
    this.translate(-(index * this.slideWidth), instant);
    this.syncState();

    if (!silent) this.emit('slider:change', { index, slider: this });
  }

  next() {
    this.goTo(this.index + 1);
  }

  prev() {
    this.goTo(this.index - 1);
  }

  translate(x, instant = false) {
    const duration = instant || this.reducedMotion ? 0 : this.options.speed;
    this.track.style.transitionDuration = `${duration}ms`;
    this.track.style.transform = `translate3d(${x}px, 0, 0)`;
  }

  syncState() {
    this.slides.forEach((slide, i) => {
      const visible = i >= this.index && i < this.index + (this.perView || 1);
      slide.classList.toggle(CLASSES.active, i === this.index);
      slide.setAttribute('aria-hidden', visible ? 'false' : 'true');
      slide.querySelectorAll('a, button, input, select, textarea').forEach((el) => {
        el.tabIndex = visible ? 0 : -1;
      });
    });

    this.dots.forEach((dot, i) => {
      const active = i === this.index;
      dot.classList.toggle(CLASSES.active, active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });

    if (!this.options.loop) {
      this.prevBtn?.classList.toggle(CLASSES.disabled, this.index === 0);
      this.nextBtn?.classList.toggle(CLASSES.disabled, this.index === this.maxIndex);
      if (this.prevBtn) this.prevBtn.disabled = this.index === 0;
      if (this.nextBtn) this.nextBtn.disabled = this.index === this.maxIndex;
    }

    if (this.progressBar) {
      const ratio = this.maxIndex ? this.index / this.maxIndex : 1;
      this.progressBar.style.transform = `scaleX(${ratio || 0.02})`;
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Autoplay                                                                */
  /* ---------------------------------------------------------------------- */

  play() {
    if (!this.options.autoplay || this.reducedMotion || this.destroyed) return;
    this.stop();
    this.timer = window.setInterval(() => {
      if (!this.isPaused && !document.hidden) this.next();
    }, this.options.autoplay);
  }

  stop() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  /* ---------------------------------------------------------------------- */
  /* Events                                                                  */
  /* ---------------------------------------------------------------------- */

  bindEvents() {
    this.prevBtn?.addEventListener('click', () => {
      this.prev();
      this.restartAutoplay();
    });

    this.nextBtn?.addEventListener('click', () => {
      this.next();
      this.restartAutoplay();
    });

    this.dotsHost?.addEventListener('click', (event) => {
      const dot = event.target.closest(`[data-slide-to]`);
      if (!dot) return;
      this.goTo(Number(dot.dataset.slideTo));
      this.restartAutoplay();
    });

    if (this.options.pauseOnHover) {
      this.root.addEventListener('mouseenter', () => this.pause());
      this.root.addEventListener('mouseleave', () => this.resume());
    }

    if (this.options.pauseOnFocus) {
      this.root.addEventListener('focusin', () => this.pause());
      this.root.addEventListener('focusout', () => this.resume());
    }

    if (this.options.keyboard) {
      this.root.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    if (this.options.draggable) this.bindDrag();

    window.addEventListener('resize', this.onResize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      document.hidden ? this.pause() : this.resume();
    });
  }

  handleKeydown(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prev();
      this.restartAutoplay();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
      this.restartAutoplay();
    }
  }

  bindDrag() {
    const onDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      this.isDragging = true;
      this.pointerId = event.pointerId;
      this.startX = event.clientX;
      this.deltaX = 0;
      this.pause();
      this.root.classList.add(CLASSES.dragging);
      this.track.style.transitionDuration = '0ms';
      this.viewport.setPointerCapture?.(event.pointerId);
    };

    const onMove = (event) => {
      if (!this.isDragging || event.pointerId !== this.pointerId) return;
      this.deltaX = event.clientX - this.startX;
      const base = -(this.index * this.slideWidth);
      this.track.style.transform = `translate3d(${base + this.deltaX}px, 0, 0)`;
    };

    const onUp = (event) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.root.classList.remove(CLASSES.dragging);
      this.viewport.releasePointerCapture?.(event.pointerId);

      if (Math.abs(this.deltaX) > this.options.dragThreshold) {
        this.deltaX < 0 ? this.next() : this.prev();
      } else {
        this.goTo(this.index);
      }

      this.deltaX = 0;
      this.resume();
      this.restartAutoplay();
    };

    this.viewport.addEventListener('pointerdown', onDown);
    this.viewport.addEventListener('pointermove', onMove, { passive: true });
    this.viewport.addEventListener('pointerup', onUp);
    this.viewport.addEventListener('pointercancel', onUp);
    this.viewport.addEventListener('dragstart', (e) => e.preventDefault());
  }

  restartAutoplay() {
    if (!this.options.autoplay) return;
    this.play();
  }

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                 */
  /* ---------------------------------------------------------------------- */

  emit(type, detail) {
    this.root.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }

  destroy() {
    this.stop();
    this.destroyed = true;
    window.removeEventListener('resize', this.onResize);
    this.root.classList.remove(CLASSES.ready);
    this.track.style.transform = '';
    this.track.style.transitionDuration = '';
  }

  /**
   * Reads `data-slider-*` attributes and casts them to option values.
   * @param {HTMLElement} root
   */
  static readDataOptions(root) {
    const map = {
      sliderAutoplay: 'autoplay',
      sliderLoop: 'loop',
      sliderPerView: 'perView',
      sliderGap: 'gap',
      sliderSpeed: 'speed',
      sliderDraggable: 'draggable',
      sliderStart: 'startIndex',
    };

    return Object.entries(map).reduce((acc, [dataKey, optionKey]) => {
      const raw = root.dataset[dataKey];
      if (raw === undefined) return acc;
      if (raw === 'true' || raw === 'false') acc[optionKey] = raw === 'true';
      else if (raw !== '' && !Number.isNaN(Number(raw))) acc[optionKey] = Number(raw);
      else acc[optionKey] = raw;
      return acc;
    }, {});
  }
}

/* -------------------------------------------------------------------------- */
/* Registry                                                                    */
/* -------------------------------------------------------------------------- */

const instances = new Map();

/**
 * Boots every `[data-slider]` found in the given scope.
 * @param {ParentNode} [scope=document]
 * @returns {Slider[]}
 */
export function initSliders(scope = document) {
  return $$(SELECTORS.slider, scope).map((el) => {
    if (instances.has(el)) return instances.get(el);
    const instance = new Slider(el);
    instances.set(el, instance);
    return instance;
  });
}

/**
 * @param {string} name value of the `data-slider` attribute
 * @returns {Slider|undefined}
 */
export function getSlider(name) {
  for (const [el, instance] of instances) {
    if (el.dataset.slider === name) return instance;
  }
  return undefined;
}

export function destroySliders() {
  instances.forEach((instance) => instance.destroy());
  instances.clear();
}

export default initSliders;
