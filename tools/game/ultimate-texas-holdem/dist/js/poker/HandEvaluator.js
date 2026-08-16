/**
 * HandEvaluator - Evaluates poker hands and determines rankings.
 *
 * Responsibilities:
 * - Evaluate a 5-card poker hand and return its ranking
 * - Compare two hands to determine the winner
 * - Support Ultimate Texas Hold'em evaluation (using best 5 of 7 cards)
 * - Identify hand types: Royal Flush, Straight Flush, Four of a Kind, etc.
 *
 * Hand Rankings (highest to lowest):
 *   9: Royal Flush
 *   8: Straight Flush
 *   7: Four of a Kind
 *   6: Full House
 *   5: Flush
 *   4: Straight
 *   3: Three of a Kind
 *   2: Two Pair
 *   1: One Pair
 *   0: High Card
 *
 * Dependencies: Card
 * Events emitted via EventBus: 'handEvaluated'
 *
 * Public API:
 * - evaluate(cards)     - Evaluate any number of cards (returns best 5-card hand)
 * - compare(hand1, hand2) - Compare two evaluated hands
 * - getHandName(rank)   - Get the name of a hand ranking
 */

import { bus } from '../core/EventBus.js';

// Hand ranking constants
const HAND_RANKINGS = {
  HIGH_CARD: 0,
  ONE_PAIR: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_OF_A_KIND: 7,
  STRAIGHT_FLUSH: 8,
  ROYAL_FLUSH: 9,
};

// Hand name lookup
const HAND_NAMES = {
  [HAND_RANKINGS.ROYAL_FLUSH]: 'Royal Flush',
  [HAND_RANKINGS.STRAIGHT_FLUSH]: 'Straight Flush',
  [HAND_RANKINGS.FOUR_OF_A_KIND]: 'Four of a Kind',
  [HAND_RANKINGS.FULL_HOUSE]: 'Full House',
  [HAND_RANKINGS.FLUSH]: 'Flush',
  [HAND_RANKINGS.STRAIGHT]: 'Straight',
  [HAND_RANKINGS.THREE_OF_A_KIND]: 'Three of a Kind',
  [HAND_RANKINGS.TWO_PAIR]: 'Two Pair',
  [HAND_RANKINGS.ONE_PAIR]: 'One Pair',
  [HAND_RANKINGS.HIGH_CARD]: 'High Card',
};

export class HandEvaluator {
  /**
   * Evaluate the best 5-card hand from a given set of cards.
   * Supports 2-7 card inputs (for Ultimate TH: player's 2 + community 5 = 7).
   * @param {Card[]} cards - Array of Card instances (2 to 7 cards).
   * @returns {Object} Evaluation result with rank, name, kickers, and bestCards.
   */
  static evaluate(cards) {
    if (!cards || cards.length < 2) {
      return {
        rank: HAND_RANKINGS.HIGH_CARD,
        name: 'High Card',
        kickers: [],
        bestCards: [],
      };
    }

    const sorted = [...cards].sort((a, b) => b.rank - a.rank);

    // If exactly 5 cards, evaluate directly
    if (cards.length === 5) {
      return this.#evaluateFiveCard(sorted);
    }

    // For more than 5 cards, find the best combination
    const combinations = this.#getAllCombinations(sorted, 5);
    let bestResult = null;

    for (const combo of combinations) {
      const result = this.#evaluateFiveCard(combo);
      if (!bestResult || this.#compareResults(result, bestResult) > 0) {
        bestResult = result;
      }
    }

    return bestResult;
  }

  /**
   * Evaluate exactly 5 cards.
   * @param {Card[]} cards - Exactly 5 Card instances (sorted by rank descending).
   * @returns {Object} Evaluation result.
   */
  static #evaluateFiveCard(cards) {
    const ranks = cards.map(c => c.rank);
    const suits = cards.map(c => c.suit);

    // Check for flush
    const isFlush = suits.every(s => s === suits[0]);

