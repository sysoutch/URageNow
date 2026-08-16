/**
 * UIController - Manages all UI rendering and user interaction.
 *
 * Responsibilities:
 * - Render game components (table, players, cards, chips)
 * - Handle user input (betting buttons, action buttons)
 * - Update UI based on game state changes
 * - Manage modals, HUDs, and overlays
 * - Coordinate animations with game events
 * - Support responsive layout adjustments
 *
 * Dependencies: EventBus, AnimationManager, StateManager, Constants
 * Events consumed: 'round:start', 'cardsDealt', 'handEvaluated', 'payoutComplete'
 * Events emitted: 'userAction', 'betPlaced', 'settingsChanged'
 *
 * Public API:
 * - constructor()
 * - init()
 * - renderTable()
 * - renderPlayers(players)
 * - renderCards(holeCards, communityCards)
 * - updateBettingUI(anteBet, playBet)
 * - showActionButtons(visible)
 * - showModal(type, data)
 * - hideModal()
 */

import { bus } from '../core/EventBus.js';
import { state } from '../core/StateManager.js';
import { AnimationManager } from '../animations/AnimationManager.js';
import { AISeatManager } from './AISeatManager.js';
import { HandEvaluator } from '../poker/HandEvaluator.js';
import { DEALER_QUALIFICATION_OPTIONS } from '../poker/DealerQualification.js';
import { EVENTS, THEMES, THEME_COLORS } from '../config/constants.js';

const HAND_WARNING_OPTIONS = [
  ['HIGH_CARD', 'High Card'],
  ['ONE_PAIR', 'One Pair'],
  ['TWO_PAIR', 'Two Pair'],
  ['THREE_OF_A_KIND', 'Three of a Kind'],
  ['STRAIGHT', 'Straight'],
  ['FLUSH', 'Flush'],
  ['FULL_HOUSE', 'Full House'],
  ['FOUR_OF_A_KIND', 'Four of a Kind'],
  ['STRAIGHT_FLUSH', 'Straight Flush'],
  ['ROYAL_FLUSH', 'Royal Flush'],
];

const HAND_WARNING_RANKS = Object.fromEntries(HAND_WARNING_OPTIONS.map(([key], index) => [key, index]));

export class UIController {
  #animationManager;
  #aiSeatManager;
  #elements = new Map();
  #currentTheme;
  #isInitialized;
  #_prevCommunityCount = 0;
  #latestDealerHandName = '-';
  #latestPlayerHandName = '-';
  #latestDealerCards = [];
  #latestPlayerCards = [];
  #latestCommunityCards = [];
  #playerBestCardIds = new Set();
  #dealerBestCardIds = new Set();

  /**
   * Create a UIController instance.
   */
  constructor() {
    this.#animationManager = new AnimationManager();
    this.#aiSeatManager = new AISeatManager();
    this.#currentTheme = THEMES.CLASSIC;
    this.#isInitialized = false;
  }

