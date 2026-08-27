/* ==========================================================================
   Velocity-X — assets/js/modules/ui.js
   Modals, tabs, accordions, dropdowns, tooltips, toasts, ripples,
   scroll-to-top, copy-to-clipboard, marquee tickers and the custom cursor.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const getFocusable = (root) =>
  qsa(FOCUSABLE, root).filter((el) => {
    if (el.hasAttribute('aria-hidden')) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 || el === document.activeElement;
  });

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const uid = (prefix = 'vx') => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

const emit = (target, name, detail) =>
  target.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));

/* --------------------------------------------------------------------------
   Scroll lock (reference counted so nested overlays behave correctly)
   -------------------------------------------------------------------------- */

const scrollLock = (() => {
  let count = 0;
  let storedY = 0;

  return {
    lock() {
      count += 1;
      if (count > 1) return;

      storedY = window.scrollY || window.pageYOffset || 0;
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;

      document.documentElement.style.setProperty('--scrollbar-width', `${scrollbar}px`);
      document.body.style.paddingRight = scrollbar > 0 ? `${scrollbar}px` : '';
      document.body.classList.add('is-scroll-locked');
    },
    unlock(force = false) {
      if (force) count = 0;
      else count = Math.max(0, count - 1);
      if (count > 0) return;

      document.body.classList.remove('is-scroll-locked');
      document.body.style.paddingRight = '';
      document.documentElement.style.removeProperty('--scrollbar-width');
      window.scrollTo({ top: storedY, behavior: 'auto' });
    },
    get locked() {
      return count > 0;
    },
  };
})();

/* --------------------------------------------------------------------------
   Overlay stack — the top-most overlay owns Escape and focus trapping
   -------------------------------------------------------------------------- */

const overlayStack = [];

const pushOverlay = (entry) => {
  overlayStack.push(entry);
};

const popOverlay = (entry) => {
  const index = overlayStack.indexOf(entry);
  if (index > -1) overlayStack.splice(index, 1);
};

const topOverlay = () => overlayStack[overlayStack.length - 1] || null;

document.addEventListener('keydown', (event) => {
  const top = topOverlay();
  if (!top) return;

  if (event.key === 'Escape' && top.dismissible) {
    event.preventDefault();
    top.close();
    return;
  }

  if (event.key !== 'Tab' || !top.trap) return;

  const focusable = getFocusable(top.element);
  if (!focusable.length) {
    event.preventDefault();
    top.element.focus({ preventScroll: true });
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && (active === first || !top.element.contains(active))) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
});

/* --------------------------------------------------------------------------
   Modals — [data-modal-open="id"] / [data-modal="id"]
   -------------------------------------------------------------------------- */

const modals = new Map();

const createModal = (element) => {
  const id = element.dataset.modal || element.id || uid('modal');
  const dismissible = element.dataset.modalDismissible !== 'false';
  let opener = null;
  let overlayEntry = null;

  element.setAttribute('role', element.getAttribute('role') || 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-hidden', 'true');
  if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
  element.hidden = !element.classList.contains('is-open');

  const instance = {
    id,
    element,
    get isOpen() {
      return element.classList.contains('is-open');
    },
    open(trigger) {
      if (instance.isOpen) return;
      opener = trigger instanceof HTMLElement ? trigger : document.activeElement;

      element.hidden = false;
      element.setAttribute('aria-hidden', 'false');
      /* Force a reflow so the CSS transition always plays. */
      void element.offsetWidth;
      element.classList.add('is-open');
      scrollLock.lock();

      overlayEntry = { element, dismissible, trap: true, close: () => instance.close() };
      pushOverlay(overlayEntry);

      const autofocus =
        qs('[data-modal-autofocus]', element) || getFocusable(element)[0] || element;
      window.requestAnimationFrame(() => autofocus.focus({ preventScroll: true }));

      emit(element, 'vx:modal:open', { id });
    },
    close() {
      if (!instance.isOpen) return;

      element.classList.remove('is-open');
      element.setAttribute('aria-hidden', 'true');
      if (overlayEntry) popOverlay(overlayEntry);
      overlayEntry = null;
      scrollLock.unlock();

      const finish = () => {
        if (!element.classList.contains('is-open')) element.hidden = true;
      };

      if (prefersReducedMotion()) finish();
      else window.setTimeout(finish, 420);

      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      opener = null;

      emit(element, 'vx:modal:close', { id });
    },
    toggle(trigger) {
      if (instance.isOpen) instance.close();
      else instance.open(trigger);
    },
  };

  if (dismissible) {
    element.addEventListener('mousedown', (event) => {
      if (event.target === element || event.target.hasAttribute('data-modal-backdrop')) {
        instance.close();
      }
    });
  }

  qsa('[data-modal-close]', element).forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      instance.close();
    });
  });

  modals.set(id, instance);
  return instance;
};

