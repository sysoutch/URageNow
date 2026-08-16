/**
 * constants.js - Application-wide constants and configuration.
 *
 * Responsibilities:
 * - Define all magic numbers as named constants
 * - Provide game rules configuration
 * - Define UI breakpoints and dimensions
 * - Configure AI behavior parameters
 */

// ===========================================================================
// Game Rules
// ===========================================================================

/** Maximum number of players at the table */
export const MAX_PLAYERS = 8;

/** Number of cards in a standard deck */
export const CARDS_PER_DECK = 52;

/** Number of suits in a deck */
export const SUITS_COUNT = 4;

/** Number of ranks per suit */
export const RANKS_PER_SUIT = 13;

/** Minimum ante bet */
export const MIN_ANTE = 5;

/** Maximum ante bet */
export const MAX_ANTE = 100;

/** Street bet multipliers supported by the table flow */
export const PLAY_BET_MULTIPLIERS = [1, 2, 3, 4];

/** Dealer qualification: Queen or better */
export const DEALER_QUALIFICATION_RANK = 'Q';

// ===========================================================================
// Betting Structure
// ===========================================================================

/** Available bet amounts */
export const BET_AMOUNTS = [5, 10, 25, 50, 100];

/** Default starting bankroll */
export const DEFAULT_BANKROLL = 1000;

/** Ante bet default */
export const DEFAULT_ANTE = 10;

// ===========================================================================
// Game Phases
// ===========================================================================

/** Sequence of game phases */
export const PHASES = {
  IDLE: 'idle',
  ANTE: 'ante',
  DEAL: 'deal',
  PLAY_DECISION: 'play_decision',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  PAYOUT: 'payout',
};

/** Betting rounds where player can act */
export const ACTIVE_PHASES = [PHASES.ANTE, PHASES.PLAY_DECISION];

// ===========================================================================
// Hand Rankings (highest to lowest)
// ===========================================================================

/** Poker hand ranking names and their numeric values */
export const HAND_RANKINGS = {
  HIGH_CARD: { name: 'High Card', value: 1 },
  ONE_PAIR: { name: 'One Pair', value: 2 },
  TWO_PAIR: { name: 'Two Pair', value: 3 },
  THREE_OF_A_KIND: { name: 'Three of a Kind', value: 4 },
  STRAIGHT: { name: 'Straight', value: 5 },
  FLUSH: { name: 'Flush', value: 6 },
  FULL_HOUSE: { name: 'Full House', value: 7 },
  FOUR_OF_A_KIND: { name: 'Four of a Kind', value: 8 },
  STRAIGHT_FLUSH: { name: 'Straight Flush', value: 9 },
  ROYAL_FLUSH: { name: 'Royal Flush', value: 10 },
};

/** Hand ranking names used in payout tables */
export const HAND_NAMES = {
  highCard: 'high_card',
  pair: 'one_pair',
  twoPair: 'two_pair',
  threeOfKind: 'three_of_a_kind',
  straight: 'straight',
  flush: 'flush',
  fullHouse: 'full_house',
  fourOfKind: 'four_of_a_kind',
  straightFlush: 'straight_flush',
  royalFlush: 'royal_flush',
};

// ===========================================================================
// Payout Multipliers
// ===========================================================================

/** Ante bonus payouts (paid regardless of dealer qualification) */
export const ANTE_BONUS_PAYOUTS = {
  straight: 1,
  flush: 1.5,
  fullHouse: 3,
  fourOfKind: 4,
  straightFlush: 50,
};

/** Trips bonus payouts (blind bet bonus) */
export const TRIPS_BONUS_PAYOUTS = {
  threeOfKind: 3,
  straight: 4,
  flush: 6,
  fullHouse: 8,
  fourOfKind: 25,
  straightFlush: 40,
  royalFlush: 50,
};

// ===========================================================================
// Card Definitions
// ===========================================================================

