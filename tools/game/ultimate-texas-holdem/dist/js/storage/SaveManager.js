/**
 * SaveManager - Handles game save/load functionality using localStorage.
 *
 * Responsibilities:
 * - Save and load game state to/from localStorage
 * - Manage multiple save slots
 * - Handle save data validation and migration
 * - Export/import save data as JSON strings
 * - Manage settings persistence
 *
 * Dependencies: EventBus, Constants (STORAGE)
 * Events consumed: 'game:end'
 * Events emitted: 'saveComplete', 'loadComplete', 'saveError', 'loadError'
 *
 * Public API:
 * - constructor()
 * - save(slotIndex, data)
 * - load(slotIndex)
 * - deleteSave(slotIndex)
 * - hasSave(slotIndex)
 * - exportData(data)
 * - importData(jsonString)
 */

import { bus } from '../core/EventBus.js';
import { STORAGE } from '../config/constants.js';

export class SaveManager {
  #storage;
  #version = STORAGE.VERSION;

  /**
   * Create a SaveManager instance.
   */
  constructor() {
    this.#storage = localStorage;
    this.#bindEvents();
  }

  /**
   * Subscribe to game events for auto-save triggers.
   */
  #bindEvents() {
    bus.on(STORAGE.EVENTS.GAME_END, () => {
      this.autoSave();
    });
  }

  /**
   * Save game data to a specific slot.
   * @param {number} slotIndex - Save slot index (0-4).
   * @param {Object} data - Game data to save.
   * @returns {Promise<boolean>} Whether the save was successful.
   */
  async save(slotIndex, data) {
    try {
      const slotKey = this.#getSlotKey(slotIndex);
      const saveData = this.#createSaveRecord(data);

      this.#storage.setItem(slotKey, JSON.stringify(saveData));

      bus.emit(STORAGE.EVENTS.SAVE_COMPLETE, { slot: slotIndex });
      console.log(`[SaveManager] Game saved to slot ${slotIndex}.`);
      return true;
    } catch (error) {
      console.error('[SaveManager] Save failed:', error);
      bus.emit(STORAGE.EVENTS.SAVE_ERROR, { slot: slotIndex, error });
      return false;
    }
  }

  /**
   * Load game data from a specific slot.
   * @param {number} slotIndex - Save slot index (0-4).
   * @returns {Object|null} Loaded game data or null if not found.
   */
  load(slotIndex) {
    try {
      const slotKey = this.#getSlotKey(slotIndex);
      const rawData = this.#storage.getItem(slotKey);

      if (!rawData) {
        console.log(`[SaveManager] No save data in slot ${slotIndex}.`);
        return null;
      }

      const saveData = JSON.parse(rawData);
      const validated = this.#validateSaveData(saveData);

      if (validated) {
        bus.emit(STORAGE.EVENTS.LOAD_COMPLETE, { slot: slotIndex, data: saveData });
        console.log(`[SaveManager] Game loaded from slot ${slotIndex}.`);
        return saveData;
      } else {
        console.warn('[SaveManager] Invalid save data format.');
        bus.emit(STORAGE.EVENTS.LOAD_ERROR, { slot: slotIndex, error: 'Invalid data' });
        return null;
      }
    } catch (error) {
      console.error('[SaveManager] Load failed:', error);
      bus.emit(STORAGE.EVENTS.LOAD_ERROR, { slot: slotIndex, error });
      return null;
    }
  }

  /**
   * Delete a save from a specific slot.
   * @param {number} slotIndex - Save slot index (0-4).
   * @returns {boolean} Whether the delete was successful.
   */
  deleteSave(slotIndex) {
    try {
      const slotKey = this.#getSlotKey(slotIndex);
      this.#storage.removeItem(slotKey);
      console.log(`[SaveManager] Save deleted from slot ${slotIndex}.`);
      return true;
    } catch (error) {
      console.error('[SaveManager] Delete failed:', error);
      return false;
    }
  }

  /**
   * Check if a save exists in a specific slot.
   * @param {number} slotIndex - Save slot index (0-4).
   * @returns {boolean}
   */
  hasSave(slotIndex) {
    const slotKey = this.#getSlotKey(slotIndex);
    return this.#storage.getItem(slotKey) !== null;
  }

  /**
   * Auto-save the current game state.
   */
  autoSave() {
    // Auto-save to slot 0 (primary slot)
    const gameState = this.#extractGameState();
    if (gameState) {
      this.save(0, gameState);
    }
  }

  /**
   * Extract current game state for saving.
   */
  #extractGameState() {
    // This would integrate with StateManager in a real implementation
    const state = document.querySelector('[data-game-state]');
    if (!state) return null;

    try {
      return JSON.parse(state.getAttribute('data-game-state'));
    } catch (error) {
      console.warn('[SaveManager] Could not extract game state:', error);
      return null;
    }
  }

  /**
   * Create a save record with metadata.
   */
  #createSaveRecord(data) {
    return {
      version: this.#version,
      timestamp: Date.now(),
      data,
    };
  }

  /**
   * Validate saved game data format and version.
   */
  #validateSaveData(saveData) {
    // Check version compatibility
    if (saveData.version && saveData.version > this.#version) {
      console.warn('[SaveManager] Save file is from a newer version.');
      return false;
    }

    // Check required fields
    if (!saveData.data || typeof saveData.data !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Export game data as a JSON string.
   * @param {Object} data - Game data to export.
   * @returns {string} JSON string.
   */
  exportData(data) {
    const saveRecord = this.#createSaveRecord(data);
    return JSON.stringify(saveRecord, null, 2);
  }

  /**
   * Import game data from a JSON string.
   * @param {string} jsonString - JSON string to import.
   * @returns {Object|null} Imported data or null if failed.
   */
  importData(jsonString) {
    try {
      const saveData = JSON.parse(jsonString);

      if (!this.#validateSaveData(saveData)) {
        console.warn('[SaveManager] Invalid imported data format.');
        return null;
      }

      console.log('[SaveManager] Data imported successfully.');
      return saveData.data;
    } catch (error) {
      console.error('[SaveManager] Import failed:', error);
      return null;
    }
  }

  /**
   * Get information about a specific save slot.
   * @param {number} slotIndex - Save slot index (0-4).
   * @returns {Object|null} Slot info or null if empty.
   */
  getSlotInfo(slotIndex) {
    const rawData = this.#storage.getItem(this.#getSlotKey(slotIndex));
    if (!rawData) return null;

    try {
      const saveData = JSON.parse(rawData);
      return {
        slot: slotIndex,
        version: saveData.version || 'unknown',
        timestamp: saveData.timestamp,
        date: new Date(saveData.timestamp).toLocaleString(),
        data: saveData.data,
      };
    } catch (error) {
      console.warn('[SaveManager] Could not read slot info:', error);
      return null;
    }
  }

  /**
   * Get all available save slots.
   * @returns {Array<Object>} Array of slot info objects.
   */
  getAllSlots() {
    const slots = [];
    for (let i = 0; i < STORAGE.MAX_SLOTS; i++) {
      const info = this.getSlotInfo(i);
      if (info) slots.push(info);
    }
    return slots;
  }

  /**
   * Clear all save data.
   */
  clearAllSaves() {
    for (let i = 0; i < STORAGE.MAX_SLOTS; i++) {
      this.deleteSave(i);
    }
    console.log('[SaveManager] All saves cleared.');
  }

  /**
   * Save settings to localStorage.
   * @param {Object} settings - Settings object.
   */
  saveSettings(settings) {
    try {
      this.#storage.setItem(STORAGE.SETTINGS_KEY, JSON.stringify({
        version: this.#version,
        timestamp: Date.now(),
        data: settings,
      }));
      console.log('[SaveManager] Settings saved.');
    } catch (error) {
      console.error('[SaveManager] Settings save failed:', error);
    }
  }

  /**
   * Load settings from localStorage.
   * @returns {Object|null} Settings object or null if not found.
   */
  loadSettings() {
    try {
      const rawData = this.#storage.getItem(STORAGE.SETTINGS_KEY);
      if (!rawData) return null;

      const saveData = JSON.parse(rawData);
      return saveData.data || null;
    } catch (error) {
      console.error('[SaveManager] Settings load failed:', error);
      return null;
    }
  }

  /**
   * Get the localStorage key for a save slot.
   */
  #getSlotKey(slotIndex) {
    return `${STORAGE.PREFIX}_${slotIndex}`;
  }

  /**
   * Set a custom storage backend (for testing).
   */
  setStorage(storage) {
    this.#storage = storage;
  }

  /**
   * Get the current storage version.
   */
  get version() {
    return this.#version;
  }
}

// Export constants for external use
export const SAVE_SLOTS = STORAGE.MAX_SLOTS;