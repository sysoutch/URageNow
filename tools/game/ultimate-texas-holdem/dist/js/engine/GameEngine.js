/**
 * GameEngine - Central orchestrator for the Ultimate Texas Hold'em game loop.
 *
 * Responsibilities:
 * - Manage the complete game flow from deal to payout
 * - Coordinate between Deck, BettingEngine, HandEvaluator, and PayoutEngine
 * - Handle dealer logic (qualifying hand, revealing cards)
 * - Process community card dealing with burn cards
 * - Track round state and transitions
 * - Emit events for UI updates
 *
 * Dependencies: EventBus, StateManager, Deck, Player, BettingEngine, HandEvaluator, PayoutEngine
 * Events consumed: 'gameReady'
 * Events emitted: 'roundStart', 'cardsDealt', 'handEvaluated', 'payoutComplete', 'gameEnd'
 *
 * Public API:
 * - constructor(players, deck)
 * - init()                 - Initialize the engine (creates default players/deck if needed)
 * - startRound()           - Begin a new round of Ultimate Texas Hold'em
 * - dealCards()            - Deal all cards (player hands + community)
 * - evaluateHands()        - Evaluate all hands and determine winners
 * - processPayouts()       - Calculate and distribute payouts
 * - reset()                - Reset game state for a new session
 */

import { bus } from '../core/EventBus.js';
import { state } from '../core/StateManager.js';
import { Deck } from '../poker/Deck.js';
import { HandEvaluator, HAND_RANKINGS as EVALUATOR_RANKINGS } from '../poker/HandEvaluator.js';
import { dealerMeetsQualification } from '../poker/DealerQualification.js';
import { BettingEngine } from './BettingEngine.js';
import { PayoutEngine } from './PayoutEngine.js';
import { resolveMainHandOutcome } from './MainHandOutcome.js';
import { EVENTS, MIN_ANTE, ANIMATION_DURATIONS } from '../config/constants.js';

export class GameEngine {
  #players;
  #deck;
  #bettingEngine;
  #payoutEngine;
  #communityCards;
  #dealerHand;
  #currentRoundIndex;
  #isProcessing;
  #roundData;
  #humanPlayer;
  #aiActionTimers;

  /**
   * Create a GameEngine instance.
   * @param {Array} [players] - Optional array of player configurations.
   * @param {Deck} [deck] - Optional deck instance.
   */
  constructor(players, deck) {
    this.#players = players || [];
    this.#deck = deck || null;
    this.#bettingEngine = null;
    this.#payoutEngine = new PayoutEngine('STANDARD');
    this.#communityCards = [];
    this.#dealerHand = [];
    this.#currentRoundIndex = 0;
    this.#isProcessing = false;
    this.#roundData = null;
    this.#humanPlayer = null;
    this.#aiActionTimers = new Set();

    this.#bindEvents();
  }

