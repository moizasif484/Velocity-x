/* ============================================================
   Velocity X — missions.js
   Missions System & 400,000 CR Final Challenge Engine
   ============================================================ */

import { $, $$, bus } from './utils.js';
import { saveSystem } from './saveSystem.js';
import { toast } from './ui.js';

export const MISSIONS_LIST = [
  {
    id: 'm1-speed',
    title: 'Speed Demon Sprint',
    category: 'Speed Challenge',
    desc: 'Reach 200 KM/H on the main downtown straight.',
    reward: 50000,
    icon: '⚡'
  },
  {
    id: 'm2-circuit',
    title: 'Neon Circuit Master',
    category: 'Race Challenge',
    desc: 'Complete a full 3-Lap race around Aurora City.',
    reward: 100000,
    icon: '🏁'
  },
  {
    id: 'm3-explore',
    title: 'City Zone Pioneer',
    category: 'Exploration',
    desc: 'Pass through all 4 City Checkpoint arches.',
    reward: 100000,
    icon: '🌆'
  },
  {
    id: 'm4-drift',
    title: 'Harbour Drift Legend',
    category: 'Driving Challenge',
    desc: 'Perform 5 high-speed drift turns in the 3D Game.',
    reward: 150000,
    icon: '🔥'
  }
];

export function renderMissions() {
  const container = $('#missions-list');
  if (!container) return;

  const currentCR = saveSystem.getCurrency();
  const targetCR = 400000;
  const isUnlocked = currentCR >= targetCR || saveSystem.state.finalChallengeUnlocked;
  const isCompleted = saveSystem.state.finalChallengeCompleted;

  // Update progress bar
  const progressPct = Math.min(100, Math.floor((currentCR / targetCR) * 100));
  const progressFill = $('#cr-progress-fill');
  const progressText = $('#cr-progress-text');
  if (progressFill) progressFill.style.width = `${progressPct}%`;
  if (progressText) progressText.textContent = `${currentCR.toLocaleString()} / ${targetCR.toLocaleString()} CR (${progressPct}%)`;

  container.innerHTML = `
    <!-- 400K Final Challenge Header Card -->
    <div class="card glass final-challenge-card ${isUnlocked ? 'is-unlocked' : ''} ${isCompleted ? 'is-completed' : ''}" style="margin-bottom: 2rem; padding: 2rem; border: 2px solid ${isCompleted ? '#4ade80' : (isUnlocked ? '#f5d90a' : '#ff2f5e')};">
      <div class="final-card-header">
        <div>
          <span class="badge ${isCompleted ? 'badge--green' : (isUnlocked ? 'badge--gold' : 'badge--red')}">
            ${isCompleted ? 'CHAMPIONSHIP WON' : (isUnlocked ? 'FINAL CHALLENGE UNLOCKED' : 'LOCKED — 400,000 CR REQUIRED')}
          </span>
          <h3 style="font-size: 1.8rem; margin-top: 0.5rem; font-family: Orbitron, sans-serif;">THE 400,000 CR ULTIMATE SHOWDOWN</h3>
        </div>
        <div class="final-badge-icon">${isCompleted ? '🏆' : (isUnlocked ? '🔓' : '🔒')}</div>
      </div>

      <p style="margin: 1rem 0; color: var(--text-muted);">
        Accumulate 400,000 virtual in-game currency to unlock the ultimate championship. Outrun the Apex Rival in a 1-on-1 duel through Aurora City!
      </p>
      
      <small style="display: block; margin-bottom: 1.5rem; color: #94a3b8; font-style: italic;">
        * Note: 400,000 CR refers strictly to virtual in-game credits, not real currency.
      </small>

      ${isCompleted ? `
        <div class="win-banner glass">
          <h4>🏆 VICTORY! YOU HAVE CONQUERED AURORA CITY!</h4>
          <p>Congratulations, Champion! You have completed the 400,000 CR Final Challenge.</p>
        </div>
      ` : (isUnlocked ? `
        <button class="btn btn--primary btn--lg btn--block" id="btn-start-final-challenge" type="button">
          <span>START THE 400,000 CR FINAL SHOWDOWN</span>
        </button>
      ` : `
        <div class="lock-status">
          <span>Earn ${ (targetCR - currentCR).toLocaleString() } more CR via missions and 3D racing to unlock!</span>
        </div>
      `)}
    </div>

    <!-- Missions Grid -->
    <div class="grid grid--2 stagger">
      ${MISSIONS_LIST.map(m => {
        const isDone = saveSystem.isMissionCompleted(m.id);
        return `
          <div class="card glass mission-card ${isDone ? 'is-done' : ''}">
            <div class="mission-head">
              <span class="mission-icon">${m.icon}</span>
              <div>
                <span class="badge badge--blue">${m.category}</span>
                <h4>${m.title}</h4>
              </div>
              <span class="mission-status">${isDone ? '✓ DONE' : ''}</span>
            </div>

            <p class="mission-desc">${m.desc}</p>

            <div class="mission-foot">
              <span class="mission-reward">+${m.reward.toLocaleString()} CR</span>
              <button class="btn ${isDone ? 'btn--ghost' : 'btn--primary'} btn--sm btn-claim-mission" 
                      data-mission-id="${m.id}" 
                      data-reward="${m.reward}"
                      ${isDone ? 'disabled' : ''} 
                      type="button">
                <span>${isDone ? 'Completed' : 'Execute Mission'}</span>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach mission triggers
  $$('.btn-claim-mission', container).forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.missionId;
      const reward = parseInt(btn.dataset.reward, 10) || 50000;
      if (saveSystem.completeMission(id, reward)) {
        toast(`Mission Complete! +${reward.toLocaleString()} CR awarded.`, { type: 'success' });
        renderMissions();
      }
    });
  });

  $('#btn-start-final-challenge')?.addEventListener('click', () => {
    toast('Starting Final 400,000 CR Challenge!', { type: 'info' });
    const racingSec = $('#racing');
    if (racingSec) {
      racingSec.scrollIntoView({ behavior: 'smooth' });
    }
    bus.emit('game:start-final');
  });
}

export function initMissions() {
  renderMissions();
  bus.on('currency:updated', renderMissions);
  bus.on('mission:completed', renderMissions);
}

export default initMissions;
