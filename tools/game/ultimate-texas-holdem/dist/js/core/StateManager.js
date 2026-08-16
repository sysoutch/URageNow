/**
 * StateManager - Centralized game state management with persistence support.
 *
 * Responsibilities:
 * - Maintain a single source of truth for all game state
 * - Provide reactive state updates via EventBus
 * - Persist and restore game state to localStorage
 * - Validate state transitions
 *
 * Dependencies: EventBus (bus)
 * Events emitted: 'stateChange', 'gameStateUpdated'
 *
 * Public API:
 * - get()              - Get current state snapshot
 * - get(key)           - Get a specific state property
 * - set(partialState)  - Update state with validation
 * - reset()            - Reset to initial state
 * - save()             - Persist state to localStorage
 * - load()             - Restore state from localStorage
 * - subscribe(fn)      - Subscribe to state changes
 */

import { bus } from './EventBus.js';

const STORAGE_KEY = 'ultimate-texas-holdem-state';

const initialState = {
  // Game phase tracking
  round: 'idle', // idle, ante, flop, turn, river, showdown, payout
  phase: null, // betting, ante-placed, dealing

  // Player information
  bankroll: 1000,
  currentBet: 0,
  totalWagered: 0,
  totalWon: 0,

  // Ultimate TH specific bets
  anteBet: 0,
  blindBet: 0,
  playBet: 0,
  tripsBet: 0,

  // Deck state
  deckSize: 52,
  cardsDealt: 0,

  // Round statistics
  handsPlayed: 0,
  handsWon: 0,
  biggestWin: 0,

  // Settings
  soundEnabled: true,
  musicEnabled: false,
  animationSpeed: 1,
  tableTheme: 'classic',
  showDealerUpcard: false,
  debugRevealDealerCards: false,
  tableRulePreset: 'official',
  dealerQualificationEnabled: true,
  dealerQualificationMinimum: 'PAIR_4',
  dealerDisqualifiedAnteMode: 'PUSH',
  preflopRaiseMode: 'THREE_OR_FOUR',
  selectedSaloonId: 'dusty-spur',
  handWarningEnabled: true,
  handWarningThreshold: 'ONE_PAIR',
  warnOnCheck: true,
  warnOnFold: true,

  // Game history
  lastHand: null,
  history: [],

  // UI state
  showSettings: false,
  showStats: false,
  showMenu: false,
};

export class StateManager {
  #state = { ...initialState };
  #subscribers = new Set();
  #maxHistory = 100;

  constructor() {
    this.#loadInitial();
  }

