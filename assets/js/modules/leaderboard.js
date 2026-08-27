/**
 * Velocity X — Leaderboard Module
 * Renders and sorts the driver standings table.
 */

const SELECTORS = {
  root: '.leaderboard',
  body: '.leaderboard__body',
  sortBtn: '[data-sort]',
  empty: '.leaderboard__empty'
};

const CLASSES = {
  row: 'leaderboard__row',
  active: 'is-active',
  podium: 'is-podium'
};

const state = {
  rows: [],
  sortKey: 'points',
  sortDir: 'desc'
};

/**
 * Loads leaderboard data. Uses data-src (JSON endpoint) when present,
 * otherwise falls back to an inline global set by the page.
 * @param {HTMLElement} root
 * @returns {Promise<Array>}
 */
async function loadData(root) {
  const src = root.dataset.src;

  if (src) {
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('[leaderboard] Could not load data:', error);
      return [];
    }
  }

  return Array.isArray(window.VELOCITY_LEADERBOARD) ? window.VELOCITY_LEADERBOARD : [];
}

/**
 * Sorts a copy of the dataset by the active key and direction.
 * @returns {Array}
 */
function getSortedRows() {
  const { rows, sortKey, sortDir } = state;
  const factor = sortDir === 'asc' ? 1 : -1;

  return rows.slice().sort((a, b) => {
    const first = a[sortKey];
    const second = b[sortKey];

    if (typeof first === 'number' && typeof second === 'number') {
      return (first - second) * factor;
    }
    return String(first).localeCompare(String(second)) * factor;
  });
}

/**
 * Builds a single row element.
 * @param {Object} entry
 * @param {number} position
 * @returns {HTMLElement}
 */
function createRow(entry, position) {
  const row = document.createElement('tr');
  row.className = CLASSES.row;
  if (position <= 3) row.classList.add(CLASSES.podium);

  row.innerHTML = `
    <td class="leaderboard__cell leaderboard__cell--pos">${position}</td>
    <td class="leaderboard__cell leaderboard__cell--driver">${entry.driver || '—'}</td>
    <td class="leaderboard__cell leaderboard__cell--team">${entry.team || '—'}</td>
    <td class="leaderboard__cell leaderboard__cell--time">${entry.time || '—'}</td>
    <td class="leaderboard__cell leaderboard__cell--points">${entry.points != null ? entry.points : 0}</td>
  `;

  return row;
}

/**
 * Paints the current state into the table body.
 * @param {HTMLElement} root
 */
function render(root) {
  const body = root.querySelector(SELECTORS.body);
  if (!body) return;

  const empty = root.querySelector(SELECTORS.empty);
  const sorted = getSortedRows();
  const fragment = document.createDocumentFragment();

  sorted.forEach((entry, index) => {
    fragment.appendChild(createRow(entry, index + 1));
  });

  body.innerHTML = '';
  body.appendChild(fragment);

  if (empty) empty.hidden = sorted.length > 0;
}

/**
 * Reflects the active sort column on the header buttons.
 * @param {HTMLElement} root
 */
function syncHeaders(root) {
  root.querySelectorAll(SELECTORS.sortBtn).forEach((btn) => {
    const isActive = btn.dataset.sort === state.sortKey;
    btn.classList.toggle(CLASSES.active, isActive);
    btn.setAttribute('aria-sort', isActive ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

export async function initLeaderboard() {
  const root = document.querySelector(SELECTORS.root);
  if (!root) return;

  state.rows = await loadData(root);
  render(root);
  syncHeaders(root);

  root.addEventListener('click', (event) => {
    const btn = event.target.closest(SELECTORS.sortBtn);
    if (!btn) return;

    const key = btn.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortKey = key;
      state.sortDir = key === 'driver' || key === 'team' ? 'asc' : 'desc';
    }

    render(root);
    syncHeaders(root);
  });
}

export default initLeaderboard;