/** Card suits */
export const SUITS = {
  HEARTS: 'hearts',
  DIAMONDS: 'diamonds',
  CLUBS: 'clubs',
  SPADES: 'spades',
};

/** Card ranks */
export const RANKS = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10',
  'J', 'Q', 'K', 'A',
];

/** Numeric values for hand evaluation */
export const RANK_VALUES = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/** Ace-low straight (wheel) */
export const ACE_LOW_STRAIGHT_VALUES = [5, 4, 3, 2, 1];

// ===========================================================================
// UI Dimensions
// ===========================================================================

/** Card dimensions in pixels */
export const CARD_DIMENSIONS = {
  width: 70,
  height: 98,
  borderRadius: 6,
};

/** Chip diameter in pixels */
export const CHIP_SIZE = 28;

/** Seat positions (percentage of table width/height) */
export const SEAT_POSITIONS = [
  { x: 50, y: 95 },   // Human player - bottom center
  { x: 50, y: 5 },    // Top
  { x: 85, y: 20 },   // Right top
  { x: 92, y: 50 },   // Right middle
  { x: 92, y: 75 },   // Right bottom
  { x: 8, y: 75 },    // Left bottom
  { x: 8, y: 50 },    // Left middle
  { x: 15, y: 20 },   // Left top
];

// ===========================================================================
// Animation Settings
// ===========================================================================

/** Default animation durations in milliseconds (camelCase for JS compatibility) */
export const ANIMATIONS = {
  CARD_DEAL: 300,
  CARD_FLIP: 300,
  CHIP_MOVE: 200,
  CHIP_STACK: 300,
  CARD_REVEAL: 500,
  WIN_PULSE: 400,
  FADE_IN: 200,
  FADE_OUT: 200,
  MODAL_SLIDE: 300,
};

/** Animation speed multipliers */
export const ANIMATION_SPEEDS = {
  SLOW: 0.5,
  NORMAL: 1,
  FAST: 2,
};

/** Legacy export for backward compatibility */
export const ANIMATION_DURATIONS = {
  dealCard: ANIMATIONS.CARD_DEAL,
  cardFlip: ANIMATIONS.CARD_FLIP,
  chipMove: ANIMATIONS.CHIP_MOVE,
  chipStack: ANIMATIONS.CHIP_STACK,
  revealCards: ANIMATIONS.CARD_REVEAL,
  payoutChips: ANIMATIONS.WIN_PULSE,
  fadeIn: ANIMATIONS.FADE_IN,
  fadeOut: ANIMATIONS.FADE_OUT,
  modalSlide: ANIMATIONS.MODAL_SLIDE,
};

// ===========================================================================
// AI Behavior
// ===========================================================================

/** Default AI delay before making decisions (ms) */
export const AI_DECISION_DELAY = 1000;

/** AI decision variance (ms) - adds randomness */
export const AI_DECISION_VARIANCE = 500;

/** Aggression levels per AI personality type (0-1 scale) */
export const AGGRESSION_LEVELS = {
  tight: 0.3,
  balanced: 0.5,
  loose: 0.7,
  aggressive: 0.85,
  maniac: 1.0,
};

/** AI personality configuration */
export const AI = {
  TYPES: ['tight', 'balanced', 'loose', 'aggressive', 'maniac'],
  DEFAULT_TYPE: 'balanced',
  DEFAULT_DELAY: AI_DECISION_DELAY,
  DEFAULT_VARIANCE: AI_DECISION_VARIANCE,
  AGGRESSION: AGGRESSION_LEVELS,
  MIN_DECISION_TIME: 500,
  MAX_DECISION_TIME: 2000,
};

// ===========================================================================
// Audio Definitions
// ===========================================================================

/** Sound effect categories and their default volumes */
export const SOUNDS = {
  DEAL: { name: 'deal', volume: 0.6 },
    CARDS_FLIP: { name: 'cards', volume: 0.5 },
    REVEAL: { name: 'reveal', volume: 0.7 },
    WIN: { name: 'win', volume: 0.8 },
    LOSE: { name: 'lose', volume: 0.4 },
    COLLECT: { name: 'collect', volume: 0.5 },
    CLICK: { name: 'click', volume: 0.3 },
    CHIP: { name: 'chip', volume: 0.6 },
};

