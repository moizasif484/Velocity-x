/* ============================================================
   Velocity X — auth.js
   Authentication System (Nova ID Login & Sign Up)
   Features:
     - Password hashing via Web Crypto API (SHA-256)
     - Session persistence across page refreshes
     - Form validation & clear error feedback
     - Duplicate user detection
     - Auto-login on sign up
     - Live navbar state updates & Logout functionality
   ============================================================ */

import { $, $$, bus } from './utils.js';
import { toast, openModal, closeModal } from './ui.js';

const SESSION_KEY = 'velocityX_user_v2';
const USERS_KEY = 'velocityX_users_v2';

const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
};

/**
 * Requirement 2 & 19: Password Security.
 * Hashes plain text passwords using SHA-256 Web Crypto API.
 */
export async function hashPassword(password) {
  if (!password) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '_velocityX_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    // Fallback simple hash string if Web Crypto API is unavailable
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = (hash << 5) - hash + password.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
}

export function getRegisteredUsers() {
  try {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveRegisteredUser(user) {
  const users = getRegisteredUsers();
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getCurrentUser() {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
  updateAuthUI();
  bus.emit('auth:changed', user);
}

export function updateAuthUI() {
  const wrap = $('#nav-auth-wrap');
  if (!wrap) return;

  const user = getCurrentUser();
  if (user) {
    const displayName = user.username || (user.email ? user.email.split('@')[0] : 'Driver');
    const initial = displayName[0].toUpperCase();
    const avatar = user.avatarUrl
      ? `<img src="${user.avatarUrl}" alt="${displayName}" class="user-avatar-img" />`
      : `<span class="user-avatar">${initial}</span>`;

    wrap.innerHTML = `
      <div class="user-pill" title="Logged in as ${displayName}">
        <a href="#profile" class="user-pill__link" data-nav>
          ${avatar}
          <span class="user-name">${displayName}</span>
        </a>
        <button class="btn-logout" id="btn-logout" title="Sign Out" type="button" aria-label="Sign Out">Logout</button>
      </div>
    `;

    $('#btn-logout', wrap)?.addEventListener('click', (e) => {
      e.stopPropagation();
      setCurrentUser(null);
      toast('Signed out successfully.', { type: 'info' });
    });
  } else {
    wrap.innerHTML = `
      <button class="btn btn--ghost btn--sm nav__auth-btn" id="nav-login-btn" data-modal-open="modal-auth" data-auth-tab="login" data-ripple type="button">
        <span>Sign In</span>
      </button>
      <button class="btn btn--ghost btn--sm nav__auth-btn" id="nav-signup-btn" data-modal-open="modal-auth" data-auth-tab="signup" data-ripple type="button">
        <span>Sign Up</span>
      </button>
    `;
  }
}

function setError(fieldId, message) {
  const input = $('#' + fieldId);
  if (!input) return;
  const wrapper = input.closest('.field') || input.parentElement;
  let errHost = $('[data-err-for="' + fieldId + '"]', wrapper);
  if (!errHost) {
    errHost = document.createElement('small');
    errHost.className = 'field__err';
    errHost.dataset.errFor = fieldId;
    wrapper.appendChild(errHost);
  }
  errHost.textContent = message || '';
  wrapper?.classList.toggle('is-invalid', Boolean(message));
}

function clearErrors(form) {
  if (!form) return;
  $$('.field', form).forEach(field => field.classList.remove('is-invalid'));
  $$('.field__err', form).forEach(err => err.textContent = '');
}

export function switchAuthTab(mode) {
  const tabLogin = $('#tab-login');
  const tabSignup = $('#tab-signup');
  const formLogin = $('#auth-form-login');
  const formSignup = $('#auth-form-signup');

  const isLogin = mode === 'login';

  tabLogin?.classList.toggle('is-active', isLogin);
  tabSignup?.classList.toggle('is-active', !isLogin);
  formLogin?.classList.toggle('is-hidden', !isLogin);
  formSignup?.classList.toggle('is-hidden', isLogin);

  if (formLogin) clearErrors(formLogin);
  if (formSignup) clearErrors(formSignup);
}

export function initAuth() {
  updateAuthUI();

  const tabLogin = $('#tab-login');
  const tabSignup = $('#tab-signup');
  const formLogin = $('#auth-form-login');
  const formSignup = $('#auth-form-signup');

  tabLogin?.addEventListener('click', () => switchAuthTab('login'));
  tabSignup?.addEventListener('click', () => switchAuthTab('signup'));

  // Global event delegation for Login & Sign Up buttons across navbar & hero
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-modal-open="modal-auth"], [data-auth-tab], [data-auth-switch], #nav-login-btn, #nav-signup-btn');
    if (!trigger) return;

    e.preventDefault();
    const targetTab = trigger.dataset.authTab || trigger.dataset.authSwitch || (trigger.id === 'nav-signup-btn' ? 'signup' : 'login');
    const modal = openModal('modal-auth', trigger);
    if (!modal) {
      const el = $('#modal-auth');
      if (el) {
        el.hidden = false;
        el.setAttribute('aria-hidden', 'false');
        el.classList.add('is-open');
      }
    }
    switchAuthTab(targetTab);
  });

  // Form submission: Sign In
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(formLogin);

    const identity = $('#login-email')?.value.trim();
    const password = $('#login-password')?.value.trim();

    let hasError = false;
    if (!identity) {
      setError('login-email', 'Email or Username is required.');
      hasError = true;
    }
    if (!password) {
      setError('login-password', 'Password is required.');
      hasError = true;
    }

    if (hasError) return;

    const hashedPassword = await hashPassword(password);
    const users = getRegisteredUsers();

    const foundUser = users.find(u =>
      (u.email.toLowerCase() === identity.toLowerCase() || u.username.toLowerCase() === identity.toLowerCase()) &&
      (u.passwordHash === hashedPassword || u.password === password) // backward compatibility check
    );

    if (foundUser) {
      const sessionUser = {
        username: foundUser.username,
        email: foundUser.email,
        bio: foundUser.bio || 'Neon Street Racer',
        avatarUrl: foundUser.avatarUrl || '',
        joinedDate: foundUser.createdAt || new Date().toLocaleDateString(),
        loggedInAt: new Date().toISOString()
      };
      setCurrentUser(sessionUser);
      closeModal('modal-auth');
      toast(`Welcome back, ${sessionUser.username}!`, { type: 'success' });
      formLogin.reset();
    } else if (users.length === 0) {
      // Dev mode fallback account creation if user list is empty
      const username = identity.includes('@') ? identity.split('@')[0] : identity;
      const sessionUser = {
        username,
        email: identity.includes('@') ? identity : `${username}@velocityx.game`,
        bio: 'Neon Street Racer',
        joinedDate: new Date().toLocaleDateString(),
        loggedInAt: new Date().toISOString()
      };
      setCurrentUser(sessionUser);
      closeModal('modal-auth');
      toast(`Welcome back, ${sessionUser.username}!`, { type: 'success' });
      formLogin.reset();
    } else {
      setError('login-password', 'Invalid identity or password.');
      toast('Invalid credentials. Please check your details.', { type: 'error' });
    }
  });

  // Form submission: Sign Up (Create Account)
  formSignup?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(formSignup);

    const username = $('#signup-username')?.value.trim();
    const email = $('#signup-email')?.value.trim();
    const password = $('#signup-password')?.value.trim();
    const confirmPassword = $('#signup-confirm-password')?.value.trim();

    let hasError = false;

    if (!username) {
      setError('signup-username', 'Driver handle / name is required.');
      hasError = true;
    } else if (username.length < 2) {
      setError('signup-username', 'Name must be at least 2 characters.');
      hasError = true;
    }

    if (!email) {
      setError('signup-email', 'Email address is required.');
      hasError = true;
    } else if (!PATTERNS.email.test(email)) {
      setError('signup-email', 'Enter a valid email address.');
      hasError = true;
    }

    if (!password) {
      setError('signup-password', 'Password is required.');
      hasError = true;
    } else if (password.length < 6) {
      setError('signup-password', 'Password must be at least 6 characters.');
      hasError = true;
    }

    if (!confirmPassword) {
      setError('signup-confirm-password', 'Please confirm your password.');
      hasError = true;
    } else if (password && password !== confirmPassword) {
      setError('signup-confirm-password', 'Passwords do not match.');
      hasError = true;
    }

    if (hasError) {
      toast('Please fix the highlighted errors.', { type: 'error' });
      return;
    }

    // Check duplicate accounts
    const users = getRegisteredUsers();
    const exists = users.some(u =>
      u.email.toLowerCase() === email.toLowerCase() ||
      u.username.toLowerCase() === username.toLowerCase()
    );

    if (exists) {
      setError('signup-email', 'An account with this email or handle already exists.');
      toast('An account with this email or handle already exists.', { type: 'error' });
      return;
    }

    // Securely hash password
    const hashedPassword = await hashPassword(password);

    const newUser = {
      username,
      email,
      passwordHash: hashedPassword,
      createdAt: new Date().toLocaleDateString(),
      bio: 'Neon Street Racer',
      avatarUrl: ''
    };

    saveRegisteredUser(newUser);

    // Set active session & auto-login
    const sessionUser = {
      username,
      email,
      bio: newUser.bio,
      joinedDate: newUser.createdAt,
      loggedInAt: new Date().toISOString()
    };
    setCurrentUser(sessionUser);

    closeModal('modal-auth');
    toast(`Account created! Welcome to Velocity X, ${username}.`, { type: 'success' });
    formSignup.reset();
  });
}

export default initAuth;
