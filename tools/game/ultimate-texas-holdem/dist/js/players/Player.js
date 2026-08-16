/**
 * Player - Represents a human or AI player at the table.
 *
 * Responsibilities:
 * - Manage player state (bankroll, bets, cards, actions)
 * - Track player decisions each round (fold, check, call, raise, all-in)
 * - Handle ante and play bet placement for Ultimate Texas Hold'em
 * - Support AI decision-making interface
 *
 * Dependencies: EventBus (bus), Constants (BETTING, EVENTS)
 * Events emitted: 'playerAction', 'playerBet', 'playerFold', 'playerAllIn'
 *
 * Public API:
 * - id              - Unique player identifier
 * - name            - Player display name
 * - bankroll        - Current bankroll amount (getter/setter)
 * - isAI            - Whether this is an AI-controlled player
 * - hand            - Current hand cards
 * - anteBet         - Current ante bet amount
 * - playBet         - Current play bet amount
 * - totalBet        - Total amount wagered in current round
 * - action          - Last action taken
 * - isFolded        - Whether player has folded
 * - isActive        - Whether player is still in the hand
 * - canAct          - Whether it's this player's turn to act
 * - placeAnte(amount)  - Place an ante bet
 * - placePlayBet(amount) - Place a play bet (reveal cards)
 * - actionFold()       - Fold the current hand
 * - actionCheck()      - Check (no bet)
 * - actionCall(amount) - Call the current bet
 * - actionRaise(amount) - Raise the bet
 * - actionAllIn()      - Go all-in
 * - resetHand()        - Reset state for a new round
 */

import { bus } from '../core/EventBus.js';
import { EVENTS } from '../config/constants.js';

let playerIdCounter = 0;

export class Player {
  #id;
  #name;
  #bankroll;
  #isAI;
  #aiType; // 'tight', 'balanced', 'loose', 'aggressive', 'maniac'
  #hand;
  #anteBet;
  #blindBet;
  #playBet;
  #tripsBet;
  #action;
  #isFolded;
  #hasActed;