// ===========================================================================
// Storage Definitions
// ===========================================================================

/** LocalStorage configuration */
export const STORAGE = {
  PREFIX: 'utholdem_',
  GAME_SAVE_KEY: 'utholdem_save',
  SETTINGS_KEY: 'utholdem_settings',
  STATISTICS_KEY: 'utholdem_statistics',
  ACHIEVEMENTS_KEY: 'utholdem_achievements',
  MAX_SLOTS: 5,
  EVENTS: {
    GAME_END: 'gameEnd',
    SAVE_COMPLETE: 'saveComplete',
    LOAD_COMPLETE: 'loadComplete',
    SAVE_ERROR: 'saveError',
    LOAD_ERROR: 'loadError',
  },
};

// Legacy export for backward compatibility
export const STORAGE_KEYS = {
  GAME_SAVE: 'utholdem_save',
  SETTINGS: 'utholdem_settings',
  STATISTICS: 'utholdem_statistics',
};

// ===========================================================================
// Statistics Definitions
// ===========================================================================

/** Default statistics tracking structure */
export const STATISTICS_DEFAULTS = {
  totalHandsPlayed: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  biggestWin: 0,
  biggestLoss: 0,
  totalWagered: 0,
  totalWon: 0,
  totalLost: 0,
  biggestBankroll: 1000,
  currentWinStreak: 0,
  maxWinStreak: 0,
  currentLossStreak: 0,
  maxLossStreak: 0,
  handFrequencies: {},
  dealerQualifies: 0,
  dealerQualifyRate: 0,
};

/** Statistics storage configuration */
export const STATISTICS = {
  KEY: 'utholdem_statistics',
  ACHIEVEMENTS_KEY: 'utholdem_achievements',
  DEFAULTS: STATISTICS_DEFAULTS,
  EVENTS: {
    UPDATED: 'statisticsUpdated',
    ACHIEVEMENT_UNLOCKED: 'achievementUnlocked',
  },
};

/** Achievement definitions */
export const ACHIEVEMENTS = {
  first_win: { id: 'first_win', name: 'First Win', description: 'Win your first hand', condition: { type: 'wins', value: 1 }, reward: 100 },
  royal_flush: { id: 'royal_flush', name: 'Royal Flush!', description: 'Get a Royal Flush', condition: { type: 'handType', value: 'royal_flush' }, reward: 1000 },
  big_win: { id: 'big_win', name: 'Big Winner', description: 'Win 10x the ante', condition: { type: 'biggestWin', value: 500 }, reward: 500 },
  first_session: { id: 'first_session', name: 'First Session', description: 'Complete your first session', condition: { type: 'totalHandsPlayed', value: 1 }, reward: 50 },
};

/** Responsive design breakpoints in pixels */
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1440,
};

// ===========================================================================
// Storage Keys (legacy - use STORAGE object above)
// ===========================================================================

/** Number of save slots (use STORAGE.MAX_SLOTS) */
export const SAVE_SLOTS_COUNT = 5;

// ===========================================================================
// Themes
// ===========================================================================

