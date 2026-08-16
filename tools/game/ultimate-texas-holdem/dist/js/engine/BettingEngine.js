/**
 * BettingEngine - Manages betting rounds for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Control the flow of betting rounds (ante, play bet placement)
 * - Validate bet amounts against rules and bankroll
 * - Track minimum/maximum bets per round
 * - Handle ante/blind requirements
 * - Manage the play bet decision timing in Ultimate TH
 *
 * Dependencies: EventBus (bus), StateManager, Constants (EVENTS)
 * Events consumed: 'roundStart', 'betPlaced'
 * Events emitted: 'bettingRound:start', 'betValidated', 'betInvalid'
 *
 * Public API:
 * - constructor(gameState, players, deck)
 * - startAnteRound()       - Start the ante betting round
 * - placePlayBet()         - Place the standard 3x play bet
 * - validateBet(type, amount) - Validate a bet against rules
 * - reset()                - Reset betting state for new round
 */

import { bus } from '../core/EventBus.js';
import { state } from '../core/StateManager.js';
import { EVENTS, ANIMATION_DURATIONS } from '../config/constants.js';

// Betting constants (local to this module)
const BETTING = {
  MIN_ANTE: 5,
  MAX_PLAY_MULTIPLIER: 3,
  RAISE_MULTIPLIERS: [1, 2, 3],
};

export class BettingEngine {
  #players;
  #currentRound;
  #minBet;
  #roundComplete;
  #lastAnte;
  #playAmount;

  /**
   * Create a BettingEngine instance.
   * @param {Object} gameState - Current game state proxy.
   * @param {Array<Player>} players - Array of Player instances.
   * @param {*} deck - Deck instance for card tracking (unused directly).
   */
  constructor(gameState, players, deck) {
    this.#players = players;
    this.#currentRound = 'ante';
    this.#minBet = BETTING.MIN_ANTE;
    this.#roundComplete = false;

    this.#bindEvents();
  }

  /**
   * Subscribe to relevant game events.
   */
  #bindEvents() {
    bus.on(EVENTS.ROUND_START, (data) => {
      this.#currentRound = data.round || 'ante';
      this.#roundComplete = false;
    });

    // Listen for ante bet placement by human player
    bus.on(EVENTS.BET_PLACED, async (data) => {
      if (data.type === 'ante' && data.playerId === 0) {
        console.log('[BettingEngine] Ante placed:', data.amount);
        const currentRound = state.get('round');
        if (currentRound === 'ante') {
          await this.#onAnteComplete(data.amount);
        }
      }
    });