  /**
   * Create a new Player instance.
   * @param {Object} options - Player configuration.
   * @param {string} [options.name='Player'] - Display name.
   * @param {boolean} [options.isAI=false] - Whether AI-controlled.
   * @param {number} [options.bankroll=1000] - Starting bankroll.
   * @param {'tight'|'balanced'|'loose'|'aggressive'|'maniac'} [options.aiType='balanced'] - AI personality.
   */
  constructor({ name = 'Player', isAI = false, bankroll = 1000, aiType = 'balanced' } = {}) {
    this.#id = ++playerIdCounter;
    this.#name = name;
    this.#bankroll = bankroll;
    this.#isAI = isAI;
    this.#aiType = aiType;
    this.#hand = [];
    this.#anteBet = 0;
    this.#blindBet = 0;
    this.#playBet = 0;
    this.#tripsBet = 0;
    this.#action = null;
    this.#isFolded = false;
    this.#hasActed = false;
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  /**
   * Get the player's unique ID.
   */
  get id() {
    return this.#id;
  }

  /**
   * Get the player's name.
   */
  get name() {
    return this.#name;
  }

  /**
   * Get the player's bankroll.
   */
  get bankroll() {
    return this.#bankroll;
  }

  /**
   * Set the player's bankroll (with validation).
   */
  set bankroll(value) {
    this.#bankroll = Math.max(0, value);
  }

  /**
   * Check if this is an AI-controlled player.
   */
  get isAI() {
    return this.#isAI;
  }

  /**
   * Get the AI personality type.
   */
  get aiType() {
    return this.#aiType;
  }

  /**
   * Get the current hand cards.
   */
  get hand() {
    return [...this.#hand];
  }

  /**
   * Get the ante bet amount.
   */
  get anteBet() {
    return this.#anteBet;
  }

  /**
   * Get the play bet amount.
   */
  get playBet() {
    return this.#playBet;
  }

  /**
   * Get the blind bet amount.
   */
  get blindBet() {
    return this.#blindBet;
  }

  /**
   * Get the trips bet amount.
   */
  get tripsBet() {
    return this.#tripsBet;
  }

  /**
   * Get total bet amount (ante + play).
   */
  get totalBet() {
    return this.#anteBet + this.#blindBet + this.#playBet + this.#tripsBet;
  }

  /**
   * Get the last action taken.
   */
  get action() {
    return this.#action;
  }

  /**
   * Check if the player has folded.
   */
  get isFolded() {
    return this.#isFolded;
  }

  /**
   * Check if the player is still active in the hand.
   */
  get isActive() {
    return !this.#isFolded && this.#bankroll > 0;
  }

  /**
   * Check if the player can take an action.
   */
  get canAct() {
    return this.isActive && !this.#isFolded && !this.#hasActed;
  }

  // ==========================================================================
  // Betting Methods
  // ==========================================================================

  /**
   * Place an ante bet.
   * @param {number} amount - Bet amount.
   */
  placeAnte(amount) {
    if (amount > this.#bankroll || amount <= 0) {
      console.warn(`[Player ${this.#id}] Cannot place ante of ${amount}.`);
      return false;
    }

    this.#anteBet += amount;
    this.#bankroll -= amount;
    this.#action = 'ante';

    bus.emit(EVENTS.BET_PLACED, {
      playerId: this.#id,
      playerName: this.#name,
      betType: 'ante',
      amount,
      totalBet: this.totalBet,
    });

    return true;
  }

  /**
   * Set the total ante bet during the ante round.
   * @param {number} amount - New total ante amount.
   */
  setAnteBet(amount) {
    if (amount < 0) return false;

    const delta = amount - this.#anteBet;
    if (delta > this.#bankroll) {
      console.warn(`[Player ${this.#id}] Cannot set ante to ${amount}.`);
      return false;
    }

    this.#anteBet = amount;
    this.#bankroll -= delta;
    this.#action = 'ante';

    bus.emit(EVENTS.BET_PLACED, {
      playerId: this.#id,
      playerName: this.#name,
      betType: 'ante',
      amount,
      totalBet: this.totalBet,
    });

    return true;
  }

  /**
   * Set the total blind bet during the opening round.
   * @param {number} amount - New total blind amount.
   */
  setBlindBet(amount) {
    if (amount < 0) return false;

    const delta = amount - this.#blindBet;
    if (delta > this.#bankroll) {
      console.warn(`[Player ${this.#id}] Cannot set blind to ${amount}.`);
      return false;
    }

    this.#blindBet = amount;
    this.#action = 'blind';
    this.#bankroll -= delta;

    bus.emit(EVENTS.BET_PLACED, {
      playerId: this.#id,
      playerName: this.#name,
      betType: 'blind',
      amount,
      totalBet: this.totalBet,
    });

    return true;
  }

  /**
   * Place a play bet (reveals cards).
   * @param {number} amount - Bet amount.
   */
  placePlayBet(amount) {
    if (amount > this.#bankroll || amount <= 0) {
      console.warn(`[Player ${this.#id}] Cannot place play bet of ${amount}.`);
      return false;
    }

    this.#playBet += amount;
    this.#bankroll -= amount;
    this.#action = 'play';
    this.#hasActed = true;

    // Reveal cards when play bet is placed
    this.#hand.forEach(card => card.flip(false));

    bus.emit(EVENTS.BET_PLACED, {
      playerId: this.#id,
      playerName: this.#name,
      betType: 'play',
      amount,
      totalBet: this.totalBet,
    });

    return true;
  }

  /**
   * Set the total trips bet during the ante round.
   * @param {number} amount - New total trips amount.
   */
  setTripsBet(amount) {
    if (amount < 0) return false;

    const delta = amount - this.#tripsBet;
    if (delta > this.#bankroll) {
      console.warn(`[Player ${this.#id}] Cannot set trips to ${amount}.`);
      return false;
    }

    this.#tripsBet = amount;
    this.#action = 'trips';

    this.#bankroll -= delta;

    bus.emit(EVENTS.BET_PLACED, {
      playerId: this.#id,
      playerName: this.#name,
      betType: 'trips',
      amount,
      totalBet: this.totalBet,
    });

    return true;
  }

  // ==========================================================================
  // Action Methods
  // ==========================================================================

  /**
   * Fold the current hand.
   */
  actionFold() {
    if (!this.isActive) return false;

    this.#isFolded = true;
    this.#action = 'fold';
    this.#hasActed = true;

    bus.emit(EVENTS.PLAYER_FOLD, { playerId: this.#id, playerName: this.#name });
    bus.emit(EVENTS.FOLD, { playerId: this.#id, playerName: this.#name });

    return true;
  }

  /**
   * Check (pass without betting).
   */
  actionCheck() {
    if (!this.canAct) return false;

    this.#action = 'check';
    this.#hasActed = true;

    bus.emit(EVENTS.PLAYER_ACTION, { playerId: this.#id, playerName: this.#name, action: 'check' });
    bus.emit(EVENTS.CHECK, { playerId: this.#id, playerName: this.#name });

    return true;
  }

  /**
   * Call the current bet.
   * @param {number} amount - Amount to call.
   */
  actionCall(amount) {
    if (!this.canAct || amount <= 0 || amount > this.#bankroll) {
      console.warn(`[Player ${this.#id}] Cannot call ${amount}; available bankroll is ${this.#bankroll}.`);
      return false;
    }

    this.#playBet += amount;
    this.#bankroll -= amount;
    this.#action = 'call';
    this.#hasActed = true;

    bus.emit(EVENTS.PLAYER_ACTION, { playerId: this.#id, playerName: this.#name, action: 'call', amount });
    bus.emit(EVENTS.CALL, { playerId: this.#id, playerName: this.#name, amount });

    return true;
  }

  /**
   * Raise the bet.
   * @param {number} amount - Total raise amount (including call).
   */
  actionRaise(amount) {
    if (!this.canAct || amount <= 0 || amount > this.#bankroll) {
      console.warn(`[Player ${this.#id}] Cannot raise ${amount}; available bankroll is ${this.#bankroll}.`);
      return false;
    }

    this.#playBet += amount;
    this.#bankroll -= amount;
    this.#action = 'raise';
    this.#hasActed = true;

    bus.emit(EVENTS.PLAYER_ACTION, { playerId: this.#id, playerName: this.#name, action: 'raise', amount });
    bus.emit(EVENTS.RAISE, { playerId: this.#id, playerName: this.#name, amount });

    return true;
  }

  /**
   * Go all-in.
   */
  actionAllIn() {
    if (!this.canAct) return false;

    const allInAmount = this.#bankroll;
    this.#playBet += allInAmount;
    this.#bankroll = 0;
    this.#action = 'all-in';
    this.#hasActed = true;

    bus.emit(EVENTS.PLAYER_ACTION, { playerId: this.#id, playerName: this.#name, action: 'all-in', amount: allInAmount });
    bus.emit(EVENTS.ALL_IN, { playerId: this.#id, playerName: this.#name, amount: allInAmount });

    return true;
  }

  // ==========================================================================
  // Hand Management
  // ==========================================================================

  /**
   * Set the player's hand cards.
   * @param {Card[]} cards - Array of Card instances.
   */
  setHand(cards) {
    this.#hand = [...cards];
  }

  /**
   * Get a specific card from the hand by index.
   * @param {number} index - Card index (0 or 1).
   * @returns {Card|null}
   */
  getCard(index) {
    return this.#hand[index] || null;
  }

  /**
   * Reset player state for a new round.
   */
  resetHand() {
    this.#hand = [];
    this.#anteBet = 0;
    this.#blindBet = 0;
    this.#playBet = 0;
    this.#tripsBet = 0;
    this.#action = null;
    this.#isFolded = false;
    this.#hasActed = false;
  }

  /**
   * Re-open player action for a new decision point later in the hand.
   */
  prepareForAction() {
    if (!this.#isFolded) {
      this.#hasActed = false;
    }
  }

  /**
   * Get player data for serialization.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.#id,
      name: this.#name,
      bankroll: this.#bankroll,
      isAI: this.#isAI,
      aiType: this.#aiType,
    };
  }

  /**
   * Get a summary of the player's current state.
   * @returns {Object}
   */
  getSummary() {
    return {
      id: this.#id,
      name: this.#name,
      bankroll: this.#bankroll,
      anteBet: this.#anteBet,
      blindBet: this.#blindBet,
      playBet: this.#playBet,
      tripsBet: this.#tripsBet,
      totalBet: this.totalBet,
      action: this.#action,
      isFolded: this.#isFolded,
      isActive: this.isActive,
      handSize: this.#hand.length,
    };
  }

  /**
   * Reset the ID counter (for testing).
   */
  static resetCounter() {
    playerIdCounter = 0;
  }
}
