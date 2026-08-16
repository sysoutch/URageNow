/**
 * Card - Represents a single playing card in the deck.
 *
 * Responsibilities:
 * - Store card suit and rank data
 * - Provide string/HTML representations of cards
 * - Support comparison operations for hand evaluation
 *
 * Dependencies: None
 *
 * Public API:
 * - suit       - The card's suit (hearts, diamonds, clubs, spades)
 * - rank       - The card's rank (2-14, where 14=Ace, 13=King, etc.)
 * - isRed()    - Returns true if the card is red (hearts or diamonds)
 * - toString() - Returns "Rank of Suit" format
 * - toValue()  - Returns HTML string for rendering
 */

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// Display mappings for ranks and suits
const RANK_DISPLAY = {
  14: 'A',
  13: 'K',
  12: 'Q',
  11: 'J',
};

const SUIT_SYMBOLS = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

const SUIT_SHORT = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S',
};

let cardInstanceCounter = 0;

export class Card {
  #id;
  #suit;
  #rank;
  #faceDown = false;

  /**
   * Create a new Card instance.
   * @param {number} rank - The card rank (2-14).
   * @param {string} suit - The card suit ('hearts', 'diamonds', 'clubs', 'spades').
   */
  constructor(rank, suit) {
    if (!RANKS.includes(rank)) {
      throw new Error(`Invalid card rank: ${rank}. Must be one of ${RANKS.join(', ')}`);
    }

    if (!SUITS.includes(suit)) {
      throw new Error(`Invalid card suit: ${suit}. Must be one of ${SUITS.join(', ')}`);
    }

    this.#id = ++cardInstanceCounter;
    this.#rank = rank;
    this.#suit = suit;
  }

  /**
   * Get the card instance ID.
   * @returns {number}
   */
  get id() {
    return this.#id;
  }

  /**
   * Get the card's suit.
   * @returns {string}
   */
  get suit() {
    return this.#suit;
  }

  /**
   * Get the card's rank.
   * @returns {number}
   */
  get rank() {
    return this.#rank;
  }

  /**
   * Check if the card is face down.
   * @returns {boolean}
   */
  get faceDown() {
    return this.#faceDown;
  }

  /**
   * Flip the card face up or down.
   * @param {boolean} [faceDown] - Whether to flip face down (default: toggle).
   */
  flip(faceDown) {
    if (faceDown === undefined) {
      this.#faceDown = !this.#faceDown;
    } else {
      this.#faceDown = Boolean(faceDown);
    }
  }

  /**
   * Check if the card is red.
   * @returns {boolean}
   */
  isRed() {
    return this.#suit === 'hearts' || this.#suit === 'diamonds';
  }

  /**
   * Get the display value for the rank.
   * @returns {string}
   */
  getRankDisplay() {
    return RANK_DISPLAY[this.#rank] || String(this.#rank);
  }

  /**
   * Get the suit symbol.
   * @returns {string}
   */
  getSuitSymbol() {
    return SUIT_SYMBOLS[this.#suit];
  }

  /**
   * Get the short suit notation (H, D, C, S).
   * @returns {string}
   */
  getShortNotation() {
    return `${this.getRankDisplay()}${SUIT_SHORT[this.#suit]}`;
  }

  /**
   * Compare this card with another for sorting.
   * @param {Card} other - Another Card instance.
   * @returns {number} Negative if less, zero if equal, positive if greater.
   */
  compareTo(other) {
    return this.#rank - other.rank;
  }

  /**
   * Check equality with another card.
   * @param {Card} other - Another Card instance.
   * @returns {boolean}
   */
  equals(other) {
    return this.#rank === other.rank && this.#suit === other.suit;
  }

  /**
   * Convert to string representation.
   * @returns {string}
   */
  toString() {
    const suitWord = this.#suit.charAt(0).toUpperCase() + this.#suit.slice(1);
    return `${this.getRankDisplay()} of ${suitWord}`;
  }

  /**
   * Generate HTML string for rendering the card.
   * @param {Object} [options] - Rendering options.
   * @param {boolean} [options.faceDown=false] - Whether to render face down.
   * @returns {string}
   */
  toHTML(options = {}) {
    const isFaceDown = options.faceDown || this.#faceDown;
    const suitClass = this.#suit;
    const rankClass = String(this.#rank).replace('.', '');
    const colorClass = this.isRed() ? 'red' : 'black';

    if (isFaceDown) {
      return `<div class="card card--face-down card--${suitClass}">
        <div class="card__face-back"></div>
      </div>`;
    }

    const centerSuit = this.getSuitSymbol();

    return `<div class="card card--face-up card--${suitClass}">
      <div class="card__face-front">
        <div class="card__corner card__corner--top-left">
          <span class="card__rank card__rank--${rankClass}">${this.getRankDisplay()}</span>
          <span class="card__suit-small">${this.getSuitSymbol()}</span>
        </div>
        <span class="card__center-suit">${centerSuit}</span>
        <div class="card__corner card__corner--bottom-right">
          <span class="card__rank card__rank--${rankClass}">${this.getRankDisplay()}</span>
          <span class="card__suit-small">${this.getSuitSymbol()}</span>
        </div>
      </div>
    </div>`;
  }

  /**
   * Create a Card from a string representation (e.g., "As", "10H").
   * @param {string} value - The card notation.
   * @returns {Card}
   */
  static fromString(value) {
    const rankMap = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11 };
    const suitMap = { 'H': 'hearts', 'D': 'diamonds', 'C': 'clubs', 'S': 'spades' };

    // Handle two-character notation (e.g., "As", "KH")
    if (value.length === 2) {
      const rank = rankMap[value[0]] || parseInt(value[0], 10);
      const suit = suitMap[value[1]];
      return new Card(rank, suit);
    }

    // Handle three-character notation for 10 (e.g., "10S")
    if (value.length === 3) {
      const rank = 10;
      const suit = suitMap[value[2]];
      return new Card(rank, suit);
    }

    throw new Error(`Invalid card notation: ${value}`);
  }

  /**
   * Create a deep copy of the card.
   * @returns {Card}
   */
  clone() {
    const copy = new Card(this.#rank, this.#suit);
    copy.flip(this.#faceDown);
    return copy;
  }
}

// Export constants for external use
export { SUITS, RANKS, RANK_DISPLAY, SUIT_SYMBOLS };
