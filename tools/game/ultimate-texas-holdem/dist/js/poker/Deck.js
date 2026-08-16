/**
 * Deck - Manages a standard 52-card deck with shuffling and dealing capabilities.
 *
 * Responsibilities:
 * - Create and manage a full deck of cards
 * - Shuffle using Fisher-Yates algorithm (cryptographically secure)
 * - Deal cards to players and community areas
 * - Track remaining cards
 * - Support multiple deck cuts for casino-style play
 *
 * Dependencies: Card
 * Events emitted via EventBus: 'deckShuffled', 'cardDealt'
 *
 * Public API:
 * - constructor()              - Create a new full deck
 * - shuffle(securityLevel)     - Shuffle the deck securely
 * - deal(count, faceDown)      - Deal N cards
 * - dealHand(playerCount)      - Deal hands to players (2 each)
 * - dealCommunity(count)       - Deal community cards
 * - remaining                  - Get remaining card count
 * - isEmpty                    - Check if deck is empty
 * - reset()                    - Reset to full unshuffled deck
 */

import { Card, SUITS, RANKS } from './Card.js';
import { bus } from '../core/EventBus.js';

export class Deck {
  #cards;
  #discarded;

  /**
   * Create a new Deck instance.
   * @param {number} [deckCount=1] - Number of decks to use (for multi-deck games).
   */
  constructor(deckCount = 1) {
    this.#cards = [];
    this.#discarded = [];
    this.#reset(deckCount);
  }

  /**
   * Reset the deck to a full unshuffled state (sorted by suit).
   * @param {number} [deckCount=1] - Number of decks to create.
   */
  #reset(deckCount = 1) {
    this.#cards = [];

    for (let d = 0; d < deckCount; d++) {
      for (const suit of SUITS) {
        for (let rank = 2; rank <= 14; rank++) {
          this.#cards.push(new Card(rank, suit));
        }
      }
    }
  }

  /**
   * Shuffle the deck using Fisher-Yates algorithm with crypto randomness.
   * @param {'standard'|'casino'} [securityLevel='standard'] - Security level for shuffling.
   */
  shuffle(securityLevel = 'standard') {
    if (this.#cards.length < 5) {
      console.warn('[Deck] Cannot shuffle a deck with fewer than 5 cards.');
      return;
    }

    const getRandomInt = () => {
      if (securityLevel === 'casino' && window.crypto && window.crypto.getRandomValues) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        return array[0];
      }
      return Math.floor(Math.random() * 2147483648);
    };

    // Fisher-Yates shuffle
    for (let i = this.#cards.length - 1; i > 0; i--) {
      const j = getRandomInt() % (i + 1);
      [this.#cards[i], this.#cards[j]] = [this.#cards[j], this.#cards[i]];
    }

    // Casino-style cut: split deck in half and swap
    if (securityLevel === 'casino') {
      const cutPoint = Math.floor(this.#cards.length / 2);
      const top = this.#cards.splice(0, cutPoint);
      const bottom = this.#cards;
      this.#cards = [...bottom, ...top];
    }

    bus.emit('deckShuffled', { count: this.#cards.length });
  }

  /**
   * Deal a specified number of cards from the top of the deck.
   * @param {number} count - Number of cards to deal.
   * @param {boolean} [faceDown=false] - Whether dealt cards are face down.
   * @returns {Card[]} Array of Card instances.
   */
  deal(count = 1, faceDown = false) {
    if (count <= 0) return [];

    if (this.#cards.length < count) {
      console.warn(`[Deck] Not enough cards! Need ${count}, have ${this.#cards.length}.`);
    }

    const dealtCount = Math.min(count, this.#cards.length);
    const dealtCards = [];

    for (let i = 0; i < dealtCount; i++) {
      const card = this.#cards.pop();
      if (faceDown) {
        card.flip(true);
      } else {
        card.flip(false);
      }
      dealtCards.push(card);
      bus.emit('cardDealt', { card: card.clone(), index: i });
    }

    return dealtCards;
  }

  /**
   * Deal initial hands to players (2 cards each).
   * @param {number} playerCount - Number of players.
   * @param {'hole'|'up'} [cardStyle='hole'] - Whether first card is face down.
   * @returns {Object[]} Array of { playerIndex, hand } objects.
   */
  dealHands(playerCount, cardStyle = 'hole') {
    const hands = [];

    for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
      const isFaceDown = cardStyle === 'hole';
      const hand = this.deal(2, isFaceDown);
      hands.push({ playerIndex, hand });
    }

    return hands;
  }

  /**
   * Deal community cards (flop, turn, river).
   * @param {number} count - Number of community cards to deal.
   * @returns {Card[]} Array of Card instances.
   */
  dealCommunity(count = 1) {
    // Community cards are always face up
    return this.deal(count, false);
  }

  /**
   * Deal the dealer's hand (hole card + visible card).
   * @returns {Card[]} Array of 2 Card instances.
   */
  dealDealerHand() {
    const holeCard = this.deal(1, true)[0]; // Hole card face down
    const upCard = this.deal(1, false)[0]; // Visible card face up
    return [holeCard, upCard];
  }

  /**
   * Get the top card without dealing it (for burn cards).
   * @returns {Card|null}
   */
  peekTop() {
    if (this.isEmpty()) return null;
    return this.#cards[this.#cards.length - 1];
  }

  /**
   * Burn a card (move top card to discard pile, common in poker).
   */
  burn() {
    if (!this.isEmpty()) {
      const burned = this.#cards.pop();
      this.#discarded.push(burned);
      bus.emit('cardBurned', { card: burned });
    }
  }

  /**
   * Get the number of remaining cards.
   * @returns {number}
   */
  get remaining() {
    return this.#cards.length;
  }

  /**
   * Check if the deck is empty.
   * @returns {boolean}
   */
  isEmpty() {
    return this.#cards.length === 0;
  }

  /**
   * Get all cards in the current deck (for testing/debugging).
   * @returns {Card[]}
   */
  getCards() {
    return [...this.#cards];
  }

  /**
   * Get discarded pile count.
   * @returns {number}
   */
  getDiscardedCount() {
    return this.#discarded.length;
  }

  /**
   * Reset and shuffle the deck for a new round.
   */
  resetAndShuffle() {
    const deckCount = this.#getDeckCount();
    this.#cards = [];
    this.#discarded = [];
    this.#reset(deckCount);
    this.shuffle('casino');
  }

  /**
   * Get the number of decks in use (inferred from card count).
   * @returns {number}
   */
  #getDeckCount() {
    const totalCards = this.#cards.length;
    if (totalCards === 0) return 1;
    const cardsPerDeck = SUITS.length * RANKS.length;
    return Math.max(1, Math.round(totalCards / cardsPerDeck));
  }

  /**
   * Get card indices for debugging display.
   * @returns {string[]} Array of card notations.
   */
  toStringArray() {
    return this.#cards.map(card => card.getShortNotation());
  }
}