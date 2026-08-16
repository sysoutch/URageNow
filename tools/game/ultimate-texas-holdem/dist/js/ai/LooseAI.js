/**
 * LooseAI - Aggressive early-bettor AI player for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Play more hands than Tight AI, but with controlled aggression
 * - Make opportunistic raises with medium-strength hands
 * - Look to exploit pots when holding marginal hands
 *
 * Dependencies: EventBus, Constants (AI_DECISION_DELAY, AI_DECISION_VARIANCE)
 * Events emitted: 'aiDecision'
 *
 * Public API:
 * - constructor()
 * - decide(hand, anteBet, playBetAvailable)
 */

import { bus } from '../core/EventBus.js';
import { AI_DECISION_DELAY, AI_DECISION_VARIANCE } from '../config/constants.js';

const HAND_STRENGTH_THRESHOLDS = {
  pair: 6,         // Play with any pair
  highCardT: 12,   // Play with T-high or better suited
  highCardJ: 13,   // Play with J-high or better unsuited
};

export class LooseAI {
  #id;
  #name;

  /**
   * Create a LooseAI instance.
   * @param {number} id - Player ID.
   * @param {string} name - Player name.
   */
  constructor(id, name) {
    this.#id = id;
    this.#name = name || `Loose AI ${id + 1}`;
  }

  /**
   * Make a decision based on current hand state.
   * @param {Array} hand - Player's hole cards.
   * @param {number} anteBet - Current ante bet amount.
   * @param {boolean} playBetAvailable - Whether play bet is available.
   * @returns {Object} Decision object with action and bet multiplier.
   */
  async decide(hand, anteBet, playBetAvailable) {
    const decision = this.#evaluateHandStrength(hand, anteBet, playBetAvailable);

    await this.#delay(this.#getDecisionTime());

    bus.emit('aiDecision', {
      playerId: this.#id,
      playerName: this.#name,
      ...decision,
    });

    return decision;
  }

  /**
   * Evaluate hand strength and determine action.
   * @param {Array} hand - Player's hole cards.
   * @param {number} anteBet - Current ante bet amount.
   * @param {boolean} playBetAvailable - Whether play bet is available.
   * @returns {Object} Decision object.
   */
  #evaluateHandStrength(hand, anteBet, playBetAvailable) {
    if (!hand || hand.length < 2) {
      return { action: 'fold', multiplier: 0 };
    }

    const card1 = hand[0];
    const card2 = hand[1];

    if (!card1 || !card2) {
      return { action: 'fold', multiplier: 0 };
    }

    const rank1 = this.#getRankValue(card1.rank);
    const rank2 = this.#getRankValue(card2.rank);

    const isPair = card1.rank === card2.rank;
    const highCard = Math.max(rank1, rank2);
    const suited = card1.suit === card2.suit;

    let shouldPlayPlayBet = false;
    let raiseMultiplier = 1;

    if (playBetAvailable) {
      // Loose AI plays more hands
      if (isPair) {
        shouldPlayPlayBet = true;
        raiseMultiplier = highCard >= 10 ? 2 : 1;
      } else if (suited && highCard >= HAND_STRENGTH_THRESHOLDS.highCardT) {
        shouldPlayPlayBet = true;
        raiseMultiplier = Math.random() > 0.6 ? 2 : 1;
      } else if (!suited && highCard >= HAND_STRENGTH_THRESHOLDS.highCardJ) {
        shouldPlayPlayBet = true;
        raiseMultiplier = 1;
      }

      // Occasionally bluff with weaker hands (15% chance)
      if (!shouldPlayPlayBet && Math.random() < 0.15) {
        shouldPlayPlayBet = true;
        raiseMultiplier = 1;
      }
    }

    return {
      action: shouldPlayPlayBet ? 'raise' : 'fold',
      multiplier: shouldPlayPlayBet ? raiseMultiplier : 0,
      confidence: this.#calculateConfidence(hand),
    };
  }

  /**
   * Calculate AI's confidence in its decision.
   * @param {Array} hand - Player's hole cards.
   * @returns {number} Confidence value (0-1).
   */
  #calculateConfidence(hand) {
    if (!hand || hand.length < 2) return 0;

    const card1 = hand[0];
    const card2 = hand[1];

    if (!card1 || !card2) return 0;

    const rank1 = this.#getRankValue(card1.rank);
    const rank2 = this.#getRankValue(card2.rank);

    let confidence = (Math.max(rank1, rank2) - 8) / 6;

    if (card1.rank === card2.rank) {
      confidence += 0.35;
    }

    if (card1.suit === card2.suit) {
      confidence += 0.15;
    }

    return Math.min(confidence, 1);
  }

  /**
   * Get numeric value for a rank.
   * @param {string} rank - Card rank.
   * @returns {number} Numeric value.
   */
  #getRankValue(rank) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
    return values[rank] || 0;
  }

  /**
   * Generate a realistic decision delay.
   * @returns {number} Delay in milliseconds.
   */
  #getDecisionTime() {
    const base = AI_DECISION_DELAY - 200; // Loose players decide faster
    const variance = Math.floor(Math.random() * AI_DECISION_VARIANCE);
    return base + variance;
  }

  /**
   * Create a delay promise.
   * @param {number} ms - Milliseconds to wait.
   * @returns {Promise<void>}
   */
  #delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get the AI personality type.
   * @returns {string}
   */
  getPersonality() {
    return 'loose';
  }

  /**
   * Get player name.
   * @returns {string}
   */
  getName() {
    return this.#name;
  }
}