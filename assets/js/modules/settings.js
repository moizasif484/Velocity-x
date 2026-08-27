/* ============================================================
   Velocity X — settings.js
   Settings & Game Preferences Module
   ============================================================ */

import { $, bus } from './utils.js';
import { saveSystem } from './saveSystem.js';
import { toast } from './ui.js';

export function renderSettings() {
  const container = $('#settings-content');
  if (!container) return;

  const currentSettings = saveSystem.state.settings;

  container.innerHTML = `
    <div class="card glass settings-card">
      <h3>Audio Settings</h3>
      <div class="settings-group">
        <label for="set-sound-vol">Sound Effects Volume</label>
        <input id="set-sound-vol" type="range" min="0" max="1" step="0.1" value="${currentSettings.soundVolume}" />
      </div>
      <div class="settings-group">
        <label for="set-music-vol">Soundtrack Volume</label>
        <input id="set-music-vol" type="range" min="0" max="1" step="0.1" value="${currentSettings.musicVolume}" />
      </div>

      <h3 style="margin-top: 2rem;">Graphics & Rendering</h3>
      <div class="settings-group">
        <label for="set-graphics">Graphics Preset</label>
        <select id="set-graphics" class="select-input">
          <option value="low" ${currentSettings.graphics === 'low' ? 'selected' : ''}>Low (Performance 120 FPS)</option>
          <option value="medium" ${currentSettings.graphics === 'medium' ? 'selected' : ''}>Medium (Balanced)</option>
          <option value="high" ${currentSettings.graphics === 'high' ? 'selected' : ''}>High / 4K Ray-Tracing</option>
        </select>
      </div>

      <h3 style="margin-top: 2rem;">Save Data Management</h3>
      <div class="settings-group" style="display: flex; gap: 1rem; align-items: center; margin-top: 1rem;">
        <button class="btn btn--ghost" id="btn-save-now" type="button">Force Save Data</button>
        <button class="btn btn--danger" id="btn-reset-save" type="button">Reset Progress</button>
      </div>
    </div>
  `;

  $('#set-sound-vol')?.addEventListener('change', (e) => {
    saveSystem.updateSettings({ soundVolume: parseFloat(e.target.value) });
    toast('Sound volume updated.', { type: 'info' });
  });

  $('#set-music-vol')?.addEventListener('change', (e) => {
    saveSystem.updateSettings({ musicVolume: parseFloat(e.target.value) });
    toast('Music volume updated.', { type: 'info' });
  });

  $('#set-graphics')?.addEventListener('change', (e) => {
    saveSystem.updateSettings({ graphics: e.target.value });
    toast(`Graphics preset set to ${e.target.value.toUpperCase()}.`, { type: 'info' });
  });

  $('#btn-save-now')?.addEventListener('click', () => {
    saveSystem.save();
    toast('Game progress and session saved!', { type: 'success' });
  });

  $('#btn-reset-save')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all game progress, currency, and unlocks?')) {
      saveSystem.resetAll();
      toast('Save data reset to default.', { type: 'warning' });
      window.location.reload();
    }
  });
}

export function initSettings() {
  renderSettings();
}

export default initSettings;
