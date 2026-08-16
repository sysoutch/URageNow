import {
    DEFAULT_AI_GUESS_POOL_TARGET,
    DEFAULT_WORD_LENGTH,
    DEFAULT_WORD_POOL_SIZE,
    DEFAULT_WORDLIST_TARGET_SIZE,
    MAX_AI_GUESS_POOL_TARGET,
    MAX_WORD_LENGTH,
    MAX_WORD_POOL_SIZE,
    MAX_WORDLIST_TARGET_SIZE,
    MIN_AI_GUESS_POOL_TARGET,
    MIN_WORD_LENGTH,
    MIN_WORD_POOL_SIZE,
    MIN_WORDLIST_TARGET_SIZE
} from './constants.js';

const LATIN_SMALL_LETTER_SHARP_S = '\u00DF';
const LATIN_CAPITAL_LETTER_SHARP_S = '\u1E9E';
const EXTENDED_KEYBOARD_ROW = '\u00C4\u00D6\u00DC\u1E9E';
const FRENCH_LABEL = 'fran\u00E7ais';
const SPANISH_LABEL = 'espa\u00F1ol';

export function clampWordLength(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return DEFAULT_WORD_LENGTH;
    return Math.max(MIN_WORD_LENGTH, Math.min(MAX_WORD_LENGTH, parsed));
}

export function clampWordPoolSize(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return DEFAULT_WORD_POOL_SIZE;
    return Math.max(MIN_WORD_POOL_SIZE, Math.min(MAX_WORD_POOL_SIZE, parsed));
}

export function clampWordlistTargetSize(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return DEFAULT_WORDLIST_TARGET_SIZE;
    return Math.max(MIN_WORDLIST_TARGET_SIZE, Math.min(MAX_WORDLIST_TARGET_SIZE, parsed));
}

export function clampAIGuessPoolTarget(value) {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) return DEFAULT_AI_GUESS_POOL_TARGET;
    return Math.max(MIN_AI_GUESS_POOL_TARGET, Math.min(MAX_AI_GUESS_POOL_TARGET, parsed));
}

export function shuffleArray(items) {
    const copy = Array.isArray(items) ? [...items] : [];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

export function createWordMask(wordLength) {
    return 'X'.repeat(clampWordLength(wordLength));
}

export function getDefaultWordStyleOptions() {
    return {
        onlySingular: false,
        allowExtendedLetters: false,
        customInstructions: ''
    };
}

export function normalizeWordStyleOptions(styleOptions) {
    const input = styleOptions && typeof styleOptions === 'object' ? styleOptions : {};
    return {
        onlySingular: Boolean(input.onlySingular),
        allowExtendedLetters: Boolean(input.allowExtendedLetters),
        customInstructions: String(input.customInstructions || '').trim()
    };
}

export function getAlphabetKey(styleOptions) {
    const normalized = normalizeWordStyleOptions(styleOptions);
    return normalized.allowExtendedLetters ? 'extended' : 'ascii';
}

export function getExtendedKeyboardRow() {
    return EXTENDED_KEYBOARD_ROW;
}

export function normalizeToWordLength(raw, wordLength, styleOptions = getDefaultWordStyleOptions()) {
    const text = typeof raw === 'string' ? raw : '';
    const normalizedStyle = normalizeWordStyleOptions(styleOptions);
    const prepared = text
        .trim()
        .normalize('NFC')
        .replace(new RegExp(LATIN_SMALL_LETTER_SHARP_S, 'g'), LATIN_CAPITAL_LETTER_SHARP_S)
        .toUpperCase();
    const chars = normalizedStyle.allowExtendedLetters
        ? (prepared.match(/\p{L}/gu) || [])
        : (prepared.match(/[A-Z]/g) || []);
    const cleaned = chars.join('');
    const normalizedLength = clampWordLength(wordLength);
    return cleaned.length === normalizedLength ? cleaned : '';
}

export function normalizeWordArray(rawCandidates, wordLength, styleOptions = getDefaultWordStyleOptions()) {
    if (!Array.isArray(rawCandidates)) return [];

    const unique = [];
    const seen = new Set();
    rawCandidates.forEach(entry => {
        const word = normalizeToWordLength(entry, wordLength, styleOptions);
        if (!word || seen.has(word)) return;
        seen.add(word);
        unique.push(word);
    });
    return unique;
}

export function parseWordArrayText(rawText, wordLength, styleOptions = getDefaultWordStyleOptions()) {
    if (typeof rawText !== 'string' || !rawText.trim()) return [];

    try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
            return normalizeWordArray(parsed, wordLength, styleOptions);
        }
        if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.candidates)) {
                return normalizeWordArray(parsed.candidates, wordLength, styleOptions);
            }
            if (Array.isArray(parsed.words)) {
                return normalizeWordArray(parsed.words, wordLength, styleOptions);
            }
            if (typeof parsed.guess === 'string') {
                return normalizeWordArray([parsed.guess], wordLength, styleOptions);
            }
        }
    } catch {
        // Fall through to plain-text parsing.
    }

    return normalizeWordArray(rawText.split(/[\s,;|]+/g), wordLength, styleOptions);
}

export function getLanguageKey(language) {
    const text = String(language || '').trim().toLowerCase();
    if (text.includes('german') || text.includes('deutsch')) return 'german';
    if (text.includes('french') || text.includes('francais') || text.includes(FRENCH_LABEL)) return 'french';
    if (text.includes('spanish') || text.includes('espanol') || text.includes(SPANISH_LABEL)) return 'spanish';
    return 'english';
}

export function normalizeBucketKey(value, fallback = 'default') {
    const text = String(value || '').trim().toLowerCase();
    return text || fallback;
}
