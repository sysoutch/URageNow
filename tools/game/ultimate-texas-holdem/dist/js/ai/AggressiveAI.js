/**
 * AggressiveAI.js - Aggressive AI player strategy for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Implement aggressive betting behavior for AI players
 * - Make decisions based on hand strength with a tendency to raise
 * - Play more hands than tight AI, with frequent raises
 *
 * Dependencies: ../config/constants.js
 */

import { AI_DECISION_DELAY, AI_DECISION_VARIANCE } from '../config/constants.js';

/**
 * AggressiveAI - Plays more hands and raises frequently.
 *
 * Characteristics:
 * - Raises with weaker starting hands
 * - Less likely to fold
 * - More aggressive play decisions
 */
export class AggressiveAI {
  #seed;

  /**
   * Create a new AggressiveAI instance.
   * @param {number} seed - Random seed for reproducibility
   */
  constructor(seed = Math.random()) {
    this.#seed = seed;
  }

  /**
   * Generate a random number between 0 and 1 using the internal seed.
   * @returns {number} Random value
   */
  #random() {
    // Simple pseudo-random for consistency
    this.#seed = (this.#seed * 9301 + 49297) % 233280;
    return this.#seed / 233280;
  }

  /**
   * Determine if the AI should raise based on hand strength.
   * Aggressive AI raises with weaker hands than tight AI.
   * @param {Array} holeCards - Player's hole cards
   * @param {number} anteBet - Current ante bet
   * @returns {{ shouldRaise: boolean, delay: number }}
   */
  decidePlayDecision(holeCards, anteBet) {
    const handStrength = this.#evaluateHandStrength(holeCards);
    const randomFactor = this.#random();

    // Aggressive AI raises with weaker hands (threshold ~35%)
    const raiseThreshold = 0.35;

    let shouldRaise = false;

    if (handStrength >= 0.6) {
      // Strong hand - almost always raise
      shouldRaise = this.#random() > 0.1;
    } else if (handStrength >= raiseThreshold) {
      // Medium hand - frequently raise
      shouldRaise = this.#random() > 0.45;
    } else {
      // Weak hand - occasionally bluff
      shouldRaise = this.#random() > 0.7;
    }

    const delay = AI_DECISION_DELAY + (this.#random() * AI_DECISION_VARIANCE);

    return { shouldRaise, delay };
  }

  /**
   * Evaluate the strength of a hand for play/fold decision.
   * @param {Array} holeCards - Array of Card objects
   * @returns {number} Strength value between 0 and 1
   */
  #evaluateHandStrength(holeCards) {
    if (holeCards.length < 2) return 0;

    const rank1 = this.#getRankValue(holeCards[0].rank);
    const rank2 = this.#getRankValue(holeCards[1].rank);
    const isPair = holeCards[0].suit === holeCards[1]?.suit &&
                   holeCards[0].rank === holeCards[1]?.rank;
    const isSuited = holeCards[0].suit === holeCards[1]?.suit;
    const cardDifference = Math.abs(rank1 - rank2);

    let strength = 0;

    // Pair bonus (aggressive AI values this highly)
    if (isPair) {
      strength += 0.5 + (Math.max(rank1, rank2) / 28);
    }

    // High card bonus
    strength += Math.max(rank1, rank2) / 28;

    // Suited bonus
    if (isSuited) {
      strength += 0.15;
    }

    // Connected cards bonus
    if (cardDifference <= 3) {
      strength += 0.1 * (4 - cardDifference);
    }

    return Math.min(strength, 1);
  }

  /**
   * Get numeric value for a card rank.
   * @param {string} rank - Card rank
   * @returns {number} Numeric value
   */
  #getRankValue(rank) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
    return values[rank] || 0;
  }

  /**
   * Get the AI personality description.
   * @returns {string} Description
   */
  getPersonality() {
    return 'Aggressive';
  }
}
/**
 * TightAI.js - Tight AI player strategy for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Implement tight, conservative betting behavior for AI players
 * - Only play strong hands
 * - Fold frequently with weak or marginal hands
 *
 * Dependencies: ../config/constants.js
 */

/**
 * TightAI - Plays few hands and only raises with strong holdings.
 *
 * Characteristics:
 * - Folds most hands pre-decision
 * - Only raises with pairs or high suited connectors
 * - Very reliable at recognizing weak hands
 */
export class TightAI {
  #seed;

  /**
   * Create a new TightAI instance.
   * @param {number} seed - Random seed for reproducibility
   */
  constructor(seed = Math.random()) {
    this.#seed = seed;
  }