    // Listen for play bet placement
    bus.on(EVENTS.USER_ACTION, async (data) => {
      if (data.action === 'play' && data.playerId === 0) {
        console.log('[BettingEngine] Play bet placed:', data.amount);
        const currentRound = state.get('round');
        if (currentRound === 'pre-flop') {
          await this.#onPlayBetComplete(data.amount);
        }
      }
    });
  }

  /**
   * Called when ante betting is complete.
   */
  async #onAnteComplete(anteAmount) {
    // Store the ante amount for later use
    this.#lastAnte = anteAmount;
    console.log('[BettingEngine] Ante accepted, waiting for play bet...');
  }

  /**
   * Called when play betting is complete - deal cards.
   */
  async #onPlayBetComplete(playAmount) {
    // Emit betting complete event to signal GameEngine
    bus.emit(EVENTS.BETTING_COMPLETE, { ante: this.#lastAnte, play: playAmount });
    console.log('[BettingEngine] Play bet accepted, dealing cards...');
  }

  /**
   * Start the ante betting round.
   */
  startAnteRound() {
    this.#currentRound = 'ante';
    this.#minBet = BETTING.MIN_ANTE;
    this.#roundComplete = false;

    bus.emit(EVENTS.BETTING_ROUND_START, { round: 'ante', minBet: this.#minBet });
    console.log('[BettingEngine] Ante betting started. Min bet:', this.#minBet);
  }

  /**
   * Place the play bet (3x ante standard in Ultimate TH).
   * @param {number} [multiplier=3] - Multiplier for ante bet.
   */
  placePlayBet(multiplier = 3) {
    const humanPlayer = this.#players.find(p => !p.isAI);
    if (!humanPlayer || humanPlayer.anteBet <= 0) {
      console.warn('[BettingEngine] Cannot place play bet without ante.');
      return;
    }

    const playAmount = humanPlayer.anteBet * multiplier;
    if (playAmount > humanPlayer.bankroll) {
      console.warn('[BettingEngine] Insufficient bankroll for play bet.');
      return;
    }

    humanPlayer.placePlayBet(playAmount);
    bus.emit(EVENTS.BET_PLACED, { type: 'play', amount: playAmount, playerId: humanPlayer.id });
    console.log('[BettingEngine] Play bet placed:', playAmount);
  }

  /**
   * Validate a bet against game rules.
   * @param {'ante'|'play'} type - Bet type.
   * @param {number} amount - Bet amount to validate.
   * @returns {Object} Validation result { valid, message, maxAmount }.
   */
  validateBet(type, amount) {
    const result = { valid: false, message: '', maxAmount: 0 };

    if (amount <= 0) {
      return { ...result, message: 'Bet must be greater than zero.' };
    }

    const humanPlayer = this.#players.find(p => !p.isAI);
    if (!humanPlayer) {
      return { ...result, message: 'No human player found.' };
    }

    switch (type) {
      case 'ante':
        result.maxAmount = humanPlayer.bankroll;
        if (amount > result.maxAmount) {
          return { ...result, valid: false, message: `Insufficient bankroll for ante. Max: ${result.maxAmount}` };
        }
        if (amount < this.#minBet) {
          return { ...result, valid: false, message: `Minimum ante is ${this.#minBet}.` };
        }
        result.valid = true;
        break;

      case 'play':
        result.maxAmount = humanPlayer.bankroll;
        if (amount > result.maxAmount) {
          return { ...result, valid: false, message: `Insufficient bankroll for play bet. Max: ${result.maxAmount}` };
        }
        const minPlay = humanPlayer.anteBet * BETTING.RAISE_MULTIPLIERS[0];
        const maxPlay = humanPlayer.anteBet * BETTING.MAX_PLAY_MULTIPLIER;
        if (amount < minPlay && amount > 0) {
          return { ...result, valid: false, message: `Play bet must be at least ${minPlay} (1x ante).` };
        }
        result.maxAmount = Math.min(result.maxAmount, maxPlay);
        if (amount > result.maxAmount) {
          return { ...result, valid: false, message: `Play bet cannot exceed ${result.maxAmount} (${BETTING.MAX_PLAY_MULTIPLIER}x ante).` };
        }
        result.valid = true;
        break;

      default:
        return { ...result, message: 'Unknown bet type.' };
    }

    bus.emit(EVENTS.BET_VALIDATED, { type, amount, player: humanPlayer.name });
    return result;
  }

  /**
   * Get the current betting round.
   * @returns {string}
   */
  get currentRound() {
    return this.#currentRound;
  }

  /**
   * Check if the current betting round is complete.
   * @returns {boolean}
   */
  get isRoundComplete() {
    return this.#roundComplete;
  }

  /**
   * Reset all betting state for a new round.
   */
  reset() {
    this.#currentRound = 'ante';
    this.#minBet = BETTING.MIN_ANTE;
    this.#roundComplete = false;

    for (const player of this.#players) {
      player.resetHand();
    }
  }

  /**
   * Get statistics about the current round.
   * @returns {Object}
   */
  getRoundStats() {
    const totalAntes = this.#players.reduce((sum, p) => sum + (p.anteBet || 0), 0);
    const totalPlays = this.#players.reduce((sum, p) => sum + (p.playBet || 0), 0);

    return {
      round: this.#currentRound,
      totalAntes,
      totalPlays,
      potTotal: totalAntes + totalPlays,
      activePlayers: this.#players.filter(p => p.isActive && !p.isFolded).length,
      foldedPlayers: this.#players.filter(p => p.isFolded).length,
    };
  }
}