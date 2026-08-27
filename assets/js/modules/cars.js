/* ==========================================================================
   Velocity-X — assets/js/modules/cars.js
   Garage: renders the roster, handles filtering, sorting, colour selection,
   spec visualisation and broadcasts the active car to the 3D scene.
   ========================================================================== */

'use strict';

import { CARS, CAR_CLASSES, getCarById, sortCars, filterCars } from '../data/cars.js';
import { bus } from './utils.js';
import { saveSystem } from './saveSystem.js';

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const numberFormatter = new Intl.NumberFormat('en-US');

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatPrice = (value) => (value > 0 ? currencyFormatter.format(value) : 'Reward Unlock');

const STAT_LABELS = {
  speed: 'Top Speed',
  accel: 'Acceleration',
  handling: 'Handling',
  braking: 'Braking',
  nitro: 'Nitro',
};

/* --------------------------------------------------------------------------
   Module state
   -------------------------------------------------------------------------- */

const state = {
  cars: [],
  filtered: [],
  filters: { class: 'all', drivetrain: 'all', search: '' },
  sort: 'featured',
  activeId: null,
  colorIndex: 0,
  compare: [],
};

const refs = {
  section: null,
  grid: null,
  filterButtons: [],
  sortSelect: null,
  searchInput: null,
  countOutput: null,
  detail: null,
  colorList: null,
  compareTray: null,
  emptyState: null,
};

/* --------------------------------------------------------------------------
   Templates
   -------------------------------------------------------------------------- */

const statBarsTemplate = (stats) =>
  Object.entries(STAT_LABELS)
    .map(([key, label]) => {
      const value = Math.max(0, Math.min(100, Number(stats?.[key] ?? 0)));
      return `
        <li class="car-stat">
          <span class="car-stat__label">${label}</span>
          <span class="car-stat__track" role="img" aria-label="${label}: ${value} out of 100">
            <span class="car-stat__fill" style="--stat-value:${value}%"></span>
          </span>
          <span class="car-stat__value">${value}</span>
        </li>`;
    })
    .join('');

const cardTemplate = (car, index) => {
  const badge = car.locked
    ? `<span class="car-card__badge car-card__badge--locked">Locked · ${escapeHtml(car.unlock)}</span>`
    : car.featured
      ? '<span class="car-card__badge car-card__badge--featured">Featured</span>'
      : '';

  const swatches = car.colors
    .slice(0, 4)
    .map(
      (color) =>
        `<span class="car-card__swatch" style="--swatch:${escapeHtml(color.hex)}" title="${escapeHtml(color.name)}"></span>`
    )
    .join('');

  return `
    <article class="car-card tier-${escapeHtml(car.tier)}" data-car-card="${escapeHtml(car.id)}"
             data-reveal="up" data-reveal-delay="${index * 70}" data-tilt="6" data-tilt-glare="true"
             style="--car-accent:${escapeHtml(car.model.accent)}; --car-body:${escapeHtml(car.model.body)}">
      <header class="car-card__head">
        <p class="car-card__brand">${escapeHtml(car.brand)}</p>
        <h3 class="car-card__name">${escapeHtml(car.name)}</h3>
        <p class="car-card__class">${escapeHtml(car.class)} · ${escapeHtml(car.specs.drivetrain)}</p>
        ${badge}
      </header>

      <div class="car-card__visual" aria-hidden="true">
        <span class="car-card__glow"></span>
        <span class="car-card__silhouette"></span>
      </div>

      <dl class="car-card__figures">
        <div><dt>Top Speed</dt><dd>${numberFormatter.format(car.specs.topSpeed)} <small>km/h</small></dd></div>
        <div><dt>0–100</dt><dd>${car.specs.zeroToSixty.toFixed(1)} <small>s</small></dd></div>
        <div><dt>Power</dt><dd>${numberFormatter.format(car.specs.power)} <small>hp</small></dd></div>
      </dl>

      <ul class="car-card__stats">${statBarsTemplate(car.stats)}</ul>

      <footer class="car-card__foot">
        <div class="car-card__swatches" aria-hidden="true">${swatches}</div>
        <p class="car-card__price">${formatPrice(car.price)}</p>
        <div class="car-card__actions">
          <button class="btn btn--ghost btn--sm" type="button" data-car-compare="${escapeHtml(car.id)}"
                  data-tooltip="Add to comparison">Compare</button>
          <button class="btn btn--primary btn--sm" type="button" data-car-select="${escapeHtml(car.id)}"
                  data-ripple>Inspect</button>
        </div>
      </footer>
    </article>`;
};