  /**
   * Generate a random number between 0 and 1 using the internal seed.
   * @returns {number} Random value
   */
  #random() {
    this.#seed = (this.#seed * 9301 + 49297) % 233280;
    return this.#seed / 233280;
  }

  /**
   * Determine if the AI should raise based on hand strength.
   * Tight AI only raises with strong hands (threshold ~65%).
   * @param {Array} holeCards - Player's hole cards
   * @param {number} anteBet - Current ante bet
   * @returns {{ shouldRaise: boolean, delay: number }}
   */
  decidePlayDecision(holeCards, anteBet) {
    const handStrength = this.#evaluateHandStrength(holeCards);
    const randomFactor = this.#random();

    // Tight AI raises only with strong hands (threshold ~65%)
    const raiseThreshold = 0.65;

    let shouldRaise = false;

    if (handStrength >= 0.7) {
      // Strong hand - almost always raise
      shouldRaise = this.#random() > 0.15;
    } else if (handStrength >= raiseThreshold) {
      // Medium-strong hand - sometimes raise
      shouldRaise = this.#random() > 0.6;
    } else {
      // Weak hand - almost never raise
      shouldRaise = this.#random() > 0.95;
    }

    const delay = AI_DECISION_DELAY + (this.#random() * AI_DECISION_VARIANCE);

    return { shouldRaise, delay };
  }

  /**
   * Evaluate the strength of a hand for play/fold decision.
   * @param {Array} holeCards - Array of Card objects
   * @returns {number} Strength value between 0 and 1
   */
  #evaluateHandStrength(holeCards) {
    if (holeCards.length < 2) return 0;

    const rank1 = this.#getRankValue(holeCards[0].rank);
    const rank2 = this.#getRankValue(holeCards[1].rank);
    const isPair = holeCards[0].rank === holeCards[1]?.rank;
    const isSuited = holeCards[0].suit === holeCards[1]?.suit;
    const cardDifference = Math.abs(rank1 - rank2);

    let strength = 0;

    // Pair bonus (tight AI heavily weights this)
    if (isPair) {
      strength += 0.5 + (Math.max(rank1, rank2) / 28);
    }

    // High card bonus
    strength += Math.max(rank1, rank2) / 28;

    // Suited bonus (tight AI values this less than aggressive)
    if (isSuited) {
      strength += 0.1;
    }

    // Connected cards bonus
    if (cardDifference <= 3) {
      strength += 0.05 * (4 - cardDifference);
    }

    return Math.min(strength, 1);
  }

  /**
   * Get numeric value for a card rank.
   * @param {string} rank - Card rank
   * @returns {number} Numeric value
   */
  #getRankValue(rank) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
    return values[rank] || 0;
  }

  /**
   * Get the AI personality description.
   * @returns {string} Description
   */
  getPersonality() {
    return 'Tight';
  }
}
/**
 * BalancedAI.js - Balanced AI player strategy for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Implement balanced, realistic betting behavior for AI players
 * - Play a reasonable number of hands with moderate aggression
 * - Simulate typical casino player behavior
 *
 * Dependencies: ../config/constants.js
 */

/**
 * BalancedAI - Plays a balanced mix of hands with moderate aggression.
 *
 * Characteristics:
 * - Plays roughly 40-50% of hands
 * - Raises with good but not great hands
 * - Realistic decision-making pattern
 */
export class BalancedAI {
  #seed;

  /**
   * Create a new BalancedAI instance.
   * @param {number} seed - Random seed for reproducibility
   */
  constructor(seed = Math.random()) {
    this.#seed = seed;
  }