  /**
   * Get the full state or a specific property.
   * @param {string} [key] - Optional property name.
   * @returns {*|object}
   */
  get(key) {
    if (key === undefined) {
      return { ...this.#state };
    }
    return this.#state[key];
  }

  /**
   * Update state with validation and notify subscribers.
   * @param {Object} partialState - Partial state to merge.
   */
  set(partialState) {
    const previous = { ...this.#state };
    this.#state = { ...this.#state, ...partialState };

    // Validate critical state properties
    if (partialState.bankroll !== undefined && this.#state.bankroll < 0) {
      this.#state.bankroll = 0;
    }

    // Track game statistics
    if (partialState.round === 'idle' && previous.round !== 'idle') {
      this.#state.handsPlayed++;
    }

    // Notify subscribers
    this.#notify(previous);

    // Auto-save
    this.save();
  }

  /**
   * Initialize state with custom values (called once at app startup).
   * Merges provided values into the initial state template so that
   * subsequent reset() calls restore these defaults.
   * @param {Object} defaults - Default values to merge into initialState.
   */
  init(defaults) {
    Object.assign(initialState, defaults);
    // Also update current state if not yet loaded from storage
    this.#state = { ...initialState, ...this.#state };
    console.log('[StateManager] State initialized.');
  }

  /**
   * Subscribe to state changes.
   * @param {Function} fn - Callback function(prevState, newState).
   * @returns {Function} - Cleanup function.
   */
  subscribe(fn) {
    this.#subscribers.add(fn);
    return () => this.#subscribers.delete(fn);
  }

  /**
   * Reset state to initial values.
   */
  reset() {
    const previous = { ...this.#state };
    this.#state = { ...initialState };
    this.#notify(previous);
    this.save();
  }

  /**
   * Persist state to localStorage.
   */
  save() {
    try {
      const dataToSave = {
        bankroll: this.#state.bankroll,
        totalWon: this.#state.totalWon,
        handsPlayed: this.#state.handsPlayed,
        handsWon: this.#state.handsWon,
        biggestWin: this.#state.biggestWin,
        settings: {
          soundEnabled: this.#state.soundEnabled,
          musicEnabled: this.#state.musicEnabled,
          animationSpeed: this.#state.animationSpeed,
          tableTheme: this.#state.tableTheme,
          showDealerUpcard: this.#state.showDealerUpcard,
          debugRevealDealerCards: this.#state.debugRevealDealerCards,
          tableRulePreset: this.#state.tableRulePreset,
          dealerQualificationEnabled: this.#state.dealerQualificationEnabled,
          dealerQualificationMinimum: this.#state.dealerQualificationMinimum,
          dealerDisqualifiedAnteMode: this.#state.dealerDisqualifiedAnteMode,
          preflopRaiseMode: this.#state.preflopRaiseMode,
          selectedSaloonId: this.#state.selectedSaloonId,
          handWarningEnabled: this.#state.handWarningEnabled,
          handWarningThreshold: this.#state.handWarningThreshold,
          warnOnCheck: this.#state.warnOnCheck,
          warnOnFold: this.#state.warnOnFold,
        },
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.warn('[StateManager] Failed to save state:', error);
    }
  }

  /**
   * Restore state from localStorage.
   */
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);

        this.#state.bankroll = parsed.bankroll ?? initialState.bankroll;
        this.#state.totalWon = parsed.totalWon ?? initialState.totalWon;
        this.#state.handsPlayed = parsed.handsPlayed ?? initialState.handsPlayed;
        this.#state.handsWon = parsed.handsWon ?? initialState.handsWon;
        this.#state.biggestWin = parsed.biggestWin ?? initialState.biggestWin;

        if (parsed.settings) {
          this.#state.soundEnabled = parsed.settings.soundEnabled ?? true;
          this.#state.musicEnabled = parsed.settings.musicEnabled ?? false;
          this.#state.animationSpeed = parsed.settings.animationSpeed ?? 1;
          this.#state.tableTheme = parsed.settings.tableTheme ?? 'classic';
          this.#state.showDealerUpcard = parsed.settings.showDealerUpcard ?? false;
          this.#state.debugRevealDealerCards = parsed.settings.debugRevealDealerCards ?? false;
          this.#state.tableRulePreset = parsed.settings.tableRulePreset ?? 'official';
          this.#state.dealerQualificationEnabled = parsed.settings.dealerQualificationEnabled ?? true;
          this.#state.dealerQualificationMinimum = parsed.settings.dealerQualificationMinimum ?? 'PAIR_4';
          this.#state.dealerDisqualifiedAnteMode = parsed.settings.dealerDisqualifiedAnteMode ?? 'PUSH';
          this.#state.preflopRaiseMode = parsed.settings.preflopRaiseMode ?? 'THREE_OR_FOUR';
          this.#state.selectedSaloonId = parsed.settings.selectedSaloonId ?? 'dusty-spur';
          this.#state.handWarningEnabled = parsed.settings.handWarningEnabled ?? true;
          this.#state.handWarningThreshold = parsed.settings.handWarningThreshold ?? 'ONE_PAIR';
          this.#state.warnOnCheck = parsed.settings.warnOnCheck ?? true;
          this.#state.warnOnFold = parsed.settings.warnOnFold ?? true;
        }
      }
    } catch (error) {
      console.warn('[StateManager] Failed to load state:', error);
      this.reset();
    }

    return { ...this.#state };
  }

  /**
   * Record a hand result for statistics.
   * @param {Object} result - Hand result data.
   */
  recordHand(result) {
    const previous = { ...this.#state };

    if (result.won) {
      this.#state.handsWon++;
      this.#state.totalWon += result.amount || 0;

      if ((result.amount || 0) > this.#state.biggestWin) {
        this.#state.biggestWin = result.amount || 0;
      }
    }

    this.#state.lastHand = result;

    // Add to history (capped)
    this.#state.history = [
      result,
      ...this.#state.history,
    ].slice(0, this.#maxHistory);

    this.#notify(previous);
  }

  /**
   * Get statistics summary.
   * @returns {Object}
   */
  getStatistics() {
    const handsPlayed = this.#state.handsPlayed;
    const handsWon = this.#state.handsWon;

    return {
      bankroll: this.#state.bankroll,
      totalWon: this.#state.totalWon,
      handsPlayed,
      handsWon,
      winRate: handsPlayed > 0 ? (handsWon / handsPlayed) : 0,
      biggestWin: this.#state.biggestWin,
      lastHand: this.#state.lastHand,
      historyLength: this.#state.history.length,
    };
  }

  /**
   * Update bankroll with a win or loss.
   * @param {number} amount - Amount to add (positive) or subtract (negative).
   */
  adjustBankroll(amount) {
    const previous = { ...this.#state };
    this.#state.bankroll += amount;

    if (amount > 0) {
      // Track wins for statistics
    }

    this.#notify(previous);
    this.save();
  }

  /**
   * Load initial state (from storage or defaults).
   */
  #loadInitial() {
    this.load();
  }

  /**
   * Notify all subscribers of state changes.
   * @param {Object} previousState - The state before the change.
   */
  #notify(previousState) {
    const eventData = {
      previous: previousState,
      current: { ...this.#state },
      timestamp: Date.now(),
    };

    bus.emit('stateChange', eventData);
    bus.emit('gameStateUpdated', eventData);
  }
}

// Export a singleton instance for global use
export const state = new StateManager();
