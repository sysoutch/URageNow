/**
 * AIEngine - Base class for Ultimate Texas Hold'em AI opponents.
 *
 * Responsibilities:
 * - Provide a common interface for all AI player types
 * - Evaluate hand strength and make betting decisions
 * - Implement decision timing for realistic play speed
 * - Support configurable aggression levels
 *
 * Dependencies: EventBus, Constants (AI, EVENTS)
 * Events emitted: 'aiDecision', 'aiAction'
 *
 * Public API:
 * - constructor(aiType, aggression)
 * - evaluate(player, communityCards, currentBet)
 * - makeDecision(player, gameContext)
 * - getDecisionTime()
 */

import { bus } from '../core/EventBus.js';
import { EVENTS, AI } from '../config/constants.js';

export class AIEngine {
  #aiType;
  #aggression;
  #decisionDelay;

  /**
   * Create an AIEngine instance.
   * @param {'tight'|'balanced'|'loose'|'aggressive'|'maniac'} aiType - AI personality type.
   * @param {number} [aggression] - Aggression level (0-1, auto-calculated if not provided).
   */
  constructor(aiType = 'balanced', aggression) {
    this.#aiType = aiType;
    this.#aggression = aggression ?? AI.AGGRESSION[aiType] ?? 0.5;
    this.#decisionDelay = AI.MAX_DECISION_TIME;
  }

  /**
   * Get the AI personality type.
   */
  get aiType() {
    return this.#aiType;
  }

  /**
   * Get the aggression level (0-1).
   */
  get aggression() {
    return this.#aggression;
  }

  /**
   * Set the aggression level.
   */
  set aggression(value) {
    this.#aggression = Math.max(0, Math.min(1, value));
  }

  /**
   * Evaluate a player's hand strength.
   * @param {Array} holeCards - Player's hole cards.
   * @param {Array} communityCards - Community cards.
   * @returns {number} Hand strength score (0-1).
   */
  evaluate(holeCards, communityCards = []) {
    if (!holeCards || holeCards.length < 2) return 0;

    const card1 = holeCards[0];
    const card2 = holeCards[1];

    // Base score from hole cards
    let score = this.#evaluateHoleCards(card1, card2);

    // Adjust for community cards if available
    if (communityCards.length > 0) {
      score += this.#evaluateWithCommunity(holeCards, communityCards);
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Evaluate hole card strength only.
   */
  #evaluateHoleCards(card1, card2) {
    const rank1 = Math.max(card1.rank, card2.rank);
    const rank2 = Math.min(card1.rank, card2.rank);
    const isPair = card1.rank === card2.rank;
    const suited = card1.suit === card2.suit;
    const gap = rank1 - rank2;

    let score = 0;

    // Pair scoring
    if (isPair) {
      score = 0.5 + (rank1 / 14) * 0.5; // 0.5-1.0 for pairs
      return score;
    }

    // High card scoring
    score += (rank1 / 14) * 0.4;

    // Suited bonus
    if (suited) {
      score += 0.1;
    }

    // Connectedness bonus (gapped hands are weaker)
    if (gap <= 2) {
      score += 0.15;
    } else if (gap <= 4) {
      score += 0.08;
    }

    // Both cards above 10 is strong
    if (rank1 >= 13 && rank2 >= 10) {
      score += 0.15;
    }

    return Math.min(1, score);
  }

  /**
   * Evaluate hand strength with community cards.
   */
  #evaluateWithCommunity(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    let adjustment = -0.3; // Start from hole card baseline

    // Count made hands (simplified check)
    if (communityCards.length >= 3) {
      adjustment += this.#checkFlushPotential(allCards);
      adjustment += this.#checkStraightPotential(allCards);
    }

    return Math.max(-0.5, Math.min(0.7, adjustment));
  }

  /**
   * Check for flush potential in the hand.
   */
  #checkFlushPotential(cards) {
    const suitCounts = {};
    for (const card of cards) {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }

    const maxSuit = Math.max(...Object.values(suitCounts));
    if (maxSuit >= 5) return 0.4; // Made flush
    if (maxSuit === 4) return 0.2; // Flush draw
    if (maxSuit === 3) return 0.1; // Weak draw
    return 0;
  }

  /**
   * Check for straight potential in the hand.
   */
  #checkStraightPotential(cards) {
    const ranks = [...new Set(cards.map(c => c.rank))].sort((a, b) => a - b);

    // Check for made straight
    if (ranks.length >= 5) {
      for (let i = 0; i <= ranks.length - 5; i++) {
        if (ranks[i + 4] - ranks[i] === 4) return 0.3;
      }
    }

    // Check for straight draw
    if (ranks.length >= 2) {
      const gap = ranks[ranks.length - 1] - ranks[0];
      if (gap <= 5 && ranks.length === 4) return 0.15;
    }

    return 0;
  }

  /**
   * Make a betting decision based on game context.
   * @param {Object} player - Player instance.
   * @param {Object} gameContext - Current game state information.
   * @returns {Object} Decision with action and optional amount.
   */
  makeDecision(player, gameContext) {
    const { holeCards, communityCards, currentBet, anteBet } = gameContext;

    const handStrength = this.evaluate(holeCards, communityCards);
    const potOdds = this.#calculatePotOdds(gameContext);
    const decisionTime = this.getDecisionTime();

    return this.#decideAction(handStrength, potOdds, currentBet, anteBet, decisionTime);
  }

  /**
   * Calculate pot odds for the AI to evaluate.
   */
  #calculatePotOdds(context) {
    const { potSize, betToCall, totalInvested } = context;
    if (betToCall <= 0) return Infinity; // Free card or check
    return potSize / betToCall;
  }

  /**
   * Decide the action based on hand strength and aggression.
   */
  #decideAction(handStrength, potOdds, currentBet, anteBet, decisionTime) {
    const raiseThreshold = 0.6 - (this.#aggression * 0.15);
    const callThreshold = 0.35 - (this.#aggression * 0.1);
    const bluffChance = this.#aggression * 0.15;

    // Random bluff/fold
    if (handStrength < 0.2 && Math.random() < bluffChance) {
      return { action: 'raise', amount: anteBet * 2, decisionTime };
    }

    if (handStrength < 0.2) {
      return { action: 'fold', decisionTime };
    }

    if (handStrength >= raiseThreshold) {
      const raiseAmount = currentBet > 0
        ? currentBet * (1 + this.#aggression)
        : anteBet * (1 + Math.floor(this.#aggression * 3));

      return { action: 'raise', amount: Math.max(anteBet, raiseAmount), decisionTime };
    }

    if (handStrength >= callThreshold || potOdds > (2 - this.#aggression)) {
      return { action: 'call', amount: currentBet, decisionTime };
    }

    return { action: 'fold', decisionTime };
  }

  /**
   * Get realistic decision time in milliseconds.
   */
  getDecisionTime() {
    // Base time with some randomness for realism
    const base = AI.MIN_DECISION_TIME + (AI.MAX_DECISION_TIME - AI.MIN_DECISION_TIME) / 2;
    const variance = (Math.random() - 0.5) * (AI.MAX_DECISION_TIME - AI.MIN_DECISION_TIME);

    // Stronger decisions take slightly longer
    return Math.max(AI.MIN_DECISION_TIME, base + variance);
  }

  /**
   * Get a summary of the AI's current strategy.
   */
  getStrategySummary() {
    return {
      type: this.#aiType,
      aggression: this.#aggression,
      decisionRange: `${AI.MIN_DECISION_TIME}ms - ${AI.MAX_DECISION_TIME}ms`,
    };
  }
}