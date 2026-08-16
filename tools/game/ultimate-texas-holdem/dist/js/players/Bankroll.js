/**
 * Bankroll - Manages player bankroll operations and tracking.
 *
 * Responsibilities:
 * - Track current bankroll balance across sessions
 * - Validate bets against available funds
 * - Calculate win/loss percentages over time
 * - Manage buy-ins and re-buys
 * - Track session start bankroll for comparison
 *
 * Dependencies: EventBus (bus), Constants (STORAGE_KEYS, DEFAULT_BANKROLL)
 * Events emitted: 'bankrollChanged', 'bankrollLow'
 *
 * Public API:
 * - constructor(initialAmount)
 * - currentBalance - Current bankroll amount
 * - sessionStart - Session start bankroll
 * - totalWagered - Total amount wagered this session
 * - totalWon - Total amount won this session
 * - totalLost - Total amount lost this session
 * - canBet(amount) - Check if player can afford a bet
 * - placeBet(amount) - Deduct bet from bankroll
 * - receiveWin(amount) - Add winnings to bankroll
 * - adjustBankroll(amount) - Adjust by positive/negative value
 * - resetSession() - Reset session tracking
 */

import { bus } from '../core/EventBus.js';
import { DEFAULT_BANKROLL, STORAGE_KEYS } from '../config/constants.js';

let bankrollIdCounter = 0;

export class Bankroll {
  #id;
  #currentBalance;
  #sessionStart;
  #totalWagered;
  #totalWon;
  #totalLost;
  #peakBankroll;
  #history;

