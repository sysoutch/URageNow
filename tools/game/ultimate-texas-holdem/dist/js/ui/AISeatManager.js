/**
 * AISeatManager - Presents the engine's AI opponents around the table.
 *
 * The game remains a single-player settlement table, but every displayed AI
 * hand is drawn by GameEngine from the active deck and follows its street
 * events. Players only leave after a completed hand, never mid-hand.
 */
const TONES = ['jade', 'amber', 'ruby', 'violet', 'blue', 'gold'];
const SUITS = { hearts: '&hearts;', diamonds: '&diams;', clubs: '&clubs;', spades: '&spades;' };
const RANKS = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export class AISeatManager {
  #seats = [];
  #playerSeats = new Map();
  #timers = new Set();

  start(container) {
    this.stop();
    this.#seats = Array.from(container?.querySelectorAll('[data-ai-seat]') || [])
      .map((element) => ({ element, player: null, cards: [], reveal: false, action: '', handName: '' }));
  }

  stop() {
    this.#timers.forEach((timer) => window.clearTimeout(timer));
    this.#timers.clear();
  }

  /** Seat active opponents at random available positions for the next hand. */
  seatPlayers(players = []) {
    if (!this.#seats.length) {
      return;
    }

    this.stop();
    this.#playerSeats.clear();
    this.#seats.forEach((seat) => this.#clearSeat(seat));

    const shuffledSeats = [...this.#seats].sort(() => Math.random() - 0.5);
    players.slice(0, shuffledSeats.length).forEach((player, index) => {
      const seat = shuffledSeats[index];
      seat.player = { ...player, tone: TONES[index % TONES.length] };
      this.#playerSeats.set(player.id, seat);
      this.#renderSeat(seat, true);
    });
  }

  /** Show each opponent's real hole cards face down after the opening deal. */
  dealHands(players = []) {
    players.forEach((player) => {
      const seat = this.#playerSeats.get(player.id);
      if (!seat) {
        return;
      }
      seat.cards = [...(player.hand || [])];
      seat.reveal = false;
      seat.action = 'In hand';
      seat.handName = '';
      this.#renderSeat(seat);
    });
  }

  showAction({ playerId, action, amount = 0 }) {
    const seat = this.#playerSeats.get(playerId);
    if (!seat) {
      return;
    }

    seat.action = amount > 0 ? `${action} $${amount}` : action;
    this.#renderSeat(seat);
    const timer = window.setTimeout(() => {
      this.#timers.delete(timer);
      if (seat.player) {
        seat.action = 'In hand';
        this.#renderSeat(seat);
      }
    }, 2800);
    this.#timers.add(timer);
  }

  revealHands() {
    this.#playerSeats.forEach((seat) => {
      seat.reveal = true;
      seat.action = seat.action === 'Fold' ? 'Folded' : 'Showdown';
      this.#renderSeat(seat);
    });
  }

  setHandName(playerId, handName) {
    const seat = this.#playerSeats.get(playerId);
    if (!seat) {
      return;
    }
    seat.handName = handName || '';
    this.#renderSeat(seat);
  }

  /** Let opponents leave at varying times after showdown. */
  releasePlayers() {
    this.#playerSeats.forEach((seat, playerId) => {
      const timer = window.setTimeout(() => {
        this.#timers.delete(timer);
        seat.element.classList.add('is-leaving');
        const clearTimer = window.setTimeout(() => {
          this.#timers.delete(clearTimer);
          this.#playerSeats.delete(playerId);
          this.#clearSeat(seat);
        }, 540);
        this.#timers.add(clearTimer);
      }, 3500 + Math.floor(Math.random() * 5000));
      this.#timers.add(timer);
    });
  }

  #clearSeat(seat) {
    seat.player = null;
    seat.cards = [];
    seat.reveal = false;
    seat.action = '';
    seat.handName = '';
    seat.element.className = this.#baseClass(seat.element);
    seat.element.innerHTML = '';
  }

  #renderSeat(seat, arriving = false) {
    const { player } = seat;
    if (!player) {
      return;
    }

    seat.element.className = `${this.#baseClass(seat.element)} is-occupied${arriving ? ' is-arriving' : ''}`;
    seat.element.innerHTML = `
      <div class="ai-seat__avatar ai-seat__avatar--${player.tone}" aria-hidden="true">${this.#initials(player.name)}</div>
      <div class="ai-seat__meta">
        <span class="ai-seat__name">${player.name}</span>
        <span class="ai-seat__buy-in">${seat.handName || `stack $${player.bankroll}`}</span>
      </div>
      <div class="ai-seat__cards" aria-label="${player.name}'s cards">
        ${seat.cards.map((card) => this.#cardMarkup(card, seat.reveal)).join('')}
      </div>
      <span class="ai-seat__action">${seat.action}</span>
    `;

    if (arriving) {
      const timer = window.setTimeout(() => {
        this.#timers.delete(timer);
        seat.element.classList.remove('is-arriving');
      }, 750);
      this.#timers.add(timer);
    }
  }

  #cardMarkup(card, reveal) {
    if (!reveal) {
      return '<span class="ai-seat__card ai-seat__card--down" aria-hidden="true"></span>';
    }

    const rank = RANKS[card.rank] ?? card.rank;
    const suit = SUITS[card.suit] || '';
    const colorClass = card.suit === 'hearts' || card.suit === 'diamonds' ? 'is-red' : 'is-black';
    return `<span class="ai-seat__card ${colorClass}">${rank}<small>${suit}</small></span>`;
  }

  #initials(name) {
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  }

  #baseClass(element) {
    return Array.from(element.classList)
      .filter((className) => !['is-occupied', 'is-arriving', 'is-leaving'].includes(className))
      .join(' ');
  }
}