    // Check for straight
    let isStraight = true;
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] !== ranks[i - 1] - 1) {
        isStraight = false;
        break;
      }
    }

    // Ace-low straight (A-2-3-4-5)
    if (!isStraight && ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 &&
        ranks[3] === 3 && ranks[4] === 2) {
      isStraight = true;
      // Move Ace to end for proper comparison
      const adjustedRanks = [...ranks.slice(1), 1];
      return this.#buildResult(adjustedRanks, isFlush, isStraight, cards);
    }

    return this.#buildResult(ranks, isFlush, isStraight, cards);
  }

  /**
   * Build evaluation result from card properties.
   */
  static #buildResult(ranks, isFlush, isStraight, originalCards) {
    // Count rank frequencies
    const rankCounts = {};
    for (const rank of ranks) {
      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    }

    const counts = Object.values(rankCounts);

    // Sort by frequency (descending), then by rank (descending) for tie-breaking
    const sortedByCount = [...Object.entries(rankCounts)].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return parseInt(b[0]) - parseInt(a[0]);
    }).map(([rank, count]) => ({ rank: parseInt(rank), count }));

    let rank, name;

    if (isStraight && isFlush) {
      if (ranks[0] === 14 && ranks[4] === 10) {
        rank = HAND_RANKINGS.ROYAL_FLUSH;
        name = HAND_NAMES[HAND_RANKINGS.ROYAL_FLUSH];
      } else {
        rank = HAND_RANKINGS.STRAIGHT_FLUSH;
        name = HAND_NAMES[HAND_RANKINGS.STRAIGHT_FLUSH];
      }
    } else if (counts.includes(4)) {
      rank = HAND_RANKINGS.FOUR_OF_A_KIND;
      name = HAND_NAMES[HAND_RANKINGS.FOUR_OF_A_KIND];
    } else if (counts.includes(3) && counts.includes(2)) {
      rank = HAND_RANKINGS.FULL_HOUSE;
      name = HAND_NAMES[HAND_RANKINGS.FULL_HOUSE];
    } else if (isFlush) {
      rank = HAND_RANKINGS.FLUSH;
      name = HAND_NAMES[HAND_RANKINGS.FLUSH];
    } else if (isStraight) {
      rank = HAND_RANKINGS.STRAIGHT;
      name = HAND_NAMES[HAND_RANKINGS.STRAIGHT];
    } else if (counts.includes(3)) {
      rank = HAND_RANKINGS.THREE_OF_A_KIND;
      name = HAND_NAMES[HAND_RANKINGS.THREE_OF_A_KIND];
    } else if (counts.filter(c => c === 2).length >= 2) {
      rank = HAND_RANKINGS.TWO_PAIR;
      name = HAND_NAMES[HAND_RANKINGS.TWO_PAIR];
    } else if (counts.includes(2)) {
      rank = HAND_RANKINGS.ONE_PAIR;
      name = HAND_NAMES[HAND_RANKINGS.ONE_PAIR];
    } else {
      rank = HAND_RANKINGS.HIGH_CARD;
      name = HAND_NAMES[HAND_RANKINGS.HIGH_CARD];
    }

    // Extract kickers (non-pair cards for tie-breaking)
    const kickers = this.#extractKickers(sortedByCount);
    const tiebreakers = this.#buildTiebreakers(rank, ranks, sortedByCount);

    return {
      rank,
      name,
      kickers,
      tiebreakers,
      bestCards: [...originalCards],
      isFlush,
      isStraight,
      counts: rankCounts,
    };
  }

  /**
   * Extract kicker cards for tie-breaking.
   */
  static #extractKickers(sortedByCount) {
    const kickers = [];
    for (const { rank, count } of sortedByCount) {
      if (count === 1) {
        kickers.push(rank);
      }
    }
    return kickers;
  }

  /**
   * Build the full tie-break vector for a hand type.
   */
  static #buildTiebreakers(handRank, ranks, sortedByCount) {
    if (handRank === HAND_RANKINGS.ROYAL_FLUSH) {
      return [14];
    }

    if (handRank === HAND_RANKINGS.STRAIGHT_FLUSH || handRank === HAND_RANKINGS.STRAIGHT) {
      return [ranks[0]];
    }

    if (handRank === HAND_RANKINGS.FOUR_OF_A_KIND) {
      const quad = sortedByCount.find(entry => entry.count === 4)?.rank || 0;
      const kicker = sortedByCount.find(entry => entry.count === 1)?.rank || 0;
      return [quad, kicker];
    }

    if (handRank === HAND_RANKINGS.FULL_HOUSE) {
      const trips = sortedByCount.find(entry => entry.count === 3)?.rank || 0;
      const pair = sortedByCount.find(entry => entry.count === 2)?.rank || 0;
      return [trips, pair];
    }

    if (handRank === HAND_RANKINGS.FLUSH || handRank === HAND_RANKINGS.HIGH_CARD) {
      return [...ranks];
    }

    if (handRank === HAND_RANKINGS.THREE_OF_A_KIND) {
      const trips = sortedByCount.find(entry => entry.count === 3)?.rank || 0;
      const kickers = sortedByCount
        .filter(entry => entry.count === 1)
        .map(entry => entry.rank);
      return [trips, ...kickers];
    }

    if (handRank === HAND_RANKINGS.TWO_PAIR) {
      const pairs = sortedByCount
        .filter(entry => entry.count === 2)
        .map(entry => entry.rank)
        .sort((a, b) => b - a);
      const kicker = sortedByCount.find(entry => entry.count === 1)?.rank || 0;
      return [...pairs, kicker];
    }

    if (handRank === HAND_RANKINGS.ONE_PAIR) {
      const pair = sortedByCount.find(entry => entry.count === 2)?.rank || 0;
      const kickers = sortedByCount
        .filter(entry => entry.count === 1)
        .map(entry => entry.rank);
      return [pair, ...kickers];
    }

    return [...ranks];
  }

  /**
   * Compare two evaluated hands.
   * @param {Object} hand1 - First evaluation result.
   * @param {Object} hand2 - Second evaluation result.
   * @returns {number} Positive if hand1 wins, negative if hand2 wins, 0 for tie.
   */
  static compare(hand1, hand2) {
    return this.#compareResults(hand1, hand2);
  }

  /**
   * Internal comparison of two evaluation results.
   */
  static #compareResults(result1, result2) {
    if (result1.rank !== result2.rank) {
      return result1.rank - result2.rank;
    }

    const tiebreakers1 = result1.tiebreakers || result1.kickers || [];
    const tiebreakers2 = result2.tiebreakers || result2.kickers || [];
    const maxKickers = Math.max(tiebreakers1.length, tiebreakers2.length);
    for (let i = 0; i < maxKickers; i++) {
      const k1 = tiebreakers1[i] || 0;
      const k2 = tiebreakers2[i] || 0;

      if (k1 !== k2) {
        return k1 - k2;
      }
    }

    return 0; // Tie
  }

  /**
   * Get all combinations of n items from array.
   */
  static #getAllCombinations(arr, n) {
    const results = [];

    const combine = (start, chosen) => {
      if (chosen.length === n) {
        results.push([...chosen]);
        return;
      }

      for (let i = start; i < arr.length; i++) {
        chosen.push(arr[i]);
        combine(i + 1, chosen);
        chosen.pop();
      }
    };

    combine(0, []);
    return results;
  }

  /**
   * Get the name of a hand ranking.
   * @param {number} rank - The hand ranking constant.
   * @returns {string}
   */
  static getHandName(rank) {
    return HAND_NAMES[rank] || 'Unknown';
  }

  /**
   * Check if a hand qualifies for the dealer's bet (pair or better in Ultimate TH).
   * In Ultimate Texas Hold'em, the dealer must have at least a pair to qualify.
   * @param {Object} result - Hand evaluation result.
   * @returns {boolean}
   */
  static dealerQualifies(result) {
    if (!result || typeof result.rank === 'undefined') return false;
    return result.rank >= HAND_RANKINGS.ONE_PAIR;
  }

  /**
   * Get hand ranking constants for external use.
   */
  static get HAND_RANKINGS() {
    return HAND_RANKINGS;
  }

  /**
   * Get all hand names for display.
   * @returns {Object}
   */
  static getHandNames() {
    return { ...HAND_NAMES };
  }
}

export { HAND_RANKINGS, HAND_NAMES };
