/**
 * Helpers - Common utility functions used across the application.
 *
 * Responsibilities:
 * - Provide reusable helper functions
 * - Format numbers, currency, and time
 * - Generate random values
 * - Debounce and throttle functions
 * - Clamp values within ranges
 *
 * Dependencies: None (pure utility functions)
 */

/**
 * Format a number as currency with commas.
 * @param {number} amount - The amount to format.
 * @returns {string} Formatted string.
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('$', '');
}

/**
 * Format a number with comma separators.
 * @param {number} num - The number to format.
 * @returns {string} Formatted string.
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * Clamp a value between min and max.
 * @param {number} value - The value to clamp.
 * @param {number} min - Minimum value.
 * @param {number} max - Maximum value.
 * @returns {number} Clamped value.
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a random integer between min and max (inclusive).
 * @param {number} min - Minimum value.
 * @param {number} max - Maximum value.
 * @returns {number} Random integer.
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max.
 * @param {number} min - Minimum value.
 * @param {number} max - Maximum value.
 * @returns {number} Random float.
 */
export function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Pick a random item from an array.
 * @param {Array} arr - The array to pick from.
 * @returns {*} Random item.
 */
export function randomChoice(arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffle an array using Fisher-Yates algorithm (mutates original).
 * @param {Array} arr - The array to shuffle.
 * @returns {Array} Shuffled array.
 */
export function shuffle(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Debounce a function call.
 * @param {Function} fn - The function to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
export function debounce(fn, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
    return timeoutId;
  };
}

/**
 * Throttle a function call.
 * @param {Function} fn - The function to throttle.
 * @param {number} limit - Time limit in milliseconds.
 * @returns {Function} Throttled function.
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Sleep for a specified duration.
 * @param {number} ms - Duration in milliseconds.
 * @returns {Promise} Promise that resolves after the delay.
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Pad a number with leading zeros.
 * @param {number} num - The number to pad.
 * @param {number} width - Total width of the string.
 * @returns {string} Padded string.
 */
export function padNumber(num, width = 2) {
  return String(num).padStart(width, '0');
}

/**
 * Format a time duration in milliseconds to MM:SS format.
 * @param {number} ms - Duration in milliseconds.
 * @returns {string} Formatted string.
 */
export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${padNumber(secs)}`;
}

/**
 * Check if a value is within a tolerance range.
 * @param {number} actual - The actual value.
 * @param {number} expected - The expected value.
 * @param {number} tolerance - Allowed difference.
 * @returns {boolean}
 */
export function approximately(actual, expected, tolerance = 0.01) {
  return Math.abs(actual - expected) <= tolerance;
}

/**
 * Create a unique ID prefix for DOM elements.
 * @param {string} namespace - The component namespace.
 * @returns {string} Unique prefixed ID.
 */
export function createId(namespace) {
  return `${namespace}-${randomInt(1000, 9999)}`;
}

/**
 * Deep clone an object using structuredClone (with fallback).
 * @param {*} obj - The object to clone.
 * @returns {*} Cloned object.
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Merge two objects deeply.
 * @param {Object} target - Target object.
 * @param {Object} source - Source object(s).
 * @returns {Object} Merged object.
 */
export function deepMerge(target, ...sources) {
  for (const source of sources) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          target[key] = deepMerge(target[key] || {}, source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }
  return target;
}

/**
 * Truncate a string to a maximum length with ellipsis.
 * @param {string} str - The string to truncate.
 * @param {number} maxLength - Maximum length including ellipsis.
 * @returns {string} Truncated string.
 */
export function truncate(str, maxLength = 50) {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str - The string to capitalize.
 * @returns {string} Capitalized string.
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert a camelCase string to kebab-case.
 * @param {string} str - The string to convert.
 * @returns {string} Kebab-case string.
 */
export function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Convert a kebab-case string to camelCase.
 * @param {string} str - The string to convert.
 * @returns {string} CamelCase string.
 */
export function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (match, char) => char.toUpperCase());
}

/**
 * Calculate percentage of a value relative to another.
 * @param {number} part - The part.
 * @param {number} whole - The whole.
 * @returns {number} Percentage (0-100).
 */
export function percentage(part, whole) {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

/**
 * Calculate compound interest or multiplier.
 * @param {number} base - The base amount.
 * @param {number} multiplier - The payout multiplier.
 * @returns {number} Total amount (base + winnings).
 */
export function calculatePayout(base, multiplier) {
  return base + (base * multiplier);
}

/**
 * Get the appropriate chip color for a value.
 * @param {number} value - The chip value.
 * @returns {string} Color name.
 */
export function getChipColor(value) {
  const colors = {
    1: 'red',
    5: 'blue',
    10: 'green',
    25: 'black',
    100: 'purple',
    500: 'gold',
  };
  return colors[value] || 'gray';
}

/**
 * Smoothly interpolate between two values.
 * @param {number} start - Start value.
 * @param {number} end - End value.
 * @param {number} t - Interpolation factor (0-1).
 * @returns {number} Interpolated value.
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Map a value from one range to another.
 * @param {number} value - The value to map.
 * @param {number} inMin - Input range minimum.
 * @param {number} inMax - Input range maximum.
 * @param {number} outMin - Output range minimum.
 * @param {number} outMax - Output range maximum.
 * @returns {number} Mapped value.
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}