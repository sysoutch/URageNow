/**
 * Statistics - Tracks player statistics and achievements.
 *
 * Responsibilities:
 * - Track all game-related statistics (wins, losses, biggest win, etc.)
 * - Calculate win rates and averages
 * - Manage achievement tracking and unlocking
 * - Provide statistical summaries and insights
 * - Persist statistics between sessions
 *
 * Dependencies: EventBus, StateManager, Constants (STATISTICS, ACHIEVEMENTS)
 * Events consumed: 'payoutComplete', 'game:end'
 * Events emitted: 'statisticsUpdated', 'achievementUnlocked'
 *
 * Public API:
 * - constructor()
 * - recordHand(result)
 * - recordWin(amount)
 * - recordLoss(amount)
 * - getStats()
 * - resetStats()
 * - checkAchievements()
 */

import { bus } from '../core/EventBus.js';
import { state } from '../core/StateManager.js';
import { STATISTICS, ACHIEVEMENTS } from '../config/constants.js';

export class Statistics {
  #stats;
  #achievements;
  #unlockedAchievements;

  /**
   * Create a Statistics instance.
   */
  constructor() {
    this.#stats = this.#loadStats();
    this.#achievements = ACHIEVEMENTS;
    this.#unlockedAchievements = new Set(this.#loadUnlocked());

    this.#bindEvents();
  }

  /**
   * Subscribe to game events for statistics tracking.
   */
  #bindEvents() {
    bus.on(STATISTICS.EVENTS.HAND_COMPLETE, (data) => {
      this.recordHand(data);
    });