  /**
   * Initialize the engine with default players and deck.
   */
  async init() {
    // Ultimate Texas Hold'em uses one standard 52-card deck.
    this.#deck = new Deck();

    // Create human player + AI opponents
    const playerConfigs = [
      { name: 'You', isAI: false, aiType: null },
      { name: 'Bot Alice', isAI: true, aiType: 'balanced' },
      { name: 'Bot Bob', isAI: true, aiType: 'tight' },
      { name: 'Bot Charlie', isAI: true, aiType: 'loose' },
    ];

    const Player = (await import('../players/Player.js')).Player;
    this.#players = playerConfigs.map((config, index) => new Player({
      ...config,
      bankroll: index === 0 ? state.get('bankroll') || 1000 : 500 + (index * 250),
    }));

    this.#humanPlayer = this.#players[0];

    // Initialize betting engine
    this.#bettingEngine = new BettingEngine(state, this.#players, this.#deck);

    console.log('[GameEngine] Engine initialized with', this.#players.length, 'players.');
  }

  /**
   * Subscribe to game-level events.
   */
  #bindEvents() {
    // Handle ante bet placement from UI
    bus.on(EVENTS.BET_PLACED, async (data) => {
      if (!this.#isProcessing || !this.#humanPlayer) return;

      const currentRound = state.get('round');
      const usesOfficialRules = this.#usesOfficialRules();

      if (data.type === 'ante' && data.playerId === 0 && currentRound === 'ante') {
        console.log('[GameEngine] Ante bet received:', data.amount);
        if (!this.#setOpeningBets(data.amount, usesOfficialRules)) return;

        // Sync StateManager so UI can read anteBet
        state.set({
          phase: 'ante-placed',
          anteBet: data.amount,
          blindBet: usesOfficialRules ? data.amount : 0,
        });
        bus.emit(EVENTS.ROUND_START, { round: 'ante', timestamp: Date.now() });
        console.log('[GameEngine] Ante accepted - waiting for play bet.');
      }

      if (data.type === 'trips' && data.playerId === 0 && currentRound === 'ante') {
        console.log('[GameEngine] Trips bet received:', data.amount);
        if (!this.#humanPlayer.setTripsBet(data.amount)) return;

        state.set({ tripsBet: data.amount });
        bus.emit(EVENTS.ROUND_START, { round: 'ante', timestamp: Date.now() });
      }

    });

    // Handle player actions across the round flow
    bus.on(EVENTS.USER_ACTION, async (data) => {
      if (!this.#isProcessing || !this.#humanPlayer) return;

      const currentRound = state.get('round');

      switch (currentRound) {
        case 'ante':
          if (data.action === 'deal') {
            await this.#dealOpeningHand();
          }
          break;
        case 'preflop':
        case 'flop':
        case 'river':
          await this.#handleStreetAction(currentRound, data.action, data.amount);
          break;
      }
    });

    // Handle new round request from UI
    bus.on(EVENTS.NEW_ROUND_REQUESTED, () => {
      if (this.#isProcessing) return;
      console.log('[GameEngine] New round requested - starting fresh.');
      this.startRound();
    });

    bus.on(EVENTS.CASH_ADDED, (data) => {
      if (!this.#humanPlayer) return;

      const amount = Number(data?.amount) || 0;
      if (amount <= 0) return;

      this.#humanPlayer.bankroll += amount;
      state.adjustBankroll(amount);
      console.log(`[GameEngine] Added $${amount} to bankroll.`);
    });
  }

  /**
   * Start a new round of Ultimate Texas Hold'em.
   */
  startRound() {
    if (this.#isProcessing) return;

    const previousState = state.get();
    const previousAnteBet = previousState.anteBet || 0;
    const usesOfficialRules = this.#usesOfficialRules(previousState.tableRulePreset);
    const previousTripsBet = previousState.tripsBet || 0;
    const previousPlayMultiplier = previousState.preflopRaiseMode === 'THREE_ONLY'
      ? 3
      : previousState.selectedPlayMultiplier || 3;

    this.#isProcessing = true;
    this.#communityCards = [];
    this.#dealerHand = [];
    this.#currentRoundIndex = 0;
    this.#clearAiActionTimers();

    // Reset all players for the new round
    for (const player of this.#players) {
      player.resetHand();
    }

    if (this.#humanPlayer) {
      this.#humanPlayer.bankroll = previousState.bankroll || 0;
    }

    // Reset deck and shuffle
    if (!this.#deck || this.#deck.remaining < 10) {
      this.#deck = new Deck();
    } else {
      this.#deck.resetAndShuffle();
    }

    const repeatTripsBet = this.#clampRepeatBet(
      previousTripsBet,
      this.#humanPlayer?.bankroll || 0
    );
    const repeatAnteBet = this.#clampRepeatBet(previousAnteBet, this.#humanPlayer?.bankroll || 0);
    const legalRepeatAnteBet = this.#clampOpeningBetForRules(
      repeatAnteBet,
      this.#humanPlayer?.bankroll || 0,
      repeatTripsBet,
      usesOfficialRules
    );
    const legalRepeatTripsBet = this.#clampRepeatBet(
      repeatTripsBet,
      this.#getMaxTripsForAnte(legalRepeatAnteBet, this.#humanPlayer?.bankroll || 0, usesOfficialRules)
    );

    if (this.#humanPlayer) {
      this.#humanPlayer.setAnteBet(legalRepeatAnteBet);
      this.#humanPlayer.setBlindBet(usesOfficialRules ? legalRepeatAnteBet : 0);
      this.#humanPlayer.setTripsBet(legalRepeatTripsBet);
    }

    // Reset state for fresh ante round while preserving the user's last opening setup
    state.set({
      round: 'ante',
      phase: legalRepeatAnteBet > 0 ? 'ante-placed' : 'betting',
      anteBet: legalRepeatAnteBet,
      blindBet: usesOfficialRules ? legalRepeatAnteBet : 0,
      playBet: 0,
      tripsBet: legalRepeatTripsBet,
      selectedPlayMultiplier: previousPlayMultiplier,
    });
    bus.emit(EVENTS.ROUND_START, {
      round: 'ante',
      freshStart: true,
      aiPlayers: this.#getAiTablePlayers(),
      timestamp: Date.now(),
    });

    // Start with ante betting - wait for user input
    if (this.#bettingEngine) {
      this.#bettingEngine.startAnteRound();
    }

    console.log('[GameEngine] Round started - Ante betting open. Waiting for user to place ante.');
  }

  /**
   * Deal all cards for the current round.
   */
  dealCards() {
    if (!this.#deck) return;

    // Deal 2 cards to each player (hole cards)
    for (const player of this.#players) {
      const hand = this.#deck.deal(2, true); // Face down
      player.setHand(hand);
    }

    // Deal dealer's hole card and upcard
    this.#dealerHand = this.#deck.dealDealerHand();

    // Emit actual card objects for UI rendering
    bus.emit(EVENTS.CARDS_DEALT, {
      holeCards: this.#humanPlayer?.hand || [],
      communityCards: [],
      dealerHand: this.#dealerHand.length > 0 ? [...this.#dealerHand] : [],
      playerHands: this.#players.map(p => ({ playerIndex: p.id, hand: p.hand })),
      aiPlayers: this.#getAiTablePlayers(true),
    });

    console.log('[GameEngine] Cards dealt to all players and dealer.');
  }

  /**
   * Deal opening hole cards and wait for the first decision.
   */
  async #dealOpeningHand() {
    this.dealCards();
    state.set({ round: 'preflop', phase: 'decision', playBet: 0 });
    this.#humanPlayer.prepareForAction();
    bus.emit(EVENTS.ROUND_START, { round: 'preflop', timestamp: Date.now() });
    this.#queueAiActions('preflop');
    console.log('[GameEngine] Opening hand dealt. Waiting for preflop action.');
  }

  /**
   * Handle player decisions after the ante is locked in.
   */
  async #handleStreetAction(currentRound, action, amount) {
    if (action === 'bet' && !this.#canAffordPlayBet(amount || this.#getStreetBetAmount(currentRound))) {
      bus.emit(EVENTS.BET_INVALID, {
        type: 'play',
        amount: amount || this.#getStreetBetAmount(currentRound),
        available: this.#humanPlayer.bankroll,
        message: `Not enough cash for this Play bet. Available: $${this.#humanPlayer.bankroll}.`,
      });
      return;
    }

    if (currentRound === 'preflop') {
      if (action === 'check') {
        if (!this.#humanPlayer.actionCheck()) return;
        await this.#dealFlop();
      } else if (action === 'bet') {
        const betAmount = amount || this.#getStreetBetAmount('preflop');
        if (!this.#humanPlayer.actionRaise(betAmount)) return;
        state.set({ playBet: this.#humanPlayer.playBet, phase: 'dealing' });
        await this.#revealRunoutAndShowdown('preflop');
      }
      return;
    }

    if (currentRound === 'flop') {
      if (action === 'check') {
        if (!this.#humanPlayer.actionCheck()) return;
        await this.#dealTurnAndRiverDecision();
      } else if (action === 'bet') {
        const betAmount = amount || this.#getStreetBetAmount('flop');
        if (!this.#humanPlayer.actionRaise(betAmount)) return;
        state.set({ playBet: this.#humanPlayer.playBet, phase: 'dealing' });
        await this.#revealRunoutAndShowdown('flop');
      }
      return;
    }

    if (currentRound === 'river') {
      if (action === 'fold') {
        if (!this.#humanPlayer.actionFold()) return;
        this.#proceedToShowdown();
        return;
      }

      if (action === 'bet') {
        const betAmount = amount || this.#getStreetBetAmount('river');
        if (!this.#humanPlayer.actionRaise(betAmount)) return;
        state.set({ playBet: this.#humanPlayer.playBet, phase: 'dealing' });
        await this.#delay(ANIMATION_DURATIONS.revealCards);
        this.#proceedToShowdown();
      }
    }
  }

  /**
   * Reveal the flop and wait for the post-flop decision.
   */
  async #dealFlop() {
    await this.#delay(ANIMATION_DURATIONS.revealCards);

    this.#deck.burn();
    const flop = this.#deck.dealCommunity(3);
    this.#communityCards = [...flop];
    state.set({ round: 'flop', phase: 'betting' });
    this.#humanPlayer.prepareForAction();
    bus.emit(EVENTS.CARDS_DEALT, { communityCards: [...this.#communityCards] });
    bus.emit(EVENTS.ROUND_START, { round: 'flop', timestamp: Date.now() });
    this.#queueAiActions('flop');
    console.log('[GameEngine] Flop dealt. Waiting for post-flop action.');
  }

  /**
   * Reveal the turn and river before the final river decision.
   */
  async #dealTurnAndRiverDecision() {
    await this.#delay(ANIMATION_DURATIONS.revealCards);

    if (state.get('round') !== 'flop') return;

    this.#deck.burn();
    const turn = this.#deck.dealCommunity(1);
    this.#communityCards = [...this.#communityCards, ...turn];
    state.set({ round: 'turn', phase: 'dealing' });
    bus.emit(EVENTS.CARDS_DEALT, { communityCards: [...this.#communityCards] });
    bus.emit(EVENTS.ROUND_START, { round: 'turn', timestamp: Date.now() });
    console.log('[GameEngine] Turn dealt.');

    await this.#delay(ANIMATION_DURATIONS.revealCards);

    this.#deck.burn();
    const river = this.#deck.dealCommunity(1);
    this.#communityCards = [...this.#communityCards, ...river];
    state.set({ round: 'river', phase: 'betting' });
    this.#humanPlayer.prepareForAction();
    bus.emit(EVENTS.CARDS_DEALT, { communityCards: [...this.#communityCards] });
    bus.emit(EVENTS.ROUND_START, { round: 'river', timestamp: Date.now() });
    this.#queueAiActions('river');
    console.log('[GameEngine] River dealt. Final betting open.');
  }

  /**
   * Reveal any remaining community cards and continue to showdown.
   */
  async #revealRunoutAndShowdown(fromRound) {
    if (fromRound === 'preflop') {
      await this.#dealFlop();
      state.set({ round: 'flop', phase: 'dealing', playBet: this.#humanPlayer.playBet });
    }

    if (fromRound === 'preflop' || fromRound === 'flop') {
      await this.#delay(ANIMATION_DURATIONS.revealCards);

      this.#deck.burn();
      const turn = this.#deck.dealCommunity(1);
      this.#communityCards = [...this.#communityCards, ...turn];
      state.set({ round: 'turn', phase: 'dealing' });
      bus.emit(EVENTS.CARDS_DEALT, { communityCards: [...this.#communityCards] });
      bus.emit(EVENTS.ROUND_START, { round: 'turn', timestamp: Date.now() });
      console.log('[GameEngine] Turn dealt.');

      await this.#delay(ANIMATION_DURATIONS.revealCards);

      this.#deck.burn();
      const river = this.#deck.dealCommunity(1);
      this.#communityCards = [...this.#communityCards, ...river];
      state.set({ round: 'river', phase: null });
      bus.emit(EVENTS.CARDS_DEALT, { communityCards: [...this.#communityCards] });
      bus.emit(EVENTS.ROUND_START, { round: 'river', timestamp: Date.now() });
      this.#queueAiActions('river');
      console.log('[GameEngine] River dealt.');
    }

    await this.#delay(ANIMATION_DURATIONS.revealCards);
    this.#proceedToShowdown();
  }

  /**
   * Get the correct post-flop bet size for the current street.
   */
  #getStreetBetAmount(roundName = state.get('round')) {
    const anteBet = this.#humanPlayer?.anteBet || 0;
    const selectedPlayMultiplier = state.get('selectedPlayMultiplier') || 3;

    if (roundName === 'preflop') {
      return anteBet * selectedPlayMultiplier;
    }

    if (roundName === 'flop') {
      return anteBet * 2;
    }

    if (roundName === 'river') {
      return anteBet;
    }

    return 0;
  }

  /**
   * Proceed to showdown phase.
   */
  async #proceedToShowdown() {
    state.set({ round: 'showdown', phase: 'evaluating' });
    bus.emit(EVENTS.SHOWDOWN_START);

    await this.#delay(ANIMATION_DURATIONS.revealCards);
    await this.#evaluateHands();
  }

  /**
   * Evaluate all hands and determine winners.
   */
  async #evaluateHands() {
    console.log('[GameEngine] Evaluating hands...');

    // Reveal dealer's hole card
    if (this.#dealerHand.length === 2) {
      this.#dealerHand[0].flip(false);
    }

    // Evaluate each player's hand (2 hole + 5 community = 7 cards)
    const evaluations = [];

    for (const player of this.#players) {
      const isHumanPlayer = player === this.#humanPlayer;
      const shouldEvaluateTrips = player.tripsBet > 0;
      if ((!player.isActive || player.isFolded) && !shouldEvaluateTrips && !isHumanPlayer) continue;

      // Filter out any null/undefined cards to prevent evaluation errors
      const allCards = [...player.hand, ...this.#communityCards].filter(c => c != null);

      if (allCards.length < 2) {
        console.warn(`[GameEngine] Player ${player.name} has insufficient cards (${allCards.length}). Skipping.`);
        continue;
      }

      const result = HandEvaluator.evaluate(allCards);
      evaluations.push({ playerId: player.id, playerName: player.name, hand: result });

      bus.emit(EVENTS.HAND_EVALUATED, {
        playerId: player.id,
        playerName: player.name,
        hand: result,
      });
    }

    // Evaluate dealer's hand
    const dealerAllCards = [...this.#dealerHand, ...this.#communityCards].filter(c => c != null);

    if (dealerAllCards.length < 2) {
      console.warn('[GameEngine] Dealer has insufficient cards. Skipping evaluation.');
      await this.#endRound();
      return;
    }

    const dealerResult = HandEvaluator.evaluate(dealerAllCards);
    const dealerQualificationEnabled = state.get('dealerQualificationEnabled') !== false;
    const dealerQualifies = dealerQualificationEnabled
      ? dealerMeetsQualification(dealerResult, state.get('dealerQualificationMinimum'))
      : true;

    evaluations.push({ playerId: 'dealer', playerName: 'Dealer', hand: dealerResult, isDealer: true });

    bus.emit(EVENTS.HAND_EVALUATED, {
      playerId: 'dealer',
      playerName: 'Dealer',
      isDealer: true,
      hand: dealerResult,
      qualifies: dealerQualifies,
    });

    await this.#processPayouts(evaluations, dealerQualifies);
  }

  /**
   * Process payouts for all players.
   */
  async #processPayouts(evaluations, dealerQualifies) {
    console.log('[GameEngine] Processing payouts...');

    if (!this.#humanPlayer) return;

    // Find human player's evaluation
    const humanEval = evaluations.find(e => e.playerId === this.#humanPlayer.id);
    if (!humanEval || !humanEval.hand) {
      console.warn('[GameEngine] No valid hand evaluation found for human player.');
      await this.#endRound();
      return;
    }

    // Calculate payout
    const anteBet = this.#humanPlayer.anteBet;
    const playBet = this.#humanPlayer.playBet;
    const tripsBet = this.#humanPlayer.tripsBet;
    const blindBet = this.#humanPlayer.blindBet;
    const dealerEval = evaluations.find(e => e.playerId === 'dealer');
    const comparison = dealerEval?.hand
      ? HandEvaluator.compare(humanEval.hand, dealerEval.hand)
      : 0;

    const result = this.#payoutEngine.calculatePayouts(
      humanEval.hand,
      dealerEval?.hand || null,
      anteBet,
      playBet,
      dealerQualifies,
      comparison,
      tripsBet,
      this.#humanPlayer.isFolded,
      {
        blindBet,
        tableRulePreset: state.get('tableRulePreset'),
        pushMainBetsWhenDealerDisqualified: state.get('dealerQualificationEnabled') !== false,
        dealerDisqualifiedAnteMode: state.get('dealerDisqualifiedAnteMode'),
      }
    );

    // Apply payout to bankroll
    if (result.netProfit !== 0) {
      state.adjustBankroll(result.netProfit);
    }

    // Record hand result for statistics
    state.recordHand({
      won: result.netProfit > 0,
      amount: result.totalWon,
      netProfit: result.netProfit,
      hand: humanEval.hand.name,
      dealerQualifies,
      anteBet,
      blindBet,
      playBet,
      tripsBet,
      timestamp: Date.now(),
    });

    const mainHandOutcome = resolveMainHandOutcome({
      comparison,
      isFolded: this.#humanPlayer.isFolded,
      dealerQualifies,
      dealerQualificationEnabled: state.get('dealerQualificationEnabled') !== false,
    });

    bus.emit(EVENTS.PAYOUT_COMPLETE, {
      player: this.#humanPlayer.name,
      hand: humanEval.hand.name,
      playerHandName: humanEval.hand.name,
      dealerHandName: dealerEval?.hand?.name || 'Unknown',
      outcomeLabel: mainHandOutcome,
      result,
    });

    console.log(`[GameEngine] Payout complete. Net profit: ${result.netProfit}`);

    await this.#endRound();
  }

  /**
   * Complete the round and prepare for next one.
   */
  async #endRound() {
    this.#clearAiActionTimers();
    state.set({ round: 'idle', phase: null });
    bus.emit(EVENTS.ROUND_END, { timestamp: Date.now() });
    bus.emit(EVENTS.GAME_END);

    this.#isProcessing = false;
    console.log('[GameEngine] Round complete.');
  }

  /**
   * Reset the game engine for a new session.
   */
  reset() {
    this.#communityCards = [];
    this.#dealerHand = [];
    if (this.#bettingEngine) {
      this.#bettingEngine.reset();
    }
    state.reset();
    console.log('[GameEngine] Engine reset.');
  }

  /**
   * Get the current community cards.
   */
  get communityCards() {
    return [...this.#communityCards];
  }

  /**
   * Check if the engine is currently processing a round.
   */
  get isProcessing() {
    return this.#isProcessing;
  }

  /**
   * Get the human player instance.
   */
  get humanPlayer() {
    return this.#humanPlayer || this.#players.find(p => !p.isAI);
  }

  /**
   * Handle a user action (betting decision).
   * @param {string} action - Action type ('check', 'call', 'raise', 'fold').
   * @param {number} [amount=0] - Bet amount for raise/call.
   */
  handleUserAction(action, amount = 0) {
    const humanPlayer = this.humanPlayer;
    if (!humanPlayer || humanPlayer.isFolded) return;

    switch (action) {
      case 'check':
        humanPlayer.actionCheck();
        break;
      case 'call':
        humanPlayer.actionCall(amount);
        break;
      case 'raise':
        humanPlayer.actionRaise(amount);
        break;
      case 'fold':
        humanPlayer.actionFold();
        break;
      default:
        console.warn(`[GameEngine] Unknown action: ${action}`);
    }

    bus.emit(EVENTS.USER_ACTION, { action, amount, playerId: humanPlayer.id });
  }

  /**
   * Utility delay function for async animations.
   */
  #delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Return safe public data for AI seats without exposing player instances. */
  #getAiTablePlayers(includeHands = false) {
    return this.#players
      .filter((player) => player.isAI)
      .map((player) => ({
        id: player.id,
        name: player.name,
        bankroll: player.bankroll,
        aiType: player.aiType,
        ...(includeHands ? { hand: player.hand } : {}),
      }));
  }

  /** Queue visible AI decisions in sync with the currently open street. */
  #queueAiActions(roundName) {
    this.#clearAiActionTimers();
    const anteBet = this.#humanPlayer?.anteBet || MIN_ANTE;

    this.#players.filter((player) => player.isAI).forEach((player, index) => {
      const timer = window.setTimeout(() => {
        this.#aiActionTimers.delete(timer);
        if (state.get('round') !== roundName) {
          return;
        }

        bus.emit(EVENTS.AI_ACTION, {
          playerId: player.id,
          playerName: player.name,
          round: roundName,
          ...this.#getAiDecision(player.aiType, roundName, anteBet),
        });
      }, 350 + (index * 420) + Math.floor(Math.random() * 320));
      this.#aiActionTimers.add(timer);
    });
  }

  /** Use lightweight personality weights for visual AI decisions. */
  #getAiDecision(aiType, roundName, anteBet) {
    const roll = Math.random();
    const aggression = { tight: 0.25, balanced: 0.5, loose: 0.68 }[aiType] ?? 0.5;

    if (roundName === 'river' && roll < 0.22 - (aggression * 0.12)) {
      return { action: 'Fold', amount: 0 };
    }

    if (roll < 0.54 - (aggression * 0.26)) {
      return { action: 'Check', amount: 0 };
    }

    const multiplier = roundName === 'preflop'
      ? (aggression > 0.6 && roll > 0.8 ? 4 : 3)
      : roundName === 'flop' ? 2 : 1;
    return { action: `Bet ${multiplier}x`, amount: anteBet * multiplier };
  }

  #clearAiActionTimers() {
    this.#aiActionTimers.forEach((timer) => window.clearTimeout(timer));
    this.#aiActionTimers.clear();
  }

  /**
   * Keep repeated bets legal for the next round and aligned to table chip units.
   */
  #clampRepeatBet(amount, maxAmount) {
    if (amount <= 0 || maxAmount < MIN_ANTE) {
      return 0;
    }

    return Math.max(0, Math.min(amount, Math.floor(maxAmount / MIN_ANTE) * MIN_ANTE));
  }

  /**
   * Whether the current table uses the official rules preset.
   * @param {string} [preset=state.get('tableRulePreset')] - Optional preset override.
   * @returns {boolean}
   */
  #usesOfficialRules(preset = state.get('tableRulePreset')) {
    return preset !== 'legacy';
  }

  /**
   * Set the opening wagers while respecting the selected rules preset.
   * @param {number} anteAmount - Desired ante amount.
   * @param {boolean} usesOfficialRules - Whether blind must mirror ante.
   * @returns {boolean}
   */
  #setOpeningBets(anteAmount, usesOfficialRules) {
    if (!this.#humanPlayer) return false;

    const currentAnte = this.#humanPlayer.anteBet;
    const currentBlind = this.#humanPlayer.blindBet;
    const currentTrips = this.#humanPlayer.tripsBet;
    const availableBankroll = this.#humanPlayer.bankroll + currentAnte + currentBlind;
    const maxAnte = this.#clampOpeningBetForRules(
      anteAmount,
      availableBankroll,
      currentTrips,
      usesOfficialRules
    );

    if (maxAnte !== anteAmount) {
      return false;
    }

    if (!this.#humanPlayer.setAnteBet(anteAmount)) return false;
    return this.#humanPlayer.setBlindBet(usesOfficialRules ? anteAmount : 0);
  }

  /**
   * Max legal trips wager after reserving the opening wager structure.
   * @param {number} anteAmount - Current ante amount.
   * @param {number} bankroll - Available bankroll.
   * @param {boolean} usesOfficialRules - Whether blind mirrors ante.
   * @returns {number}
   */
  #getMaxTripsForAnte(anteAmount, bankroll, usesOfficialRules) {
    const openingCost = usesOfficialRules ? anteAmount * 2 : anteAmount;
    return Math.max(0, bankroll - openingCost);
  }

  /**
   * Clamp the ante against the currently selected rules preset.
   * @param {number} anteAmount - Requested ante amount.
   * @param {number} bankroll - Available bankroll.
   * @param {number} tripsBet - Current trips bet.
   * @param {boolean} usesOfficialRules - Whether blind mirrors ante.
   * @returns {number}
   */
  #clampOpeningBetForRules(anteAmount, bankroll, tripsBet, usesOfficialRules) {
    const usableBankroll = Math.max(0, bankroll - tripsBet);
    const divisor = usesOfficialRules ? 2 : 1;
    const maxAnte = Math.floor(usableBankroll / divisor / MIN_ANTE) * MIN_ANTE;
    return Math.max(0, Math.min(anteAmount, maxAnte));
  }

  /**
   * Reject unaffordable Play wagers instead of silently turning them into partial all-in bets.
   * @param {number} amount - Required Play wager.
   * @returns {boolean}
   */
  #canAffordPlayBet(amount) {
    return Boolean(this.#humanPlayer)
      && Number.isFinite(amount)
      && amount > 0
      && this.#humanPlayer.bankroll >= amount;
  }

}