  /**
   * Initialize the UI controller and bind events.
   */
  init() {
    if (this.#isInitialized) return;

    this.#bindEvents();
    this.#loadTheme(this.#currentTheme);
    this.renderTable();
    this.#bindButtons();
    this.#aiSeatManager.start(document.getElementById('table-ai-seats'));

    this.#isInitialized = true;
    console.log('[UIController] UI initialized.');
  }

  /**
   * Bind click handlers to all pre-built HTML buttons.
   */
  #bindButtons() {
    // Ante controls
    const anteMinus = document.getElementById('btn-ante-minus');
    const antePlus = document.getElementById('btn-ante-plus');
    if (anteMinus) anteMinus.addEventListener('click', () => this.handleAnteBet(-5));
    if (antePlus) antePlus.addEventListener('click', () => this.handleAnteBet(5));

    // Play controls
    const playMinus = document.getElementById('btn-play-minus');
    const playPlus = document.getElementById('btn-play-plus');
    if (playMinus) playMinus.addEventListener('click', () => this.handlePlayBet(-1));
    if (playPlus) playPlus.addEventListener('click', () => this.handlePlayBet(1));

    // Trips controls
    const tripsMinus = document.getElementById('btn-trips-minus');
    const tripsPlus = document.getElementById('btn-trips-plus');
    if (tripsMinus) tripsMinus.addEventListener('click', () => this.handleTripsBet(-5));
    if (tripsPlus) tripsPlus.addEventListener('click', () => this.handleTripsBet(5));

    this.#bindBetAmountInput('ante-amount', 'ante');
    this.#bindBetAmountInput('trips-amount', 'trips');
    this.#bindBetAmountInput('play-amount', 'play');

    // Action buttons
    const dealBtn = document.getElementById('btn-deal');
    const foldBtn = document.getElementById('btn-fold');
    const checkBtn = document.getElementById('btn-check');
    const betBtn = document.getElementById('btn-bet');
    const restartBtn = document.getElementById('btn-restart');
    const addCashBtn = document.getElementById('btn-add-cash');
    const settingsBtn = document.getElementById('btn-settings');
    const showDealerUpcardToggle = document.getElementById('toggle-show-dealer-upcard');
    const officialRulesToggle = document.getElementById('toggle-official-rules');

    if (dealBtn) dealBtn.addEventListener('click', () => this.handleDeal());
    if (foldBtn) foldBtn.addEventListener('click', () => this.handlePostFlopAction('fold'));
    if (checkBtn) checkBtn.addEventListener('click', () => this.handlePostFlopAction('check'));
    if (betBtn) betBtn.addEventListener('click', () => this.handleBetAction());
    if (restartBtn) restartBtn.addEventListener('click', () => this.#handleNewRound());
    if (addCashBtn) addCashBtn.addEventListener('click', () => this.#handleAddCash());
    if (settingsBtn) settingsBtn.addEventListener('click', () => this.#openSettingsModal());
    if (showDealerUpcardToggle) {
      showDealerUpcardToggle.addEventListener('change', (event) => {
        this.#handleDealerUpcardToggle(event.target.checked);
      });
    }
    if (officialRulesToggle) {
      officialRulesToggle.addEventListener('change', (event) => {
        this.#handleOfficialRulesToggle(event.target.checked);
      });
    }
  }

  /**
   * Subscribe to game events for UI updates.
   */
  #bindEvents() {
    // State change events - keep bet displays in sync with StateManager
    bus.on('stateChange', (data) => {
      this.#handleStateChange(data);
    });

    // Round events
    bus.on(EVENTS.ROUND_START, (data) => {
      this.#handleRoundStart(data);
    });

    bus.on(EVENTS.SHOWDOWN_START, () => {
      this.#aiSeatManager.revealHands();
      if (this.#latestDealerCards.length > 0) {
        this.renderDealerHand(this.#latestDealerCards, { revealAll: true });
      }
    });

    // Card events - handle both formats from different sources
    bus.on(EVENTS.CARDS_DEALT, (data) => {
      if (data.holeCards && data.communityCards) {
        this.renderCards(data.holeCards, data.communityCards);
        this.#aiSeatManager.dealHands(data.aiPlayers || []);
        if (data.dealerHand) {
          this.renderDealerHand(data.dealerHand);
        }
      } else if (data.playerHands && data.communityCards) {
        this.renderPlayerHands(data.playerHands, data.communityCards);
      } else if (data.dealerHand) {
        this.renderDealerHand(data.dealerHand);
      } else if (Array.isArray(data.communityCards)) {
        this.renderCommunityCards(data.communityCards);
      }
    });

    // Card dealing events from Deck
    bus.on('cardDealt', (data) => {
      this.#handleCardDealt(data);
    });

    // Hand evaluation events
    bus.on(EVENTS.HAND_EVALUATED, (data) => {
      this.#handleHandEvaluated(data);
    });

    bus.on(EVENTS.AI_ACTION, (data) => {
      this.#aiSeatManager.showAction(data);
    });

    // Payout events
    bus.on(EVENTS.PAYOUT_COMPLETE, (data) => {
      this.#handlePayoutComplete(data);
    });

    // Betting events
    bus.on(EVENTS.BET_PLACED, (data) => {
      this.updateBettingUI();
      this.#updateButtonStates();
    });
    bus.on(EVENTS.BET_INVALID, (data) => {
      window.alert(data?.message || 'This wager is not available with the current bankroll.');
      this.#updateButtonStates();
    });

    // User action events
    bus.on(EVENTS.USER_ACTION, (data) => {
      this.updateBettingUI();
      this.#updateButtonStates();
    });

    // Round end events
    bus.on(EVENTS.ROUND_END, () => {
      this.#aiSeatManager.releasePlayers();
      this.#handleRoundEnd();
    });

    // Settings events
    bus.on('settingsChanged', (data) => {
      if (data.theme) {
        this.#loadTheme(data.theme);
      }
    });
  }

  /**
   * Handle state changes from StateManager.
   */
  #handleStateChange(data) {
    const current = data.current;

    if (
      current.showDealerUpcard !== data.previous.showDealerUpcard
      || current.debugRevealDealerCards !== data.previous.debugRevealDealerCards
    ) {
      this.#syncDealerUpcardToggle();
      if (this.#latestDealerCards.length > 0 && current.round !== 'showdown') {
        this.renderDealerHand(this.#latestDealerCards);
      }
    }

    if (current.tableRulePreset !== data.previous.tableRulePreset) {
      this.#syncOfficialRulesToggle();
      this.#syncRulesPresentation();
      this.#updateButtonStates();
    }

    // Update bet displays when anteBet or playBet change in state
    if (current.anteBet !== undefined || current.blindBet !== undefined || current.playBet !== undefined || current.tripsBet !== undefined || current.selectedPlayMultiplier !== undefined || current.round) {
      this.#updateBetDisplays();
    }

    // Update button states on any round/phase change
    if (current.round || current.phase) {
      this.#updateButtonStates();
    }
  }

  /**
   * Update bet amount displays directly from StateManager.
   */
  #updateBetDisplays() {
    const gameState = state.get();
    const anteAmountEl = document.getElementById('ante-amount');
    const blindAmountEl = document.getElementById('blind-amount');
    const playAmountEl = document.getElementById('play-amount');
    const tripsAmountEl = document.getElementById('trips-amount');
    const handsPlayedEl = document.getElementById('hands-played-display');
    const selectedPlayMultiplier = gameState.preflopRaiseMode === 'THREE_ONLY'
      ? 3
      : gameState.selectedPlayMultiplier || 3;
    const playDisplayAmount = gameState.playBet > 0
      ? gameState.playBet
      : (gameState.round === 'ante' || gameState.round === 'preflop') && (gameState.anteBet || 0) > 0
        ? (gameState.anteBet || 0) * selectedPlayMultiplier
        : 0;

    if (anteAmountEl) anteAmountEl.value = String(gameState.anteBet || 0);
    if (blindAmountEl) blindAmountEl.value = String(gameState.blindBet || 0);
    if (playAmountEl) playAmountEl.value = String(playDisplayAmount);
    if (tripsAmountEl) tripsAmountEl.value = String(gameState.tripsBet || 0);
    if (handsPlayedEl) handsPlayedEl.textContent = `${gameState.handsPlayed || 0}`;
  }

  /**
   * Handle round start event.
   */
  #handleRoundStart(data) {
    const { round } = data;
    const gameState = state.get();

    if (data.aiPlayers?.length) {
      this.#aiSeatManager.seatPlayers(data.aiPlayers);
    }

    if (round === 'ante' && data.freshStart) {
      this.resetForNextRound();
      const playerHandSummaryEl = document.getElementById('player-hand-summary');
      const dealerHandSummaryEl = document.getElementById('dealer-hand-summary');
      this.#renderPayoutBreakdown([]);
      this.#updateBetDisplays();
      this.#setResultStatus(
        (gameState.anteBet || 0) > 0
          ? this.#getOpeningStatusMessage(true)
          : this.#getOpeningStatusMessage(false)
      );
      this.#latestPlayerHandName = '-';
      this.#latestDealerHandName = '-';
      this.#latestDealerCards = [];
      this.#latestPlayerCards = [];
      this.#latestCommunityCards = [];
      this.#playerBestCardIds.clear();
      this.#dealerBestCardIds.clear();
      if (playerHandSummaryEl) playerHandSummaryEl.textContent = 'Player: -';
      if (dealerHandSummaryEl) dealerHandSummaryEl.textContent = 'Dealer: -';
    } else if (round === 'preflop') {
      this.#setResultStatus('Opening hand dealt. Check or bet 3x / 4x before the flop.');
    } else if (round === 'flop') {
      this.#setResultStatus('Flop is out. Check or bet 2x.');
    } else if (round === 'turn') {
      this.#setResultStatus('Turn card revealed...');
    } else if (round === 'river') {
      this.#setResultStatus('Final decision. Fold or bet 1x.');
    }

    // Update button states based on phase
    this.#updateButtonStates();
  }

  /**
   * Handle hand evaluation event.
   */
  #handleHandEvaluated(data) {
    const { playerId, playerName, hand } = data;

    if (data.isDealer && data.qualifies !== undefined) {
      this.#latestDealerHandName = hand?.name || '-';
      this.#dealerBestCardIds = new Set((hand?.bestCards || []).map(card => card.id));
      this.#refreshShowdownHighlights();
      console.log(`[UIController] Dealer ${hand.name} - ${data.qualifies ? 'QUALIFIES' : 'DOES NOT QUALIFY'}`);
      return;
    }

    if (data.playerId && data.playerName !== 'You') {
      this.#aiSeatManager.setHandName(data.playerId, data.hand?.name);
      return;
    }