/** Theme color definitions for each available theme */
export const THEME_COLORS = {
  classic: {
    feltPrimary: '#2d5a3d',
    feltSecondary: '#1e4d2b',
    tableBorder: '#8b6914',
    cardBackground: '#ffffff',
    chipBase: '#ff4444',
    textPrimary: '#ffffff',
    textSecondary: '#d4c5a0',
    accentGold: '#d4af37',
    accentRed: '#cc3333',
    accentGreen: '#2d8a4e',
    accentBlue: '#3366cc',
  },
  dark: {
    feltPrimary: '#1a1a2e',
    feltSecondary: '#0f0f1a',
    tableBorder: '#4a4a6a',
    cardBackground: '#2a2a3e',
    chipBase: '#ff5555',
    textPrimary: '#e0e0e0',
    textSecondary: '#8888aa',
    accentGold: '#c7a631',
    accentRed: '#dd4444',
    accentGreen: '#3d9a5e',
    accentBlue: '#4477dd',
  },
  vegas: {
    feltPrimary: '#2d6b3f',
    feltSecondary: '#1e5a30',
    tableBorder: '#ffd700',
    cardBackground: '#ffffff',
    chipBase: '#ff2222',
    textPrimary: '#ffffff',
    textSecondary: '#ffd700',
    accentGold: '#ffd700',
    accentRed: '#cc1111',
    accentGreen: '#3dab5e',
    accentBlue: '#2255bb',
  },
};

/** Available visual themes with display names and color definitions */
export const THEMES = {
  CLASSIC: 'classic',
  DARK: 'dark',
  VEGAS: 'vegas',
};

/** Theme metadata for UI display */
export const THEME_META = {
  classic: { name: 'Classic Green', description: 'Traditional casino green felt' },
  dark: { name: 'Dark Night', description: 'Sleek dark theme for late-night play' },
  vegas: { name: 'Vegas Gold', description: 'Luxurious gold-accented Vegas style' },
};

// ===========================================================================
// Event Names (for EventBus)
// ===========================================================================

export const EVENTS = {
  // Application lifecycle
  GAME_READY: 'gameReady',
  GAME_END: 'gameEnd',

  // Game flow
  ROUND_START: 'roundStart',
  ROUND_END: 'roundEnd',
  PHASE_CHANGE: 'phaseChange',

  // User & AI actions
  USER_ACTION: 'userAction',
  AI_ACTION: 'aiAction',
  AI_DECISION: 'aiDecision',

  // Betting
  BET_PLACED: 'betPlaced',
  BET_VALIDATED: 'betValidated',
  BET_INVALID: 'betInvalid',
  BETTING_ROUND_START: 'bettingRoundStart',
  BETTING_COMPLETE: 'bettingComplete',

  // Showdown
  SHOWDOWN_START: 'showdownStart',

  // Cards
  CARDS_DEALT: 'cardsDealt',

  // Hand evaluation
  HAND_EVALUATED: 'handEvaluated',
  DEALER_QUALIFIED: 'dealerQualified',

  // Payouts
  PAYOUT_CALCULATED: 'payoutCalculated',
  PAYOUT_COMPLETE: 'payoutComplete',

  // Player events
  PLAYER_FOLD: 'playerFold',
  PLAYER_ACTION: 'playerAction',
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  RAISE: 'raise',
  ALL_IN: 'allIn',

  // Settings
  SETTINGS_CHANGED: 'settingsChanged',

  // New round request (from UI)
  NEW_ROUND_REQUESTED: 'newRoundRequested',
  CASH_ADDED: 'cashAdded',
};

// ===========================================================================
// Error Messages
// ===========================================================================

export const ERRORS = {
  DECK_EMPTY: 'Cannot draw from an empty deck',
  INVALID_HAND: 'Invalid hand configuration',
  INSUFFICIENT_BANKROLL: 'Insufficient bankroll for this bet',
  INVALID_PHASE: 'Action not allowed in current phase',
  STATE_CORRUPTED: 'Game state appears corrupted',
};

// ===========================================================================
// Exported Helper - Validate constants
// ===========================================================================

/**
 * Run basic sanity checks on constant values.
 */
export function validateConstants() {
  if (RANKS.length !== RANKS_PER_SUIT) {
    console.warn('[Constants] RANKS length does not match RANKS_PER_SUIT');
  }

  if (Object.keys(SUITS).length !== SUITS_COUNT) {
    console.warn('[Constants] SUITS count does not match SUITS_COUNT');
  }

  if (MAX_PLAYERS > 8 || MAX_PLAYERS < 2) {
    console.warn('[Constants] MAX_PLAYERS should be between 2 and 8');
  }
}
