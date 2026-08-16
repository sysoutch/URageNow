import {
    LLM_MEMORY_STORAGE_KEY,
    MAX_MEMORY_GUESS_BANK_ENTRIES,
    MAX_MEMORY_WORDS_PER_BUCKET,
    MAX_REVIEW_REJECTIONS_PER_BUCKET,
    WORD_REVIEW_STORAGE_KEY
} from './constants.js';
import {
    clampWordLength,
    getAlphabetKey,
    getDefaultWordStyleOptions,
    normalizeBucketKey,
    normalizeToWordLength
} from './word-utils.js';

function getMemoryModelKey(model, role = 'generic') {
    const modelKey = normalizeBucketKey(model, 'model');
    const roleKey = normalizeBucketKey(role, 'generic');
    return `${roleKey}::${modelKey}`;
}

function loadLLMMemoryStore() {
    try {
        const raw = localStorage.getItem(LLM_MEMORY_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveLLMMemoryStore(store) {
    try {
        localStorage.setItem(LLM_MEMORY_STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
        console.warn('Could not persist LLM memory store.', error);
    }
}

function getMemoryLanguageKey(language, wordLength, styleOptions = getDefaultWordStyleOptions()) {
    const languageKey = normalizeBucketKey(language, 'language');
    const lengthKey = clampWordLength(wordLength);
    return `${languageKey}::len${lengthKey}::${getAlphabetKey(styleOptions)}`;
}

function loadWordReviewStore() {
    try {
        const raw = localStorage.getItem(WORD_REVIEW_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function saveWordReviewStore(store) {
    try {
        localStorage.setItem(WORD_REVIEW_STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
        console.warn('Could not persist word review store.', error);
    }
}

function createEmptyMemoryBucket() {
    return {
        words: [],
        guessBank: []
    };
}

function normalizeMemoryBucket(rawBucket) {
    if (Array.isArray(rawBucket)) {
        return {
            words: rawBucket,
            guessBank: []
        };
    }

    if (!rawBucket || typeof rawBucket !== 'object') {
        return createEmptyMemoryBucket();
    }

    return {
        words: Array.isArray(rawBucket.words) ? rawBucket.words : [],
        guessBank: Array.isArray(rawBucket.guessBank) ? rawBucket.guessBank : []
    };
}

function getMemoryBucket(store, modelKey, languageKey) {
    const modelStore = store[modelKey];
    if (!modelStore || typeof modelStore !== 'object') {
        return createEmptyMemoryBucket();
    }
    return normalizeMemoryBucket(modelStore[languageKey]);
}

function saveMemoryBucket(store, modelKey, languageKey, bucket) {
    store[modelKey] = store[modelKey] || {};
    store[modelKey][languageKey] = {
        words: Array.isArray(bucket.words) ? bucket.words : [],
        guessBank: Array.isArray(bucket.guessBank) ? bucket.guessBank : []
    };
}

function normalizeGuessMemoryEntry(entry, wordLength, styleOptions = getDefaultWordStyleOptions()) {
    if (!entry || typeof entry !== 'object') return null;

    const normalizedGuess = normalizeToWordLength(entry.guess, wordLength, styleOptions);
    if (normalizedGuess.length !== clampWordLength(wordLength)) {
        return null;
    }

    return {
        guess: normalizedGuess,
        signature: String(entry.signature || '').trim(),
        fixedMask: String(entry.fixedMask || '').trim(),
        absentLetters: String(entry.absentLetters || '').trim(),
        requiredCounts: String(entry.requiredCounts || '').trim(),
        maxCounts: String(entry.maxCounts || '').trim(),
        excludedPositions: String(entry.excludedPositions || '').trim(),
        regexSource: String(entry.regexSource || '').trim(),
        solved: Boolean(entry.solved),
        guessNumber: Math.max(0, parseInt(entry.guessNumber, 10) || 0),
        effectiveness: Number.isFinite(entry.effectiveness) ? entry.effectiveness : 0,
        count: Math.max(1, parseInt(entry.count, 10) || 1),
        lastUsedAt: Number.isFinite(entry.lastUsedAt) ? entry.lastUsedAt : Date.now()
    };
}

export function getMemoryWordsForModel(model, language, wordLength, styleOptions = getDefaultWordStyleOptions(), limit = 120, role = 'generic') {
    const store = loadLLMMemoryStore();
    const modelKey = getMemoryModelKey(model, role);
    const languageKey = getMemoryLanguageKey(language, wordLength, styleOptions);
    const words = getMemoryBucket(store, modelKey, languageKey).words;
    return Array.isArray(words) ? words.slice(0, Math.max(1, limit)) : [];
}

export function rememberWordForModel(model, language, word, wordLength, styleOptions = getDefaultWordStyleOptions(), role = 'generic') {
    const normalizedLength = clampWordLength(wordLength);
    const normalized = normalizeToWordLength(word, normalizedLength, styleOptions);
    if (normalized.length !== normalizedLength) return;

    const store = loadLLMMemoryStore();
    const modelKey = getMemoryModelKey(model, role);
    const languageKey = getMemoryLanguageKey(language, normalizedLength, styleOptions);
    const bucket = getMemoryBucket(store, modelKey, languageKey);
    const existing = bucket.words;
    const withoutDup = [normalized, ...existing.filter(existingWord => existingWord !== normalized)];
    bucket.words = withoutDup.slice(0, MAX_MEMORY_WORDS_PER_BUCKET);
    saveMemoryBucket(store, modelKey, languageKey, bucket);
    saveLLMMemoryStore(store);
}

export function getGuessMemoryEntriesForModel(model, language, wordLength, styleOptions = getDefaultWordStyleOptions(), limit = 120, role = 'generic') {
    const store = loadLLMMemoryStore();
    const modelKey = getMemoryModelKey(model, role);
    const languageKey = getMemoryLanguageKey(language, wordLength, styleOptions);
    const guessBank = getMemoryBucket(store, modelKey, languageKey).guessBank;
    return guessBank
        .map(entry => normalizeGuessMemoryEntry(entry, wordLength, styleOptions))
        .filter(Boolean)
        .slice(0, Math.max(1, limit));
}

export function rememberGuessMemoryForModel(model, language, entry, wordLength, styleOptions = getDefaultWordStyleOptions(), role = 'generic') {
    const normalizedLength = clampWordLength(wordLength);
    const normalizedEntry = normalizeGuessMemoryEntry(entry, normalizedLength, styleOptions);
    if (!normalizedEntry) return;

    const store = loadLLMMemoryStore();
    const modelKey = getMemoryModelKey(model, role);
    const languageKey = getMemoryLanguageKey(language, normalizedLength, styleOptions);
    const bucket = getMemoryBucket(store, modelKey, languageKey);
    const existing = bucket.guessBank
        .map(candidate => normalizeGuessMemoryEntry(candidate, normalizedLength, styleOptions))
        .filter(Boolean);

    const existingIndex = existing.findIndex(candidate => candidate.signature === normalizedEntry.signature && candidate.guess === normalizedEntry.guess);
    if (existingIndex >= 0) {
        const current = existing[existingIndex];
        existing[existingIndex] = {
            ...current,
            solved: current.solved || normalizedEntry.solved,
            effectiveness: Math.max(current.effectiveness, normalizedEntry.effectiveness),
            guessNumber: current.guessNumber > 0 ? Math.min(current.guessNumber, normalizedEntry.guessNumber) : normalizedEntry.guessNumber,
            count: current.count + 1,
            lastUsedAt: Math.max(current.lastUsedAt, normalizedEntry.lastUsedAt)
        };
    } else {
        existing.unshift(normalizedEntry);
    }

    existing.sort((left, right) =>
        Number(right.solved) - Number(left.solved)
        || right.effectiveness - left.effectiveness
        || right.count - left.count
        || right.lastUsedAt - left.lastUsedAt
    );
    bucket.guessBank = existing.slice(0, MAX_MEMORY_GUESS_BANK_ENTRIES);
    saveMemoryBucket(store, modelKey, languageKey, bucket);
    saveLLMMemoryStore(store);
}

export function getReviewedRejectedWords(language, wordLength, styleOptions = getDefaultWordStyleOptions(), limit = 200) {
    const store = loadWordReviewStore();
    const bucketKey = getMemoryLanguageKey(language, wordLength, styleOptions);
    const entries = Array.isArray(store[bucketKey]) ? store[bucketKey] : [];
    return entries
        .map(entry => normalizeToWordLength(typeof entry === 'string' ? entry : entry?.word, wordLength, styleOptions))
        .filter(Boolean)
        .slice(0, Math.max(1, limit));
}

export function rememberReviewedRejectedWord(language, word, wordLength, styleOptions = getDefaultWordStyleOptions(), review = null) {
    const normalizedLength = clampWordLength(wordLength);
    const normalized = normalizeToWordLength(word, normalizedLength, styleOptions);
    if (normalized.length !== normalizedLength) return;

    const store = loadWordReviewStore();
    const bucketKey = getMemoryLanguageKey(language, normalizedLength, styleOptions);
    const existing = Array.isArray(store[bucketKey]) ? store[bucketKey] : [];
    const normalizedReview = review && typeof review === 'object' ? review : {};
    const newEntry = {
        word: normalized,
        noVotes: Math.max(0, parseInt(normalizedReview.noVotes, 10) || 0),
        yesVotes: Math.max(0, parseInt(normalizedReview.yesVotes, 10) || 0),
        reviewers: Array.isArray(normalizedReview.reviewers) ? normalizedReview.reviewers : [],
        reviewedAt: Number.isFinite(normalizedReview.reviewedAt) ? normalizedReview.reviewedAt : Date.now()
    };
    const withoutDup = [newEntry, ...existing.filter(entry => {
        const existingWord = normalizeToWordLength(typeof entry === 'string' ? entry : entry?.word, normalizedLength, styleOptions);
        return existingWord !== normalized;
    })];
    store[bucketKey] = withoutDup.slice(0, MAX_REVIEW_REJECTIONS_PER_BUCKET);
    saveWordReviewStore(store);
}

export function clearMemoryForModel(model, role = 'generic') {
    const store = loadLLMMemoryStore();
    const modelKey = getMemoryModelKey(model, role);
    if (store[modelKey]) {
        delete store[modelKey];
        saveLLMMemoryStore(store);
    }
}
