/**
 * AnimationManager - Centralized animation system for UI transitions and effects.
 *
 * Responsibilities:
 * - Manage CSS animations and transitions
 * - Provide requestAnimationFrame-based animation loops
 * - Handle card dealing, chip movement, and win effects
 * - Support animation queuing and chaining
 * - Respect reduced motion accessibility settings
 *
 * Dependencies: EventBus, Constants (ANIMATIONS), StateManager
 * Events consumed: 'stateChange', 'animation:start', 'animation:end'
 * Events emitted: 'animationStart', 'animationEnd', 'animationComplete'
 *
 * Public API:
 * - constructor()
 * - play(element, animationName, duration)
 * - animate(element, properties, duration, easing)
 * - dealCard(element, targetPosition, callback)
 * - revealCard(cardElement, callback)
 * - moveChips(chipElement, targetPosition, callback)
 * - showWinEffect(element, amount)
 * - queueAnimation(animation)
 * - setSpeed(multiplier)
 */

import { bus } from '../core/EventBus.js';
import { state } from '../core/StateManager.js';
import { ANIMATIONS } from '../config/constants.js';

export class AnimationManager {
  #animations = new Map();
  #queue = [];
  #isPlaying = false;
  #speedMultiplier = 1;
  #rafIds = new Set();
  #reducedMotion = false;

  /**
   * Create an AnimationManager instance.
   */
  constructor() {
    this.#bindEvents();
    this.#loadSettings();
  }

  /**
   * Subscribe to relevant game events.
   */
  #bindEvents() {
    bus.on('stateChange', (data) => {
      this.#handleStateChange(data);
    });

