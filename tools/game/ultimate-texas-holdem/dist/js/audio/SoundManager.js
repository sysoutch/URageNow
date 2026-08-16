/**
 * SoundManager - Manages game audio (SFX and music).
 *
 * Responsibilities:
 * - Load and cache audio assets
 * - Play sound effects for game events
 * - Control background music volume and playback
 * - Manage master, SFX, and music volume levels
 * - Support muting/unmuting
 *
 * Dependencies: EventBus, Constants (SOUNDS)
 * Events consumed: 'game:start', 'round:end', 'payoutComplete'
 * Events emitted: 'soundLoaded', 'soundError'
 *
 * Public API:
 * - constructor()
 * - play(soundName)
 * - playSFX(name)
 * - setVolume(level)
 * - toggleMute()
 */

import { bus } from '../core/EventBus.js';
import { EVENTS, SOUNDS } from '../config/constants.js';

export class SoundManager {
  #sounds = new Map();
  #music = null;
  #masterVolume = 1;
  #sfxVolume = 0.8;
  #musicVolume = 0.4;
  #isMuted = false;
  #isLoading = false;

  /**
   * Create a SoundManager instance.
   */
  constructor() {
    this.#bindEvents();
  }

  /**
   * Subscribe to game events for sound triggers.
   */
  #bindEvents() {
    bus.on(EVENTS.GAME_READY, () => this.#playSound('deal'));
    bus.on(EVENTS.CARDS_DEALT, () => this.#playSound('cards'));
    bus.on(EVENTS.HAND_EVALUATED, () => this.#playSound('reveal'));
    bus.on(EVENTS.PAYOUT_COMPLETE, (data) => {
      if (data.result?.netProfit > 0) {
        this.#playSound('win');
      } else if (data.result?.netProfit < 0) {
        this.#playSound('lose');
      }
    });
    bus.on(EVENTS.ROUND_END, () => this.#playSound('collect'));
  }

  /**
   * Initialize sound assets from a manifest.
   * @param {Array} manifest - Array of { name, src, type }.
   * @returns {Promise<void>}
   */
  async init(manifest) {
    if (this.#isLoading) return;

    this.#isLoading = true;

    for (const item of manifest) {
      try {
        const audio = new Audio(item.src);
        audio.volume = item.type === 'music' ? this.#musicVolume : this.#sfxVolume * this.#masterVolume;
        audio.preload = 'auto';

        if (item.type === 'music') {
          audio.loop = true;
          this.#music = audio;
        } else {
          this.#sounds.set(item.name, audio);
        }

        bus.emit('soundLoaded', item);
      } catch (error) {
        console.warn(`[SoundManager] Failed to load sound: ${item.src}`, error);
        bus.emit('soundError', item);
      }
    }

    this.#isLoading = false;
    console.log('[SoundManager] Audio initialized.');
  }

  /**
   * Play a specific sound effect by name.
   * @param {string} name - Sound name.
   */
  #playSound(name) {
    if (this.#isMuted || this.#masterVolume === 0) return;

    const audio = this.#sounds.get(name);
    if (!audio) {
      console.warn(`[SoundManager] Sound not found: ${name}`);
      return;
    }

    // Clone to allow overlapping sounds
    const clone = audio.cloneNode();
    clone.volume = this.#sfxVolume * this.#masterVolume;
    clone.play().catch(err => {
      console.warn(`[SoundManager] Failed to play sound: ${name}`, err);
    });
  }

  /**
   * Play a sound effect directly.
   * @param {string} name - Sound name.
   */
  playSFX(name) {
    this.#playSound(name);
  }

  /**
   * Start background music.
   */
  startMusic() {
    if (!this.#music || this.#isMuted) return;

    this.#music.volume = this.#musicVolume * this.#masterVolume;
    this.#music.play().catch(err => {
      console.warn('[SoundManager] Failed to start music:', err);
    });
  }

  /**
   * Stop background music.
   */
  stopMusic() {
    if (!this.#music) return;

    this.#music.pause();
    this.#music.currentTime = 0;
  }

  /**
   * Set master volume (0-1).
   * @param {number} level - Volume level.
   */
  setVolume(level) {
    this.#masterVolume = Math.max(0, Math.min(1, level));
    this.#applyVolumes();
  }

  /**
   * Set SFX volume (0-1).
   * @param {number} level - Volume level.
   */
  setSFXVolume(level) {
    this.#sfxVolume = Math.max(0, Math.min(1, level));
    this.#applyVolumes();
  }

  /**
   * Set music volume (0-1).
   * @param {number} level - Volume level.
   */
  setMusicVolume(level) {
    this.#musicVolume = Math.max(0, Math.min(1, level));
    if (this.#music) {
      this.#music.volume = this.#musicVolume * this.#masterVolume;
    }
  }

  /**
   * Apply volume settings to all audio elements.
   */
  #applyVolumes() {
    const masterVol = this.#masterVolume;

    for (const [name, audio] of this.#sounds) {
      audio.volume = this.#sfxVolume * masterVol;
    }

    if (this.#music) {
      this.#music.volume = this.#musicVolume * masterVol;
    }
  }

  /**
   * Toggle mute state.
   */
  toggleMute() {
    this.#isMuted = !this.#isMuted;

    if (this.#isMuted) {
      this.stopAll();
    } else {
      this.startMusic();
    }

    return this.#isMuted;
  }

  /**
   * Stop all playing sounds.
   */
  stopAll() {
    for (const audio of this.#sounds.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.stopMusic();
  }

  /**
   * Get current volume settings.
   * @returns {Object} Volume levels.
   */
  getVolumes() {
    return {
      master: this.#masterVolume,
      sfx: this.#sfxVolume,
      music: this.#musicVolume,
      isMuted: this.#isMuted,
    };
  }

  /**
   * Check if a sound exists.
   * @param {string} name - Sound name.
   * @returns {boolean}
   */
  hasSound(name) {
    return this.#sounds.has(name);
  }

  /**
   * Get list of available sounds.
   * @returns {Array<string>}
   */
  getAvailableSounds() {
    return [...this.#sounds.keys()];
  }

  /**
   * Preload a specific sound.
   * @param {string} src - Audio source URL.
   * @returns {Promise<void>}
   */
  async preload(src) {
    const audio = new Audio(src);
    return new Promise(resolve => {
      audio.addEventListener('canplaythrough', () => resolve(), { once: true });
      audio.addEventListener('error', () => resolve(), { once: true }); // Resolve anyway
      audio.load();
    });
  }

  /**
   * Dispose of all audio resources.
   */
  dispose() {
    this.stopAll();
    this.#sounds.clear();
    this.#music = null;
  }
}