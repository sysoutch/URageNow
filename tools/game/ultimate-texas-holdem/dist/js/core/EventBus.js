/**
 * EventBus - Central event system for decoupled communication between modules.
 *
 * Responsibilities:
 * - Emit and listen to named events across the application
 * - Allow modules to communicate without direct dependencies
 * - Manage event lifecycle (subscribe, unsubscribe, emit)
 *
 * Dependencies: None (pure utility class)
 *
 * Public API:
 * - on(event, handler)     - Subscribe to an event
 * - off(event, handler)    - Unsubscribe from an event
 * - once(event, handler)   - Subscribe to fire only once
 * - emit(event, ...args)   - Emit an event with optional data
 */
export class EventBus {
  #listeners = new Map();

  /**
   * Subscribe to an event.
   * @param {string} event - The event name.
   * @param {Function} handler - The callback function.
   * @returns {Function} - A cleanup function that removes the listener.
   */
  on(event, handler) {
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, []);
    }

    const handlers = this.#listeners.get(event);
    handlers.push(handler);

    // Return a cleanup function for easy subscription management
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event - The event name.
   * @param {Function} handler - The callback function to remove.
   */
  off(event, handler) {
    if (!this.#listeners.has(event)) return;

    const handlers = this.#listeners.get(event);
    const index = handlers.indexOf(handler);

    if (index > -1) {
      handlers.splice(index, 1);
    }

    // Clean up empty event entries
    if (handlers.length === 0) {
      this.#listeners.delete(event);
    }
  }

  /**
   * Subscribe to an event that fires only once.
   * @param {string} event - The event name.
   * @param {Function} handler - The callback function.
   * @returns {Function} - A cleanup function that removes the listener.
   */
  once(event, handler) {
    const wrapped = (...args) => {
      this.off(event, wrapped);
      handler(...args);
    };

    return this.on(event, wrapped);
  }

  /**
   * Emit an event with optional data.
   * @param {string} event - The event name.
   * @param {...*} args - Arguments to pass to handlers.
   */
  emit(event, ...args) {
    if (!this.#listeners.has(event)) return;

    const handlers = [...this.#listeners.get(event)];

    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[EventBus] Error handling event '${event}':`, error);
      }
    }
  }

  /**
   * Check if an event has any listeners.
   * @param {string} event - The event name.
   * @returns {boolean}
   */
  hasListeners(event) {
    return this.#listeners.has(event) && this.#listeners.get(event).length > 0;
  }

  /**
   * Remove all listeners for a specific event.
   * @param {string} event - The event name.
   */
  removeAllListeners(event) {
    if (event) {
      this.#listeners.delete(event);
    } else {
      this.#listeners.clear();
    }
  }

  /**
   * Get the count of listeners for an event.
   * @param {string} event - The event name.
   * @returns {number}
   */
  listenerCount(event) {
    if (!this.#listeners.has(event)) return 0;
    return this.#listeners.get(event).length;
  }
}

// Export a singleton instance for global use
export const bus = new EventBus();