    bus.on('animation:start', (data) => {
      if (data && data.animation) {
        this.play(data.element, data.animation, data.duration);
      }
    });
  }

  /**
   * Load animation settings from state.
   */
  #loadSettings() {
    const speed = state.get('animationSpeed');
    if (speed !== undefined) {
      this.#speedMultiplier = speed;
    }

    const reducedMotion = state.get('reducedMotion') ?? false;
    if (this.#reducedMotion !== reducedMotion) {
      this.#reducedMotion = reducedMotion;
    }
  }

  /**
   * Handle game state changes for animation triggers.
   */
  #handleStateChange(data) {
    const { current } = data;

    if (current.animationSpeed !== undefined && current.animationSpeed !== this.#speedMultiplier) {
      this.#speedMultiplier = current.animationSpeed;
    }

    if (current.reducedMotion !== undefined && current.reducedMotion !== this.#reducedMotion) {
      this.#reducedMotion = current.reducedMotion;
    }
  }

  // ==========================================================================
  // Core Animation Methods
  // ==========================================================================

  /**
   * Play a CSS animation on an element.
   * @param {HTMLElement} element - The target element.
   * @param {string} animationName - Name of the CSS animation.
   * @param {number} [duration] - Duration in ms (uses constant if not provided).
   * @returns {Promise<void>}
   */
  play(element, animationName, duration) {
    if (!element || this.#reducedMotion) {
      return Promise.resolve();
    }

    const adjustedDuration = (duration || ANIMATIONS.CARD_DEAL) / this.#speedMultiplier;

    element.style.animation = `${animationName} ${adjustedDuration}ms ease-out forwards`;

    return new Promise(resolve => {
      const onComplete = () => {
        element.removeEventListener('animationend', onComplete);
        element.style.animation = '';
        resolve();
      };
      element.addEventListener('animationend', onComplete);

      // Fallback timeout in case animationend doesn't fire
      setTimeout(() => {
        element.removeEventListener('animationend', onComplete);
        element.style.animation = '';
        resolve();
      }, adjustedDuration + 100);
    });
  }

  /**
   * Animate element properties using requestAnimationFrame.
   * @param {HTMLElement} element - The target element.
   * @param {Object} properties - Properties to animate (opacity, transform, etc.).
   * @param {number} [duration] - Duration in ms.
   * @param {string} [easing] - Easing function name.
   * @returns {Promise<void>}
   */
  async animate(element, properties, duration, easing = 'ease-out') {
    if (!element || this.#reducedMotion) {
      return Promise.resolve();
    }

    const adjustedDuration = (duration || ANIMATIONS.FADE_IN) / this.#speedMultiplier;
    const startValues = {};
    const endValues = {};

    // Capture current computed styles
    for (const key in properties) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        const computed = getComputedStyle(element);
        startValues[key] = this.#parseValue(computed.getPropertyValue(key));
        endValues[key] = properties[key];
      }
    }

    return new Promise(resolve => {
      let startTime = null;

      const animateFrame = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / adjustedDuration, 1);

        // Apply easing
        const easedProgress = this.#applyEasing(progress, easing);

        // Update properties
        for (const key in startValues) {
          if (Object.prototype.hasOwnProperty.call(startValues, key)) {
            const start = startValues[key];
            const end = endValues[key];
            const current = start + (end - start) * easedProgress;
            element.style.setProperty(key, current);
          }
        }

        if (progress < 1) {
          const rafId = requestAnimationFrame(animateFrame);
          this.#rafIds.add(rafId);
        } else {
          // Animation complete - clean up RAF
          for (const id of this.#rafIds) {
            cancelAnimationFrame(id);
          }
          this.#rafIds.clear();
          resolve();
        }
      };

      const rafId = requestAnimationFrame(animateFrame);
      this.#rafIds.add(rafId);
    });
  }

  // ==========================================================================
  // Card Animation Methods
  // ==========================================================================

  /**
   * Animate a card being dealt to a position.
   * @param {HTMLElement} cardElement - The card element.
   * @param {Object} targetPosition - Target {x, y} coordinates.
   * @param {Function} [callback] - Callback when animation completes.
   * @returns {Promise<void>}
   */
  async dealCard(cardElement, targetPosition, callback) {
    if (this.#reducedMotion) {
      cardElement.style.transform = `translate(${targetPosition.x}px, ${targetPosition.y}px)`;
      return Promise.resolve(callback?.());
    }

    const adjustedDuration = ANIMATIONS.CARD_DEAL / this.#speedMultiplier;

    // Start from off-screen position
    cardElement.style.transition = `transform ${adjustedDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
    cardElement.style.transform = `translate(${targetPosition.x}px, ${targetPosition.y}px)`;

    return new Promise(resolve => {
      const onComplete = () => {
        cardElement.removeEventListener('transitionend', onComplete);
        callback?.();
        resolve();
      };
      cardElement.addEventListener('transitionend', onComplete);

      setTimeout(() => {
        cardElement.removeEventListener('transitionend', onComplete);
        resolve();
      }, adjustedDuration + 100);
    });
  }

  /**
   * Animate a card being revealed (flipped).
   * @param {HTMLElement} cardElement - The card element.
   * @param {Function} [callback] - Callback when animation completes.
   * @returns {Promise<void>}
   */
  async revealCard(cardElement, callback) {
    if (this.#reducedMotion) {
      return Promise.resolve(callback?.());
    }

    const adjustedDuration = ANIMATIONS.CARD_REVEAL / this.#speedMultiplier;

    cardElement.style.transition = `transform ${adjustedDuration}ms ease-in-out`;
    cardElement.style.transform = 'rotateY(180deg)';

    return new Promise(resolve => {
      const onComplete = () => {
        cardElement.removeEventListener('transitionend', onComplete);
        callback?.();
        resolve();
      };
      cardElement.addEventListener('transitionend', onComplete);

      setTimeout(() => {
        cardElement.removeEventListener('transitionend', onComplete);
        resolve();
      }, adjustedDuration + 100);
    });
  }

  // ==========================================================================
  // Chip Animation Methods
  // ==========================================================================

  /**
   * Animate chips being moved to the pot.
   * @param {HTMLElement} chipElement - The chip element(s).
   * @param {Object} targetPosition - Target {x, y} coordinates.
   * @param {Function} [callback] - Callback when animation completes.
   * @returns {Promise<void>}
   */
  async moveChips(chipElement, targetPosition, callback) {
    if (this.#reducedMotion) {
      chipElement.style.transform = `translate(${targetPosition.x}px, ${targetPosition.y}px)`;
      return Promise.resolve(callback?.());
    }

    const adjustedDuration = ANIMATIONS.CHIP_MOVE / this.#speedMultiplier;

    chipElement.style.transition = `transform ${adjustedDuration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
    chipElement.style.transform = `translate(${targetPosition.x}px, ${targetPosition.y}px) scale(0.8)`;

    return new Promise(resolve => {
      const onComplete = () => {
        chipElement.removeEventListener('transitionend', onComplete);
        callback?.();
        resolve();
      };
      chipElement.addEventListener('transitionend', onComplete);

      setTimeout(() => {
        chipElement.removeEventListener('transitionend', onComplete);
        resolve();
      }, adjustedDuration + 100);
    });
  }

  /**
   * Show a win effect (pulsing/glowing) on the player's area.
   * @param {HTMLElement} element - The element to animate.
   * @param {number} [amount] - Win amount for display.
   * @returns {Promise<void>}
   */
  async showWinEffect(element, amount) {
    if (this.#reducedMotion) return Promise.resolve();

    const adjustedDuration = ANIMATIONS.WIN_PULSE / this.#speedMultiplier;

    // Pulse animation
    element.style.animation = `winPulse ${adjustedDuration}ms ease-in-out`;

    // Add win amount display if provided
    if (amount !== undefined && amount !== 0) {
      const winDisplay = document.createElement('div');
      winDisplay.className = 'win-amount';
      winDisplay.textContent = `+$${amount.toLocaleString()}`;
      element.appendChild(winDisplay);

      // Animate the win display
      winDisplay.style.opacity = '1';
      setTimeout(() => {
        winDisplay.style.transition = 'opacity 0.5s ease-out';
        winDisplay.style.opacity = '0';
        setTimeout(() => winDisplay.remove(), 500);
      }, adjustedDuration / 2);
    }

    return new Promise(resolve => {
      const onComplete = () => {
        element.removeEventListener('animationend', onComplete);
        element.style.animation = '';
        resolve();
      };
      element.addEventListener('animationend', onComplete);

      setTimeout(() => {
        element.removeEventListener('animationend', onComplete);
        element.style.animation = '';
        resolve();
      }, adjustedDuration + 100);
    });
  }

  // ==========================================================================
  // Queue Management
  // ==========================================================================

  /**
   * Add an animation to the queue.
   * @param {Object} animation - Animation config { element, type, data }.
   */
  queueAnimation(animation) {
    this.#queue.push({
      ...animation,
      timestamp: Date.now(),
    });

    if (!this.#isPlaying) {
      this.#processQueue();
    }
  }

  /**
   * Process the animation queue sequentially.
   */
  async #processQueue() {
    if (this.#queue.length === 0) {
      this.#isPlaying = false;
      return;
    }

    this.#isPlaying = true;
    const animation = this.#queue.shift();

    try {
      switch (animation.type) {
        case 'deal':
          await this.dealCard(animation.element, animation.data?.position);
          break;
        case 'reveal':
          await this.revealCard(animation.element);
          break;
        case 'moveChips':
          await this.moveChips(animation.element, animation.data?.position);
          break;
        case 'winEffect':
          await this.showWinEffect(animation.element, animation.data?.amount);
          break;
        case 'fade':
          await this.animate(animation.element, { opacity: animation.data?.opacity || 1 }, animation.data?.duration);
          break;
      }

      bus.emit('animationComplete', animation);
    } catch (error) {
      console.error('[AnimationManager] Error processing queue:', error);
    }

    // Process next animation after a small delay
    setTimeout(() => this.#processQueue(), 50 / this.#speedMultiplier);
  }

  /**
   * Clear the animation queue.
   */
  clearQueue() {
    this.#queue = [];
  }

  /**
   * Set the animation speed multiplier.
   * @param {number} multiplier - Speed multiplier (0.5 = half speed, 2 = double speed).
   */
  setSpeed(multiplier) {
    this.#speedMultiplier = Math.max(0.1, Math.min(3, multiplier));
  }

  /**
   * Get the current animation speed.
   * @returns {number}
   */
  get speed() {
    return this.#speedMultiplier;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Parse a CSS value for interpolation.
   */
  #parseValue(value) {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Apply an easing function to a progress value.
   */
  #applyEasing(t, easing) {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - Math.pow(1 - t, 3);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'linear':
        return t;
      default:
        return 1 - Math.pow(1 - t, 3); // ease-out as default
    }
  }

  /**
   * Stop all active animations.
   */
  stopAll() {
    for (const id of this.#rafIds) {
      cancelAnimationFrame(id);
    }
    this.#rafIds.clear();
    this.#queue = [];
    this.#isPlaying = false;
  }

  /**
   * Toggle reduced motion mode.
   */
  toggleReducedMotion(enabled) {
    this.#reducedMotion = enabled;
  }
}