const initModals = (root = document) => {
  qsa('.modal, [data-modal]', root).forEach((el) => {
    const id = el.dataset.modal || el.id;
    if (id && !modals.has(id)) createModal(el);
  });
};

export const openModal = (id, trigger) => {
  const modal = modals.get(id);
  if (modal) modal.open(trigger);
  return modal || null;
};

export const closeModal = (id) => {
  if (id) {
    const modal = modals.get(id);
    if (modal) modal.close();
    return;
  }
  modals.forEach((modal) => modal.close());
};

/* --------------------------------------------------------------------------
   Tabs — [data-tabs] > [data-tab-list] > [data-tab="panelId"]
   -------------------------------------------------------------------------- */

const initTabs = (root = document) => {
  qsa('[data-tabs]', root).forEach((wrapper) => {
    if (wrapper.dataset.tabsReady === 'true') return;
    wrapper.dataset.tabsReady = 'true';

    const list = qs('[data-tab-list]', wrapper) || wrapper;
    const tabs = qsa('[data-tab]', list);
    const panels = qsa('[data-tab-panel]', wrapper);
    if (!tabs.length || !panels.length) return;

    list.setAttribute('role', 'tablist');

    const activate = (key, focusTab = false) => {
      tabs.forEach((tab) => {
        const isActive = tab.dataset.tab === key;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.setAttribute('tabindex', isActive ? '0' : '-1');
        if (isActive && focusTab) tab.focus({ preventScroll: true });
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.tabPanel === key;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });

      wrapper.dataset.activeTab = key;
      emit(wrapper, 'vx:tabs:change', { key });
    };

    tabs.forEach((tab, index) => {
      const key = tab.dataset.tab;
      const panel = panels.find((p) => p.dataset.tabPanel === key);
      const tabId = tab.id || uid('tab');
      const panelId = panel && (panel.id || uid('panel'));

      tab.id = tabId;
      tab.setAttribute('role', 'tab');
      if (panel) {
        panel.id = panelId;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabId);
        tab.setAttribute('aria-controls', panelId);
      }

      tab.addEventListener('click', (event) => {
        event.preventDefault();
        activate(key);
      });

      tab.addEventListener('keydown', (event) => {
        const keys = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
        if (!keys.includes(event.key)) return;
        event.preventDefault();

        let next = index;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;

        activate(tabs[next].dataset.tab, true);
      });
    });

    const initial =
      wrapper.dataset.activeTab ||
      (tabs.find((t) => t.classList.contains('is-active')) || tabs[0]).dataset.tab;

    activate(initial);
  });
};

/* --------------------------------------------------------------------------
   Accordions — [data-accordion] > [data-accordion-item]
   -------------------------------------------------------------------------- */

