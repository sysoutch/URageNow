/**
 * PayoutEngine - Calculates payouts for Ultimate Texas Hold'em bets.
 *
 * Responsibilities:
 * - Calculate winnings based on hand rankings and pay tables
 * - Handle dealer qualification checks
 * - Process ante bonuses and straight bonuses
 * - Manage play bet payouts
 * - Support multiple pay table configurations
 *
 * Dependencies: EventBus (bus)
 * Events emitted: 'payoutCalculated', 'winPaid'
 *
 * Public API:
 * - constructor(payTable)
 * - calculatePayouts(playerHand, dealerHand, anteBet, playBet)
 * - calculateStraightBonus(handResult)
 * - calculatePlayPayout(handResult, betAmount)
 * - checkDealerQualification(dealerHandResult)
 */

import { bus } from '../core/EventBus.js';

// ===========================================================================
// Internal Constants
// ===========================================================================

/** Standard pay table for Ultimate Texas Hold'em */
const STANDARD_PAY_TABLE = {
  royal_flush: 100,
  straight_flush: 50,
  four_of_a_kind: 20,
  full_house: 4,
  flush: 3,
  straight: 2,
  three_of_a_kind: 1,
};

/** Straight bonus payouts (ante bonus) */
const STRAIGHT_BONUS = {
  royal_flush: 100,
  straight_flush: 50,
  four_of_a_kind: 20,
  full_house: 4,
  flush: 3,
  straight: 1,
};

/** Trips side bet payouts */
const TRIPS_BONUS = {
  royal_flush: 50,
  straight_flush: 40,
  four_of_a_kind: 25,
  full_house: 8,
  flush: 6,
  straight: 4,
  three_of_a_kind: 3,
};

/** Standard blind payouts */
const BLIND_PAYOUT = {
  royal_flush: 500,
  straight_flush: 50,
  four_of_a_kind: 10,
  full_house: 3,
  flush: 1.5,
  straight: 1,
};

/** Internal hand ranking constants (0-9 scale) */
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

/** Pay table configurations */
const PAYOUTS = {
  STANDARD: STANDARD_PAY_TABLE,
  ALTERNATIVE: {
    royal_flush: 50,
    straight_flush: 25,
    four_of_a_kind: 10,
    full_house: 3,
    flush: 2,
    straight: 1,
    three_of_a_kind: 1,
  },
};

/** Event names */
const EVENTS = {
  PAYOUT_CALCULATED: 'payoutCalculated',
  WIN_PAID: 'winPaid',
};

export class PayoutEngine {
  #payTable;

  /**
   * Create a PayoutEngine instance.
   * @param {'STANDARD'|'ALTERNATIVE'} [payTableName='STANDARD'] - Pay table name.
   */
  constructor(payTableName = 'STANDARD') {
    this.#payTable = PAYOUTS[payTableName] || PAYOUTS.STANDARD;
  }