    if (playerId === 1 || playerName === 'You') {
      this.#latestPlayerHandName = hand?.name || '-';
      this.#playerBestCardIds = new Set((hand?.bestCards || []).map(card => card.id));
      this.#refreshShowdownHighlights();
    }
  }

  /**
   * Handle payout complete event.
   */
  #handlePayoutComplete(data) {
    const { result, outcomeLabel, playerHandName, dealerHandName } = data;

    const playerResolvedHand = playerHandName || this.#latestPlayerHandName || '-';
    const dealerResolvedHand = dealerHandName || this.#latestDealerHandName || '-';
    const outcomeText = outcomeLabel || (result.netProfit > 0 ? 'WIN' : result.netProfit < 0 ? 'LOSE' : 'PUSH');

    const resultDisplayEl = document.getElementById('result-display');
    const tableStageEl = document.querySelector('.table-stage');
    const profitEl = document.getElementById('net-profit');
    if (resultDisplayEl) {
      resultDisplayEl.classList.remove('center-message--status');
      resultDisplayEl.classList.add('center-message--outcome');
    }
    if (tableStageEl) {
      tableStageEl.classList.add('table-stage--showdown');
    }
    if (profitEl && result) {
      const isWin = result.netProfit > 0;
      const isPush = result.netProfit === 0;

      profitEl.textContent = isPush
        ? 'PUSH'
        : `${isWin ? '+' : '-'}$${Math.abs(result.netProfit).toLocaleString()}`;
      profitEl.className = `net-profit ${isWin ? 'win' : isPush ? 'push' : 'loss'}`;

      // Animate the result display
      this.#animationManager.play(profitEl, 'resultFlash', 500);
    }

    // Show hand name in result display
    const handNameEl = document.getElementById('hand-name');
    if (handNameEl) {
      handNameEl.textContent = outcomeText;
    }

    const playerHandSummaryEl = document.getElementById('player-hand-summary');
    const dealerHandSummaryEl = document.getElementById('dealer-hand-summary');
    if (playerHandSummaryEl) {
      playerHandSummaryEl.textContent = `Player: ${playerResolvedHand}`;
    }
    if (dealerHandSummaryEl) {
      dealerHandSummaryEl.textContent = `Dealer: ${dealerResolvedHand}`;
    }
    this.#renderPayoutBreakdown(result.breakdown || []);

    const lastResultEl = document.getElementById('last-result-display');
    if (lastResultEl) {
      const shortOutcomeLabels = {
        WIN: 'Win',
        LOSE: 'Lose',
        "Dealer didn't qualify": "Dealer didn't qualify",
        'Dealer has the same hand as you': 'Tie with dealer',
      };
      lastResultEl.textContent = shortOutcomeLabels[outcomeText] || outcomeText;
    }
  }

  /**
   * Handle round end - show new round button.
   */
  #handleRoundEnd() {
    const restartBtn = document.getElementById('btn-restart');
    const dealBtn = document.getElementById('btn-deal');
    const foldBtn = document.getElementById('btn-fold');
    const checkBtn = document.getElementById('btn-check');
    const betBtn = document.getElementById('btn-bet');

    if (restartBtn) {
      restartBtn.style.display = '';
      restartBtn.disabled = false;
    }
    if (dealBtn) dealBtn.style.display = 'none';
    if (foldBtn) foldBtn.style.display = 'none';
    if (checkBtn) checkBtn.style.display = 'none';
    if (betBtn) betBtn.style.display = 'none';
  }

  /**
   * Handle NEW ROUND button click - emit event to start a new round.
   */
  #handleNewRound() {
    console.log('[UIController] New Round requested.');
    bus.emit(EVENTS.NEW_ROUND_REQUESTED);
  }

  /**
   * Prompt for a bankroll top-up and credit it through the engine/state flow.
   */
  #handleAddCash() {
    const rawAmount = window.prompt('How much cash do you want to add?', '500');
    if (rawAmount === null) return;

    const amount = Number.parseInt(rawAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert('Enter a positive dollar amount.');
      return;
    }

    bus.emit(EVENTS.CASH_ADDED, {
      amount,
      playerId: 0,
    });
  }

  // ==========================================================================
  // Rendering Methods
  // ==========================================================================

  /**
   * Render the main game table.
   * Caches existing DOM elements for later use instead of overwriting them.
   */
  renderTable() {
    // Cache all critical UI elements immediately so they're available in #getElement
    const ids = [
      'community-cards', 'dealer-area', 'result-display', 'net-profit',
      'bankroll-display', 'modal-container', 'controls-area'
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) this.#elements.set(id, el);
    });

    // Cache the human player's main card container
    const humanCards = document.getElementById('player-cards');
    if (humanCards) {
      this.#elements.set('player-cards', humanCards);
    }

    this.#syncDealerUpcardToggle();
    this.#syncOfficialRulesToggle();
    this.#syncRulesPresentation();
    this.#renderBankrollDisplay(state.get('bankroll') || 0);

    console.log('[UIController] Table rendered with pre-built HTML.');
  }

  /**
   * Render dealer's hand.
   */
  renderDealerHand(dealerHand, options = {}) {
    const dealerArea = this.#getElement('dealer-area');
    if (!dealerArea || !dealerHand) return;
    this.#latestDealerCards = [...dealerHand];

    const revealAll = options.revealAll || state.get('round') === 'showdown';
    const showDealerUpcard = state.get('showDealerUpcard');
    const debugRevealDealerCards = state.get('debugRevealDealerCards');

    dealerArea.innerHTML = `
      <div class="dealer-cards" id="dealer-cards">
        ${dealerHand.map((card, idx) => {
          const shouldReveal = revealAll || debugRevealDealerCards || (showDealerUpcard && idx === 1);
          return this.#createCardHTML(card, shouldReveal, shouldReveal && this.#shouldDimDealerCard(card));
        }).join('')}
      </div>
    `;
  }

  /**
   * Render cards on the table.
   */
  renderCards(holeCards, communityCards) {
    // Render player's hole cards (face up for human player)
    const playerCardsEl = this.#getElement('player-cards');
    if (playerCardsEl && holeCards) {
      this.#latestPlayerCards = [...holeCards];
      playerCardsEl.innerHTML = holeCards
        .map(card => this.#createCardHTML(card, true, this.#shouldDimPlayerCard(card)))
        .join('');
    }

    // Render community cards
    const communityEl = this.#getElement('community-cards');
    if (communityEl && communityCards) {
      this.#latestCommunityCards = [...communityCards];
      communityEl.innerHTML = communityCards
        .map(card => this.#createCardHTML(card, true, this.#shouldDimCommunityCard(card)))
        .join('');
    }

    this.#updateCurrentHandIndicator();
  }

  /**
   * Create HTML for a single card.
   */
  #createCardHTML(card, faceUp = false, dimmed = false) {
    const suitSymbol = { hearts: '&hearts;', diamonds: '&diams;', clubs: '&clubs;', spades: '&spades;' };
    const rankSymbol = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const rank = rankSymbol[card.rank] || card.rank;
    const suit = suitSymbol[card.suit];

    return `
      <div class="card ${faceUp ? 'card--face-up' : 'card--face-down'} card--${card.suit} ${dimmed ? 'card--dimmed' : ''}" data-card-id="${card.id}">
        <div class="card__front">
          <div class="card__corner">
            <span class="card__rank">${rank}</span>
            <span class="card__suit card__suit--${card.suit}">${suit}</span>
          </div>
          <div class="card__pip card__pip--${card.suit}">${suit}</div>
          <div class="card__corner card__corner--bottom">
            <span class="card__rank">${rank}</span>
            <span class="card__suit card__suit--${card.suit}">${suit}</span>
          </div>
        </div>
        <div class="card__back"></div>
      </div>
    `;
  }

  // ==========================================================================
  // Betting UI Methods
  // ==========================================================================

  /**
   * Update the betting UI with current bet amounts.
   */
  updateBettingUI() {
    const gameState = state.get();
    this.#renderBankrollDisplay(gameState.bankroll || 0);
  }

  /**
   * Reset the betting UI for a new round.
   */
  resetBettingUI() {
    this.#updateBetDisplays();
  }

  /**
   * Update UI state based on current phase.
   */
  #updateButtonStates() {
    const gameState = state.get();
    const usesOfficialRules = this.#usesOfficialRules(gameState);
    document.querySelector('.table-stage')?.classList.toggle('table-stage--opening', gameState.round === 'ante');

    // Ante controls - always enabled during ante round
    const anteMinus = document.getElementById('btn-ante-minus');
    const antePlus = document.getElementById('btn-ante-plus');
    const anteInput = document.getElementById('ante-amount');
    const bankrollRemainingForAnte = this.#getMaxAnte(gameState);
    if (anteMinus) anteMinus.disabled = gameState.round !== 'ante' || gameState.anteBet <= 0;
    if (antePlus) antePlus.disabled = gameState.round !== 'ante' || bankrollRemainingForAnte < 5;
    if (anteInput) {
      anteInput.disabled = gameState.round !== 'ante';
      anteInput.min = '0';
      anteInput.max = String(bankrollRemainingForAnte);
      anteInput.step = '5';
    }

    const tripsMinus = document.getElementById('btn-trips-minus');
    const tripsPlus = document.getElementById('btn-trips-plus');
    const tripsInput = document.getElementById('trips-amount');
    const bankrollRemainingForTrips = this.#getMaxTrips(gameState);
    if (tripsMinus) tripsMinus.disabled = gameState.round !== 'ante' || gameState.tripsBet <= 0;
    if (tripsPlus) tripsPlus.disabled = gameState.round !== 'ante' || bankrollRemainingForTrips < 5;
    if (tripsInput) {
      tripsInput.disabled = gameState.round !== 'ante';
      tripsInput.min = '0';
      tripsInput.max = String(bankrollRemainingForTrips);
      tripsInput.step = '5';
    }

    // Play controls - used to pick the preflop bet multiplier
    const playMinus = document.getElementById('btn-play-minus');
    const playPlus = document.getElementById('btn-play-plus');
    const playInput = document.getElementById('play-amount');
    const officialRulesToggle = document.getElementById('toggle-official-rules');
    const canAdjustPreflopMultiplier =
      (gameState.round === 'ante' && gameState.anteBet > 0)
      || gameState.round === 'preflop';
    const allowsFourX = gameState.preflopRaiseMode !== 'THREE_ONLY';
    const selectedPlayMultiplier = allowsFourX ? gameState.selectedPlayMultiplier || 3 : 3;
    if (playMinus) playMinus.disabled = !canAdjustPreflopMultiplier || selectedPlayMultiplier <= 3;
    if (playPlus) playPlus.disabled = !canAdjustPreflopMultiplier || !allowsFourX || selectedPlayMultiplier >= 4;
    if (playInput) {
      playInput.disabled = !canAdjustPreflopMultiplier;
      playInput.min = String((gameState.anteBet || 0) * 3);
      playInput.max = String((gameState.anteBet || 0) * (allowsFourX ? 4 : 3));
      playInput.step = String(gameState.anteBet || 5);
    }

    if (officialRulesToggle) {
      officialRulesToggle.disabled = gameState.round !== 'ante' || (gameState.anteBet || 0) > 0 || (gameState.tripsBet || 0) > 0;
    }

    const blindZone = document.getElementById('blind-zone');
    const blindInput = document.getElementById('blind-amount');
    if (blindZone) {
      blindZone.classList.toggle('bet-zone--inactive', !usesOfficialRules);
    }
    if (blindInput) {
      blindInput.disabled = true;
      blindInput.readOnly = true;
    }

    // Deal button - visible during ante round once the ante is placed
    const dealBtn = document.getElementById('btn-deal');
    const restartBtn = document.getElementById('btn-restart');
    if (dealBtn) {
      const showDealButton = gameState.round === 'ante' && gameState.anteBet > 0;
      dealBtn.style.display = showDealButton ? '' : 'none';
      dealBtn.disabled = gameState.anteBet === 0;
    }
    if (restartBtn) restartBtn.style.display = gameState.round === 'idle' ? '' : 'none';

    // Street action buttons
    const foldBtn = document.getElementById('btn-fold');
    const checkBtn = document.getElementById('btn-check');
    const betBtn = document.getElementById('btn-bet');
    const hasDecision = ['preflop', 'flop', 'river'].includes(gameState.round)
      && ['decision', 'betting'].includes(gameState.phase);
    const isPreflopRound = gameState.round === 'preflop';
    const isFlop = gameState.round === 'flop';
    const isRiver = gameState.round === 'river';

    if (foldBtn) {
      foldBtn.disabled = !isRiver;
      foldBtn.style.display = isRiver ? '' : 'none';
      this.#setActionButtonContent(foldBtn, '×', 'Fold');
    }
    if (checkBtn) {
      const canCheck = isPreflopRound || isFlop;
      checkBtn.disabled = !canCheck;
      this.#setActionButtonContent(checkBtn, '✓', 'Check');
      checkBtn.style.display = canCheck ? '' : 'none';
    }
    if (betBtn) {
      const betLabel = isPreflopRound
        ? `Raise ${selectedPlayMultiplier}X`
        : isFlop
          ? 'Raise 2X'
          : isRiver
            ? 'Raise 1X'
            : 'Bet';
      const betAmount = isPreflopRound
        ? (gameState.anteBet || 0) * selectedPlayMultiplier
        : isFlop
          ? (gameState.anteBet || 0) * 2
          : isRiver
            ? (gameState.anteBet || 0)
            : 0;
      const availableForPlay = this.#getAvailableForPlay(gameState);
      const canAffordBet = betAmount > 0 && betAmount <= availableForPlay;
      betBtn.disabled = !hasDecision || !canAffordBet;
      betBtn.title = hasDecision && !canAffordBet
        ? `Not enough cash: $${betAmount.toLocaleString()} required, $${availableForPlay.toLocaleString()} available.`
        : '';
      this.#setActionButtonContent(
        betBtn,
        '+',
        betLabel,
        betAmount > 0 ? `$${betAmount.toLocaleString()}` : null
      );
      betBtn.style.display = hasDecision ? '' : 'none';
    }

    if (dealBtn) {
      this.#setActionButtonContent(dealBtn, '◆', 'Deal Hand');
    }

    // Update bankroll display
    this.#renderBankrollDisplay(gameState.bankroll || 0);
  }

  /**
   * Handle ante bet button clicks.
   * @param {number} delta - Amount to add/subtract from ante.
   */
  handleAnteBet(delta) {
    const gameState = state.get();
    if (gameState.round !== 'ante') return;

    let newAmount = gameState.anteBet + delta;
    if (delta > 0) {
      const maxAnte = this.#getMaxAnte(gameState);
      // Clamp between min and bankroll
      newAmount = Math.max(5, Math.min(newAmount, maxAnte));
      // Round to nearest 5
      newAmount = Math.floor(newAmount / 5) * 5;
    } else {
      newAmount = Math.max(0, newAmount);
    }

    if (newAmount !== gameState.anteBet) {
      this.#placeAnteBet(newAmount);
    }
  }

  /**
   * Handle trips bet button clicks.
   * @param {number} delta - Amount to add/subtract from trips.
   */
  handleTripsBet(delta) {
    const gameState = state.get();
    if (gameState.round !== 'ante') return;

    let newAmount = (gameState.tripsBet || 0) + delta;
    if (delta > 0) {
      const maxTrips = this.#getMaxTrips(gameState);
      newAmount = Math.max(5, Math.min(newAmount, maxTrips));
      newAmount = Math.floor(newAmount / 5) * 5;
    } else {
      newAmount = Math.max(0, newAmount);
    }

    if (newAmount !== (gameState.tripsBet || 0)) {
      this.#placeTripsBet(newAmount);
    }
  }

  /**
   * Handle play bet button clicks.
   * @param {number} delta - Multiplier change (-1 or +1).
   */
  handlePlayBet(delta) {
    const gameState = state.get();
    if (!['ante', 'preflop'].includes(gameState.round) || gameState.anteBet === 0) return;

    const maximumMultiplier = gameState.preflopRaiseMode === 'THREE_ONLY' ? 3 : 4;
    const nextMultiplier = Math.max(3, Math.min(maximumMultiplier, (gameState.selectedPlayMultiplier || 3) + delta));
    state.set({ selectedPlayMultiplier: nextMultiplier });
  }

  /**
   * Handle manual bet amount entry.
   * @param {'ante'|'trips'|'play'} betType - Bet input to commit.
   * @param {string} rawValue - Raw input string.
   */
  handleManualBetEntry(betType, rawValue) {
    const gameState = state.get();
    const parsedAmount = Number.parseInt(rawValue, 10);

    if (Number.isNaN(parsedAmount)) {
      this.#updateBetDisplays();
      return;
    }

    if (betType === 'ante' && gameState.round === 'ante') {
      const maxAnte = this.#getMaxAnte(gameState);
      const nextAnte = this.#normalizeChipAmount(parsedAmount, maxAnte);
      if (nextAnte !== gameState.anteBet) {
        this.#placeAnteBet(nextAnte);
      } else {
        this.#updateBetDisplays();
      }
      return;
    }

    if (betType === 'trips' && gameState.round === 'ante') {
      const maxTrips = this.#getMaxTrips(gameState);
      const nextTrips = this.#normalizeChipAmount(parsedAmount, maxTrips);
      if (nextTrips !== (gameState.tripsBet || 0)) {
        this.#placeTripsBet(nextTrips);
      } else {
        this.#updateBetDisplays();
      }
      return;
    }

    if (betType === 'play' && ['ante', 'preflop'].includes(gameState.round) && (gameState.anteBet || 0) > 0) {
      const nextMultiplier = this.#resolvePlayMultiplierFromAmount(parsedAmount, gameState.anteBet || 0);
      state.set({ selectedPlayMultiplier: nextMultiplier });
      return;
    }

    this.#updateBetDisplays();
  }

  /**
   * Handle the deal button click.
   */
  handleDeal() {
    const gameState = state.get();
    if (gameState.round === 'ante' && gameState.anteBet > 0) {
      bus.emit(EVENTS.USER_ACTION, {
        action: 'deal',
        playerId: 0,
      });
    }
  }

  /**
   * Handle post-flop actions (check, fold, call).
   */
  handlePostFlopAction(action, amount = 0) {
    if (this.#shouldWarnBeforeAction(action)) {
      this.#showHandWarning(action, () => this.#emitUserAction(action, amount));
      return;
    }

    this.#emitUserAction(action, amount);
  }

  /** Emit a confirmed street action to the game engine. */
  #emitUserAction(action, amount = 0) {
    bus.emit(EVENTS.USER_ACTION, {
      action,
      amount,
      playerId: 0,
    });
  }

  /**
   * Handle the street bet action based on the current round.
   */
  handleBetAction() {
    const gameState = state.get();

    if (!['preflop', 'flop', 'river'].includes(gameState.round)) return;

    const amount = gameState.round === 'preflop'
      ? gameState.anteBet * (
          gameState.preflopRaiseMode === 'THREE_ONLY'
            ? 3
            : gameState.selectedPlayMultiplier || 3
        )
      : gameState.round === 'flop'
        ? gameState.anteBet * 2
        : gameState.anteBet;

    const availableForPlay = this.#getAvailableForPlay(gameState);
    if (amount > availableForPlay) {
      window.alert(`Not enough cash for this Play bet. You need $${amount.toLocaleString()}, but only $${availableForPlay.toLocaleString()} is available.`);
      return;
    }

    bus.emit(EVENTS.USER_ACTION, {
      action: 'bet',
      amount,
      playerId: 0,
    });
  }

  /**
   * Place an ante bet.
   */
  #placeAnteBet(amount) {
    bus.emit(EVENTS.BET_PLACED, {
      type: 'ante',
      amount,
      playerId: 0,
    });
  }

  /**
   * Place or update the trips side bet.
   */
  #placeTripsBet(amount) {
    bus.emit(EVENTS.BET_PLACED, {
      type: 'trips',
      amount,
      playerId: 0,
    });
  }

  /**
   * Show lightweight status copy during the hand and hide the outcome detail stack.
   */
  #setResultStatus(message) {
    const resultDisplayEl = document.getElementById('result-display');
    const tableStageEl = document.querySelector('.table-stage');
    const handNameEl = document.getElementById('hand-name');
    const profitEl = document.getElementById('net-profit');
    const playerHandSummaryEl = document.getElementById('player-hand-summary');
    const dealerHandSummaryEl = document.getElementById('dealer-hand-summary');

    if (resultDisplayEl) {
      resultDisplayEl.classList.add('center-message--status');
      resultDisplayEl.classList.remove('center-message--outcome');
    }
    if (tableStageEl) {
      tableStageEl.classList.remove('table-stage--showdown');
    }
    if (handNameEl) handNameEl.textContent = message;
    if (profitEl) {
      profitEl.textContent = '-';
      profitEl.className = 'net-profit';
    }
    if (playerHandSummaryEl) playerHandSummaryEl.textContent = 'Player: -';
    if (dealerHandSummaryEl) dealerHandSummaryEl.textContent = 'Dealer: -';
    this.#renderPayoutBreakdown([]);
  }

  /**
   * Bind enter/blur handlers to a manual bet input.
   */
  #bindBetAmountInput(inputId, betType) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('blur', (event) => {
      this.handleManualBetEntry(betType, event.target.value);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.#updateBetDisplays();
        event.target.blur();
      }
    });
  }

  /**
   * Snap a typed chip amount to the nearest valid $5 increment.
   */
  #normalizeChipAmount(amount, maxAmount) {
    if (amount <= 0 || maxAmount <= 0) return 0;

    const clamped = Math.min(amount, maxAmount);
    const rounded = Math.round(clamped / 5) * 5;
    return Math.max(5, Math.min(rounded, maxAmount));
  }

  /**
   * Resolve a typed play amount to the nearest legal preflop multiplier.
   */
  #resolvePlayMultiplierFromAmount(amount, anteBet) {
    if (state.get('preflopRaiseMode') === 'THREE_ONLY') {
      return 3;
    }

    const threeX = anteBet * 3;
    const fourX = anteBet * 4;
    return Math.abs(amount - threeX) <= Math.abs(amount - fourX) ? 3 : 4;
  }

  /**
   * Persist the custom dealer upcard rule and refresh the current hand display.
   */
  #handleDealerUpcardToggle(enabled) {
    state.set({ showDealerUpcard: enabled });
  }

  /**
   * Persist the table-rules preset and refresh the visible cues.
   * @param {boolean} enabled - Whether the official preset is enabled.
   */
  #handleOfficialRulesToggle(enabled) {
    const gameState = state.get();
    if (gameState.round !== 'ante' || (gameState.anteBet || 0) > 0 || (gameState.tripsBet || 0) > 0) {
      this.#syncOfficialRulesToggle();
      window.alert('Change the rules preset before placing opening bets.');
      return;
    }

    const tableRulePreset = enabled ? 'official' : 'legacy';
    state.set({
      tableRulePreset,
      blindBet: enabled ? (gameState.anteBet || 0) : 0,
    });
  }

  /**
   * Keep the dealer upcard toggle in sync with state.
   */
  #syncDealerUpcardToggle() {
    const toggle = document.getElementById('toggle-show-dealer-upcard');
    if (toggle) {
      toggle.checked = Boolean(state.get('showDealerUpcard'));
    }
  }

  /**
   * Keep the official-rules toggle in sync with state.
   */
  #syncOfficialRulesToggle() {
    const toggle = document.getElementById('toggle-official-rules');
    if (toggle) {
      toggle.checked = this.#usesOfficialRules();
    }
  }

  /**
   * Update rules-sensitive copy and visibility on the table.
   */
  #syncRulesPresentation() {
    const boardBanner = document.getElementById('board-banner');
    const usesOfficialRules = this.#usesOfficialRules();

    if (boardBanner) {
      boardBanner.textContent = usesOfficialRules
        ? 'Official UTH: Blind pays on winning straights or better'
        : 'Legacy house rules: Ante pushes if dealer has less than a pair';
    }
  }

  /**
   * Render the bankroll as a chip stack with a hoverable exact amount.
   */
  #renderBankrollDisplay(amount) {
    const bankrollEl = document.getElementById('bankroll-display');
    if (!bankrollEl) return;

    const safeAmount = Math.max(0, Number(amount) || 0);
    bankrollEl.dataset.bankrollLabel = `$${safeAmount.toLocaleString()}`;
    bankrollEl.title = `$${safeAmount.toLocaleString()}`;
    bankrollEl.innerHTML = this.#createBankrollStackHTML(safeAmount);
  }

  /**
   * Render the round-end payout lines in settlement order.
   * Trips is intentionally shown last so the main hand resolves first.
   * @param {Array<Object>} breakdown - Ordered payout rows from the engine.
   */
  #renderPayoutBreakdown(breakdown = []) {
    const container = document.getElementById('payout-breakdown');
    if (!container) return;

    if (!breakdown.length) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = breakdown.map((entry) => {
      const amountText = entry.profit === 0
        ? 'Push'
        : `${entry.profit > 0 ? '+' : '-'}$${Math.abs(entry.profit).toLocaleString()}`;
      const amountClass = entry.profit > 0 ? 'is-win' : entry.profit < 0 ? 'is-loss' : 'is-push';

      return `
        <div class="payout-breakdown__row">
          <span class="payout-breakdown__label">${entry.label}</span>
          <span class="payout-breakdown__amount ${amountClass}">${amountText}</span>
          <span class="payout-breakdown__meta">${entry.multiplierLabel}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Whether the table is currently using the official UTH preset.
   * @param {Object} [gameState=state.get()] - Optional state snapshot.
   * @returns {boolean}
   */
  #usesOfficialRules(gameState = state.get()) {
    return (gameState.tableRulePreset || 'official') !== 'legacy';
  }

  /**
   * Max legal ante for the current preset, accounting for Trips and mirrored Blind in official mode.
   * @param {Object} gameState - State snapshot.
   * @returns {number}
   */
  #getMaxAnte(gameState) {
    const bankrollAfterTrips = Math.max(0, (gameState.bankroll || 0) - (gameState.tripsBet || 0));
    const divisor = this.#usesOfficialRules(gameState) ? 2 : 1;
    return Math.floor(bankrollAfterTrips / divisor / 5) * 5;
  }

  /**
   * Max legal Trips amount after reserving the current opening wager structure.
   * @param {Object} gameState - State snapshot.
   * @returns {number}
   */
  #getMaxTrips(gameState) {
    const openingCost = this.#usesOfficialRules(gameState)
      ? (gameState.anteBet || 0) * 2
      : (gameState.anteBet || 0);
    return Math.max(0, (gameState.bankroll || 0) - openingCost);
  }

  /**
   * Cash not already committed to Ante, Blind, Trips, or an earlier Play wager.
   * @param {Object} gameState - State snapshot.
   * @returns {number}
   */
  #getAvailableForPlay(gameState) {
    return Math.max(
      0,
      (gameState.bankroll || 0)
        - (gameState.anteBet || 0)
        - (gameState.blindBet || 0)
        - (gameState.tripsBet || 0)
        - (gameState.playBet || 0)
    );
  }

  /**
   * Status text for the opening round under the current rules preset.
   * @param {boolean} hasRepeatBet - Whether a carry-forward wager is loaded.
   * @returns {string}
   */
  #getOpeningStatusMessage(hasRepeatBet) {
    if (this.#usesOfficialRules()) {
      return hasRepeatBet
        ? 'Last Ante, Blind, and Trips are loaded. Adjust them or deal the opening hand.'
        : 'Place your Ante and matching Blind, add Trips if you want it, then deal the opening hand.';
    }

    return hasRepeatBet
      ? 'Last legacy bet sizes are loaded. Adjust them or deal the opening hand.'
      : 'Place your ante, add Trips if you want it, then deal the opening hand.';
  }

  /**
   * Create a compact visual chip stack for the current bankroll.
   */
  #createBankrollStackHTML(amount) {
    const chipRack = this.#getBankrollDisplayChips(amount).map(({ color, label, active }) => `
      <span class="bankroll-rack__chip bankroll-rack__chip--${color} ${active ? 'is-active' : ''}">
        <span>${label}</span>
      </span>
    `).join('');

    return `
      <div class="bankroll-total">$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="bankroll-divider" aria-hidden="true"></div>
      <div class="bankroll-rack" aria-hidden="true">
        ${chipRack}
      </div>
      <div class="bankroll-stack__base">Drag chips to bet</div>
    `;
  }

  /**
   * Build a decorative chip rack that reflects bankroll strength.
   */
  #getBankrollDisplayChips(amount) {
    const thresholds = [1, 5, 25, 100, 500];
    const colors = ['black', 'red', 'green', 'black', 'purple'];

    return thresholds.map((value, index) => ({
      color: colors[index],
      label: value,
      active: amount >= value,
    }));
  }

  // ==========================================================================
  // Modal Methods
  // ==========================================================================

  /**
   * Show a modal dialog.
   */
  showModal(type, data = {}) {
    const modalContainer = this.#getElement('modal-container');
    if (!modalContainer) return;

    let content = '';

    switch (type) {
      case 'game-over':
        content = this.#createGameOverModal(data);
        break;
      default:
        console.warn(`[UIController] Unknown modal type: ${type}`);
        return;
    }

    const modal = document.createElement('div');
    modal.className = `modal modal--${type}`;
    modal.innerHTML = content;
    modal.id = `modal-${type}`;

    // Add close button handler
    const closeBtn = modal.querySelector('.modal__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideModal());
    }

    modalContainer.appendChild(modal);
  }

  /**
   * Hide the currently displayed modal.
   */
  hideModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.remove());
  }

  /**
   * Create game over modal content.
   */
  #createGameOverModal(data) {
    return `
      <div class="modal__content">
        <button class="modal__close">&times;</button>
        <h2 class="modal__title">Round Complete</h2>
        <div class="game-over__result">
          <span class="game-over__hand">${data.hand || '-'}</span>
          <span class="game-over__profit ${data.netProfit > 0 ? 'win' : data.netProfit < 0 ? 'loss' : ''}">
            ${data.netProfit >= 0 ? '+' : '-'}$${Math.abs(data.netProfit).toLocaleString()}
          </span>
        </div>
        <button class="modal__action" id="btn-new-round">New Round</button>
      </div>
    `;
  }

  // ==========================================================================
  // Theme Methods
  // ==========================================================================

  /**
   * Load a theme by name.
   */
  #loadTheme(themeName) {
    const themeKey = THEMES[themeName] || THEMES.CLASSIC;
    this.#currentTheme = themeKey;

    document.body.className = `theme-${themeKey.toLowerCase()}`;

    // Update CSS variables from THEME_COLORS
    const colors = THEME_COLORS[themeKey] || THEME_COLORS.classic;
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  }

  /**
   * Get the current theme name.
   */
  getTheme() {
    return this.#currentTheme;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get a DOM element by ID from our registry or document.
   */
  #getElement(id) {
    if (this.#elements.has(id)) {
      return this.#elements.get(id);
    }

    const el = document.getElementById(id);
    if (el) {
      this.#elements.set(id, el);
    }
    return el;
  }

  /**
   * Clear the element cache.
   */
  clearCache() {
    this.#elements.clear();
  }

  /**
   * Render player hands on the table.
   */
  renderPlayerHands(playerHands, communityCards) {
    playerHands.forEach(({ playerIndex, hand }) => {
      const cardsEl = this.#getElement(`player-cards-${playerIndex}`);
      if (cardsEl && hand) {
        cardsEl.innerHTML = hand.map((card, cardIdx) =>
          this.#createCardHTML(card, cardIdx === 1)
        ).join('');
      }
    });

    // Also render community cards if provided
    if (communityCards && communityCards.length > 0) {
      this.renderCommunityCards(communityCards);
    }
  }

  /**
   * Render community cards on the table.
   * This method is called incrementally - first with flop (3), then turn (1), then river (1).
   * It must preserve previously rendered cards and only update/add new ones.
   */
  renderCommunityCards(communityCards) {
    const communityEl = this.#getElement('community-cards');
    if (!communityEl || !communityCards || communityCards.length === 0) return;
    this.#latestCommunityCards = [...communityCards];

    // Ensure we have exactly 5 slots for the full board
    let slots = communityEl.querySelectorAll('.card-slot');

    if (slots.length === 0) {
      communityEl.innerHTML = Array(5).fill('<div class="card-slot"></div>').join('');
      slots = communityEl.querySelectorAll('.card-slot');
    }

    // Render each card into its slot - preserve previously rendered cards
    communityCards.forEach((card, index) => {
      if (slots[index]) {
        const existingCard = slots[index].querySelector('.card');
        // Only update if this is a new card or the slot is empty
        if (!existingCard || index >= this.#_prevCommunityCount) {
          slots[index].innerHTML = this.#createCardWrapperHTML(card, false, this.#shouldDimCommunityCard(card));
        }
      }
    });

    // Store current count so we know which cards are "new" next time
    this.#_prevCommunityCount = communityCards.length;
    this.#updateCurrentHandIndicator();
  }

  /** Keep the player's current best made hand visible throughout the round. */
  #updateCurrentHandIndicator() {
    const indicator = document.getElementById('current-hand');
    if (!indicator) {
      return;
    }

    const cards = [...this.#latestPlayerCards, ...this.#latestCommunityCards];
    indicator.textContent = cards.length < 2
      ? 'Current hand: Waiting for deal'
      : `Current hand: ${this.#getCurrentHandName(cards)}`;
  }

  /** Evaluate complete boards normally and partial boards by their made ranks. */
  #getCurrentHandName(cards) {
    return this.#getCurrentHandSummary(cards).name;
  }

  /** Return the made-hand name and rank for a partial or complete board. */
  #getCurrentHandSummary(cards) {
    if (cards.length >= 5) {
      const evaluatedHand = HandEvaluator.evaluate(cards);
      return {
        name: evaluatedHand?.name || 'High Card',
        rank: evaluatedHand?.rank ?? HAND_WARNING_RANKS.HIGH_CARD,
      };
    }

    const rankCounts = new Map();
    cards.forEach((card) => rankCounts.set(card.rank, (rankCounts.get(card.rank) || 0) + 1));
    const counts = [...rankCounts.values()].sort((left, right) => right - left);

    if (counts[0] === 4) {
      return { name: 'Four of a Kind', rank: HAND_WARNING_RANKS.FOUR_OF_A_KIND };
    }
    if (counts[0] === 3) {
      return { name: 'Three of a Kind', rank: HAND_WARNING_RANKS.THREE_OF_A_KIND };
    }
    if (counts[0] === 2 && counts[1] === 2) {
      return { name: 'Two Pair', rank: HAND_WARNING_RANKS.TWO_PAIR };
    }
    if (counts[0] === 2) {
      return { name: 'One Pair', rank: HAND_WARNING_RANKS.ONE_PAIR };
    }
    return { name: 'High Card', rank: HAND_WARNING_RANKS.HIGH_CARD };
  }

  /** Whether a risky check or fold meets the configured made-hand threshold. */
  #shouldWarnBeforeAction(action) {
    const settings = state.get();
    const actionEnabled = action === 'check' ? settings.warnOnCheck : action === 'fold' ? settings.warnOnFold : false;
    if (!settings.handWarningEnabled || !actionEnabled) {
      return false;
    }

    const cards = [...this.#latestPlayerCards, ...this.#latestCommunityCards];
    if (cards.length < 2) {
      return false;
    }

    const threshold = HAND_WARNING_RANKS[settings.handWarningThreshold] ?? HAND_WARNING_RANKS.ONE_PAIR;
    return this.#getCurrentHandSummary(cards).rank >= threshold;
  }

  /** Ask the player to confirm a check or fold that discards a made hand. */
  #showHandWarning(action, onConfirm) {
    const hand = this.#getCurrentHandSummary([...this.#latestPlayerCards, ...this.#latestCommunityCards]);
    const modalContainer = this.#getElement('modal-container');
    if (!modalContainer) {
      return;
    }

    this.hideModal();
    const modal = document.createElement('section');
    modal.className = 'modal hand-warning-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="modal__header">
        <h2 class="modal__header-title">${action === 'fold' ? 'Fold' : 'Check'} with ${hand.name}?</h2>
        <button class="modal__header-close" type="button" aria-label="Close">&times;</button>
      </div>
      <div class="modal__body">
        Your current made hand is <strong>${hand.name}</strong>. Are you sure you want to ${action}?
      </div>
      <div class="modal__footer">
        <button class="modal__button modal__button--secondary" type="button" data-warning-cancel>Keep Playing</button>
        <button class="modal__button modal__button--danger" type="button" data-warning-confirm>Yes, ${action}</button>
      </div>
    `;

    const close = () => this.hideModal();
    modal.querySelector('.modal__header-close')?.addEventListener('click', close);
    modal.querySelector('[data-warning-cancel]')?.addEventListener('click', close);
    modal.querySelector('[data-warning-confirm]')?.addEventListener('click', () => {
      close();
      onConfirm();
    });
    modalContainer.appendChild(modal);
  }

  /** Open the hand-protection settings panel. */
  #openSettingsModal() {
    const settings = state.get();
    const modalContainer = this.#getElement('modal-container');
    if (!modalContainer) {
      return;
    }

    this.hideModal();
    const optionMarkup = HAND_WARNING_OPTIONS.map(([value, label]) => `
      <option value="${value}" ${settings.handWarningThreshold === value ? 'selected' : ''}>${label} or better</option>
    `).join('');
    const dealerQualificationMarkup = DEALER_QUALIFICATION_OPTIONS.map(([value, label]) => `
      <option value="${value}" ${settings.dealerQualificationMinimum === value ? 'selected' : ''}>${label}</option>
    `).join('');
    const modal = document.createElement('section');
    modal.className = 'modal settings-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <form id="hand-warning-settings-form">
        <div class="modal__header">
          <h2 class="modal__header-title">Table Settings</h2>
          <button class="modal__header-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="modal__body settings-modal__body">
          <label class="settings-modal__toggle">
            <input type="checkbox" name="enabled" ${settings.handWarningEnabled ? 'checked' : ''} />
            <span>Warn before risky actions</span>
          </label>
          <label class="settings-modal__field">
            <span>Warn when current hand is</span>
            <select name="threshold">${optionMarkup}</select>
          </label>
          <label class="settings-modal__toggle">
            <input type="checkbox" name="warnOnCheck" ${settings.warnOnCheck ? 'checked' : ''} />
            <span>Confirm before checking</span>
          </label>
          <label class="settings-modal__toggle">
            <input type="checkbox" name="warnOnFold" ${settings.warnOnFold ? 'checked' : ''} />
            <span>Confirm before folding</span>
          </label>
          <label class="settings-modal__toggle settings-modal__toggle--debug">
            <input type="checkbox" name="debugRevealDealerCards" ${settings.debugRevealDealerCards ? 'checked' : ''} />
            <span>Debug: reveal dealer cards</span>
          </label>
          <label class="settings-modal__toggle">
            <input type="checkbox" name="dealerQualificationEnabled" ${settings.dealerQualificationEnabled !== false ? 'checked' : ''} />
            <span>Require the dealer to qualify and apply the settlement rule below</span>
          </label>
          <label class="settings-modal__field">
            <span>Minimum dealer hand</span>
            <select name="dealerQualificationMinimum">${dealerQualificationMarkup}</select>
          </label>
          <label class="settings-modal__field">
            <span>When the dealer does not qualify</span>
            <select name="dealerDisqualifiedAnteMode">
              <option value="PUSH" ${settings.dealerDisqualifiedAnteMode !== 'PAY_ON_PLAYER_WIN' ? 'selected' : ''}>Push Ante, Blind, and Play</option>
              <option value="PAY_ON_PLAYER_WIN" ${settings.dealerDisqualifiedAnteMode === 'PAY_ON_PLAYER_WIN' ? 'selected' : ''}>Pay winning Ante; push Blind and Play</option>
            </select>
          </label>
          <p class="settings-modal__hint">The winning-Ante option returns the Ante plus a 1:1 win when your hand beats the dealer. Trips still settles independently.</p>
          <label class="settings-modal__field">
            <span>Before-flop Play wager</span>
            <select name="preflopRaiseMode">
              <option value="THREE_ONLY" ${settings.preflopRaiseMode === 'THREE_ONLY' ? 'selected' : ''}>3x only</option>
              <option value="THREE_OR_FOUR" ${settings.preflopRaiseMode !== 'THREE_ONLY' ? 'selected' : ''}>3x or 4x</option>
            </select>
          </label>
          <p class="settings-modal__hint">Choose whether the player may raise 3x only or choose between 3x and 4x before the flop.</p>
          <p class="settings-modal__hint">Default: pair of fours. Trips always settles from the player's hand, even when the dealer does not qualify.</p>
          <p class="settings-modal__hint">Warnings use made hands only. Draws do not trigger a confirmation.</p>
        </div>
        <div class="modal__footer">
          <button class="modal__button modal__button--secondary" type="button" data-settings-cancel>Cancel</button>
          <button class="modal__button modal__button--primary" type="submit">Save Settings</button>
        </div>
      </form>
    `;

    const close = () => this.hideModal();
    modal.querySelector('.modal__header-close')?.addEventListener('click', close);
    modal.querySelector('[data-settings-cancel]')?.addEventListener('click', close);
    modal.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      state.set({
        handWarningEnabled: formData.has('enabled'),
        handWarningThreshold: formData.get('threshold'),
        warnOnCheck: formData.has('warnOnCheck'),
        warnOnFold: formData.has('warnOnFold'),
        debugRevealDealerCards: formData.has('debugRevealDealerCards'),
        dealerQualificationEnabled: formData.has('dealerQualificationEnabled'),
        dealerQualificationMinimum: formData.get('dealerQualificationMinimum'),
        dealerDisqualifiedAnteMode: formData.get('dealerDisqualifiedAnteMode'),
        preflopRaiseMode: formData.get('preflopRaiseMode'),
        selectedPlayMultiplier: formData.get('preflopRaiseMode') === 'THREE_ONLY'
          ? 3
          : state.get('selectedPlayMultiplier'),
      });
      close();
    });
    modalContainer.appendChild(modal);
  }

  /**
   * Create HTML wrapper for a card.
   */
  #createCardWrapperHTML(card, faceDown = false, dimmed = false) {
    const suitSymbol = { hearts: '&hearts;', diamonds: '&diams;', clubs: '&clubs;', spades: '&spades;' };
    const rankSymbol = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const suitClass = card.suit ? `card__suit--${card.suit}` : '';
    const rank = rankSymbol[card.rank] ?? card.rank;
    const suit = suitSymbol[card.suit] || '';

    return `
      <div class="card ${faceDown ? 'card--face-down' : 'card--face-up'} card--${card.suit} ${dimmed ? 'card--dimmed' : ''}" data-card-id="${card.id}">
        <div class="card__front">
          <div class="card__corner">
            <span class="card__rank">${rank}</span>
            <span class="card__suit ${suitClass}">${suit}</span>
          </div>
          <div class="card__pip ${suitClass}">${suit}</div>
          <div class="card__corner card__corner--bottom">
            <span class="card__rank">${rank}</span>
            <span class="card__suit ${suitClass}">${suit}</span>
          </div>
        </div>
        <div class="card__back"></div>
      </div>
    `;
  }

  /**
   * Render a two-line casino-style action button label.
   */
  #setActionButtonContent(button, icon, label, subtitle = null) {
    if (!button) return;

    button.innerHTML = `
      <span class="action-btn__icon" aria-hidden="true">${icon}</span>
      <span class="action-btn__content">
        <span class="action-btn__label">${label}</span>
        ${subtitle ? `<span class="action-btn__subtitle">${subtitle}</span>` : ''}
      </span>
    `;
  }

  /**
   * Handle individual card dealt event.
   */
  #handleCardDealt(data) {
    const { card, index } = data;
    if (!card || index === undefined) return;

    console.log(`[UIController] Card dealt: ${card.getShortNotation()} (index: ${index})`);
  }

  /**
   * Reset UI for next round.
   */
  resetForNextRound() {
    const communityEl = this.#getElement('community-cards');
    if (communityEl) {
      const slots = communityEl.querySelectorAll('.card-slot');
      slots.forEach(slot => slot.innerHTML = '');
    }

    // Clear player cards
    const playerCardsEl = this.#getElement('player-cards');
    if (playerCardsEl) playerCardsEl.innerHTML = '';
    this.#latestPlayerCards = [];
    this.#latestCommunityCards = [];
    this.#updateCurrentHandIndicator();

    // Reset dealer hand
    const dealerArea = this.#getElement('dealer-area');
    if (dealerArea) {
      dealerArea.innerHTML = `
        <div class="dealer-cards" id="dealer-cards">
          <div class="card card--face-down"></div>
          <div class="card card--face-down"></div>
        </div>
      `;
    }

    // Reset community card counter for incremental rendering
    this.#_prevCommunityCount = 0;
    this.#playerBestCardIds.clear();
    this.#dealerBestCardIds.clear();

    console.log('[UIController] Reset for next round.');
  }

  /**
   * Re-render visible cards once best-five data becomes available.
   */
  #refreshShowdownHighlights() {
    if (this.#latestPlayerCards.length > 0) {
      this.renderCards(this.#latestPlayerCards, this.#latestCommunityCards);
    } else if (this.#latestCommunityCards.length > 0) {
      this.renderCommunityCards(this.#latestCommunityCards);
    }

    if (this.#latestDealerCards.length > 0) {
      this.renderDealerHand(this.#latestDealerCards, { revealAll: state.get('round') === 'showdown' });
    }
  }

  /**
   * Whether a player hole card is outside the best five.
   */
  #shouldDimPlayerCard(card) {
    return state.get('round') === 'showdown'
      && this.#playerBestCardIds.size > 0
      && !this.#playerBestCardIds.has(card.id);
  }

  /**
   * Whether a dealer hole card is outside the best five.
   */
  #shouldDimDealerCard(card) {
    return state.get('round') === 'showdown'
      && this.#dealerBestCardIds.size > 0
      && !this.#dealerBestCardIds.has(card.id);
  }

  /**
   * Dim board cards only when neither evaluated hand uses them.
   */
  #shouldDimCommunityCard(card) {
    return state.get('round') === 'showdown'
      && (this.#playerBestCardIds.size > 0 || this.#dealerBestCardIds.size > 0)
      && !this.#playerBestCardIds.has(card.id)
      && !this.#dealerBestCardIds.has(card.id);
  }
}