const initAccordions = (root = document) => {
  qsa('[data-accordion]', root).forEach((accordion) => {
    if (accordion.dataset.accordionReady === 'true') return;
    accordion.dataset.accordionReady = 'true';

    const single = accordion.dataset.accordion === 'single';
    const items = qsa('[data-accordion-item]', accordion);

    const setState = (item, open) => {
      const trigger = qs('[data-accordion-trigger]', item);
      const panel = qs('[data-accordion-panel]', item);
      if (!trigger || !panel) return;

      item.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));

      if (open) {
        panel.hidden = false;
        panel.style.maxHeight = `${panel.scrollHeight}px`;
      } else {
        panel.style.maxHeight = '0px';
      }

      emit(item, open ? 'vx:accordion:open' : 'vx:accordion:close', { item });
    };

    items.forEach((item) => {
      const trigger = qs('[data-accordion-trigger]', item);
      const panel = qs('[data-accordion-panel]', item);
      if (!trigger || !panel) return;

      const triggerId = trigger.id || uid('acc-trigger');
      const panelId = panel.id || uid('acc-panel');
      trigger.id = triggerId;
      panel.id = panelId;
      trigger.setAttribute('aria-controls', panelId);
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', triggerId);
      panel.style.overflow = 'hidden';
      panel.style.transition = prefersReducedMotion()
        ? 'none'
        : 'max-height 420ms cubic-bezier(0.22, 1, 0.36, 1)';

      const startOpen = item.classList.contains('is-open');
      panel.hidden = !startOpen;
      panel.style.maxHeight = startOpen ? `${panel.scrollHeight}px` : '0px';
      trigger.setAttribute('aria-expanded', String(startOpen));

      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        const willOpen = !item.classList.contains('is-open');

        if (single && willOpen) {
          items.forEach((other) => {
            if (other !== item && other.classList.contains('is-open')) setState(other, false);
          });
        }

        setState(item, willOpen);
      });

      panel.addEventListener('transitionend', (event) => {
        if (event.propertyName !== 'max-height') return;
        if (item.classList.contains('is-open')) panel.style.maxHeight = 'none';
        else panel.hidden = true;
      });
    });

    window.addEventListener(
      'resize',
      () => {
        items.forEach((item) => {
          const panel = qs('[data-accordion-panel]', item);
          if (panel && item.classList.contains('is-open')) panel.style.maxHeight = 'none';
        });
      },
      { passive: true }
    );
  });
};

/* --------------------------------------------------------------------------
   Dropdowns / popovers — [data-dropdown]
   -------------------------------------------------------------------------- */

const initDropdowns = (root = document) => {
  qsa('[data-dropdown]', root).forEach((dropdown) => {
    if (dropdown.dataset.dropdownReady === 'true') return;
    dropdown.dataset.dropdownReady = 'true';

    const trigger = qs('[data-dropdown-trigger]', dropdown);
    const menu = qs('[data-dropdown-menu]', dropdown);
    if (!trigger || !menu) return;

    const menuId = menu.id || uid('menu');
    menu.id = menuId;
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', menuId);

    let entry = null;

    const close = () => {
      if (!dropdown.classList.contains('is-open')) return;
      dropdown.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (entry) popOverlay(entry);
      entry = null;
      emit(dropdown, 'vx:dropdown:close', {});
    };

    const open = () => {
      if (dropdown.classList.contains('is-open')) return;
      qsa('[data-dropdown].is-open').forEach((other) => {
        if (other !== dropdown) other.dispatchEvent(new CustomEvent('vx:dropdown:request-close'));
      });

      dropdown.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      entry = { element: dropdown, dismissible: true, trap: false, close };
      pushOverlay(entry);

      const first = getFocusable(menu)[0];
      if (first) window.requestAnimationFrame(() => first.focus({ preventScroll: true }));
      emit(dropdown, 'vx:dropdown:open', {});
    };

    dropdown.addEventListener('vx:dropdown:request-close', close);

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (dropdown.classList.contains('is-open')) close();
      else open();
    });

    menu.addEventListener('click', (event) => {
      if (event.target.closest('[data-dropdown-item]')) close();
    });

    document.addEventListener('pointerdown', (event) => {
      if (!dropdown.contains(event.target)) close();
    });

    dropdown.addEventListener('focusout', (event) => {
      if (!dropdown.contains(event.relatedTarget)) close();
    });
  });
};

/* --------------------------------------------------------------------------
   Tooltips — [data-tooltip="text"]
   -------------------------------------------------------------------------- */

let tooltipEl = null;

const ensureTooltip = () => {
  if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'vx-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tooltipEl);
  return tooltipEl;
};

const positionTooltip = (target, placement) => {
  const tip = ensureTooltip();
  const rect = target.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const gap = 10;

  let top;
  let left;

  switch (placement) {
    case 'bottom':
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.left - tipRect.width - gap;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - tipRect.height / 2;
      left = rect.right + gap;
      break;
    case 'top':
    default:
      top = rect.top - tipRect.height - gap;
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      break;
  }

  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - tipRect.height - 8));

  tip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
  tip.dataset.placement = placement;
};