const detailTemplate = (car, colorIndex) => {
  const color = car.colors[colorIndex] || car.colors[0];

  const specRows = [
    ['Engine', car.specs.engine],
    ['Transmission', car.specs.transmission],
    ['Drivetrain', car.specs.drivetrain],
    ['Power', `${numberFormatter.format(car.specs.power)} hp`],
    ['Torque', `${numberFormatter.format(car.specs.torque)} Nm`],
    ['Kerb Weight', `${numberFormatter.format(car.specs.weight)} kg`],
    ['Top Speed', `${numberFormatter.format(car.specs.topSpeed)} km/h`],
    ['0–100 km/h', `${car.specs.zeroToSixty.toFixed(1)} s`],
  ]
    .map(
      ([label, value]) =>
        `<div class="spec-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
    )
    .join('');

  const swatches = car.colors
    .map(
      (item, index) => `
        <li>
          <button class="color-swatch${index === colorIndex ? ' is-active' : ''}" type="button"
                  data-car-color="${index}" style="--swatch:${escapeHtml(item.hex)}"
                  aria-pressed="${index === colorIndex}" aria-label="${escapeHtml(item.name)}">
            <span class="sr-only">${escapeHtml(item.name)}</span>
          </button>
        </li>`
    )
    .join('');

  const tags = car.tags
    .map((tag) => `<li class="chip chip--sm">${escapeHtml(tag)}</li>`)
    .join('');

  return `
    <div class="car-detail__inner" style="--car-accent:${escapeHtml(car.model.accent)}">
      <header class="car-detail__head">
        <p class="car-detail__eyebrow">${escapeHtml(car.brand)} · ${escapeHtml(car.class)}</p>
        <h3 class="car-detail__title">${escapeHtml(car.name)}</h3>
        <p class="car-detail__desc">${escapeHtml(car.description)}</p>
        <ul class="car-detail__tags">${tags}</ul>
      </header>

      <div class="car-detail__color">
        <p class="car-detail__color-label">Livery · <strong>${escapeHtml(color.name)}</strong></p>
        <ul class="car-detail__swatches">${swatches}</ul>
      </div>

      <ul class="car-detail__stats">${statBarsTemplate(car.stats)}</ul>

      <dl class="car-detail__specs">${specRows}</dl>

      <footer class="car-detail__foot">
        <p class="car-detail__price">${formatPrice(car.price)}</p>
        <button class="btn btn--primary" type="button" data-car-drive="${escapeHtml(car.id)}" data-ripple>
          Take the wheel
        </button>
      </footer>
    </div>`;
};

/* --------------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------------- */

const renderCount = () => {
  if (!refs.countOutput) return;
  const total = state.cars.length;
  const shown = state.filtered.length;
  refs.countOutput.textContent =
    shown === total ? `${total} vehicles` : `${shown} of ${total} vehicles`;
};

const renderEmptyState = () => {
  if (!refs.emptyState) return;
  const empty = state.filtered.length === 0;
  refs.emptyState.hidden = !empty;
  if (refs.grid) refs.grid.hidden = empty;
};

const renderGrid = () => {
  if (!refs.grid) return;

  refs.grid.innerHTML = state.filtered.map(cardTemplate).join('');
  renderCount();
  renderEmptyState();
  syncActiveCard();

  document.dispatchEvent(
    new CustomEvent('vx:cars:rendered', { detail: { count: state.filtered.length, root: refs.grid } })
  );
};

const syncActiveCard = () => {
  qsa('[data-car-card]', refs.grid || document).forEach((card) => {
    const isActive = card.dataset.carCard === state.activeId;
    card.classList.toggle('is-active', isActive);
    card.setAttribute('aria-current', isActive ? 'true' : 'false');
  });

  qsa('[data-car-compare]').forEach((btn) => {
    const active = state.compare.includes(btn.dataset.carCompare);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
};

const renderDetail = () => {
  if (!refs.detail) return;
  const car = getCarById(state.activeId) || state.filtered[0] || state.cars[0];
  if (!car) return;

  refs.detail.innerHTML = detailTemplate(car, state.colorIndex);
  refs.detail.dataset.activeCar = car.id;
};

const renderCompareTray = () => {
  if (!refs.compareTray) return;

  const cars = state.compare.map(getCarById).filter(Boolean);
  refs.compareTray.classList.toggle('is-visible', cars.length > 0);
  refs.compareTray.setAttribute('aria-hidden', String(cars.length === 0));

  if (!cars.length) {
    refs.compareTray.innerHTML = '';
    return;
  }

  const rows = Object.entries(STAT_LABELS)
    .map(([key, label]) => {
      const best = Math.max(...cars.map((car) => Number(car.stats[key] ?? 0)));
      const cells = cars
        .map((car) => {
          const value = Number(car.stats[key] ?? 0);
          return `<td class="${value === best && cars.length > 1 ? 'is-best' : ''}">${value}</td>`;
        })
        .join('');
      return `<tr><th scope="row">${label}</th>${cells}</tr>`;
    })
    .join('');

  const heads = cars
    .map(
      (car) => `
        <th scope="col">
          <span class="compare-head">
            <span class="compare-head__name">${escapeHtml(car.name)}</span>
            <button class="compare-head__remove" type="button" data-car-compare-remove="${escapeHtml(car.id)}"
                    aria-label="Remove ${escapeHtml(car.name)} from comparison">&times;</button>
          </span>
        </th>`
    )
    .join('');

  refs.compareTray.innerHTML = `
    <div class="compare__bar">
      <h4 class="compare__title">Comparison</h4>
      <button class="btn btn--ghost btn--sm" type="button" data-car-compare-clear>Clear all</button>
    </div>
    <div class="compare__scroll">
      <table class="compare__table">
        <caption class="sr-only">Performance comparison of selected vehicles</caption>
        <thead><tr><td></td>${heads}</tr></thead>
        <tbody>
          ${rows}
          <tr><th scope="row">Top Speed</th>${cars.map((c) => `<td>${numberFormatter.format(c.specs.topSpeed)} km/h</td>`).join('')}</tr>
          <tr><th scope="row">0–100</th>${cars.map((c) => `<td>${c.specs.zeroToSixty.toFixed(1)} s</td>`).join('')}</tr>
          <tr><th scope="row">Price</th>${cars.map((c) => `<td>${formatPrice(c.price)}</td>`).join('')}</tr>
        </tbody>
      </table>
    </div>`;
};

/* --------------------------------------------------------------------------
   Filtering / sorting
   -------------------------------------------------------------------------- */

const applyFilters = () => {
  state.filtered = sortCars(filterCars(state.cars, state.filters), state.sort);

  if (!state.filtered.some((car) => car.id === state.activeId) && state.filtered.length) {
    setActiveCar(state.filtered[0].id, { silent: true });
  }

  renderGrid();
};

const renderFilterButtons = () => {
  if (!refs.filterButtons.length) return;
  refs.filterButtons.forEach((btn) => {
    const active = (btn.dataset.carFilter || 'all') === state.filters.class;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
};

/* --------------------------------------------------------------------------
   Public actions
   -------------------------------------------------------------------------- */

export const setActiveCar = (id, options = {}) => {
  const car = getCarById(id);
  if (!car) return null;

  const changed = state.activeId !== car.id;
  state.activeId = car.id;
  if (changed) state.colorIndex = 0;

  syncActiveCard();
  renderDetail();

  if (!options.silent) {
    saveSystem.setSelectedCar(car.id);
    bus.emit('car:select', car);
    bus.emit('car:selected', car.id);
    document.dispatchEvent(
      new CustomEvent('vx:car:change', {
        detail: { car, color: car.colors ? (car.colors[state.colorIndex] || car.colors[0]) : { hex: car.paint || '#22d3ff' } },
      })
    );
  }

  return car;
};

export const setCarColor = (index) => {
  const car = getCarById(state.activeId);
  if (!car) return;

  const safeIndex = Math.max(0, Math.min(car.colors.length - 1, Number(index) || 0));
  state.colorIndex = safeIndex;
  renderDetail();

  document.dispatchEvent(
    new CustomEvent('vx:car:color', {
      detail: { car, color: car.colors[safeIndex], index: safeIndex },
    })
  );
};

export const toggleCompare = (id) => {
  const car = getCarById(id);
  if (!car) return;

  const index = state.compare.indexOf(car.id);
  if (index > -1) {
    state.compare.splice(index, 1);
  } else {
    if (state.compare.length >= 3) state.compare.shift();
    state.compare.push(car.id);
  }

  syncActiveCard();
  renderCompareTray();

  document.dispatchEvent(
    new CustomEvent('vx:cars:compare', { detail: { ids: [...state.compare] } })
  );
};

export const clearCompare = () => {
  state.compare = [];
  syncActiveCard();
  renderCompareTray();
};

export const setFilter = (key, value) => {
  if (!(key in state.filters)) return;
  state.filters[key] = value;
  if (key === 'class') renderFilterButtons();
  applyFilters();
};

export const setSort = (value) => {
  state.sort = value;
  applyFilters();
};

export const getState = () => ({
  ...state,
  filters: { ...state.filters },
  compare: [...state.compare],
});

/* --------------------------------------------------------------------------
   Events
   -------------------------------------------------------------------------- */

const bindEvents = () => {
  refs.filterButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      setFilter('class', btn.dataset.carFilter || 'all');
    });
  });

  if (refs.sortSelect) {
    refs.sortSelect.addEventListener('change', () => setSort(refs.sortSelect.value));
  }

  if (refs.searchInput) {
    let timer = 0;
    refs.searchInput.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setFilter('search', refs.searchInput.value.trim()), 180);
    });
  }

  if (refs.grid) {
    refs.grid.addEventListener('click', (event) => {
      const select = event.target.closest('[data-car-select]');
      if (select) {
        event.preventDefault();
        setActiveCar(select.dataset.carSelect);
        const target = refs.detail || refs.section;
        if (target && window.innerWidth < 1024) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }

      const compare = event.target.closest('[data-car-compare]');
      if (compare) {
        event.preventDefault();
        toggleCompare(compare.dataset.carCompare);
      }
    });

    refs.grid.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('[data-car-card]');
      if (!card || event.target.closest('button')) return;
      event.preventDefault();
      setActiveCar(card.dataset.carCard);
    });
  }

  if (refs.detail) {
    refs.detail.addEventListener('click', (event) => {
      const swatch = event.target.closest('[data-car-color]');
      if (swatch) {
        event.preventDefault();
        setCarColor(swatch.dataset.carColor);
        return;
      }

      const drive = event.target.closest('[data-car-drive]');
      if (drive) {
        event.preventDefault();
        document.dispatchEvent(
          new CustomEvent('vx:car:drive', { detail: { car: getCarById(drive.dataset.carDrive) } })
        );
      }
    });
  }

  if (refs.compareTray) {
    refs.compareTray.addEventListener('click', (event) => {
      if (event.target.closest('[data-car-compare-clear]')) {
        event.preventDefault();
        clearCompare();
        return;
      }
      const remove = event.target.closest('[data-car-compare-remove]');
      if (remove) {
        event.preventDefault();
        toggleCompare(remove.dataset.carCompareRemove);
      }
    });
  }
};

/* --------------------------------------------------------------------------
   Init
   -------------------------------------------------------------------------- */

const buildFilterBar = () => {
  const host = qs('[data-car-filters]');
  if (!host || host.children.length) return;

  const classes = ['all', ...CAR_CLASSES];
  host.innerHTML = classes
    .map(
      (name) => `
      <button class="filter-chip" type="button" data-car-filter="${escapeHtml(name)}"
              aria-pressed="${name === 'all'}">
        ${name === 'all' ? 'All classes' : escapeHtml(name)}
      </button>`
    )
    .join('');
};

let initialised = false;

export const init = () => {
  refs.section = qs('[data-cars]');
  if (!refs.section || initialised) return api;
  initialised = true;

  refs.grid = qs('[data-car-grid]', refs.section);
  refs.sortSelect = qs('[data-car-sort]', refs.section);
  refs.searchInput = qs('[data-car-search]', refs.section);
  refs.countOutput = qs('[data-car-count]', refs.section);
  refs.detail = qs('[data-car-detail]', refs.section);
  refs.compareTray = qs('[data-car-compare-tray]', refs.section);
  refs.emptyState = qs('[data-car-empty]', refs.section);

  state.cars = CARS.slice();

  buildFilterBar();
  refs.filterButtons = qsa('[data-car-filter]', refs.section);

  if (refs.sortSelect && refs.sortSelect.value) state.sort = refs.sortSelect.value;

  const initialId = refs.section.dataset.carsInitial || state.cars[0]?.id;
  state.activeId = getCarById(initialId) ? initialId : state.cars[0]?.id || null;

  renderFilterButtons();
  applyFilters();
  renderDetail();
  renderCompareTray();
  bindEvents();

  if (state.activeId) {
    const car = getCarById(state.activeId);
    document.dispatchEvent(
      new CustomEvent('vx:car:change', {
        detail: { car, color: car.colors[0] },
      })
    );
  }

  document.dispatchEvent(new CustomEvent('vx:cars:ready', { detail: { count: state.cars.length } }));

  return api;
};

const api = {
  init,
  setActiveCar,
  setCarColor,
  setFilter,
  setSort,
  toggleCompare,
  clearCompare,
  getState,
};
export const initCars = init;
export default api;