    bus.on(STATISTICS.EVENTS.GAME_END, () => {
      this.#persistStats();
    });
  }

  /**
   * Load statistics from storage.
   */
  #loadStats() {
    const defaults = STATISTICS.DEFAULTS;
    try {
      const stored = localStorage.getItem(STATISTICS.KEY);
      if (stored) {
        return { ...defaults, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('[Statistics] Failed to load stats:', error);
    }
    return { ...defaults };
  }

  /**
   * Load unlocked achievements from storage.
   */
  #loadUnlocked() {
    try {
      const stored = localStorage.getItem(STATISTICS.ACHIEVEMENTS_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('[Statistics] Failed to load achievements:', error);
    }
    return [];
  }

  /**
   * Persist statistics to localStorage.
   */
  #persistStats() {
    try {
      localStorage.setItem(STATISTICS.KEY, JSON.stringify(this.#stats));
      localStorage.setItem(
        STATISTICS.ACHIEVEMENTS_KEY,
        JSON.stringify([...this.#unlockedAchievements])
      );
    } catch (error) {
      console.error('[Statistics] Failed to persist stats:', error);
    }
  }

  /**
   * Record a completed hand result.
   * @param {Object} result - Hand result data.
   */
  recordHand(result) {
    const { won, amount, netProfit, hand, anteBet, playBet, dealerQualifies } = result;

    // Update total hands played
    this.#stats.totalHandsPlayed++;

    // Update win/loss counts
    if (won) {
      this.#stats.wins++;
      this.recordWin(amount);
    } else {
      this.#stats.losses++;
      this.recordLoss(Math.abs(netProfit));
    }

    // Track push games
    if (!won && netProfit === 0) {
      this.#stats.pushes++;
    }

    // Update total amount wagered
    this.#stats.totalWagered += anteBet + playBet;

    // Update biggest win/loss
    if (won && amount > this.#stats.biggestWin) {
      this.#stats.biggestWin = amount;
    }
    if (!won && netProfit < 0 && Math.abs(netProfit) > this.#stats.biggestLoss) {
      this.#stats.biggestLoss = Math.abs(netProfit);
    }

    // Track current bankroll
    const currentBankroll = state.get('bankroll');
    if (currentBankroll > this.#stats.biggestBankroll) {
      this.#stats.biggestBankroll = currentBankroll;
    }

    // Track consecutive wins/losses
    if (won) {
      this.#stats.currentWinStreak++;
      this.#stats.maxWinStreak = Math.max(
        this.#stats.maxWinStreak,
        this.#stats.currentWinStreak
      );
      this.#stats.currentLossStreak = 0;
    } else if (netProfit < 0) {
      this.#stats.currentLossStreak++;
      this.#stats.maxLossStreak = Math.max(
        this.#stats.maxLossStreak,
        this.#stats.currentLossStreak
      );
      this.#stats.currentWinStreak = 0;
    }

    // Track hand type frequencies
    if (hand) {
      this.#stats.handFrequencies[hand] =
        (this.#stats.handFrequencies[hand] || 0) + 1;
    }

    // Track dealer qualification rate
    if (dealerQualifies !== undefined) {
      this.#stats.dealerQualifies++;
      this.#stats.dealerQualifyRate =
        this.#stats.dealerQualifies / this.#stats.totalHandsPlayed;
    }

    bus.emit(STATISTICS.EVENTS.UPDATED, { stats: this.#stats });
  }

  /**
   * Record a win event.
   * @param {number} amount - Total win amount.
   */
  recordWin(amount) {
    this.#stats.totalWon += amount;
    this.#stats.biggestWin = Math.max(this.#stats.biggestWin, amount);
  }

  /**
   * Record a loss event.
   * @param {number} amount - Total loss amount.
   */
  recordLoss(amount) {
    this.#stats.totalLost += amount;
    this.#stats.biggestLoss = Math.max(this.#stats.biggestLoss, amount);
  }

  /**
   * Get current statistics.
   * @returns {Object} Statistics object.
   */
  getStats() {
    const stats = { ...this.#stats };

    // Calculate derived statistics
    stats.winRate = this.calculateWinRate();
    stats.avgWin = this.calculateAverage('totalWon', 'wins');
    stats.avgLoss = this.calculateAverage('totalLost', 'losses');
    stats.netProfit = this.#stats.totalWon - this.#stats.totalLost;

    return stats;
  }

  /**
   * Calculate win rate percentage.
   */
  calculateWinRate() {
    if (this.#stats.totalHandsPlayed === 0) return 0;
    return (this.#stats.wins / this.#stats.totalHandsPlayed) * 100;
  }

  /**
   * Calculate average for a stat.
   */
  calculateAverage(totalKey, countKey) {
    const total = this.#stats[totalKey];
    const count = this.#stats[countKey];
    if (count === 0) return 0;
    return total / count;
  }

  /**
   * Check all achievements for unlocks.
   */
  checkAchievements() {
    const newUnlocks = [];

    for (const [id, achievement] of Object.entries(this.#achievements)) {
      if (this.#unlockedAchievements.has(id)) continue;

      if (this.#checkCondition(achievement.condition)) {
        this.#unlockedAchievements.add(id);
        newUnlocks.push({ id, name: achievement.name, description: achievement.description });
        bus.emit(STATISTICS.EVENTS.ACHIEVEMENT_UNLOCKED, {
          id,
          name: achievement.name,
          description: achievement.description,
        });
      }
    }

    this.#persistStats();
    return newUnlocks;
  }

  /**
   * Check if an achievement condition is met.
   */
  #checkCondition(condition) {
    switch (condition.type) {
      case 'totalHandsPlayed':
        return this.#stats.totalHandsPlayed >= condition.value;
      case 'wins':
        return this.#stats.wins >= condition.value;
      case 'biggestWin':
        return this.#stats.biggestWin >= condition.value;
      case 'maxWinStreak':
        return this.#stats.maxWinStreak >= condition.value;
      case 'totalWon':
        return this.#stats.totalWon >= condition.value;
      case 'netProfit':
        return (this.#stats.totalWon - this.#stats.totalLost) >= condition.value;
      default:
        return false;
    }
  }

  /**
   * Get unlocked achievements.
   */
  getUnlockedAchievements() {
    return [...this.#unlockedAchievements].map(id => ({
      id,
      ...this.#achievements[id],
    }));
  }

  /**
   * Get all achievements with unlock status.
   */
  getAllAchievements() {
    return Object.entries(this.#achievements).map(([id, achievement]) => ({
      id,
      ...achievement,
      unlocked: this.#unlockedAchievements.has(id),
    }));
  }

  /**
   * Get progress toward a specific achievement.
   */
  getAchievementProgress(achievementId) {
    const achievement = this.#achievements[achievementId];
    if (!achievement) return null;

    let current = 0;
    switch (achievement.condition.type) {
      case 'totalHandsPlayed':
        current = this.#stats.totalHandsPlayed;
        break;
      case 'wins':
        current = this.#stats.wins;
        break;
      case 'biggestWin':
        current = this.#stats.biggestWin;
        break;
      case 'maxWinStreak':
        current = this.#stats.maxWinStreak;
        break;
      case 'totalWon':
        current = this.#stats.totalWon;
        break;
      case 'netProfit':
        current = this.#stats.totalWon - this.#stats.totalLost;
        break;
    }

    return {
      achievementId,
      name: achievement.name,
      current,
      target: achievement.condition.value,
      unlocked: this.#unlockedAchievements.has(achievementId),
    };
  }

  /**
   * Reset all statistics.
   */
  resetStats() {
    this.#stats = STATISTICS.DEFAULTS;
    this.#persistStats();
    bus.emit(STATISTICS.EVENTS.UPDATED, { stats: this.#stats });
  }

  /**
   * Get hand frequency distribution.
   */
  getHandFrequencies() {
    return { ...this.#stats.handFrequencies };
  }

  /**
   * Export statistics as JSON string.
   */
  exportStats() {
    return JSON.stringify(this.getStats(), null, 2);
  }

  /**
   * Import statistics from JSON string.
   */
  importStats(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.#stats = { ...STATISTICS.DEFAULTS, ...imported };
      this.#persistStats();
      return true;
    } catch (error) {
      console.error('[Statistics] Import failed:', error);
      return false;
    }
  }

  /**
   * Get a summary string for display.
   */
  getSummary() {
    const stats = this.getStats();
    return `
      Hands Played: ${stats.totalHandsPlayed}
      Win Rate: ${stats.winRate.toFixed(1)}%
      Biggest Win: $${stats.biggestWin.toLocaleString()}
      Net Profit: $${stats.netProfit.toLocaleString()}
      Unlocked Achievements: ${this.#unlockedAchievements.size}/${Object.keys(this.#achievements).length}
    `.trim();
  }
}

// Export default instance for easy import
export const statistics = new Statistics();