const initTooltips = () => {
  const show = (target) => {
    const text = target.getAttribute('data-tooltip');
    if (!text) return;
    const tip = ensureTooltip();
    tip.textContent = text;
    tip.setAttribute('aria-hidden', 'false');
    tip.classList.add('is-visible');
    positionTooltip(target, target.getAttribute('data-tooltip-placement') || 'top');
  };

  const hide = () => {
    if (!tooltipEl) return;
    tooltipEl.classList.remove('is-visible');
    tooltipEl.setAttribute('aria-hidden', 'true');
  };

  document.addEventListener('pointerover', (event) => {
    const target = event.target.closest('[data-tooltip]');
    if (target) show(target);
  });

  document.addEventListener('pointerout', (event) => {
    if (event.target.closest('[data-tooltip]')) hide();
  });

  document.addEventListener('focusin', (event) => {
    const target = event.target.closest('[data-tooltip]');
    if (target) show(target);
  });

  document.addEventListener('focusout', hide);
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide, { passive: true });
};

/* --------------------------------------------------------------------------
   Toasts
   -------------------------------------------------------------------------- */

const TOAST_ICONS = {
  success: 'M20 6 9 17l-5-5',
  error: 'M18 6 6 18M6 6l12 12',
  warning: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 16v-4m0-4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
};

let toastRegion = null;

const ensureToastRegion = () => {
  if (toastRegion && document.body.contains(toastRegion)) return toastRegion;
  toastRegion =
    qs('[data-toast-region]') || document.createElement('div');
  toastRegion.className = 'vx-toasts';
  toastRegion.setAttribute('data-toast-region', '');
  toastRegion.setAttribute('role', 'region');
  toastRegion.setAttribute('aria-label', 'Notifications');
  toastRegion.setAttribute('aria-live', 'polite');
  if (!document.body.contains(toastRegion)) document.body.appendChild(toastRegion);
  return toastRegion;
};

