/* ============================================================
   Velocity X — saveSystem.js
   Centralized Persistence & Game State Store
   ============================================================ */

import { bus } from './utils.js';

const STORAGE_KEY = 'velocityX_gameState_v2';

const DEFAULT_STATE = {
  currency: 0, // In-game virtual currency (CR)
  selectedCarId: 'vx-01-apex',
  unlockedCars: ['vx-01-apex', 'vx-02-rune'],
  completedMissions: [],
  finalChallengeUnlocked: false,
  finalChallengeCompleted: false,
  stats: {
    racesWon: 0,
    distanceDrivenKm: 0,
    topSpeedAchieved: 0,
    driftsPerformed: 0
  },
  galleryLikes: {},
  galleryComments: {},
  chatHistory: {},
  settings: {
    soundVolume: 0.8,
    musicVolume: 0.5,
    graphics: 'high',
    theme: 'neon-dark'
  }
};

class SaveSystem {
  constructor() {
    this.state = this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return { ...DEFAULT_STATE, ...JSON.parse(data) };
      }
    } catch (err) {
      console.warn('[SaveSystem] Failed to load state, using defaults:', err);
    }
    return { ...DEFAULT_STATE };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      bus.emit('state:updated', this.state);
    } catch (err) {
      console.warn('[SaveSystem] Failed to save state:', err);
    }
  }

  getCurrency() {
    return this.state.currency || 0;
  }

  addCurrency(amount) {
    this.state.currency = Math.max(0, (this.state.currency || 0) + amount);
    if (this.state.currency >= 400000) {
      this.state.finalChallengeUnlocked = true;
    }
    this.save();
    bus.emit('currency:updated', this.state.currency);
    return this.state.currency;
  }

  getSelectedCar() {
    return this.state.selectedCarId || 'vx-01-apex';
  }

  setSelectedCar(carId) {
    this.state.selectedCarId = carId;
    if (!this.state.unlockedCars.includes(carId)) {
      this.state.unlockedCars.push(carId);
    }
    this.save();
    bus.emit('car:selected', carId);
  }

  isMissionCompleted(missionId) {
    return this.state.completedMissions.includes(missionId);
  }

  completeMission(missionId, reward = 0) {
    if (!this.state.completedMissions.includes(missionId)) {
      this.state.completedMissions.push(missionId);
      if (reward > 0) {
        this.addCurrency(reward);
      } else {
        this.save();
      }
      bus.emit('mission:completed', missionId);
      return true;
    }
    return false;
  }

  setFinalChallengeCompleted() {
    this.state.finalChallengeCompleted = true;
    this.save();
    bus.emit('game:win');
  }

  getGalleryLikes() {
    return this.state.galleryLikes || {};
  }

  toggleGalleryLike(postId) {
    this.state.galleryLikes[postId] = !this.state.galleryLikes[postId];
    this.save();
    return this.state.galleryLikes[postId];
  }

  getGalleryComments(postId) {
    return this.state.galleryComments[postId] || [];
  }

  addGalleryComment(postId, commentObj) {
    if (!this.state.galleryComments[postId]) {
      this.state.galleryComments[postId] = [];
    }
    this.state.galleryComments[postId].push(commentObj);
    this.save();
    return this.state.galleryComments[postId];
  }

  getChatHistory(contactId) {
    return this.state.chatHistory[contactId] || [];
  }

  saveChatHistory(contactId, messages) {
    this.state.chatHistory[contactId] = messages;
    this.save();
  }

  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.save();
    bus.emit('settings:updated', this.state.settings);
  }

  resetAll() {
    this.state = { ...DEFAULT_STATE };
    this.save();
  }
}

export const saveSystem = new SaveSystem();
export default saveSystem;
