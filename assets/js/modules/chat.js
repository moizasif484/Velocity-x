/* ============================================================
   Velocity X — chat.js
   Real Functional Messaging System
   Features:
     - Driver contacts list with online indicators
     - Active chat view with timestamps & scroll to bottom
     - Empty message validation & error state feedback
     - Automated driver rival responses (AI simulation)
     - Persistent chat history per contact
   ============================================================ */

import { $, $$, bus } from './utils.js';
import { getCurrentUser } from './auth.js';
import { saveSystem } from './saveSystem.js';
import { toast } from './ui.js';

// Default contacts list
const CONTACTS = [
  {
    id: 'rival-apex',
    name: 'Kaito Rensu (Apex Leader)',
    avatar: 'assets/img/favicon.svg',
    status: 'Online',
    bio: 'Rank #1 Driver in Aurora City',
    autoReplies: [
      'Ready for the night circuit? Bring your fastest hypercar.',
      'I saw your time on Checkpoint 2. Impressive, but can you beat 400 km/h?',
      'Reach 400,000 CR to unlock the Final Showdown. I will be waiting!'
    ]
  },
  {
    id: 'rival-drift',
    name: 'Yuki Kaido (Drift King)',
    avatar: 'assets/img/favicon.svg',
    status: 'In Game',
    bio: 'Vantage Drift Specialist',
    autoReplies: [
      'Angle is everything. Keep your throttle steady in the corners!',
      'Meet me at the Harbour Bay docks for the drift challenge.',
      'That drift run was insane!'
    ]
  },
  {
    id: 'studio-hq',
    name: 'Nova HQ Support',
    avatar: 'assets/img/favicon.svg',
    status: 'Verified HQ',
    bio: 'Official Velocity X Studio Crew',
    autoReplies: [
      'Welcome to Velocity X! Let us know if you have any questions.',
      'Season 04 Neon Uprising is live! Check out the new city districts.',
      'Your career progress syncs automatically with Nova ID.'
    ]
  }
];

let activeContactId = 'rival-apex';

export function renderChat() {
  const root = $('#chat-root');
  if (!root) return;

  const currentUser = getCurrentUser() || { username: 'You', email: 'driver@velocityx.game' };
  const contact = CONTACTS.find(c => c.id === activeContactId) || CONTACTS[0];
  const messages = saveSystem.getChatHistory(contact.id);

  root.innerHTML = `
    <div class="chat-app glass">
      <!-- Sidebar Contacts -->
      <aside class="chat-sidebar">
        <div class="chat-sidebar__head">
          <h3>Conversations</h3>
          <span class="badge badge--blue">${CONTACTS.length} Drivers</span>
        </div>
        <div class="chat-contacts-list">
          ${CONTACTS.map(c => {
            const isActive = c.id === activeContactId;
            const history = saveSystem.getChatHistory(c.id);
            const lastMsg = history.length ? history[history.length - 1].text : 'No messages yet';
            return `
              <button class="chat-contact-item ${isActive ? 'is-active' : ''}" data-contact-id="${c.id}" type="button">
                <div class="contact-avatar-wrap">
                  <div class="contact-avatar">${c.name[0]}</div>
                  <span class="contact-status-dot ${c.status === 'Online' ? 'is-online' : ''}"></span>
                </div>
                <div class="contact-info">
                  <div class="contact-name-row">
                    <span class="contact-name">${c.name}</span>
                  </div>
                  <p class="contact-preview">${lastMsg}</p>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </aside>

      <!-- Main Message Window -->
      <main class="chat-main">
        <!-- Chat Header -->
        <header class="chat-header">
          <div class="contact-avatar-wrap">
            <div class="contact-avatar">${contact.name[0]}</div>
          </div>
          <div>
            <h4 class="chat-target-name">${contact.name}</h4>
            <span class="chat-target-status">${contact.status} · ${contact.bio}</span>
          </div>
        </header>

        <!-- Message History -->
        <div class="chat-messages" id="chat-messages">
          ${messages.length === 0 ? `
            <div class="chat-empty">
              <p>Start a conversation with <strong>${contact.name}</strong></p>
            </div>
          ` : messages.map(m => `
            <div class="chat-bubble ${m.sender === 'user' ? 'chat-bubble--user' : 'chat-bubble--contact'}">
              <div class="bubble-meta">
                <span class="bubble-sender">${m.sender === 'user' ? (currentUser.username || 'You') : contact.name}</span>
                <span class="bubble-time">${m.time}</span>
              </div>
              <p class="bubble-text">${escapeHtml(m.text)}</p>
            </div>
          `).join('')}
        </div>

        <!-- Input Bar -->
        <form class="chat-input-bar" id="chat-form">
          <input id="chat-input" type="text" placeholder="Type your message..." autocomplete="off" required />
          <button class="btn btn--primary" type="submit">
            <span>Send</span>
          </button>
        </form>
      </main>
    </div>
  `;

  // Scroll messages to bottom
  const msgContainer = $('#chat-messages', root);
  if (msgContainer) {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  // Bind Contact click events
  $$('.chat-contact-item', root).forEach(btn => {
    btn.addEventListener('click', () => {
      activeContactId = btn.dataset.contactId;
      renderChat();
    });
  });

  // Bind Form submission
  $('#chat-form', root)?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chat-input', root);
    const text = input?.value.trim();

    if (!text) {
      toast('Please type a message before sending.', { type: 'error' });
      return;
    }

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { sender: 'user', text, time };

    const history = saveSystem.getChatHistory(contact.id);
    history.push(userMsg);
    saveSystem.saveChatHistory(contact.id, history);

    input.value = '';
    renderChat();

    // Automated contact reply simulation after short delay
    setTimeout(() => {
      const replies = contact.autoReplies || ['Copy that! See you on the track.'];
      const replyText = replies[Math.floor(Math.random() * replies.length)];
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const contactMsg = { sender: 'contact', text: replyText, time: replyTime };

      const updatedHistory = saveSystem.getChatHistory(contact.id);
      updatedHistory.push(contactMsg);
      saveSystem.saveChatHistory(contact.id, updatedHistory);
      renderChat();
    }, 1200);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}

export function initChat() {
  renderChat();
  bus.on('auth:changed', renderChat);
}

export default initChat;