  /**
   * Generate a random number between 0 and 1 using the internal seed.
   * @returns {number} Random value
   */
  #random() {
    this.#seed = (this.#seed * 9301 + 49297) % 233280;
    return this.#seed / 233280;
  }

  /**
   * Determine if the AI should raise based on hand strength.
   * Balanced AI uses a moderate threshold (~50%).
   * @param {Array} holeCards - Player's hole cards
   * @param {number} anteBet - Current ante bet
   * @returns {{ shouldRaise: boolean, delay: number }}
   */
  decidePlayDecision(holeCards, anteBet) {
    const handStrength = this.#evaluateHandStrength(holeCards);
    const randomFactor = this.#random();

    // Balanced AI raises with medium-strong hands (threshold ~50%)
    const raiseThreshold = 0.5;

    let shouldRaise = false;

    if (handStrength >= 0.65) {
      // Strong hand - frequently raise
      shouldRaise = this.#random() > 0.2;
    } else if (handStrength >= raiseThreshold) {
      // Medium hand - moderate raise rate
      shouldRaise = this.#random() > 0.5;
    } else {
      // Weak hand - rarely raise
      shouldRaise = this.#random() > 0.8;
    }

    const delay = AI_DECISION_DELAY + (this.#random() * AI_DECISION_VARIANCE);

    return { shouldRaise, delay };
  }

  /**
   * Evaluate the strength of a hand for play/fold decision.
   * @param {Array} holeCards - Array of Card objects
   * @returns {number} Strength value between 0 and 1
   */
  #evaluateHandStrength(holeCards) {
    if (holeCards.length < 2) return 0;

    const rank1 = this.#getRankValue(holeCards[0].rank);
    const rank2 = this.#getRankValue(holeCards[1].rank);
    const isPair = holeCards[0].rank === holeCards[1]?.rank;
    const isSuited = holeCards[0].suit === holeCards[1]?.suit;
    const cardDifference = Math.abs(rank1 - rank2);

    let strength = 0;

    // Pair bonus
    if (isPair) {
      strength += 0.45 + (Math.max(rank1, rank2) / 28);
    }

    // High card bonus
    strength += Math.max(rank1, rank2) / 28;

    // Suited bonus
    if (isSuited) {
      strength += 0.12;
    }

    // Connected cards bonus
    if (cardDifference <= 3) {
      strength += 0.08 * (4 - cardDifference);
    }

    return Math.min(strength, 1);
  }

  /**
   * Get numeric value for a card rank.
   * @param {string} rank - Card rank
   * @returns {number} Numeric value
   */
  #getRankValue(rank) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
    return values[rank] || 0;
  }

  /**
   * Get the AI personality description.
   * @returns {string} Description
   */
  getPersonality() {
    return 'Balanced';
  }
}
/**
 * LooseAI.js - Loose AI player strategy for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Implement loose, unpredictable betting behavior for AI players
 * - Play many hands including weak ones
 * - Create variety at the table with frequent raises
 *
 * Dependencies: ../config/constants.js
 */

/**
 * LooseAI - Plays almost any two cards with occasional raises.
 *
 * Characteristics:
 * - Very loose pre-decision criteria
 * - Raises frequently even with weak hands
 * - Creates action and unpredictability at the table
 */
export class LooseAI {
  #seed;

  /**
   * Create a new LooseAI instance.
   * @param {number} seed - Random seed for reproducibility
   */
  constructor(seed = Math.random()) {
    this.#seed = seed;
  }

  /**
   * Generate a random number between 0 and 1 using the internal seed.
   * @returns {number} Random value
   */
  #random() {
    this.#seed = (this.#seed * 9301 + 49297) % 233280;
    return this.#seed / 233280;
  }

  /**
   * Determine if the AI should raise based on hand strength.
   * Loose AI raises with very weak hands (threshold ~25%).
   * @param {Array} holeCards - Player's hole cards
   * @param {number} anteBet - Current ante bet
   * @returns {{ shouldRaise: boolean, delay: number }}
   */
  decidePlayDecision(holeCards, anteBet) {
    const handStrength = this.#evaluateHandStrength(holeCards);
    const randomFactor = this.#random();

    // Loose AI raises with very weak hands (threshold ~25%)
    const raiseThreshold = 0.25;

    let shouldRaise = false;

    if (handStrength >= 0.5) {
      // Decent hand - almost always raise
      shouldRaise = this.#random() > 0.05;
    } else if (handStrength >= raiseThreshold) {
      // Mediocre hand - often raise
      shouldRaise = this.#random() > 0.35;
    } else {
      // Weak hand - still sometimes raise
      shouldRaise = this.#random() > 0.6;
    }

    const delay = AI_DECISION_DELAY + (this.#random() * AI_DECISION_VARIANCE);

    return { shouldRaise, delay };
  }

  /**
   * Evaluate the strength of a hand for play/fold decision.
   * @param {Array} holeCards - Array of Card objects
   * @returns {number} Strength value between 0 and 1
   */
  #evaluateHandStrength(holeCards) {
    if (holeCards.length < 2) return 0;

    const rank1 = this.#getRankValue(holeCards[0].rank);
    const rank2 = this.#getRankValue(holeCards[1].rank);
    const isPair = holeCards[0].rank === holeCards[1]?.rank;
    const isSuited = holeCards[0].suit === holeCards[1]?.suit;
    const cardDifference = Math.abs(rank1 - rank2);

    let strength = 0;

    // Pair bonus (loose AI values pairs highly but plays more)
    if (isPair) {
      strength += 0.4 + (Math.max(rank1, rank2) / 28);
    }

    // High card bonus
    strength += Math.max(rank1, rank2) / 28;

    // Suited bonus (loose AI values suitedness more)
    if (isSuited) {
      strength += 0.2;
    }

    // Connected cards bonus (loose AI loves connected cards)
    if (cardDifference <= 4) {
      strength += 0.15 * (5 - cardDifference);
    }

    return Math.min(strength, 1);
  }

  /**
   * Get numeric value for a card rank.
   * @param {string} rank - Card rank
   * @returns {number} Numeric value
   */
  #getRankValue(rank) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
    return values[rank] || 0;
  }

  /**
   * Get the AI personality description.
   * @returns {string} Description
   */
  getPersonality() {
    return 'Loose';
  }
}
/**
 * ManiacAI.js - Maniac AI player strategy for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Implement extremely aggressive, unpredictable betting behavior
 * - Raise with virtually any hand
 * - Create maximum table action and chaos
 *
 * Dependencies: ../config/constants.js
 */

