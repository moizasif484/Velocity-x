/* ============================================================
   Velocity X — profile.js
   User Profile Management
   Features:
     - User picture, handle, email, bio, joined date
     - In-game stats (races won, currency earned, cars unlocked)
     - Interactive profile editor modal / form
     - Logout trigger
   ============================================================ */

import { $, bus } from './utils.js';
import { getCurrentUser, setCurrentUser, getRegisteredUsers } from './auth.js';
import { saveSystem } from './saveSystem.js';
import { toast, openModal, closeModal } from './ui.js';

export function renderProfile() {
  const profileContainer = $('#profile-content');
  if (!profileContainer) return;

  const user = getCurrentUser();
  const currency = saveSystem.getCurrency();
  const unlockedCount = saveSystem.state.unlockedCars ? saveSystem.state.unlockedCars.length : 1;

  if (!user) {
    profileContainer.innerHTML = `
      <div class="card glass profile-empty text-center" style="padding: 3rem 1.5rem;">
        <h3>No Driver Profile Active</h3>
        <p class="text-sub">Please sign in or create an account to view your driver profile and stats.</p>
        <div style="margin-top: 1.5rem; display: flex; justify-content: center; gap: 1rem;">
          <button class="btn btn--primary" data-modal-open="modal-auth" data-auth-tab="login" type="button">Sign In</button>
          <button class="btn btn--ghost" data-modal-open="modal-auth" data-auth-tab="signup" type="button">Sign Up</button>
        </div>
      </div>
    `;
    return;
  }

  const initial = (user.username || 'D')[0].toUpperCase();
  const avatarHtml = user.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="${user.username}" class="profile-avatar-img" />`
    : `<div class="profile-avatar-placeholder">${initial}</div>`;

  profileContainer.innerHTML = `
    <div class="profile-card glass">
      <div class="profile-header">
        <div class="profile-avatar-wrap">
          ${avatarHtml}
        </div>
        <div class="profile-info">
          <h2 class="profile-username">${user.username || 'Driver'}</h2>
          <p class="profile-email">${user.email || 'driver@velocityx.game'}</p>
          <p class="profile-bio">${user.bio || 'Neon Street Racer & City Explorer'}</p>
          <span class="profile-joined">Joined: ${user.joinedDate || 'Season 04'}</span>
        </div>
        <div class="profile-actions">
          <button class="btn btn--ghost btn--sm" id="btn-edit-profile" type="button">Edit Profile</button>
          <button class="btn btn--danger btn--sm" id="btn-profile-logout" type="button">Logout</button>
        </div>
      </div>

      <div class="profile-stats-grid">
        <div class="stat-box glass">
          <span class="stat-num">${currency.toLocaleString()} CR</span>
          <span class="stat-lbl">Virtual Currency</span>
        </div>
        <div class="stat-box glass">
          <span class="stat-num">${unlockedCount} / 10</span>
          <span class="stat-lbl">Cars Unlocked</span>
        </div>
        <div class="stat-box glass">
          <span class="stat-num">${saveSystem.state.completedMissions.length}</span>
          <span class="stat-lbl">Missions Passed</span>
        </div>
        <div class="stat-box glass">
          <span class="stat-num">${saveSystem.state.finalChallengeCompleted ? 'CHAMPION' : (saveSystem.state.finalChallengeUnlocked ? 'FINALIST' : 'ROOKIE')}</span>
          <span class="stat-lbl">Driver Tier</span>
        </div>
      </div>
    </div>
  `;

  // Attach profile event handlers
  $('#btn-edit-profile')?.addEventListener('click', openEditProfileModal);
  $('#btn-profile-logout')?.addEventListener('click', () => {
    setCurrentUser(null);
    toast('Signed out successfully.', { type: 'info' });
    renderProfile();
  });
}

function openEditProfileModal() {
  const user = getCurrentUser();
  if (!user) return;

  const modal = $('#modal-edit-profile');
  if (!modal) {
    // Dynamically inject Edit Profile Modal if not present in DOM
    const modalEl = document.createElement('div');
    modalEl.className = 'modal';
    modalEl.id = 'modal-edit-profile';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.innerHTML = `
      <div class="modal__backdrop" data-modal-close></div>
      <div class="modal__panel glass modal__panel--auth">
        <button class="modal__close" data-modal-close aria-label="Close" type="button">&times;</button>
        <h3 class="auth-title">Edit Driver Profile</h3>
        <form id="form-edit-profile" class="auth-form" style="margin-top: 1rem;">
          <div class="field">
            <label for="ep-username">Driver Name / Handle</label>
            <input id="ep-username" type="text" required value="${user.username || ''}" />
          </div>
          <div class="field">
            <label for="ep-bio">Bio</label>
            <textarea id="ep-bio" rows="3" placeholder="Tell the grid about yourself">${user.bio || ''}</textarea>
          </div>
          <div class="field">
            <label for="ep-avatar">Avatar Image URL (Optional)</label>
            <input id="ep-avatar" type="url" placeholder="https://example.com/avatar.jpg" value="${user.avatarUrl || ''}" />
          </div>
          <button class="btn btn--primary btn--block" type="submit" style="margin-top: 1rem;">Save Changes</button>
        </form>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  // Set values
  $('#ep-username').value = user.username || '';
  $('#ep-bio').value = user.bio || '';
  $('#ep-avatar').value = user.avatarUrl || '';

  openModal('modal-edit-profile');

  $('#form-edit-profile')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newUsername = $('#ep-username')?.value.trim();
    const newBio = $('#ep-bio')?.value.trim();
    const newAvatar = $('#ep-avatar')?.value.trim();

    if (!newUsername) {
      toast('Username cannot be empty', { type: 'error' });
      return;
    }

    const updatedUser = {
      ...user,
      username: newUsername,
      bio: newBio,
      avatarUrl: newAvatar
    };

    // Save to active session & localStorage registered database
    setCurrentUser(updatedUser);

    const users = getRegisteredUsers();
    const idx = users.findIndex(u => u.email === user.email);
    if (idx !== -1) {
      users[idx] = { ...users[idx], username: newUsername, bio: newBio, avatarUrl: newAvatar };
      localStorage.setItem('velocityX_users_v2', JSON.stringify(users));
    }

    closeModal('modal-edit-profile');
    toast('Profile updated successfully!', { type: 'success' });
    renderProfile();
  });
}

export function initProfile() {
  renderProfile();
  bus.on('auth:changed', renderProfile);
  bus.on('currency:updated', renderProfile);
  bus.on('mission:completed', renderProfile);
}

export default initProfile;