export const toast = (message, options = {}) => {
  const { type = 'info', title = '', duration = 4800, dismissible = true } = options;
  const region = ensureToastRegion();

  const el = document.createElement('div');
  el.className = `vx-toast vx-toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

  el.innerHTML = `
    <span class="vx-toast__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round"><path d="${icon}"/></svg>
    </span>
    <div class="vx-toast__body">
      ${title ? `<p class="vx-toast__title"></p>` : ''}
      <p class="vx-toast__message"></p>
    </div>
    ${dismissible ? '<button class="vx-toast__close" type="button" aria-label="Dismiss notification">&times;</button>' : ''}
  `;

  if (title) qs('.vx-toast__title', el).textContent = title;
  qs('.vx-toast__message', el).textContent = message;

  region.appendChild(el);
  window.requestAnimationFrame(() => el.classList.add('is-visible'));

  let timer = 0;

  const remove = () => {
    window.clearTimeout(timer);
    el.classList.remove('is-visible');
    const finish = () => el.remove();
    if (prefersReducedMotion()) finish();
    else window.setTimeout(finish, 320);
  };

  if (dismissible) qs('.vx-toast__close', el).addEventListener('click', remove);

  if (duration > 0) {
    timer = window.setTimeout(remove, duration);
    el.addEventListener('pointerenter', () => window.clearTimeout(timer));
    el.addEventListener('pointerleave', () => {
      timer = window.setTimeout(remove, 1600);
    });
  }

  return { element: el, dismiss: remove };
};

/* --------------------------------------------------------------------------
   Ripple — [data-ripple]
   -------------------------------------------------------------------------- */

const initRipple = () => {
  document.addEventListener('pointerdown', (event) => {
    const target = event.target.closest('[data-ripple]');
    if (!target || prefersReducedMotion()) return;

    const rect = target.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.8;
    const ripple = document.createElement('span');

    ripple.className = 'vx-ripple';
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    target.appendChild(ripple);

    ripple.addEventListener('animationend', () => ripple.remove());
    window.setTimeout(() => ripple.remove(), 900);
  });
};

/* --------------------------------------------------------------------------
   Copy to clipboard — [data-copy="text"]
   -------------------------------------------------------------------------- */

const copyText = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  area.remove();
};

const initCopy = () => {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    event.preventDefault();

    const value =
      button.dataset.copy ||
      (button.dataset.copyTarget ? qs(button.dataset.copyTarget)?.textContent : '') ||
      '';

    if (!value.trim()) return;

    try {
      await copyText(value.trim());
      button.classList.add('is-copied');
      window.setTimeout(() => button.classList.remove('is-copied'), 1800);
      toast(button.dataset.copyMessage || 'Copied to clipboard.', { type: 'success', duration: 2600 });
    } catch (error) {
      toast('Unable to copy to clipboard.', { type: 'error' });
    }
  });
};

/* --------------------------------------------------------------------------
   Back to top — [data-scroll-top]
   -------------------------------------------------------------------------- */

const initScrollTop = () => {
  const buttons = qsa('[data-scroll-top]');
  if (!buttons.length) return;

  const update = () => {
    const visible = (window.scrollY || window.pageYOffset || 0) > window.innerHeight * 0.6;
    buttons.forEach((btn) => {
      btn.classList.toggle('is-visible', visible);
      btn.setAttribute('aria-hidden', String(!visible));
      btn.tabIndex = visible ? 0 : -1;
    });
  };

  buttons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  });

  window.addEventListener('scroll', update, { passive: true });
  update();
};

/* --------------------------------------------------------------------------
   Custom cursor — pointer-fine devices only
   -------------------------------------------------------------------------- */

const initCursor = () => {
  const cursor = qs('[data-cursor]');
  if (!cursor) return;
  if (prefersReducedMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    cursor.remove();
    return;
  }

  const dot = qs('[data-cursor-dot]', cursor) || cursor;
  const ring = qs('[data-cursor-ring]', cursor);

  const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const dotPos = { ...pointer };
  const ringPos = { ...pointer };
  let raf = 0;

  const render = () => {
    dotPos.x += (pointer.x - dotPos.x) * 0.42;
    dotPos.y += (pointer.y - dotPos.y) * 0.42;
    ringPos.x += (pointer.x - ringPos.x) * 0.16;
    ringPos.y += (pointer.y - ringPos.y) * 0.16;

    dot.style.transform = `translate3d(${dotPos.x}px, ${dotPos.y}px, 0) translate(-50%, -50%)`;
    if (ring) {
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) translate(-50%, -50%)`;
    }

    raf = window.requestAnimationFrame(render);
  };

  document.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    cursor.classList.add('is-active');
  });

  document.addEventListener('pointerdown', () => cursor.classList.add('is-pressed'));
  document.addEventListener('pointerup', () => cursor.classList.remove('is-pressed'));
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-active'));

  document.addEventListener('pointerover', (event) => {
    const interactive = event.target.closest(
      'a, button, [role="button"], input, select, textarea, [data-cursor-hover]'
    );
    cursor.classList.toggle('is-hovering', Boolean(interactive));
    const label = interactive?.getAttribute('data-cursor-label') || '';
    cursor.dataset.label = label;
    cursor.classList.toggle('has-label', Boolean(label));
  });

  raf = window.requestAnimationFrame(render);

  window.addEventListener('beforeunload', () => window.cancelAnimationFrame(raf));
};

/* --------------------------------------------------------------------------
   Segmented / range controls — [data-range] with live value output
   -------------------------------------------------------------------------- */

const initRanges = (root = document) => {
  qsa('input[type="range"][data-range]', root).forEach((input) => {
    const output = input.dataset.rangeOutput ? qs(input.dataset.rangeOutput) : null;

    const update = () => {
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const progress = max === min ? 0 : (Number(input.value) - min) / (max - min);
      input.style.setProperty('--range-progress', String(progress));
      if (output) output.textContent = `${input.value}${input.dataset.rangeSuffix || ''}`;
    };

    input.addEventListener('input', update);
    update();
  });
};

/* --------------------------------------------------------------------------
   Lifecycle
   -------------------------------------------------------------------------- */

let initialised = false;

export const refresh = (root = document) => {
  initModals(root);
  initTabs(root);
  initAccordions(root);
  initDropdowns(root);
  initRanges(root);
};

export const init = () => {
  if (initialised) return api;
  initialised = true;

  refresh(document);
  initTooltips();
  initRipple();
  initCopy();
  initScrollTop();
  initCursor();

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-modal-open]');
    if (!trigger) return;
    event.preventDefault();
    openModal(trigger.dataset.modalOpen, trigger);
  });

  document.dispatchEvent(new CustomEvent('vx:ui:ready'));
  return api;
};

export { scrollLock, getFocusable, copyText };
export const initUI = init;
const api = {
  init,
  refresh,
  openModal,
  closeModal,
  toast,
  scrollLock,
  copyText,
};

export default api;