  /**
   * Calculate all payouts for a completed hand.
   * @param {Object} playerEvaluation - Player hand evaluation results.
   * @param {Object} dealerEvaluation - Dealer hand evaluation results.
   * @param {number} anteBet - Player's ante bet.
   * @param {number} playBet - Player's play bet.
   * @param {boolean} dealerQualifies - Whether the dealer qualified.
   * @param {number} comparison - Positive if player beats dealer, negative if dealer wins, 0 if push.
   * @param {number} [tripsBet=0] - Player's trips side bet.
   * @param {boolean} [isFolded=false] - Whether the player folded the main hand.
   * @returns {Object} Detailed payout breakdown.
   */
  calculatePayouts(playerEvaluation, dealerEvaluation, anteBet, playBet, dealerQualifies, comparison, tripsBet = 0, isFolded = false, options = {}) {
    const preset = options.tableRulePreset === 'legacy' ? 'legacy' : 'official';
    const usesOfficialRules = preset === 'official';

    // Guard against null/undefined evaluation (rank can be 0 for HIGH_CARD)
    if (!playerEvaluation || typeof playerEvaluation.rank === 'undefined') {
      console.warn('[PayoutEngine] Invalid or missing hand evaluation.');
      return {
        antePayout: 0,
        blindPayout: 0,
        playPayout: 0,
        tripsPayout: 0,
        straightBonus: 0,
        totalWon: 0,
        netProfit: -(anteBet + (options.blindBet || 0) + playBet + tripsBet),
        breakdown: this.#buildBreakdown({
          anteBet,
          blindBet: options.blindBet || 0,
          playBet,
          tripsBet,
          antePayout: 0,
          blindPayout: 0,
          playPayout: 0,
          tripsPayout: 0,
          straightBonus: 0,
        }),
        details: [{ type: 'error', message: 'Invalid hand evaluation' }],
      };
    }

    const blindBet = options.blindBet || 0;
    const totalWagered = anteBet + blindBet + playBet + tripsBet;
    const result = {
      antePayout: 0,
      blindPayout: 0,
      playPayout: 0,
      tripsPayout: 0,
      straightBonus: 0,
      totalWon: 0,
      netProfit: -totalWagered,
      breakdown: null,
      details: [],
    };

    const handRank = playerEvaluation.rank;

    if (!usesOfficialRules) {
      result.straightBonus = this.calculateStraightBonus(handRank, anteBet);
    }
    result.tripsPayout = this.calculateTripsPayout(handRank, tripsBet);

    if (isFolded) {
      result.details.push({
        type: 'loss',
        message: 'Player folded - Ante and Play lose.',
      });
      if (blindBet > 0) {
        result.details.push({
          type: 'blind',
          hand: playerEvaluation.name,
          amount: 0,
        });
      }
    } else if (options.pushMainBetsWhenDealerDisqualified && !dealerQualifies) {
      const paysWinningAnte = options.dealerDisqualifiedAnteMode === 'PAY_ON_PLAYER_WIN' && comparison > 0;
      result.antePayout += paysWinningAnte ? anteBet * 2 : anteBet;
      result.blindPayout += blindBet;
      result.playPayout += playBet;
      result.details.push({
        type: paysWinningAnte ? 'ante' : 'push',
        message: paysWinningAnte
          ? "Dealer didn't qualify - winning Ante pays 1 to 1; Blind and Play are returned. Trips settles independently."
          : "Dealer didn't qualify - Ante, Blind, and Play are returned. Trips settles independently.",
      });
    } else if (comparison < 0) {
      result.details.push({
        type: 'loss',
        message: `${dealerEvaluation?.name || 'Dealer hand'} beats ${playerEvaluation.name}.`,
      });
      if (blindBet > 0) {
        result.details.push({
          type: 'blind',
          hand: playerEvaluation.name,
          amount: 0,
        });
      }
    } else if (comparison === 0) {
      result.antePayout += anteBet;
      result.blindPayout += blindBet;
      result.playPayout += playBet;
      result.details.push({
        type: 'push',
        message: blindBet > 0
          ? 'Player and dealer tie - Ante, Blind, and Play push.'
          : 'Player and dealer tie - Ante and Play push.',
      });
    } else if (!usesOfficialRules && !dealerQualifies) {
      result.antePayout += anteBet;
      result.playPayout += playBet * 2;
      result.details.push({
        type: 'play',
        hand: playerEvaluation.name,
        amount: playBet * 2,
      });
      result.details.push({
        type: 'push',
        message: 'Dealer does not qualify - Ante pushes.',
      });
    } else {
      result.antePayout += anteBet * 2;
      result.playPayout += playBet * 2;
      result.details.push({
        type: 'ante',
        hand: playerEvaluation.name,
        amount: anteBet * 2,
      });
      result.details.push({
        type: 'play',
        hand: playerEvaluation.name,
        amount: playBet * 2,
      });
    }

    if (usesOfficialRules && blindBet > 0 && !(options.pushMainBetsWhenDealerDisqualified && !dealerQualifies)) {
      result.blindPayout = this.calculateBlindPayout(handRank, blindBet, comparison);
      result.details.push({
        type: 'blind',
        hand: playerEvaluation.name,
        amount: result.blindPayout,
      });
    }

    if (result.straightBonus > 0) {
      result.details.push({
        type: 'straight_bonus',
        hand: playerEvaluation.name,
        amount: result.straightBonus,
      });
    }

    if (result.tripsPayout > 0) {
      result.details.push({
        type: 'trips',
        hand: playerEvaluation.name,
        amount: result.tripsPayout,
      });
    }

    // Calculate totals
    result.totalWon = result.antePayout + result.blindPayout + result.playPayout + result.tripsPayout + result.straightBonus;
    result.netProfit = result.totalWon - totalWagered;
    result.breakdown = this.#buildBreakdown({
      anteBet,
      blindBet,
      playBet,
      tripsBet,
      antePayout: result.antePayout,
      blindPayout: result.blindPayout,
      playPayout: result.playPayout,
      tripsPayout: result.tripsPayout,
      straightBonus: result.straightBonus,
    });

    bus.emit(EVENTS.PAYOUT_CALCULATED, {
      hand: playerEvaluation.name,
      anteBet,
      blindBet,
      playBet,
      tripsBet,
      antePayout: result.antePayout,
      blindPayout: result.blindPayout,
      playPayout: result.playPayout,
      tripsPayout: result.tripsPayout,
      straightBonus: result.straightBonus,
      totalWon: result.totalWon,
      netProfit: result.netProfit,
      dealerQualifies,
      comparison,
      tableRulePreset: preset,
    });

    return result;
  }

  /**
   * Build a UI-friendly breakdown for each wager bucket.
   * Profit values exclude returned stakes so the numbers add up to net profit cleanly.
   * @param {Object} payoutData - Raw settled bets and returns.
   * @returns {Array<Object>} Ordered breakdown rows.
   */
  #buildBreakdown(payoutData) {
    const {
      anteBet,
      blindBet,
      playBet,
      tripsBet,
      antePayout,
      blindPayout,
      playPayout,
      tripsPayout,
      straightBonus,
    } = payoutData;

    return [
      this.#createBreakdownEntry('Ante', anteBet, antePayout),
      this.#createBreakdownEntry('Blind', blindBet, blindPayout),
      this.#createBreakdownEntry('Play', playBet, playPayout),
      this.#createBonusEntry('Bonus', straightBonus),
      this.#createBreakdownEntry('Trips', tripsBet, tripsPayout),
    ].filter(Boolean);
  }

  /**
   * Create a settlement row for a standard wager.
   * @param {string} label - Display label.
   * @param {number} wager - Original wager.
   * @param {number} totalReturn - Total amount returned including stake.
   * @returns {Object|null}
   */
  #createBreakdownEntry(label, wager, totalReturn) {
    if (!wager && !totalReturn) {
      return null;
    }

    const profit = totalReturn - wager;
    let multiplierLabel = 'Lose';

    if (wager > 0) {
      if (profit === 0 && totalReturn === wager) {
        multiplierLabel = 'Push';
      } else if (profit > 0) {
        multiplierLabel = `${this.#formatMultiplier(profit / wager)}x`;
      }
    }

    return {
      label,
      wager,
      totalReturn,
      profit,
      multiplierLabel,
    };
  }

  /**
   * Create a row for a bonus that has no returned stake component.
   * @param {string} label - Display label.
   * @param {number} amount - Bonus amount.
   * @returns {Object|null}
   */
  #createBonusEntry(label, amount) {
    if (!amount) {
      return null;
    }

    return {
      label,
      wager: 0,
      totalReturn: amount,
      profit: amount,
      multiplierLabel: 'Bonus',
    };
  }

  /**
   * Format a multiplier with minimal noise.
   * @param {number} value - Multiplier to show.
   * @returns {string}
   */
  #formatMultiplier(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  /**
   * Calculate ante bet payout based on hand ranking.
   * @param {number} handRank - The player's hand rank.
   * @param {number} anteBet - The ante bet amount.
   * @returns {number} Total payout including original bet.
   */
  _calculateAntePayout(handRank, anteBet) {
    const multiplier = this._getMultiplier(handRank);

    if (multiplier === undefined || multiplier <= 0) return anteBet;

    return anteBet * multiplier + anteBet;
  }

  /**
   * Calculate play bet payout based on hand ranking.
   * @param {number} handRank - The player's hand rank.
   * @param {number} playBet - The play bet amount.
   * @returns {number} Total payout including original bet.
   */
  _calculatePlayPayout(handRank, playBet) {
    const multiplier = this._getMultiplier(handRank);

    if (multiplier === undefined || multiplier <= 0) return playBet;

    return playBet * multiplier + playBet;
  }

  /**
   * Get the payout multiplier for a given hand rank.
   * @param {number} handRank - The hand ranking constant.
   * @returns {number|null} Multiplier or null if no payout (push).
   */
  _getMultiplier(handRank) {
    const mapping = {
      [HAND_RANKINGS.ROYAL_FLUSH]: 'royal_flush',
      [HAND_RANKINGS.STRAIGHT_FLUSH]: 'straight_flush',
      [HAND_RANKINGS.FOUR_OF_A_KIND]: 'four_of_a_kind',
      [HAND_RANKINGS.FULL_HOUSE]: 'full_house',
      [HAND_RANKINGS.FLUSH]: 'flush',
      [HAND_RANKINGS.STRAIGHT]: 'straight',
      [HAND_RANKINGS.THREE_OF_A_KIND]: 'three_of_a_kind',
      [HAND_RANKINGS.TWO_PAIR]: 'two_pair',
    };

    const key = mapping[handRank];
    if (key && this.#payTable[key] !== undefined) {
      return this.#payTable[key];
    }

    // One pair or less: even money (1:1)
    if (handRank === HAND_RANKINGS.ONE_PAIR || handRank === HAND_RANKINGS.HIGH_CARD) {
      return 1;
    }

    return null;
  }

  /**
   * Calculate straight bonus payout only (ante still returns).
   * @param {number} handRank - The player's hand rank.
   * @param {number} anteBet - The ante bet amount.
   * @returns {number} Bonus payout amount.
   */
  _calculateAnteBonusOnly(handRank, anteBet) {
    const bonus = this.calculateStraightBonus(handRank, anteBet);
    return anteBet + bonus;
  }

  /**
   * Calculate straight bonus based on hand ranking.
   * @param {number} handRank - The player's hand rank.
   * @param {number} betAmount - The bet amount (ante or side bet).
   * @returns {number} Bonus payout amount.
   */
  calculateStraightBonus(handRank, betAmount) {
    const bonusMapping = {
      [HAND_RANKINGS.ROYAL_FLUSH]: 'royal_flush',
      [HAND_RANKINGS.STRAIGHT_FLUSH]: 'straight_flush',
      [HAND_RANKINGS.FOUR_OF_A_KIND]: 'four_of_a_kind',
      [HAND_RANKINGS.FULL_HOUSE]: 'full_house',
      [HAND_RANKINGS.FLUSH]: 'flush',
      [HAND_RANKINGS.STRAIGHT]: 'straight',
    };

    const key = bonusMapping[handRank];
    if (key && STRAIGHT_BONUS[key] !== undefined) {
      return betAmount * STRAIGHT_BONUS[key];
    }

    return 0;
  }

  /**
   * Calculate trips side bet return including the original wager.
   * @param {number} handRank - The player's hand rank.
   * @param {number} tripsBet - The trips wager amount.
   * @returns {number} Total trips return including stake.
   */
  calculateTripsPayout(handRank, tripsBet) {
    if (!tripsBet) return 0;

    const payoutMapping = {
      [HAND_RANKINGS.ROYAL_FLUSH]: 'royal_flush',
      [HAND_RANKINGS.STRAIGHT_FLUSH]: 'straight_flush',
      [HAND_RANKINGS.FOUR_OF_A_KIND]: 'four_of_a_kind',
      [HAND_RANKINGS.FULL_HOUSE]: 'full_house',
      [HAND_RANKINGS.FLUSH]: 'flush',
      [HAND_RANKINGS.STRAIGHT]: 'straight',
      [HAND_RANKINGS.THREE_OF_A_KIND]: 'three_of_a_kind',
    };

    const key = payoutMapping[handRank];
    if (!key || TRIPS_BONUS[key] === undefined) {
      return 0;
    }

    return tripsBet * (TRIPS_BONUS[key] + 1);
  }

  /**
   * Calculate the official blind payout including pushes and returned stake.
   * @param {number} handRank - Final player hand rank.
   * @param {number} blindBet - Blind wager amount.
   * @param {number} comparison - Hand comparison result.
   * @returns {number} Total blind return including stake where applicable.
   */
  calculateBlindPayout(handRank, blindBet, comparison) {
    if (!blindBet) return 0;
    if (comparison < 0) return 0;
    if (comparison === 0) return blindBet;

    const payoutMapping = {
      [HAND_RANKINGS.ROYAL_FLUSH]: 'royal_flush',
      [HAND_RANKINGS.STRAIGHT_FLUSH]: 'straight_flush',
      [HAND_RANKINGS.FOUR_OF_A_KIND]: 'four_of_a_kind',
      [HAND_RANKINGS.FULL_HOUSE]: 'full_house',
      [HAND_RANKINGS.FLUSH]: 'flush',
      [HAND_RANKINGS.STRAIGHT]: 'straight',
    };

    const key = payoutMapping[handRank];
    if (!key || BLIND_PAYOUT[key] === undefined) {
      return blindBet;
    }

    return blindBet * (1 + BLIND_PAYOUT[key]);
  }

  /**
   * Check if the dealer qualifies (has a pair or better).
   * @param {Object} dealerHandResult - Dealer's hand evaluation result.
   * @returns {boolean}
   */
  checkDealerQualification(dealerHandResult) {
    return dealerHandResult.rank >= HAND_RANKINGS.ONE_PAIR;
  }

  /**
   * Update the pay table.
   * @param {'STANDARD'|'ALTERNATIVE'} payTableName - New pay table name.
   */
  setPayTable(payTableName) {
    this.#payTable = PAYOUTS[payTableName] || PAYOUTS.STANDARD;
  }

  /**
   * Get the current pay table.
   * @returns {Object}
   */
  getPayTable() {
    return { ...this.#payTable };
  }

  /**
   * Get all available pay tables.
   * @returns {Array<string>}
   */
  static getAvailableTables() {
    return Object.keys(PAYOUTS).filter(
      key => typeof PAYOUTS[key] === 'object' && !Array.isArray(PAYOUTS[key])
    );
  }

  /**
   * Calculate total pot value.
   * @param {Array<Player>} players - Array of Player instances.
   * @returns {number} Total pot amount.
   */
  static calculatePot(players) {
    return players.reduce((total, player) => total + player.totalBet, 0);
  }

  /**
   * Calculate per-player payout breakdown for display.
   * @param {Object} playerData - Player evaluation data.
   * @returns {Object} Detailed payout info.
   */
  static formatPayoutDisplay(playerData) {
    const { handName, anteBet, playBet, won, multiplier } = playerData;

    if (!won) {
      return {
        hand: handName,
        status: 'LOSE',
        anteResult: -anteBet,
        playResult: -playBet,
        total: -(anteBet + playBet),
      };
    }

    const antePayout = anteBet * (multiplier || 1) + anteBet;
    const playPayout = playBet * (multiplier || 1) + playBet;

    return {
      hand: handName,
      status: 'WIN',
      multiplier: multiplier || 1,
      anteResult: antePayout - anteBet,
      playResult: playPayout - playBet,
      total: antePayout + playPayout - anteBet - playBet,
    };
  }
}

// Export hand ranking constants for use in other modules
export { HAND_RANKINGS };
