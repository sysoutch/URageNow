/**
 * main.js - Application entry point for Ultimate Texas Hold'em.
 *
 * Responsibilities:
 * - Initialize all game systems and managers
 * - Start the game loop
 * - Handle application lifecycle (start, pause, resume)
 * - Provide global access to core services
 *
 * Dependencies: All other modules
 */

import { bus } from './core/EventBus.js';
import { state } from './core/StateManager.js';
import { GameEngine } from './engine/GameEngine.js';
import { UIController } from './ui/UIController.js';
import { AnimationManager } from './animations/AnimationManager.js';
import { SoundManager } from './audio/SoundManager.js';
import { SaveManager } from './storage/SaveManager.js';
import { Statistics } from './statistics/Statistics.js';
import { SaloonMenu } from './ui/SaloonMenu.js';
import { findSaloon } from './config/saloons.js';

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'DOM card table; no positional movement controls',
  ...state.get(),
  visibleCommunityCards: Array.from(document.querySelectorAll('#community-cards .card'))
    .map(card => card.textContent.trim())
    .filter(Boolean),
  visiblePlayerCards: Array.from(document.querySelectorAll('#player-cards .card'))
    .map(card => card.textContent.trim())
    .filter(Boolean),
  result: document.getElementById('hand-name')?.textContent?.trim() || '',
  saloonMenuOpen: Boolean(document.querySelector('.saloon-menu')),
  selectedSaloon: findSaloon(state.get('selectedSaloonId')).name,
});

window.advanceTime = () => {
  // The table is event-driven; exposing this deterministic no-op lets game automation
  // observe stable state between user actions without changing real animation timing.
};
import { AIEngine } from './ai/AIEngine.js';
import { EVENTS, THEMES } from './config/constants.js';

/**
 * Game Application - Main orchestrator class.
 */
export class GameApplication {
  #gameEngine;
  #uiController;
  #animationManager;
  #soundManager;
  #saveManager;
  #statistics;
  #aiEngine;
  #saloonMenu;
  #isRunning;

  /**
   * Create a new GameApplication instance.
   */
  constructor() {
    this.#gameEngine = null;
    this.#uiController = null;
    this.#animationManager = null;
    this.#soundManager = null;
    this.#saveManager = null;
    this.#statistics = null;
    this.#aiEngine = null;
    this.#saloonMenu = null;
    this.#isRunning = false;
  }

  /**
   * Initialize the game application.
   */
  async init() {
    console.log('[GameApp] Initializing Ultimate Texas Hold\'em...');

    // Initialize core systems
    this.#initializeState();
    this.#initializeSoundManager();
    this.#initializeSaveManager();
    this.#initializeStatistics();

    // Initialize game engine (creates deck, players, etc.)
    this.#gameEngine = new GameEngine();
    await this.#gameEngine.init();

    // Initialize UI controller
    this.#uiController = new UIController();
    this.#uiController.init();

    // Initialize animation manager
    this.#animationManager = new AnimationManager();

    // Initialize AI engine for table opponents
    this.#aiEngine = new AIEngine(this.#gameEngine);

    // Bind game events to UI updates (NOTE: GameEngine handles GAME_READY internally)
    this.#bindGameEvents();

    // Load saved settings if available
    this.#loadSettings();

    this.#isRunning = true;

    console.log('[GameApp] Game initialized successfully.');

    this.#openSaloonMenu();
  }