  /**
   * Create a new Bankroll instance.
   * @param {number} [initialAmount=1000] - Starting bankroll amount.
   */
  constructor(initialAmount = DEFAULT_BANKROLL) {
    this.#id = ++bankrollIdCounter;
    this.#currentBalance = Math.max(0, initialAmount);
    this.#sessionStart = this.#currentBalance;
    this.#totalWagered = 0;
    this.#totalWon = 0;
    this.#totalLost = 0;
    this.#peakBankroll = this.#currentBalance;
    this.#history = [];

    this.#recordChange(initialAmount, 'initial');
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  /**
   * Get the current bankroll balance.
   */
  get currentBalance() {
    return this.#currentBalance;
  }

  /**
   * Get the session start bankroll amount.
   */
  get sessionStart() {
    return this.#sessionStart;
  }

  /**
   * Get the total amount wagered this session.
   */
  get totalWagered() {
    return this.#totalWagered;
  }

  /**
   * Get the total amount won this session.
   */
  get totalWon() {
    return this.#totalWon;
  }

  /**
   * Get the total amount lost this session.
   */
  get totalLost() {
    return this.#totalLost;
  }

  /**
   * Get the peak bankroll reached this session.
   */
  get peakBankroll() {
    return this.#peakBankroll;
  }

  /**
   * Calculate net profit/loss for the session.
   */
  get netProfit() {
    return this.#currentBalance - this.#sessionStart;
  }

  /**
   * Calculate win rate as a percentage of wagered amount.
   */
  get winRate() {
    if (this.#totalWagered === 0) return 0;
    return (this.netProfit / this.#totalWagered) * 100;
  }

  /**
   * Check if the bankroll is critically low.
   */
  get isLow() {
    return this.#currentBalance < this.#sessionStart * 0.1;
  }

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * Check if the player can afford a bet of the given amount.
   * @param {number} amount - Bet amount to check.
   * @returns {boolean} Whether the bet is affordable.
   */
  canBet(amount) {
    return amount > 0 && this.#currentBalance >= amount;
  }

  /**
   * Get the maximum bet amount possible.
   * @returns {number} Maximum affordable bet.
   */
  get maxBet() {
    return Math.max(0, this.#currentBalance);
  }

  // ==========================================================================
  // Bankroll Operations
  // ==========================================================================

  /**
   * Deduct a bet amount from the bankroll.
   * @param {number} amount - Amount to wager.
   * @returns {boolean} Whether the wager was successful.
   */
  placeBet(amount) {
    if (!this.canBet(amount)) {
      console.warn(`[Bankroll] Cannot place bet of ${amount}. Balance: ${this.#currentBalance}`);
      return false;
    }

    this.#currentBalance -= amount;
    this.#totalWagered += amount;

    this.#recordChange(this.#currentBalance, 'bet', amount);

    bus.emit('bankrollChanged', {
      balance: this.#currentBalance,
      change: -amount,
      type: 'bet',
    });

    if (this.isLow) {
      bus.emit('bankrollLow', {
        balance: this.#currentBalance,
        threshold: this.#sessionStart * 0.1,
      });
    }

    return true;
  }

  /**
   * Add winnings to the bankroll.
   * @param {number} amount - Winnings amount.
   * @returns {boolean} Whether the win was processed successfully.
   */
  receiveWin(amount) {
    if (amount <= 0) {
      console.warn(`[Bankroll] Cannot receive non-positive win: ${amount}`);
      return false;
    }

    this.#currentBalance += amount;
    this.#totalWon += amount;

    // Update peak bankroll
    if (this.#currentBalance > this.#peakBankroll) {
      this.#peakBankroll = this.#currentBalance;
    }

    this.#recordChange(this.#currentBalance, 'win', amount);

    bus.emit('bankrollChanged', {
      balance: this.#currentBalance,
      change: amount,
      type: 'win',
    });

    return true;
  }

  /**
   * Adjust bankroll by a positive or negative amount.
   * @param {number} amount - Amount to adjust (positive for win, negative for loss).
   * @returns {boolean} Whether the adjustment was successful.
   */
  adjustBankroll(amount) {
    if (amount > 0) {
      return this.receiveWin(amount);
    } else if (amount < 0) {
      return this.placeBet(Math.abs(amount));
    }
    return false;
  }

  /**
   * Process a complete bet outcome.
   * @param {number} wageredAmount - Original bet amount.
   * @param {number} returnedAmount - Amount returned to player (including winnings).
   */
  processOutcome(wageredAmount, returnedAmount) {
    const netAmount = returnedAmount - wageredAmount;

    if (netAmount > 0) {
      this.receiveWin(netAmount);
    } else if (netAmount < 0) {
      this.#totalLost += Math.abs(netAmount);
      this.placeBet(Math.abs(netAmount));
    }
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Perform a buy-in (add funds to bankroll).
   * @param {number} amount - Amount to add.
   * @returns {boolean} Whether the buy-in was successful.
   */
  buyIn(amount) {
    if (amount <= 0) return false;

    this.#currentBalance += amount;
    this.#recordChange(this.#currentBalance, 'buyin', amount);

    bus.emit('bankrollChanged', {
      balance: this.#currentBalance,
      change: amount,
      type: 'buyin',
    });

    return true;
  }

  /**
   * Cash out (remove funds from bankroll).
   * @param {number} amount - Amount to remove.
   * @returns {boolean} Whether the cash-out was successful.
   */
  cashOut(amount) {
    if (!this.canBet(amount)) return false;

    this.#currentBalance -= amount;
    this.#recordChange(this.#currentBalance, 'cashout', amount);

    bus.emit('bankrollChanged', {
      balance: this.#currentBalance,
      change: -amount,
      type: 'cashout',
    });

    return true;
  }

  /**
   * Reset session tracking (new session).
   */
  resetSession() {
    this.#sessionStart = this.#currentBalance;
    this.#totalWagered = 0;
    this.#totalWon = 0;
    this.#totalLost = 0;
    this.#peakBankroll = this.#currentBalance;
    this.#history = [];

    bus.emit('bankrollSessionReset', {
      balance: this.#currentBalance,
    });
  }

  // ==========================================================================
  // History & Serialization
  // ==========================================================================

  /**
   * Record a bankroll change in the history.
   * @param {number} balance - Balance after change.
   * @param {string} type - Change type (bet, win, buyin, etc.).
   * @param {number} [amount] - Amount changed.
   */
  #recordChange(balance, type, amount = 0) {
    this.#history.push({
      balance,
      change: amount,
      type,
      timestamp: Date.now(),
    });

    // Keep only last 100 entries to prevent memory bloat
    if (this.#history.length > 100) {
      this.#history = this.#history.slice(-100);
    }
  }

  /**
   * Get the bankroll change history.
   * @param {number} [limit=20] - Number of entries to return.
   * @returns {Array} Recent history entries.
   */
  getHistory(limit = 20) {
    return [...this.#history.slice(-limit)];
  }

  /**
   * Get session summary data for serialization.
   * @returns {Object} Session summary.
   */
  toJSON() {
    return {
      currentBalance: this.#currentBalance,
      sessionStart: this.#sessionStart,
      totalWagered: this.#totalWagered,
      totalWon: this.#totalWon,
      totalLost: this.#totalLost,
      peakBankroll: this.#peakBankroll,
    };
  }

  /**
   * Reset the ID counter (for testing).
   */
  static resetCounter() {
    bankrollIdCounter = 0;
  }
}
