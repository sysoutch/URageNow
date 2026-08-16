/**
 * Dealer - Handles all dealer logic for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Manage the dealer's hand and hole card
 * - Determine dealer qualification (dealer needs Ace-X or better)
 * - Control the dealing flow according to UTH rules
 *
 * Dependencies: EventBus, Card, Constants
 * Events emitted: 'dealerHandUpdated', 'dealerQualified'
 * Events consumed: 'gameStart'
 *
 * Public API:
 * - constructor()
 * - dealDealerCards(deck)
 * - checkQualification()
 * - revealHoleCard()
 */

import { bus } from '../core/EventBus.js';
import { CARD } from '../config/constants.js';

export class Dealer {
  #hand;
  #holeCard;
  #communityCards;
  #qualified;
  #_holeRevealed;

  /**
   * Create a Dealer instance.
   */
  constructor() {
    this.#hand = [];
    this.#holeCard = null;
    this.#communityCards = [];
    this.#qualified = false;

    // Subscribe to game events
    bus.on(CARD.EVENTS.GAME_START, this.#handleGameStart.bind(this));
  }

  /**
   * Handle game start event.
   */
  #handleGameStart() {
    this.reset();
  }

  /**
   * Deal the dealer's two hole cards from the deck.
   * @param {Array} deck - The current deck of cards.
   * @returns {Object} Object containing holeCard and dealtCards.
   */
  dealDealerCards(deck) {
    if (!deck || deck.length < 2) {
      console.warn('[Dealer] Not enough cards to deal dealer hand.');
      return { holeCard: null, dealtCards: [] };
    }

    // Deal two cards to the dealer (first card is face up, second is hole card)
    const dealtCards = [deck.pop(), deck.pop()];
    this.#hand = [...dealtCards];

    // The first card dealt is face up, second is the hole card
    this.#holeCard = dealtCards[1];

    bus.emit(CARD.EVENTS.DEALER_HAND_UPDATED, {
      hand: this.#hand,
      holeCard: this.#holeCard,
    });

    return { holeCard: this.#holeCard, dealtCards };
  }

  /**
   * Set community cards on the table.
   * @param {Array} cards - Community cards to set.
   */
  setCommunityCards(cards) {
    this.#communityCards = [...cards];
  }

  /**
   * Check if the dealer qualifies (Ace-X or better).
   * @returns {boolean} True if dealer qualifies.
   */
  checkQualification() {
    if (this.#hand.length < 2) {
      this.#qualified = false;
      return false;
    }

    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };

    const card1Rank = rankValues[this.#hand[0].rank] || 0;
    const card2Rank = rankValues[this.#hand[1].rank] || 0;

    const highCard = Math.max(card1Rank, card2Rank);
    const lowCard = Math.min(card1Rank, card2Rank);

    // Dealer qualifies with Ace-X or better
    this.#qualified = highCard === 14 && lowCard >= 10;

    bus.emit(CARD.EVENTS.DEALER_QUALIFIED, { qualified: this.#qualified });

    return this.#qualified;
  }

  /**
   * Get the dealer's face-up card.
   * @returns {Object|null} The face-up card or null.
   */
  getFaceUpCard() {
    return this.#hand[0] || null;
  }

  /**
   * Reveal the dealer's hole card (for display purposes).
   * @returns {Object|null} The hole card or null.
   */
  revealHoleCard() {
    return this.#holeCard;
  }

  /**
   * Check if the dealer has revealed their hole card.
   * @returns {boolean}
   */
  isHoleRevealed() {
    return !!this.#_holeRevealed;
  }

  /**
   * Mark the hole card as revealed.
   */
  revealHole() {
    this.#_holeRevealed = true;
  }

  /**
   * Get the dealer's full hand.
   * @returns {Array} The dealer's hand.
   */
  getHand() {
    return [...this.#hand];
  }

  /**
   * Get the community cards.
   * @returns {Array} The community cards.
   */
  getCommunityCards() {
    return [...this.#communityCards];
  }

  /**
   * Check if the dealer qualifies.
   * @returns {boolean} True if qualified.
   */
  isQualified() {
    return this.#qualified;
  }

  /**
   * Reset the dealer's state for a new round.
   */
  reset() {
    this.#hand = [];
    this.#holeCard = null;
    this.#communityCards = [];
    this.#qualified = false;
    this.#_holeRevealed = false;

    bus.emit(CARD.EVENTS.DEALER_RESET, {});
  }

  /**
   * Get the dealer's high card value.
   * @returns {number} High card value (2-14).
   */
  getHighCard() {
    if (this.#hand.length < 2) return 0;

    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
    const card1Rank = rankValues[this.#hand[0].rank] || 0;
    const card2Rank = rankValues[this.#hand[1].rank] || 0;

    return Math.max(card1Rank, card2Rank);
  }

  /**
   * Get the dealer's low card value.
   * @returns {number} Low card value (2-14).
   */
  getLowCard() {
    if (this.#hand.length < 2) return 0;

    const rankValues = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
    const card1Rank = rankValues[this.#hand[0].rank] || 0;
    const card2Rank = rankValues[this.#hand[1].rank] || 0;

    return Math.min(card1Rank, card2Rank);
  }
}