  /**
   * Initialize the state manager with default values.
   */
  #initializeState() {
    state.init({
      bankroll: 1000,
      anteBet: 0,
      playBet: 0,
      blindBet: 0,
      tripsBet: 0,
      pot: 0,
      currentRound: 'ante',
      phase: 'idle',
      deckShuffled: false,
      animationSpeed: 1,
      reducedMotion: false,
      showDealerUpcard: false,
      debugRevealDealerCards: false,
      selectedPlayMultiplier: 3,
      tableRulePreset: 'official',
      dealerQualificationEnabled: true,
      dealerQualificationMinimum: 'PAIR_4',
      dealerDisqualifiedAnteMode: 'PUSH',
      preflopRaiseMode: 'THREE_OR_FOUR',
      selectedSaloonId: 'dusty-spur',
      handWarningEnabled: true,
      handWarningThreshold: 'ONE_PAIR',
      warnOnCheck: true,
      warnOnFold: true,
    });
  }

  #openSaloonMenu() {
    this.#saloonMenu = new SaloonMenu({
      container: document.getElementById('saloon-menu-container'),
      onSelect: ({ saloon, ante }) => {
        const usesOfficialRules = state.get('tableRulePreset') !== 'legacy';
        state.set({
          selectedSaloonId: saloon.id,
          anteBet: ante,
          blindBet: usesOfficialRules ? ante : 0,
          tripsBet: 0,
        });
        const saloonName = document.getElementById('current-saloon-name');
        if (saloonName) saloonName.textContent = saloon.name;
        this.startRound();
      },
    });
    this.#saloonMenu.open({
      bankroll: state.get('bankroll'),
      selectedSaloonId: state.get('selectedSaloonId'),
    });
  }

  /**
   * Initialize the sound manager.
   */
  #initializeSoundManager() {
    this.#soundManager = new SoundManager();

    // Load default sounds (placeholder WAV files)
    const soundManifest = [
      { name: 'deal', src: './assets/sounds/deal.wav', type: 'sfx' },
      { name: 'cards', src: './assets/sounds/cards.wav', type: 'sfx' },
      { name: 'reveal', src: './assets/sounds/reveal.wav', type: 'sfx' },
      { name: 'win', src: './assets/sounds/win.wav', type: 'sfx' },
      { name: 'lose', src: './assets/sounds/lose.wav', type: 'sfx' },
      { name: 'collect', src: './assets/sounds/collect.wav', type: 'sfx' },
    ];

    this.#soundManager.init(soundManifest);
  }

  /**
   * Initialize the save manager.
   */
  #initializeSaveManager() {
    this.#saveManager = new SaveManager();
  }

  /**
   * Initialize statistics tracking.
   */
  #initializeStatistics() {
    this.#statistics = new Statistics();
  }

  /**
   * Bind game events to UI and system updates.
   */
  #bindGameEvents() {
    // When a round starts, update the UI (bet display reset is handled by UIController internally)
    bus.on(EVENTS.ROUND_START, (data) => {
      if (this.#uiController) {
        this.#uiController.updateBettingUI();
      }
    });

    // NOTE: PAYOUT_COMPLETE and ROUND_END handling for "New Round" button
    // is handled entirely by UIController to avoid duplicate modals/buttons.
  }

  /**
   * Load saved settings from storage.
   */
  #loadSettings() {
    const settings = this.#saveManager.loadSettings();
    if (settings) {
      state.set(settings);

      // Apply animation speed
      if (this.#animationManager && settings.animationSpeed) {
        this.#animationManager.setSpeed(settings.animationSpeed);
      }

      // Apply reduced motion setting
      if (settings.reducedMotion) {
        document.body.classList.add('reduced-motion');
      }
    }
  }

  /**
   * Start a new round of poker.
   */
  startRound() {
    if (!this.#isRunning || !this.#gameEngine) return;

    this.#gameEngine.startRound();
  }

  /**
   * Handle user action (betting decision).
   */
  handleUserAction(action, amount = 0) {
    if (!this.#isRunning || !this.#gameEngine) return;

    bus.emit(EVENTS.USER_ACTION, { action, amount });
  }

  /**
   * Get the current game state.
   */
  getState() {
    return state.get();
  }

  /**
   * Update a game state value.
   */
  setState(key, value) {
    state.set(key, value);
  }

  /**
   * Save the current game to a slot.
   */
  saveGame(slotIndex = 0) {
    if (!this.#saveManager || !this.#gameEngine) return;

    const gameState = this.#gameEngine.getGameState();
    this.#saveManager.save(slotIndex, gameState);
  }

  /**
   * Load a saved game from a slot.
   */
  loadGame(slotIndex = 0) {
    if (!this.#saveManager || !this.#gameEngine) return;

    const saveData = this.#saveManager.load(slotIndex);
    if (saveData) {
      this.#gameEngine.loadGameState(saveData);
      console.log('[GameApp] Game loaded from slot', slotIndex);
    }
  }

  /**
   * Get the current statistics.
   */
  getStatistics() {
    return this.#statistics?.getStats();
  }

  /**
   * Get unlocked achievements.
   */
  getAchievements() {
    return this.#statistics?.getAllAchievements();
  }

  /**
   * Toggle mute state for audio.
   */
  toggleMute() {
    if (this.#soundManager) {
      const isMuted = this.#soundManager.toggleMute();
      document.body.classList.toggle('muted', isMuted);
      return isMuted;
    }
    return true;
  }

  /**
   * Set the game theme.
   */
  setTheme(themeName) {
    const theme = THEMES[themeName];
    if (!theme) {
      console.warn(`[GameApp] Unknown theme: ${themeName}`);
      return;
    }

    state.set('theme', themeName);
    bus.emit('settingsChanged', { theme: themeName });

    // Save settings
    this.#saveManager?.saveSettings(state.get());
  }

  /**
   * Set animation speed.
   */
  setAnimationSpeed(speed) {
    state.set('animationSpeed', speed);
    if (this.#animationManager) {
      this.#animationManager.setSpeed(speed);
    }

    // Save settings
    this.#saveManager?.saveSettings(state.get());
  }

  /**
   * Toggle reduced motion mode.
   */
  toggleReducedMotion(enabled) {
    state.set('reducedMotion', enabled);
    document.body.classList.toggle('reduced-motion', enabled);

    if (this.#animationManager) {
      this.#animationManager.toggleReducedMotion(enabled);
    }

    // Save settings
    this.#saveManager?.saveSettings(state.get());
  }

  /**
   * Start the game loop.
   */
  start() {
    this.#isRunning = true;
    console.log('[GameApp] Game started.');
  }

  /**
   * Pause the game.
   */
  pause() {
    this.#isRunning = false;
    if (this.#soundManager) {
      this.#soundManager.stopMusic();
    }
    console.log('[GameApp] Game paused.');
  }

  /**
   * Resume the game.
   */
  resume() {
    this.#isRunning = true;
    if (this.#soundManager) {
      this.#soundManager.startMusic();
    }
    console.log('[GameApp] Game resumed.');
  }

  /**
   * Stop and clean up the game.
   */
  stop() {
    this.#isRunning = false;

    // Save state
    if (this.#saveManager && this.#gameEngine) {
      const gameState = this.#gameEngine.getGameState();
      this.#saveManager.save(0, gameState);
    }

    // Clean up systems
    if (this.#soundManager) {
      this.#soundManager.dispose();
    }

    bus.removeAllListeners();
    state.reset();

    console.log('[GameApp] Game stopped.');
  }

  /**
   * Get the game engine instance.
   */
  getEngine() {
    return this.#gameEngine;
  }

  /**
   * Get the UI controller instance.
   */
  getUI() {
    return this.#uiController;
  }

  /**
   * Get the sound manager instance.
   */
  getSoundManager() {
    return this.#soundManager;
  }

  /**
   * Get the save manager instance.
   */
  getSaveManager() {
    return this.#saveManager;
  }

  /**
   * Get the statistics instance.
   */
  getStatisticsInstance() {
    return this.#statistics;
  }

  /**
   * Get the AI engine instance.
   */
  getAIEngine() {
    return this.#aiEngine;
  }
}

// ==========================================================================
// Application Bootstrap
// ==========================================================================

/**
 * Create and start the game application.
 */
async function bootstrap() {
  const app = new GameApplication();

  try {
    await app.init();
    app.start();

    // Hide the loading overlay after initialization
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 500);
    }

    // Make app available globally for debugging
    window.__gameApp = app;

    console.log('[GameApp] Bootstrap complete.');
  } catch (error) {
    console.error('[GameApp] Failed to initialize:', error);
    document.body.classList.add('app-error');

    // Still hide overlay on error so user can see the page
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// Export for external use
export const gameApp = null; // Will be set by bootstrap