/**
 * ManiacAI - Plays every hand and raises constantly.
 *
 * Characteristics:
 * - Almost never folds pre-decision
 * - Raises with any two cards
 * - Highly unpredictable and aggressive
 */
export class ManiacAI {
  #seed;

  /**
   * Create a new ManiacAI instance.
   * @param {number} seed - Random seed for reproducibility
   */
  constructor(seed = Math.random()) {
    this.#seed = seed;
  }

  /**
   * Generate a random number between 0 and 1 using the internal seed.
   * @returns {number} Random value
   */
  #random() {
    this.#seed = (this.#seed * 9301 + 49297) % 233280;
    return this.#seed / 233280;
  }

  /**
   * Determine if the AI should raise based on hand strength.
   * Maniac AI raises with almost any hand (threshold ~10%).
   * @param {Array} holeCards - Player's hole cards
   * @param {number} anteBet - Current ante bet
   * @returns {{ shouldRaise: boolean, delay: number }}
   */
  decidePlayDecision(holeCards, anteBet) {
    const handStrength = this.#evaluateHandStrength(holeCards);
    const randomFactor = this.#random();

    // Maniac AI raises with nearly any hand (threshold ~10%)
    const raiseThreshold = 0.1;

    let shouldRaise = false;

    if (handStrength >= 0.4) {
      // Any decent hand - almost always raise
      shouldRaise = this.#random() > 0.02;
    } else if (handStrength >= raiseThreshold) {
      // Mediocre hand - frequently raise
      shouldRaise = this.#random() > 0.3;
    } else {
      // Weak hand - still sometimes raise (maniac!)
      shouldRaise = this.#random() > 0.5;
    }

    const delay = AI_DECISION_DELAY + (this.#random() * AI_DECISION_VARIANCE);

    return { shouldRaise, delay };
  }

  /**
   * Evaluate the strength of a hand for play/fold decision.
   * @param {Array} holeCards - Array of Card objects
   * @returns {number} Strength value between 0 and 1
   */
  #evaluateHandStrength(holeCards) {
    if (holeCards.length < 2) return 0;

    const rank1 = this.#getRankValue(holeCards[0].rank);
    const rank2 = this.#getRankValue(holeCards[1].rank);
    const isPair = holeCards[0].rank === holeCards[1]?.rank;
    const isSuited = holeCards[0].suit === holeCards[1]?.suit;
    const cardDifference = Math.abs(rank1 - rank2);

    let strength = 0;

    // Pair bonus (maniac values pairs but plays everything)
    if (isPair) {
      strength += 0.35 + (Math.max(rank1, rank2) / 28);
    }

    // High card bonus
    strength += Math.max(rank1, rank2) / 28;

    // Suited bonus (maniac loves suited cards)
    if (isSuited) {
      strength += 0.25;
    }

    // Connected cards bonus (maniac is obsessed with connectors)
    if (cardDifference <= 5) {
      strength += 0.2 * (6 - cardDifference);
    }

    return Math.min(strength, 1);
  }

  /**
   * Get numeric value for a card rank.
   * @param {string} rank - Card rank
   * @returns {number} Numeric value
   */
  #getRankValue(rank) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
    return values[rank] || 0;
  }

  /**
   * Get the AI personality description.
   * @returns {string} Description
   */
  getPersonality() {
    return 'Maniac';
  }
}
