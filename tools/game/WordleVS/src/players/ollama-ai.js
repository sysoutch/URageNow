import {
    AI_PROMPT_MEMORY_BANK_HINT_LIMIT,
    AI_MATCH_CHOICE_ATTEMPTS,
    AI_MATCH_CHOICE_LIMIT,
    AI_PROBE_FALLBACK_AFTER_ATTEMPTS,
    AI_PROMPT_GUESS_HISTORY_LIMIT,
    AI_PROMPT_MEMORY_HINT_LIMIT,
    AI_RETHINK_MAX_PASSES,
    DEFAULT_AI_MODEL,
    DEFAULT_WORD_LENGTH,
    buildConstraintRegex,
    collectGuessEntries,
    createWordMask,
    describeGuessColors,
    describeGuessEntry,
    deriveWordleConstraints,
    extractOllamaText,
    filterWordsByRegex,
    formatConstraintsForPrompt,
    generateWithOllama,
    getDefaultWordStyleOptions,
    getHardAbsentLetters,
    getLanguageKey,
    getSolvedWordFromConstraints,
    normalizeWordArray,
    normalizeWordStyleOptions,
    parseWordArrayText,
    scoreCandidateWord,
    wordFitsConstraints
} from '../shared.js';
import { PlayerBoard } from './player-board.js';

const AI_STUCK_REVEAL_FAILURE_THRESHOLD = 3;

export class OllamaAI extends PlayerBoard {
    constructor(id, name, container, tactic = 'balanced', language = 'English', model = DEFAULT_AI_MODEL, wordLength = DEFAULT_WORD_LENGTH, styleOptions = getDefaultWordStyleOptions(), options = {}) {
        super(id, name, container, true, wordLength, styleOptions, options);
        this.tactic = tactic;
        this.language = language;
        this.model = model;
        this.thinking = false;
        this.styleOptions = normalizeWordStyleOptions(styleOptions);
        this.canGuessProvider = options.canGuessProvider || (() => true);
        this.memoryEnabledProvider = options.memoryEnabledProvider || (() => false);
        this.memoryWordsProvider = options.memoryWordsProvider || (() => []);
        this.memoryBankProvider = options.memoryBankProvider || (() => []);
        this.rememberWordHook = options.rememberWordHook || (() => {});
        this.rememberGuessMemoryHook = options.rememberGuessMemoryHook || (() => {});
        this.getSharedRoundContext = options.getSharedRoundContext || (() => []);
        this.getRoundRevision = options.getRoundRevision || (() => 0);
        this.dictionaryWordsProvider = options.dictionaryWordsProvider || (() => []);
        this.allowedWordsProvider = options.allowedWordsProvider || (() => []);
        this.openingGuessProvider = options.openingGuessProvider || (() => '');
        this.knowledgeModeProvider = options.knowledgeModeProvider || (() => 'sample');
        this.decisionModeProvider = options.decisionModeProvider || (() => 'llm');
        this.matchStateProvider = options.matchStateProvider || (() => ({}));
        this.runLLMTaskProvider = options.runLLMTaskProvider || (async task => task());
        this.revealFailureThresholdProvider = options.revealFailureThresholdProvider || (() => AI_STUCK_REVEAL_FAILURE_THRESHOLD);
        this.handleRevealSolutionHook = options.handleRevealSolutionHook || (async () => ({ handled: false }));
        this.moveRequestInFlight = false;
        this.pendingGuessMemoryEntry = null;
        this.lastRejectedLLMGuess = '';
        this.consecutiveFailedTurns = 0;
        this.setSubtitle(this.getTacticLabel());
    }

    getTacticLabel() {
        if (this.tactic === 'calm') return 'Calm';
        if (this.tactic === 'impatient') return 'Impatient';
        return 'Balanced';
    }

    getDecisionMode() {
        const mode = this.decisionModeProvider();
        if (mode === 'hybrid' || mode === 'assisted') {
            return mode;
        }
        return 'llm';
    }

    isReadyToGuess() {
        return this.canGuessProvider()
            && !this.gameOver
            && typeof this.solution === 'string'
            && this.solution.length === this.wordLength;
    }

    getKnownGuessEntries(sharedContext) {
        return collectGuessEntries(this.guesses, sharedContext, this.wordLength, this.styleOptions, this.name);
    }

    getKnownWordUniverse(guessEntries, includeObservedWords = true) {
        const dictionaryWords = this.dictionaryWordsProvider(this.language, this.wordLength, this.styleOptions);
        const memoryWords = this.memoryEnabledProvider()
            ? this.memoryWordsProvider(this.model, this.language, this.wordLength, this.styleOptions)
            : [];
        const observedWords = includeObservedWords
            ? guessEntries.filter(entry => !entry.isSelf).map(entry => entry.word)
            : [];

        return normalizeWordArray(
            [
                ...(Array.isArray(dictionaryWords) ? dictionaryWords : []),
                ...(Array.isArray(memoryWords) ? memoryWords : []),
                ...observedWords
            ],
            this.wordLength,
            this.styleOptions
        );
    }

    reset(solution, roundNumber = 0) {
        super.reset(solution, roundNumber);
        this.moveRequestInFlight = false;
        this.pendingGuessMemoryEntry = null;
        this.lastRejectedLLMGuess = '';
        this.consecutiveFailedTurns = 0;
    }

    getRevealFailureThreshold() {
        const threshold = parseInt(this.revealFailureThresholdProvider(), 10);
        return Number.isFinite(threshold)
            ? Math.max(2, threshold)
            : AI_STUCK_REVEAL_FAILURE_THRESHOLD;
    }

    markFailedTurn(reason = '') {
        this.consecutiveFailedTurns++;
        const label = String(reason || '').trim();
        if (label) {
            this.roundNote = `${label} (${this.consecutiveFailedTurns} failed turn${this.consecutiveFailedTurns === 1 ? '' : 's'})`;
        }
        this.updateUI();
    }

    clearFailedTurnStreak() {
        this.consecutiveFailedTurns = 0;
    }

    parseRevealDecision(rawResponse) {
        const raw = String(rawResponse || '').trim();
        if (!raw) return { reveal: false, reason: '' };

        let parsed = null;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    parsed = JSON.parse(jsonMatch[0]);
                } catch (innerError) {
                    parsed = null;
                }
            }
        }

        const revealRaw = parsed?.reveal;
        const reveal = typeof revealRaw === 'boolean'
            ? revealRaw
            : ['true', 'yes', '1'].includes(String(revealRaw || '').trim().toLowerCase());
        const reason = String(parsed?.reason || '').trim().slice(0, 80);
        return { reveal, reason };
    }

    getAllowedWordSet() {
        const allowedWords = normalizeWordArray(
            this.allowedWordsProvider(this.language, this.wordLength, this.styleOptions),
            this.wordLength,
            this.styleOptions
        );
        return new Set(allowedWords);
    }

    filterAllowedWords(words) {
        const normalizedWords = normalizeWordArray(words, this.wordLength, this.styleOptions);
        const allowedWords = this.getAllowedWordSet();
        if (allowedWords.size === 0) {
            return normalizedWords;
        }
        return normalizedWords.filter(word => allowedWords.has(word));
    }

    getAppOpeningGuess() {
        if (this.knowledgeModeProvider() !== 'sample') {
            return '';
        }
        const providedGuess = this.openingGuessProvider(this.language, this.wordLength, this.styleOptions, this.id, this.model);
        return this.filterAllowedWords([providedGuess])[0] || '';
    }

    shouldUseDeterministicChoice(sourceLabel, validMatches, constraints = null, regexInfo = null) {
        const decisionMode = this.getDecisionMode();
        if (!Array.isArray(validMatches) || validMatches.length <= 1) {
            return true;
        }
        if (this.knowledgeModeProvider() === 'full' && sourceLabel === 'local sources') {
            return false;
        }
        if (sourceLabel === 'local sources' && constraints && regexInfo) {
            const memoryEntries = this.getRelevantGuessMemory(constraints, regexInfo);
            if (decisionMode === 'llm' && memoryEntries.length > 0) {
                return false;
            }
        }
        if (sourceLabel === 'memory bank') {
            return decisionMode === 'assisted';
        }
        if (sourceLabel !== 'LLM pool') {
            return true;
        }
        return validMatches.length <= Math.max(4, this.wordLength + 1);
    }

    getRegexMatchedCandidates(words, constraints, regexInfo) {
        return this.filterAllowedWords(filterWordsByRegex(words, constraints, this.wordLength, this.styleOptions, regexInfo))
            .filter(word => !constraints.allGuessedWords.has(word));
    }

    scoreWordNaturalness(word) {
        const letterPriority = 'ETAOINSHRDLCUMWFGYPBVKXJQZ';
        const commonDigraphs = new Set([
            'TH', 'HE', 'IN', 'ER', 'AN', 'RE', 'ON', 'AT', 'EN', 'ND',
            'AL', 'LE', 'OU', 'OR', 'PH', 'LY', 'GL', 'GR', 'BR', 'PR',
            'TR', 'DR', 'CR', 'FR', 'BL', 'PL', 'SL', 'CL', 'FL', 'ST',
            'SP', 'SC', 'SK', 'SM', 'SN', 'SW', 'CH', 'SH', 'WH', 'CK',
            'LD', 'LP', 'LM', 'MP', 'NG', 'GH'
        ]);
        const vowels = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);
        let score = 0;

        for (const letter of new Set(word.split(''))) {
            const priorityIndex = letterPriority.indexOf(letter);
            score += priorityIndex >= 0 ? Math.max(0, 8 - (priorityIndex * 0.28)) : 0;
        }

        for (let index = 0; index < word.length - 1; index++) {
            const pair = `${word[index]}${word[index + 1]}`;
            if (commonDigraphs.has(pair)) {
                score += 2.5;
                continue;
            }

            const leftVowel = vowels.has(word[index]);
            const rightVowel = vowels.has(word[index + 1]);
            if (!leftVowel && !rightVowel) {
                score -= 3.5;
            } else if (leftVowel !== rightVowel) {
                score += 0.5;
            }
        }

        return score;
    }

    scoreCandidateWithHistory(word, constraints, guessEntries, referencePool = []) {
        const normalizedWord = normalizeWordArray([word], this.wordLength, this.styleOptions)[0];
        if (!normalizedWord || constraints?.allGuessedWords?.has(normalizedWord)) {
            return Number.NEGATIVE_INFINITY;
        }

        const referenceWords = normalizeWordArray(referencePool, this.wordLength, this.styleOptions);
        const baseScore = scoreCandidateWord(
            normalizedWord,
            referenceWords.length > 0 ? referenceWords : [normalizedWord],
            this.wordLength
        );
        const unresolvedPositions = [];
        const allGuessedLetters = new Set();
        const positionRetryCounts = Array.from({ length: this.wordLength }, () => new Map());
        let score = baseScore + this.scoreWordNaturalness(normalizedWord);

        for (let index = 0; index < this.wordLength; index++) {
            if (!constraints?.fixedPositions?.[index]) {
                unresolvedPositions.push(index);
            }
        }

        guessEntries.forEach(entry => {
            if (!entry?.word || !Array.isArray(entry.result)) {
                return;
            }
            for (let index = 0; index < Math.min(entry.word.length, this.wordLength); index++) {
                const letter = entry.word[index];
                allGuessedLetters.add(letter);
                if (!constraints?.fixedPositions?.[index] && entry.result[index] !== 'correct') {
                    const retryMap = positionRetryCounts[index];
                    retryMap.set(letter, (retryMap.get(letter) || 0) + 1);
                }
            }
        });

        const uniqueLetters = new Set(normalizedWord);
        let duplicatePenalty = 0;
        uniqueLetters.forEach(letter => {
            const count = normalizedWord.split(letter).length - 1;
            const requiredCount = constraints?.minCounts?.get(letter) || 0;
            const overage = Math.max(0, count - Math.max(1, requiredCount));
            duplicatePenalty += overage * 4;
            if (!allGuessedLetters.has(letter)) {
                score += unresolvedPositions.length > 2 ? 7 : 3;
            }
        });
        score -= duplicatePenalty;

        unresolvedPositions.forEach(index => {
            const letter = normalizedWord[index];
            const retriesAtPosition = positionRetryCounts[index].get(letter) || 0;
            score -= retriesAtPosition * 10;
            if (retriesAtPosition === 0) {
                score += unresolvedPositions.length > 2 ? 4 : 9;
            }
        });

        guessEntries.forEach(entry => {
            if (!entry?.word) {
                return;
            }

            let samePositionMatches = 0;
            let sameLetterMatches = 0;
            const entryLetters = new Set(entry.word);
            for (let index = 0; index < this.wordLength; index++) {
                if (entry.word[index] === normalizedWord[index]) {
                    samePositionMatches++;
                }
                if (entryLetters.has(normalizedWord[index])) {
                    sameLetterMatches++;
                }
            }

            score -= samePositionMatches * 3.5;
            if (samePositionMatches >= this.wordLength - 2) {
                score -= 14;
            }
            score -= Math.max(0, sameLetterMatches - Math.max(2, unresolvedPositions.length)) * 1.75;
        });

        const lastSelfGuess = [...guessEntries].reverse().find(entry => entry?.isSelf && entry?.word);
        if (lastSelfGuess?.word) {
            unresolvedPositions.forEach(index => {
                if (normalizedWord[index] !== lastSelfGuess.word[index]) {
                    score += 8;
                } else {
                    score -= 10;
                }
            });
        }

        return score;
    }

    rankCandidates(candidates, referencePool = candidates, constraints = null, guessEntries = []) {
        return normalizeWordArray(candidates, this.wordLength, this.styleOptions)
            .map(word => ({
                word,
                score: constraints
                    ? this.scoreCandidateWithHistory(word, constraints, guessEntries, referencePool)
                    : scoreCandidateWord(word, referencePool, this.wordLength)
            }))
            .filter(entry => Number.isFinite(entry.score))
            .sort((a, b) => b.score - a.score);
    }

    pickBestCandidate(candidates, referencePool = candidates, constraints = null, guessEntries = []) {
        if (!Array.isArray(candidates) || candidates.length === 0) return '';
        if (candidates.length === 1) return candidates[0];

        const scored = this.rankCandidates(candidates, referencePool, constraints, guessEntries);
        if (scored.length === 0) {
            return '';
        }

        if (this.tactic === 'impatient') {
            const topSlice = scored.slice(0, Math.min(3, scored.length));
            return topSlice[Math.floor(Math.random() * topSlice.length)].word;
        }

        if (this.tactic === 'balanced') {
            const topSlice = scored.slice(0, Math.min(2, scored.length));
            return topSlice[0].word;
        }

        return scored[0].word;
    }

    serializeCountMap(countMap) {
        if (!(countMap instanceof Map) || countMap.size === 0) {
            return 'none';
        }
        return Array.from(countMap.entries())
            .sort((left, right) => left[0].localeCompare(right[0]))
            .map(([letter, count]) => `${letter}${count}`)
            .join(',');
    }

    serializeExcludedPositions(excludedPositions) {
        if (!Array.isArray(excludedPositions) || excludedPositions.length === 0) {
            return 'none';
        }
        const entries = excludedPositions.flatMap((set, index) => Array.from(set || []).sort().map(letter => `${index}:${letter}`));
        return entries.length > 0 ? entries.join(',') : 'none';
    }

    createConstraintMemorySnapshot(constraints, regexInfo) {
        const fixedMask = Array.from({ length: this.wordLength }, (_, index) => constraints.fixedPositions[index] || '_').join('');
        const absentLetters = Array.from(getHardAbsentLetters(constraints)).sort().join('') || 'none';
        const requiredCounts = this.serializeCountMap(constraints.minCounts);
        const maxCounts = this.serializeCountMap(new Map(
            Array.from(constraints.maxCounts.entries()).filter(([, value]) => Number.isFinite(value))
        ));
        const excludedPositions = this.serializeExcludedPositions(constraints.excludedPositions);
        const regexSource = String(regexInfo?.source || '').trim();
        const signature = [
            fixedMask,
            absentLetters,
            requiredCounts,
            maxCounts,
            excludedPositions,
            regexSource
        ].join('|');

        return {
            signature,
            fixedMask,
            absentLetters,
            requiredCounts,
            maxCounts,
            excludedPositions,
            regexSource
        };
    }

    splitMemoryTokenString(value) {
        return String(value || '')
            .split(',')
            .map(token => token.trim())
            .filter(Boolean)
            .filter(token => token !== 'none');
    }

    countStringOverlap(left, right) {
        const normalize = value => {
            const text = String(value || '').trim();
            return text === 'none' ? '' : text;
        };
        const leftSet = new Set(normalize(left).split('').filter(Boolean));
        const rightSet = new Set(normalize(right).split('').filter(Boolean));
        let matches = 0;
        leftSet.forEach(char => {
            if (rightSet.has(char)) {
                matches++;
            }
        });
        return matches;
    }

    countTokenOverlap(left, right) {
        const leftTokens = new Set(this.splitMemoryTokenString(left));
        const rightTokens = new Set(this.splitMemoryTokenString(right));
        let matches = 0;
        leftTokens.forEach(token => {
            if (rightTokens.has(token)) {
                matches++;
            }
        });
        return matches;
    }

    scoreGuessMemoryEntry(entry, snapshot) {
        if (!entry || !entry.guess) {
            return Number.NEGATIVE_INFINITY;
        }

        let score = 0;
        if (entry.signature && snapshot.signature && entry.signature === snapshot.signature) {
            score += 240;
        }
        if (entry.regexSource && snapshot.regexSource && entry.regexSource === snapshot.regexSource) {
            score += 60;
        }

        const entryFixed = String(entry.fixedMask || '');
        const snapshotFixed = String(snapshot.fixedMask || '');
        for (let index = 0; index < Math.min(entryFixed.length, snapshotFixed.length); index++) {
            const left = entryFixed[index];
            const right = snapshotFixed[index];
            if (left === '_' || right === '_') continue;
            if (left === right) {
                score += 18;
            }
        }

        score += this.countStringOverlap(entry.absentLetters, snapshot.absentLetters) * 4;
        score += this.countTokenOverlap(entry.requiredCounts, snapshot.requiredCounts) * 10;
        score += this.countTokenOverlap(entry.maxCounts, snapshot.maxCounts) * 7;
        score += this.countTokenOverlap(entry.excludedPositions, snapshot.excludedPositions) * 3;
        score += Math.min(6, parseInt(entry.count, 10) || 1) * 3;
        score += Math.max(0, 6 - (parseInt(entry.guessNumber, 10) || 0));
        score += Number(entry.effectiveness || 0) * 2;
        if (entry.solved) {
            score += 18;
        }
        return score;
    }

    getRelevantGuessMemory(constraints, regexInfo) {
        if (!this.memoryEnabledProvider()) {
            return [];
        }

        const snapshot = this.createConstraintMemorySnapshot(constraints, regexInfo);
        const allEntries = this.memoryBankProvider(this.model, this.language, this.wordLength, this.styleOptions);
        if (!Array.isArray(allEntries) || allEntries.length === 0) {
            return [];
        }

        return allEntries
            .filter(entry => entry && entry.guess && !constraints.allGuessedWords.has(entry.guess))
            .map(entry => ({
                ...entry,
                memoryScore: this.scoreGuessMemoryEntry(entry, snapshot),
                isExactState: entry.signature === snapshot.signature
            }))
            .filter(entry => Number.isFinite(entry.memoryScore) && (entry.isExactState || entry.memoryScore >= 18))
            .sort((left, right) =>
                Number(right.isExactState) - Number(left.isExactState)
                || right.memoryScore - left.memoryScore
                || Number(right.solved) - Number(left.solved)
                || (right.count || 0) - (left.count || 0)
                || (right.lastUsedAt || 0) - (left.lastUsedAt || 0)
            );
    }

    formatGuessMemoryHint(memoryEntries) {
        const relevantEntries = memoryEntries.slice(0, AI_PROMPT_MEMORY_BANK_HINT_LIMIT);
        if (relevantEntries.length === 0) {
            return '';
        }

        const parts = relevantEntries.map(entry => {
            const tags = [];
            tags.push(entry.isExactState ? 'exact-state' : 'similar-state');
            if (entry.solved) {
                tags.push('solved');
            }
            if (entry.count > 1) {
                tags.push(`seen ${entry.count}x`);
            }
            return `${entry.guess} (${tags.join(', ')})`;
        });

        return `Relevant guess-bank memories from similar clue states: ${parts.join('; ')}`;
    }

    getMemoryBackedCandidateHints(validMatches, memoryEntries) {
        if (!Array.isArray(validMatches) || validMatches.length === 0 || !Array.isArray(memoryEntries) || memoryEntries.length === 0) {
            return [];
        }

        const validSet = new Set(validMatches);
        const seen = new Set();
        return memoryEntries
            .map(entry => entry?.guess || '')
            .filter(word => word && validSet.has(word) && !seen.has(word) && seen.add(word))
            .slice(0, AI_PROMPT_MEMORY_BANK_HINT_LIMIT);
    }

    formatMemoryBackedCandidateHint(validMatches, memoryEntries) {
        const hintedCandidates = this.getMemoryBackedCandidateHints(validMatches, memoryEntries);
        if (hintedCandidates.length === 0) {
            return '';
        }

        return `Memory-backed candidate hints among the app-valid matches: ${hintedCandidates.join(', ')}. Use these as clues, but still choose the best word yourself from the valid match list.`;
    }

    getMemoryBankCandidates(constraints, regexInfo) {
        return this.getRelevantGuessMemory(constraints, regexInfo)
            .map(entry => entry.guess)
            .filter(Boolean);
    }

    formatInferenceUpgradeHint(constraints) {
        const inferredFlags = Array.isArray(constraints?.inferredFixedPositions)
            ? constraints.inferredFixedPositions
            : [];
        const inferredParts = constraints.fixedPositions
            .map((letter, index) => (letter && inferredFlags[index] ? `${index + 1}=${letter}` : ''))
            .filter(Boolean);
        if (inferredParts.length === 0) {
            return '';
        }
        return `Inference upgrades: Treat ${inferredParts.join(', ')} as green/fixed positions derived from the accumulated yellow exclusions.`;
    }

    formatCountUpgradeHint(constraints) {
        const exactCountParts = [];
        const fixedCounts = new Map();
        constraints.fixedPositions.forEach(letter => {
            if (!letter) return;
            fixedCounts.set(letter, (fixedCounts.get(letter) || 0) + 1);
        });

        constraints.minCounts.forEach((minCount, letter) => {
            if (!constraints.maxCounts.has(letter)) {
                return;
            }
            const maxCount = constraints.maxCounts.get(letter);
            if (!Number.isFinite(maxCount) || maxCount !== minCount || minCount <= 0) {
                return;
            }

            const fixedCount = fixedCounts.get(letter) || 0;
            const countLabel = minCount === 1 ? 'exactly 1 time' : `exactly ${minCount} times`;
            exactCountParts.push(
                fixedCount >= minCount
                    ? `${letter} is fully resolved and appears ${countLabel}`
                    : `${letter} appears ${countLabel}`
            );
        });

        if (exactCountParts.length === 0) {
            return '';
        }
        return `Count upgrades: Treat these as exact count constraints: ${exactCountParts.join('; ')}.`;
    }

    formatWordleSemanticsHint() {
        return [
            'Wordle clue legend:',
            '- Green / correct = this exact letter is fixed in this exact position.',
            '- Yellow / present = this letter is in the solution but NOT in this position.',
            '- Gray / grey / absent = this letter is not in the solution, unless duplicate-letter count rules explicitly keep some copies.',
            '- Trust the derived constraints, fixed positions, count rules, and regex gate over raw guess intuition.',
            '- If a letter is promoted into "Fixed positions", treat it exactly like a confirmed green tile.'
        ].join('\n');
    }

    formatWordleSemanticsExample(constraints) {
        const inferredFlags = Array.isArray(constraints?.inferredFixedPositions)
            ? constraints.inferredFixedPositions
            : [];
        const inferredPart = constraints.fixedPositions
            .map((letter, index) => (letter && inferredFlags[index] ? `${index + 1}=${letter}` : ''))
            .filter(Boolean)[0];

        if (inferredPart) {
            return `Example: if repeated yellow exclusions force ${inferredPart}, then treat ${inferredPart} as green/fixed now.`;
        }

        const fixedPart = constraints.fixedPositions
            .map((letter, index) => (letter ? `${index + 1}=${letter}` : ''))
            .filter(Boolean)[0];
        if (fixedPart) {
            return `Example: if Derived constraints says ${fixedPart}, then that slot is confirmed green/fixed.`;
        }

        return 'Example: if a row says yellow E at 2, then E is in the word but E cannot be at position 2.';
    }

    formatMatchStateHint() {
        const state = this.matchStateProvider() || {};
        const parts = [];
        const normalizedMode = String(state.mode || '').trim();
        const roundNumber = parseInt(state.roundNumber, 10);
        const guessesUsed = Array.isArray(this.guesses) ? this.guesses.length : 0;
        const guessesRemaining = this.getGuessesRemaining();
        const guessNumber = Math.min(this.wordLength + 1, guessesUsed + 1);

        if (normalizedMode) {
            parts.push(`Mode: ${normalizedMode}`);
        }
        if (Number.isFinite(roundNumber) && roundNumber > 0) {
            parts.push(`Round: ${roundNumber}`);
        }
        parts.push(`This guess number: ${guessNumber} of 6`);
        parts.push(`Guesses remaining after this choice: ${guessesRemaining}`);

        const timeLeft = parseInt(state.timeLeft, 10);
        if (Number.isFinite(timeLeft) && timeLeft > 0 && (normalizedMode === 'timed' || normalizedMode === 'elimination')) {
            parts.push(`Time left: ${timeLeft}s`);
        }

        if (normalizedMode === 'timed') {
            const targetGames = parseInt(state.targetGames, 10);
            const winsSoFar = parseInt(state.winsSoFar, 10);
            if (Number.isFinite(targetGames)) {
                parts.push(targetGames > 0 ? `Target solves to win match: ${targetGames}` : 'Target solves to win match: unlimited');
            }
            if (Number.isFinite(winsSoFar)) {
                parts.push(`Your solved rounds so far: ${winsSoFar}`);
            }
        }

        if (normalizedMode === 'elimination') {
            const checkpointIndex = parseInt(state.checkpointIndex, 10);
            const checkpointRequirement = parseInt(state.checkpointRequirement, 10);
            if (Number.isFinite(checkpointIndex) && Number.isFinite(checkpointRequirement) && checkpointIndex >= 0) {
                parts.push(`Current elimination checkpoint: ${checkpointIndex + 1}, requires ${checkpointRequirement} green letters`);
            }
        }

        return `Match state:\n- ${parts.join('\n- ')}`;
    }

    getPromptMemoryWords(constraints, limit = AI_PROMPT_MEMORY_HINT_LIMIT) {
        if (!this.memoryEnabledProvider()) {
            return [];
        }

        const memoryWords = normalizeWordArray(
            this.memoryWordsProvider(this.model, this.language, this.wordLength, this.styleOptions),
            this.wordLength,
            this.styleOptions
        );
        if (memoryWords.length === 0) {
            return [];
        }

        const filtered = memoryWords.filter(word =>
            !constraints.allGuessedWords.has(word)
            && this.filterAllowedWords([word]).length > 0
            && wordFitsConstraints(word, constraints, this.wordLength, this.styleOptions)
        );

        return filtered.slice(0, limit);
    }

    buildPromptContextBlock(guessEntries, constraints, memoryWords, memoryEntries, regexInfo, extraNote = '', forbiddenRetryWords = []) {
        const guessHistory = guessEntries
            .slice(-AI_PROMPT_GUESS_HISTORY_LIMIT)
            .map(describeGuessEntry)
            .filter(Boolean)
            .join('\n');
        const colorHistory = guessEntries
            .slice(-AI_PROMPT_GUESS_HISTORY_LIMIT)
            .map(describeGuessColors)
            .filter(Boolean)
            .join('\n');
        const allGuessedWords = Array.from(constraints.allGuessedWords);
        const selfGuessedWords = Array.from(constraints.selfGuessedWords);
        const otherGuessedWords = Array.from(constraints.otherPlayersGuessedWords);
        const memoryHint = memoryWords.length
            ? `Known valid words from your memory for ${this.language}: ${memoryWords.slice(0, AI_PROMPT_MEMORY_HINT_LIMIT).join(', ')}`
            : '';
        const guessMemoryHint = this.formatGuessMemoryHint(memoryEntries);
        const retryForbiddenWords = normalizeWordArray(forbiddenRetryWords, this.wordLength, this.styleOptions)
            .filter(word => !constraints.allGuessedWords.has(word));
        const inferenceHint = this.formatInferenceUpgradeHint(constraints);
        const countUpgradeHint = this.formatCountUpgradeHint(constraints);
        const semanticsHint = this.formatWordleSemanticsHint();
        const semanticsExample = this.formatWordleSemanticsExample(constraints);
        const matchStateHint = this.formatMatchStateHint();

        const promptParts = [
            `${semanticsHint}
${semanticsExample}
${matchStateHint}
All boards share the same hidden word, so clues from other players are valid for you too.
Guess history:
${guessHistory || 'No clues yet.'}
Per-player color summary:
${colorHistory || 'No color clues yet.'}
Derived constraints:
${formatConstraintsForPrompt(constraints)}
App regex gate: ${regexInfo.source}
All previous guesses: ${allGuessedWords.length ? allGuessedWords.join(', ') : 'none'}
Your own previous guesses: ${selfGuessedWords.length ? selfGuessedWords.join(', ') : 'none'}
Other players' guesses: ${otherGuessedWords.length ? otherGuessedWords.join(', ') : 'none'}`
        ];

        if (inferenceHint) {
            promptParts.push(inferenceHint);
        }

        if (countUpgradeHint) {
            promptParts.push(countUpgradeHint);
        }

        if (memoryHint) {
            promptParts.push(memoryHint);
        }

        if (guessMemoryHint) {
            promptParts.push(guessMemoryHint);
        }

        if (retryForbiddenWords.length > 0) {
            promptParts.push(`Do NOT guess these failed words again in this turn: ${retryForbiddenWords.join(', ')}`);
        }

        if (extraNote) {
            promptParts.push(extraNote);
        }

        return promptParts.join('\n');
    }

    buildAIPrompt(systemPrompt, guessEntries, constraints, memoryWords, memoryEntries, regexInfo, retryMode = false, forbiddenRetryWords = []) {
        const retryNote = retryMode
            ? 'Previous attempt produced no app-valid regex/count matches. Follow the regex gate and derived constraints exactly.'
            : '';

        return `${systemPrompt}
${this.buildPromptContextBlock(guessEntries, constraints, memoryWords, memoryEntries, regexInfo, retryNote, forbiddenRetryWords)}
Task:
- Suggest ${this.guessPoolTarget} candidate guesses that satisfy every clue.
- Never repeat any previous guess from any player.
- The app will reject anything that fails the regex gate or count rules.
- Prefer common, strategically useful ${this.language} words.
- Return JSON only with this schema:
{"candidates":["${createWordMask(this.wordLength)}"]}
- Every candidate must be exactly ${this.wordLength} letters.
- No markdown, no explanation, no prose.`;
    }

    buildChoicePrompt(systemPrompt, guessEntries, constraints, validMatches, memoryEntries, regexInfo, retryMode = false, forbiddenRetryWords = []) {
        const rankedMatches = this.rankCandidates(validMatches, validMatches, constraints, guessEntries).map(entry => entry.word);
        const limitedMatches = rankedMatches.slice(0, AI_MATCH_CHOICE_LIMIT);
        const listLabel = limitedMatches.length === rankedMatches.length
            ? `Valid matches after app filtering (${limitedMatches.length})`
            : `Valid matches after app filtering (top ${limitedMatches.length} of ${rankedMatches.length})`;
        const retryNote = retryMode
            ? 'Previous choice was invalid or outside the app-filtered list. Pick exactly one word from the provided matches.'
            : '';
        const memoryCandidateHint = this.formatMemoryBackedCandidateHint(limitedMatches, memoryEntries);

        return `${systemPrompt}
${this.buildPromptContextBlock(guessEntries, constraints, [], memoryEntries, regexInfo, retryNote, forbiddenRetryWords)}
${listLabel}:
${limitedMatches.join(', ')}
${memoryCandidateHint ? `${memoryCandidateHint}\n` : ''}Task:
- The memory bank is advisory only. You must personally choose the guess from the valid matches above.
- Choose exactly one best next guess from the app-filtered valid matches above.
- Never repeat any previous guess from any player.
- Your guess MUST be one of the listed valid matches.
- Return JSON only with this schema:
{"guess":"${createWordMask(this.wordLength)}"}
- No markdown, no explanation, no prose.`;
    }

    buildDirectGuessPrompt(systemPrompt, guessEntries, constraints, memoryWords, memoryEntries, regexInfo, retryMode = false, forbiddenRetryWords = []) {
        const retryNote = retryMode
            ? 'Previous direct guess was invalid. Return exactly one common word that satisfies the regex gate and all derived constraints.'
            : 'Return exactly one best next guess that satisfies the regex gate and all derived constraints.';

        return `${systemPrompt}
${this.buildPromptContextBlock(guessEntries, constraints, memoryWords, memoryEntries, regexInfo, retryNote, forbiddenRetryWords)}
Task:
- Return exactly one best next guess that satisfies every clue.
- Never repeat any previous guess from any player.
- The guess MUST satisfy the regex gate and derived letter-count rules.
- Prefer a common, strategically useful ${this.language} word.
- Return JSON only with this schema:
{"guess":"${createWordMask(this.wordLength)}"}
- Every guess must be exactly ${this.wordLength} letters.
- No markdown, no explanation, no prose.`;
    }

    buildEndgameGuessPrompt(systemPrompt, constraints, regexInfo, memoryWords = [], memoryEntries = [], retryMode = false, forbiddenRetryWords = []) {
        const patternMask = Array.from({ length: this.wordLength }, (_, index) => constraints.fixedPositions[index] || '_').join('');
        const unresolvedPositions = constraints.fixedPositions
            .map((letter, index) => (letter ? null : index + 1))
            .filter(Boolean);
        const hardAbsentLetters = Array.from(getHardAbsentLetters(constraints)).sort();
        const blockedPositions = constraints.excludedPositions
            .map((letters, index) => {
                const blocked = Array.from(letters || []).sort();
                return blocked.length > 0 ? `${index + 1} not ${blocked.join('/')}` : '';
            })
            .filter(Boolean)
            .join(', ') || 'none';
        const guessMemoryHint = this.formatGuessMemoryHint(memoryEntries);
        const retryForbiddenWords = normalizeWordArray(forbiddenRetryWords, this.wordLength, this.styleOptions)
            .filter(word => !constraints.allGuessedWords.has(word));
        const retryNote = retryMode
            ? 'Previous endgame guess was invalid. Focus on a real common word that matches the pattern exactly.'
            : 'This is an endgame state. Focus only on filling the missing slots with a valid common word.';

        return `${systemPrompt}
You are solving a nearly completed Wordle in ${this.language}.
Pattern: ${patternMask}
Missing positions: ${unresolvedPositions.join(', ') || 'none'}
Required letters/counts: ${this.serializeCountMap(constraints.minCounts)}
Forbidden letters: ${hardAbsentLetters.length ? hardAbsentLetters.join(', ') : 'none'}
Blocked positions: ${blockedPositions}
App regex gate: ${regexInfo.source}
Previous guesses to avoid: ${Array.from(constraints.allGuessedWords).join(', ') || 'none'}
${memoryWords.length ? `Known valid words from memory: ${memoryWords.join(', ')}` : ''}
${guessMemoryHint ? `${guessMemoryHint}\n` : ''}${retryForbiddenWords.length ? `Do NOT guess these failed words again in this turn: ${retryForbiddenWords.join(', ')}\n` : ''}${retryNote}
Task:
- Think only about words that fit the visible pattern exactly.
- Use the guess-bank memories only as hints. You must still decide on the final word yourself.
- Return exactly one best common ${this.language} word for this pattern.
- Never repeat any previous guess.
- The guess MUST satisfy the regex gate and derived letter-count rules.
- Return JSON only with this schema:
{"guess":"${createWordMask(this.wordLength)}"}
- Every guess must be exactly ${this.wordLength} letters.
- No markdown, no explanation, no prose.`;
    }

    buildBlankFillGuessPrompt(systemPrompt, constraints, regexInfo, memoryWords = [], memoryEntries = [], retryMode = false, forbiddenRetryWords = []) {
        const patternMask = Array.from({ length: this.wordLength }, (_, index) => constraints.fixedPositions[index] || '_').join('');
        const unresolvedPositions = constraints.fixedPositions
            .map((letter, index) => (letter ? null : index + 1))
            .filter(Boolean);
        const hardAbsentLetters = Array.from(getHardAbsentLetters(constraints)).sort();
        const remainingLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
            .split('')
            .filter(letter => !hardAbsentLetters.includes(letter))
            .join(', ');
        const guessMemoryHint = this.formatGuessMemoryHint(memoryEntries);
        const retryForbiddenWords = normalizeWordArray(forbiddenRetryWords, this.wordLength, this.styleOptions)
            .filter(word => !constraints.allGuessedWords.has(word));
        const retryNote = retryMode
            ? 'Previous blank-fill attempt was invalid. Try different remaining-letter combinations and reject any fake words.'
            : 'You are stuck. Fill the blank slots systematically with remaining letters, build plausible variants, and keep only real common words.';

        return `${systemPrompt}
You are solving a pattern-completion Wordle in ${this.language}.
Pattern: ${patternMask}
Blank positions: ${unresolvedPositions.join(', ') || 'none'}
Remaining usable letters: ${remainingLetters || 'none'}
Required letters/counts: ${this.serializeCountMap(constraints.minCounts)}
App regex gate: ${regexInfo.source}
Previous guesses to avoid: ${Array.from(constraints.allGuessedWords).join(', ') || 'none'}
${memoryWords.length ? `Known valid words from memory: ${memoryWords.join(', ')}` : ''}
${guessMemoryHint ? `${guessMemoryHint}\n` : ''}${retryForbiddenWords.length ? `Do NOT guess these failed words again in this turn: ${retryForbiddenWords.join(', ')}\n` : ''}${retryNote}
Task:
- Fill the blank positions with remaining letters and mentally enumerate plausible variants for the pattern.
- Reject any variant that is not a real common ${this.language} word.
- Never repeat any previous or forbidden guess.
- The guess MUST satisfy the regex gate and derived letter-count rules.
- Return JSON only with this schema:
{"guess":"${createWordMask(this.wordLength)}"}
- Every guess must be exactly ${this.wordLength} letters.
- No markdown, no explanation, no prose.`;
    }

    buildLastGuessPrompt(systemPrompt, guessEntries, constraints, exactCandidates, plausibleCandidates, memoryEntries, regexInfo, retryMode = false) {
        const exactList = exactCandidates.slice(0, 18);
        const plausibleList = plausibleCandidates.slice(0, 18);
        const retryNote = retryMode
            ? 'Previous last-guess attempt was invalid. Commit to the single most likely real word now.'
            : 'This is your final allowed guess. Use every clue from yourself and the other players to identify the most likely exact solution.';
        const memoryCandidateHint = this.formatMemoryBackedCandidateHint(exactList.length > 0 ? exactList : plausibleList, memoryEntries);

        const candidateBlock = exactList.length > 0
            ? `Exact app-valid candidate solutions (${exactList.length}):\n${exactList.join(', ')}`
            : plausibleList.length > 0
                ? `No local exact candidate was proven. Most plausible real words from known sources:\n${plausibleList.join(', ')}`
                : 'No local candidate shortlist is available.';

        return `${systemPrompt}
${this.buildPromptContextBlock(guessEntries, constraints, [], memoryEntries, regexInfo, retryNote)}
${candidateBlock}
${memoryCandidateHint ? `${memoryCandidateHint}\n` : ''}Task:
- The memory bank is advisory only. You must personally choose the final word from the clues and candidate lists.
- This is the last guess, so do not explore. Choose the single most likely solution word.
- Never repeat any previous guess from any player.
- The guess MUST satisfy the regex gate and derived letter-count rules.
- Prefer the exact candidate list when one is provided.
- Return JSON only with this schema:
{"guess":"${createWordMask(this.wordLength)}"}
- Every guess must be exactly ${this.wordLength} letters.
- No markdown, no explanation, no prose.`;
    }

    async requestLLMCandidatePool(systemPrompt, guessEntries, constraints, regexInfo, retryMode = false, forbiddenRetryWords = []) {
        const memoryWords = this.getPromptMemoryWords(constraints);
        const memoryEntries = this.getRelevantGuessMemory(constraints, regexInfo);
        const prompt = this.buildAIPrompt(systemPrompt, guessEntries, constraints, memoryWords, memoryEntries, regexInfo, retryMode, forbiddenRetryWords);
        console.log(retryMode ? '[AI Guess Retry Prompt]' : '[AI Guess Prompt]', prompt);

        const data = await generateWithOllama({
            model: this.model,
            prompt,
            format: 'json',
            stream: false,
            think: false,
            options: {
                temperature: retryMode ? 0.0 : this.tactic === 'impatient' ? 0.35 : 0.1,
                num_predict: Math.max(140, Math.min(420, this.guessPoolTarget * 18)),
                top_p: 0.85
            }
        });

        const rawResponse = extractOllamaText(data);
        console.log('Ollama response for AI guess:', rawResponse);
        const parsed = parseWordArrayText(rawResponse, this.wordLength, this.styleOptions);
        return {
            parsedCandidates: parsed,
            validMatches: this.getRegexMatchedCandidates(parsed, constraints, regexInfo)
        };
    }

    async requestLLMChoiceFromMatches(systemPrompt, guessEntries, constraints, validMatches, regexInfo, retryMode = false, forbiddenRetryWords = []) {
        const memoryEntries = this.getRelevantGuessMemory(constraints, regexInfo);
        const prompt = this.buildChoicePrompt(systemPrompt, guessEntries, constraints, validMatches, memoryEntries, regexInfo, retryMode, forbiddenRetryWords);
        console.log(retryMode ? '[AI Match Choice Retry Prompt]' : '[AI Match Choice Prompt]', prompt);

        const data = await generateWithOllama({
            model: this.model,
            prompt,
            format: 'json',
            stream: false,
            think: false,
            options: {
                temperature: 0.0,
                num_predict: 140,
                top_p: 0.8
            }
        });

        const rawResponse = extractOllamaText(data);
        console.log('Ollama response for AI match choice:', rawResponse);
        const validSet = new Set(normalizeWordArray(validMatches, this.wordLength, this.styleOptions));
        const [guess] = parseWordArrayText(rawResponse, this.wordLength, this.styleOptions);
        return guess && validSet.has(guess) && !constraints.allGuessedWords.has(guess) ? guess : '';
    }

    async requestLLMDirectGuess(systemPrompt, guessEntries, constraints, regexInfo, retryMode = false, forbiddenRetryWords = []) {
        const memoryWords = this.getPromptMemoryWords(constraints);
        const memoryEntries = this.getRelevantGuessMemory(constraints, regexInfo);
        const prompt = this.buildDirectGuessPrompt(systemPrompt, guessEntries, constraints, memoryWords, memoryEntries, regexInfo, retryMode, forbiddenRetryWords);
        console.log(retryMode ? '[AI Direct Guess Retry Prompt]' : '[AI Direct Guess Prompt]', prompt);

        const data = await generateWithOllama({
            model: this.model,
            prompt,
            format: 'json',
            stream: false,
            think: false,
            options: {
                temperature: 0.0,
                num_predict: 120,
                top_p: 0.8
            }
        });

        const rawResponse = extractOllamaText(data);
        console.log('Ollama response for AI direct guess:', rawResponse);
        const [guess] = parseWordArrayText(rawResponse, this.wordLength, this.styleOptions);
        if (!guess || constraints.allGuessedWords.has(guess) || this.filterAllowedWords([guess]).length === 0) {
            this.lastRejectedLLMGuess = guess || '';
            return '';
        }
        const validGuess = this.getRegexMatchedCandidates([guess], constraints, regexInfo)[0] || '';
        this.lastRejectedLLMGuess = validGuess ? '' : guess;
        return validGuess;
    }

    async requestLLMEndgameGuess(systemPrompt, constraints, regexInfo, retryMode = false, forbiddenRetryWords = []) {
        const memoryWords = this.getPromptMemoryWords(constraints, 14);
        const memoryEntries = this.getRelevantGuessMemory(constraints, regexInfo);
        const prompt = this.buildEndgameGuessPrompt(systemPrompt, constraints, regexInfo, memoryWords, memoryEntries, retryMode, forbiddenRetryWords);
        console.log(retryMode ? '[AI Endgame Retry Prompt]' : '[AI Endgame Prompt]', prompt);

        const data = await generateWithOllama({
            model: this.model,
            prompt,
            format: 'json',
            stream: false,
            think: false,
            options: {
                temperature: 0.0,
                num_predict: 80,
                top_p: 0.75
            }
        });

        const rawResponse = extractOllamaText(data);
        console.log('Ollama response for AI endgame guess:', rawResponse);
        const [guess] = parseWordArrayText(rawResponse, this.wordLength, this.styleOptions);
        if (!guess || constraints.allGuessedWords.has(guess) || this.filterAllowedWords([guess]).length === 0) {
            this.lastRejectedLLMGuess = guess || '';
            return '';
        }
        const validGuess = this.getRegexMatchedCandidates([guess], constraints, regexInfo)[0] || '';
        this.lastRejectedLLMGuess = validGuess ? '' : guess;
        return validGuess;
    }

    async requestLLMBlankFillGuess(systemPrompt, constraints, regexInfo, retryMode = false, forbiddenRetryWords = []) {
        const memoryWords = this.getPromptMemoryWords(constraints, 14);
        const memoryEntries = this.getRelevantGuessMemory(constraints, regexInfo);
        const prompt = this.buildBlankFillGuessPrompt(systemPrompt, constraints, regexInfo, memoryWords, memoryEntries, retryMode, forbiddenRetryWords);
        console.log(retryMode ? '[AI Blank Fill Retry Prompt]' : '[AI Blank Fill Prompt]', prompt);

        const data = await generateWithOllama({
            model: this.model,
            prompt,
            format: 'json',
            stream: false,
            think: false,
            options: {
                temperature: 0.0,
                num_predict: 100,
                top_p: 0.75
            }
        });

        const rawResponse = extractOllamaText(data);
        console.log('Ollama response for AI blank fill guess:', rawResponse);
        const [guess] = parseWordArrayText(rawResponse, this.wordLength, this.styleOptions);
        if (!guess || constraints.allGuessedWords.has(guess) || this.filterAllowedWords([guess]).length === 0) {
            this.lastRejectedLLMGuess = guess || '';
            return '';
        }
        const validGuess = this.getRegexMatchedCandidates([guess], constraints, regexInfo)[0] || '';
        this.lastRejectedLLMGuess = validGuess ? '' : guess;
        return validGuess;
    }

    async requestLLMRevealDecision(systemPrompt, guessEntries, constraints, regexInfo, triggerReason = '') {
        const memoryWords = this.getPromptMemoryWords(constraints, 10);
        const memoryEntries = this.getRelevantGuessMemory(constraints, regexInfo);
        const prompt = `${systemPrompt}
${this.buildPromptContextBlock(guessEntries, constraints, memoryWords, memoryEntries, regexInfo)}
Stuck state:
- Consecutive failed turns: ${this.consecutiveFailedTurns}
- Trigger reason: ${String(triggerReason || 'No valid app-accepted guess produced.')}
Task:
- Decide if you should reveal the hidden solution now.
- Choose reveal=true only if you are genuinely stuck and repeated retries are unlikely to help.
- Choose reveal=false if another normal guess attempt is still worthwhile.
- Return JSON only with this schema:
{"reveal":true|false,"reason":"<short reason>"}
- No markdown, no prose outside JSON.`;
        console.log('[AI Reveal Decision Prompt]', prompt);

        const data = await generateWithOllama({
            model: this.model,
            prompt,
            format: 'json',
            stream: false,
            think: false,
            options: {
                temperature: 0.0,
                num_predict: 90,
                top_p: 0.75
            }
        });

        const rawResponse = extractOllamaText(data);
        console.log('Ollama response for AI reveal decision:', rawResponse);
        return this.parseRevealDecision(rawResponse);
    }

    async tryRevealSolutionWhenStuck(systemPrompt, actionToken = this.roundActionToken, triggerReason = '') {
        if (!this.isReadyToGuess() || actionToken !== this.roundActionToken) {
            return false;
        }

        const threshold = this.getRevealFailureThreshold();
        if (this.consecutiveFailedTurns < threshold) {
            return false;
        }

        let decision = { reveal: false, reason: '' };
        try {
            decision = await this.runLLMTaskProvider(async () => {
                if (!this.isReadyToGuess() || actionToken !== this.roundActionToken) {
                    return { reveal: false, reason: '' };
                }
                const sharedContext = this.getSharedRoundContext();
                const guessEntries = this.getKnownGuessEntries(sharedContext);
                const constraints = deriveWordleConstraints(guessEntries, this.wordLength);
                const regexInfo = buildConstraintRegex(constraints, this.wordLength, this.styleOptions);
                return this.requestLLMRevealDecision(systemPrompt, guessEntries, constraints, regexInfo, triggerReason);
            });
        } catch (error) {
            console.warn('AI reveal decision failed; continuing normal retries.', error);
            return false;
        }

        if (!decision?.reveal || !this.isReadyToGuess() || actionToken !== this.roundActionToken) {
            return false;
        }

        this.roundNote = 'Stuck repeatedly. Revealing the solution for review.';
        this.updateUI();

        try {
            const result = await this.handleRevealSolutionHook({
                playerId: this.id,
                playerName: this.name,
                model: this.model,
                language: this.language,
                solution: this.solution,
                failedTurnCount: this.consecutiveFailedTurns,
                reason: decision.reason || triggerReason || 'Repeated failed turns'
            });
            if (result?.handled) {
                this.clearFailedTurnStreak();
                if (result.note) {
                    this.roundNote = result.note;
                    this.updateUI();
                }
                return true;
            }
        } catch (error) {
            console.warn('AI reveal hook failed; continuing normal retries.', error);
        }

        return false;
    }

    async requestLLMLastGuess(systemPrompt, guessEntries, constraints, exactCandidates, plausibleCandidates, regexInfo, retryMode = false) {
        const memoryEntries = this.getRelevantGuessMemory(constraints, regexInfo);
        const prompt = this.buildLastGuessPrompt(
            systemPrompt,
            guessEntries,
            constraints,
            exactCandidates,
            plausibleCandidates,
            memoryEntries,
            regexInfo,
            retryMode
        );
        console.log(retryMode ? '[AI Last Guess Retry Prompt]' : '[AI Last Guess Prompt]', prompt);

        const data = await generateWithOllama({
            model: this.model,
            prompt,
            format: 'json',
            stream: false,
            think: false,
            options: {
                temperature: 0.0,
                num_predict: 110,
                top_p: 0.78
            }
        });

        const rawResponse = extractOllamaText(data);
        console.log('Ollama response for AI last guess:', rawResponse);
        const [guess] = parseWordArrayText(rawResponse, this.wordLength, this.styleOptions);
        if (!guess || constraints.allGuessedWords.has(guess) || this.filterAllowedWords([guess]).length === 0) {
            return '';
        }
        return this.getRegexMatchedCandidates([guess], constraints, regexInfo)[0] || '';
    }

    getConstraintPenalty(word, constraints) {
        let penalty = 0;
        const normalizedWord = normalizeWordArray([word], this.wordLength, this.styleOptions)[0];
        if (!normalizedWord || constraints.allGuessedWords.has(normalizedWord)) {
            return Number.POSITIVE_INFINITY;
        }

        const letterCounts = new Map();
        for (let index = 0; index < this.wordLength; index++) {
            const letter = normalizedWord[index];
            const fixedLetter = constraints.fixedPositions[index];
            if (fixedLetter && fixedLetter !== letter) {
                penalty += 4;
            } else if (!fixedLetter && constraints.excludedPositions[index].has(letter)) {
                penalty += 2;
            }
            letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
        }

        for (const [letter, minCount] of constraints.minCounts.entries()) {
            const count = letterCounts.get(letter) || 0;
            if (count < minCount) {
                penalty += (minCount - count) * 4;
            }
        }

        for (const [letter, maxCount] of constraints.maxCounts.entries()) {
            const count = letterCounts.get(letter) || 0;
            if (count > maxCount) {
                penalty += (count - maxCount) * 4;
            }
        }

        return penalty;
    }

    pickRelaxedCandidate(words, constraints, guessEntries = []) {
        const candidates = this.filterAllowedWords(words)
            .filter(word => !constraints.allGuessedWords.has(word));
        if (candidates.length === 0) {
            return '';
        }

        const scored = candidates
            .map(word => ({
                word,
                penalty: this.getConstraintPenalty(word, constraints),
                score: this.scoreCandidateWithHistory(word, constraints, guessEntries, candidates)
            }))
            .filter(entry => Number.isFinite(entry.penalty))
            .sort((left, right) => left.penalty - right.penalty || right.score - left.score);

        return scored[0]?.word || '';
    }

    getExploratoryProbe(guessEntries, constraints, anchorCandidates = []) {
        if (this.guesses.length >= 5) {
            return '';
        }

        const sourceWords = this.getKnownWordUniverse(guessEntries, false);
        if (sourceWords.length === 0) {
            return '';
        }

        const hardAbsentLetters = getHardAbsentLetters(constraints);
        const anchorPool = normalizeWordArray(anchorCandidates, this.wordLength, this.styleOptions);
        const anchorSet = new Set(anchorPool);
        const informationalPool = anchorPool.length > 0
            ? anchorPool
            : this.getRegexMatchedCandidates(sourceWords, constraints, buildConstraintRegex(constraints, this.wordLength, this.styleOptions));

        const overallFreq = new Map();
        const positionFreq = Array.from({ length: this.wordLength }, () => new Map());
        informationalPool.forEach(word => {
            const seenLetters = new Set();
            for (let i = 0; i < this.wordLength; i++) {
                const letter = word[i];
                positionFreq[i].set(letter, (positionFreq[i].get(letter) || 0) + 1);
                if (!seenLetters.has(letter)) {
                    overallFreq.set(letter, (overallFreq.get(letter) || 0) + 1);
                    seenLetters.add(letter);
                }
            }
        });

        const candidates = sourceWords
            .filter(word => !constraints.allGuessedWords.has(word))
            .filter(word => !Array.from(hardAbsentLetters).some(letter => word.includes(letter)))
            .filter(word => anchorSet.size === 0 || !anchorSet.has(word));
        if (candidates.length === 0) {
            return '';
        }

        const scored = candidates
            .map(word => {
                let score = this.scoreCandidateWithHistory(word, constraints, guessEntries, informationalPool.length > 0 ? informationalPool : candidates);
                for (const letter of new Set(word)) {
                    score += (overallFreq.get(letter) || 0) * 2;
                }
                for (let i = 0; i < this.wordLength; i++) {
                    if (!constraints.fixedPositions[i]) {
                        score += (positionFreq[i].get(word[i]) || 0) * 0.75;
                    }
                }
                if (!wordFitsConstraints(word, constraints, this.wordLength, this.styleOptions)) {
                    score -= 8;
                }
                return { word, score };
            })
            .sort((a, b) => b.score - a.score);

        return scored[0]?.word || '';
    }

    getConstraintSignal(constraints) {
        const fixedCount = constraints.fixedPositions.filter(Boolean).length;
        const requiredLetterCount = Array.from(constraints.minCounts.values()).reduce((sum, count) => sum + count, 0);
        const absentCount = getHardAbsentLetters(constraints).size;
        return {
            fixedCount,
            requiredLetterCount,
            absentCount,
            clueScore: (fixedCount * 3) + requiredLetterCount + Math.min(4, absentCount * 0.3)
        };
    }

    shouldAvoidLooseFallbacks(constraints) {
        const guessesRemaining = this.getGuessesRemaining();
        const signal = this.getConstraintSignal(constraints);
        return guessesRemaining <= 2 || signal.fixedCount >= 2 || signal.requiredLetterCount >= 3 || signal.clueScore >= 6;
    }

    getSemiConstrainedCandidates(words, constraints, guessEntries = [], maxPenalty = 2) {
        return this.filterAllowedWords(words)
            .filter(word => !constraints.allGuessedWords.has(word))
            .map(word => ({
                word,
                penalty: this.getConstraintPenalty(word, constraints),
                score: this.scoreCandidateWithHistory(word, constraints, guessEntries, words)
            }))
            .filter(entry => Number.isFinite(entry.penalty) && entry.penalty <= maxPenalty)
            .sort((left, right) => left.penalty - right.penalty || right.score - left.score)
            .map(entry => entry.word);
    }

    async resolveLastGuess(systemPrompt, guessEntries, constraints, regexInfo) {
        const exactUniverse = this.normalizeCandidatePoolForHeuristics([
            ...this.getKnownWordUniverse(guessEntries, true),
            ...this.allowedWordsProvider(this.language, this.wordLength, this.styleOptions)
        ]);
        const exactCandidates = this.rankCandidates(
            this.getRegexMatchedCandidates(exactUniverse, constraints, regexInfo),
            exactUniverse,
            constraints,
            guessEntries
        ).map(entry => entry.word);

        if (exactCandidates.length === 1) {
            console.log(`[AI Last Guess Resolver] exact solution candidate identified: ${exactCandidates[0]}`);
            return exactCandidates[0];
        }

        if (exactCandidates.length > 1) {
            for (let attempt = 0; attempt < 2; attempt++) {
                const finalGuess = await this.requestLLMLastGuess(
                    systemPrompt,
                    guessEntries,
                    constraints,
                    exactCandidates,
                    exactCandidates,
                    regexInfo,
                    attempt > 0
                );
                if (finalGuess) {
                    console.log(`[AI Last Guess Resolver] last-guess prompt selected ${finalGuess}`);
                    return finalGuess;
                }
            }

            const fallbackExact = exactCandidates[0];
            console.log(`[AI Last Guess Resolver] falling back to top exact candidate ${fallbackExact}`);
            return fallbackExact;
        }

        const plausibleCandidates = this.rankCandidates(exactUniverse, exactUniverse, constraints, guessEntries)
            .map(entry => entry.word)
            .slice(0, 18);
        for (let attempt = 0; attempt < 2; attempt++) {
            const finalGuess = await this.requestLLMLastGuess(
                systemPrompt,
                guessEntries,
                constraints,
                [],
                plausibleCandidates,
                regexInfo,
                attempt > 0
            );
            if (finalGuess) {
                console.log(`[AI Last Guess Resolver] last-guess prompt produced ${finalGuess}`);
                return finalGuess;
            }
        }

        const semiConstrained = this.getSemiConstrainedCandidates(exactUniverse, constraints, guessEntries, 2);
        if (semiConstrained.length > 0) {
            console.log(`[AI Last Guess Resolver] using best low-penalty fallback ${semiConstrained[0]}`);
            return semiConstrained[0];
        }

        return '';
    }

    async getNearSolvedGuess(systemPrompt, guessEntries, constraints, regexInfo) {
        const fixedCount = constraints.fixedPositions.filter(Boolean).length;
        const unresolvedPositions = constraints.fixedPositions
            .map((letter, index) => (letter ? -1 : index))
            .filter(index => index >= 0);
        if (fixedCount < this.wordLength - 2 || unresolvedPositions.length === 0 || unresolvedPositions.length > 2) {
            return '';
        }

        const knownUniverse = this.normalizeCandidatePoolForHeuristics([
            ...this.getKnownWordUniverse(guessEntries, true),
            ...this.allowedWordsProvider(this.language, this.wordLength, this.styleOptions)
        ]);
        const exactCandidates = this.getRegexMatchedCandidates(knownUniverse, constraints, regexInfo);
        if (exactCandidates.length > 0) {
            const rankedKnown = this.pickBestCandidate(exactCandidates, exactCandidates, constraints, guessEntries);
            console.log(`[AI Endgame Resolver] near-solved state; using ranked known candidate ${rankedKnown}`);
            return rankedKnown;
        }

        const failedEndgameGuesses = [];
        for (let attempt = 0; attempt < 2; attempt++) {
            const endgameGuess = await this.requestLLMEndgameGuess(
                systemPrompt,
                constraints,
                regexInfo,
                attempt > 0,
                failedEndgameGuesses
            );
            if (endgameGuess) {
                console.log(`[AI Endgame Resolver] near-solved state; compact endgame prompt returned ${endgameGuess}`);
                return endgameGuess;
            }
            if (this.lastRejectedLLMGuess) {
                failedEndgameGuesses.push(this.lastRejectedLLMGuess);
            }
        }

        for (let attempt = 0; attempt < 2; attempt++) {
            const blankFillGuess = await this.requestLLMBlankFillGuess(
                systemPrompt,
                constraints,
                regexInfo,
                attempt > 0,
                failedEndgameGuesses
            );
            if (blankFillGuess) {
                console.log(`[AI Endgame Resolver] blank-fill fallback returned ${blankFillGuess}`);
                return blankFillGuess;
            }
            if (this.lastRejectedLLMGuess) {
                failedEndgameGuesses.push(this.lastRejectedLLMGuess);
            }
        }

        return '';
    }

    normalizeCandidatePoolForHeuristics(words) {
        return this.filterAllowedWords(words)
            .filter((word, index, pool) => pool.indexOf(word) === index)
            .filter(word => !this.guesses.some(entry => entry.word === word));
    }

    rememberSubmittedGuessFromPendingContext() {
        if (!this.pendingGuessMemoryEntry || typeof this.rememberGuessMemoryHook !== 'function') {
            return;
        }

        const latestGuess = this.guesses[this.guesses.length - 1];
        if (!latestGuess || !latestGuess.word) {
            this.pendingGuessMemoryEntry = null;
            return;
        }

        const correctCount = latestGuess.result.filter(state => state === 'correct').length;
        const presentCount = latestGuess.result.filter(state => state === 'present').length;
        const solved = latestGuess.word === this.solution;
        const effectiveness = (correctCount * 4) + (presentCount * 2) + (solved ? 18 : 0);
        this.rememberGuessMemoryHook(
            this.model,
            this.language,
            {
                ...this.pendingGuessMemoryEntry,
                guess: latestGuess.word,
                solved,
                guessNumber: this.guesses.length,
                effectiveness,
                lastUsedAt: Date.now()
            },
            this.wordLength,
            this.styleOptions
        );
        this.pendingGuessMemoryEntry = null;
    }

    async resolveGuessFromCandidates(systemPrompt, guessEntries, constraints, candidates, regexInfo, sourceLabel) {
        const validMatches = this.getRegexMatchedCandidates(candidates, constraints, regexInfo);
        if (validMatches.length === 0) {
            return '';
        }

        if (validMatches.length === 1) {
            console.log(`[AI Regex Matcher] ${sourceLabel} produced a single app-valid match via ${regexInfo.source}: ${validMatches[0]}`);
            return validMatches[0];
        }

        console.log(`[AI Regex Matcher] ${sourceLabel} produced ${validMatches.length} app-valid matches via ${regexInfo.source}`);
        if (this.shouldUseDeterministicChoice(sourceLabel, validMatches, constraints, regexInfo)) {
            const deterministicGuess = this.pickBestCandidate(validMatches, validMatches, constraints, guessEntries);
            console.log(`[AI Deterministic Choice] ${sourceLabel} resolved locally to ${deterministicGuess}`);
            return deterministicGuess;
        }

        let failedChoiceAttempts = 0;
        const failedChoiceWords = [];
        for (let attempt = 0; attempt < AI_MATCH_CHOICE_ATTEMPTS; attempt++) {
            const llmChoice = await this.requestLLMChoiceFromMatches(
                systemPrompt,
                guessEntries,
                constraints,
                validMatches,
                regexInfo,
                attempt > 0,
                failedChoiceWords
            );
            if (llmChoice) {
                return llmChoice;
            }
            failedChoiceAttempts++;
        }

        if (failedChoiceAttempts >= AI_PROBE_FALLBACK_AFTER_ATTEMPTS) {
            const probeGuess = this.getExploratoryProbe(guessEntries, constraints, validMatches);
            if (probeGuess) {
                console.log(`[AI Probe Guess] unresolved ${sourceLabel} matches; using exploratory guess ${probeGuess}`);
                return probeGuess;
            }
        }

        const fallbackGuess = this.pickBestCandidate(validMatches, validMatches, constraints, guessEntries);
        console.log(`[AI Regex Matcher] ${sourceLabel} match choice failed; falling back to ${fallbackGuess}`);
        return fallbackGuess;
    }

    async generateGuessFromContext(systemPrompt, sharedContext) {
        const guessEntries = this.getKnownGuessEntries(sharedContext);
        const constraints = deriveWordleConstraints(guessEntries, this.wordLength);
        const regexInfo = buildConstraintRegex(constraints, this.wordLength, this.styleOptions);
        const guessesRemaining = this.getGuessesRemaining();
        const avoidLooseFallbacks = this.shouldAvoidLooseFallbacks(constraints);
        const decisionMode = this.getDecisionMode();

        if (guessEntries.length === 0 && this.guesses.length === 0) {
            const openingGuess = this.getAppOpeningGuess();
            if (openingGuess && !constraints.allGuessedWords.has(openingGuess)) {
                console.log(`[AI Opening Guess] using app-selected opening guess ${openingGuess}`);
                return openingGuess;
            }
        }

        const solvedWord = getSolvedWordFromConstraints(constraints, this.wordLength, this.styleOptions);
        if (solvedWord && !constraints.allGuessedWords.has(solvedWord)) {
            console.log(`[AI Constraint Solver] solved word identified from shared clues: ${solvedWord}`);
            return solvedWord;
        }

        if (guessesRemaining <= 1) {
            const lastGuess = await this.resolveLastGuess(systemPrompt, guessEntries, constraints, regexInfo);
            if (lastGuess) {
                return lastGuess;
            }
        }

        const nearSolvedGuess = await this.getNearSolvedGuess(systemPrompt, guessEntries, constraints, regexInfo);
        if (nearSolvedGuess) {
            return nearSolvedGuess;
        }

        if (decisionMode === 'assisted') {
            const memoryBankGuess = await this.resolveGuessFromCandidates(
                systemPrompt,
                guessEntries,
                constraints,
                this.getMemoryBankCandidates(constraints, regexInfo),
                regexInfo,
                'memory bank'
            );
            if (memoryBankGuess) {
                return memoryBankGuess;
            }
        }

        const localUniverse = this.getKnownWordUniverse(guessEntries, true);
        const localGuess = await this.resolveGuessFromCandidates(
            systemPrompt,
            guessEntries,
            constraints,
            localUniverse,
            regexInfo,
            'local sources'
        );
        if (localGuess) {
            return localGuess;
        }

        const llmRawCandidates = [];
        let llmResponse = await this.requestLLMCandidatePool(systemPrompt, guessEntries, constraints, regexInfo, false);
        llmRawCandidates.push(...llmResponse.parsedCandidates);
        let llmCandidates = llmResponse.validMatches;
        if (llmCandidates.length === 0) {
            llmResponse = await this.requestLLMCandidatePool(
                systemPrompt,
                guessEntries,
                constraints,
                regexInfo,
                true,
                llmRawCandidates
            );
            llmRawCandidates.push(...llmResponse.parsedCandidates);
            llmCandidates = llmResponse.validMatches;
        }

        if (llmCandidates.length > 0) {
            const llmGuess = await this.resolveGuessFromCandidates(
                systemPrompt,
                guessEntries,
                constraints,
                llmCandidates,
                regexInfo,
                'LLM pool'
            );
            if (llmGuess) {
                return llmGuess;
            }
        }

        if (!avoidLooseFallbacks) {
            const relaxedLLMGuess = this.pickRelaxedCandidate(llmRawCandidates, constraints, guessEntries);
            if (relaxedLLMGuess) {
                console.log(`[AI Relaxed Matcher] no exact app-valid match; trying exploratory near-match ${relaxedLLMGuess}`);
                return relaxedLLMGuess;
            }
        }

        const failedDirectGuesses = [];
        for (let attempt = 0; attempt < 2; attempt++) {
            const directGuess = await this.requestLLMDirectGuess(
                systemPrompt,
                guessEntries,
                constraints,
                regexInfo,
                attempt > 0,
                failedDirectGuesses
            );
            if (directGuess) {
                return directGuess;
            }
            if (this.lastRejectedLLMGuess) {
                failedDirectGuesses.push(this.lastRejectedLLMGuess);
            }
        }

        const constrainedUniverse = this.normalizeCandidatePoolForHeuristics([
            ...this.getKnownWordUniverse(guessEntries, true),
            ...llmRawCandidates
        ]);
        const semiConstrainedGuess = this.getSemiConstrainedCandidates(constrainedUniverse, constraints, guessEntries, avoidLooseFallbacks ? 2 : 4)[0] || '';
        if (semiConstrainedGuess) {
            console.log(`[AI Semi-Constrained Fallback] using low-penalty guess ${semiConstrainedGuess}`);
            return semiConstrainedGuess;
        }

        if (!avoidLooseFallbacks) {
            const probeGuess = this.getExploratoryProbe(guessEntries, constraints);
            if (probeGuess) {
                console.log(`[AI Probe Guess] no definitive match after LLM attempts; using exploratory guess ${probeGuess}`);
                return probeGuess;
            }
        }

        return '';
    }

    getTypingDelayMs() {
        if (this.tactic === 'impatient') {
            return 45 + Math.random() * 45;
        }
        if (this.tactic === 'calm') {
            return 150 + Math.random() * 110;
        }
        return 85 + Math.random() * 75;
    }

    async typeAndSubmitGuess(guess, actionToken = this.roundActionToken) {
        const normalizedGuess = normalizeWordArray([guess], this.wordLength, this.styleOptions)[0];
        if (!normalizedGuess || !this.isReadyToGuess() || actionToken !== this.roundActionToken) {
            return false;
        }

        this.typing = true;
        this.validationMessage = '';
        this.currentGuess = '';
        this.roundNote = 'Committing guess to the board.';
        this.updateUI();

        for (const letter of normalizedGuess) {
            if (!this.isReadyToGuess() || actionToken !== this.roundActionToken) {
                this.typing = false;
                this.currentGuess = '';
                this.updateUI();
                return false;
            }
            this.currentGuess += letter;
            this.updateUI();
            await this.sleep(this.getTypingDelayMs());
        }

        await this.sleep(Math.max(45, this.getTypingDelayMs() * 0.6));
        if (!this.isReadyToGuess() || actionToken !== this.roundActionToken) {
            this.typing = false;
            this.currentGuess = '';
            this.updateUI();
            return false;
        }
        this.typing = false;
        this.updateUI();
        const submitted = this.submitGuess();
        if (!submitted && this.isReadyToGuess()) {
            this.currentGuess = '';
            this.roundNote = 'Last AI guess was rejected. Replanning.';
            this.updateUI();
        } else if (submitted) {
            this.rememberSubmittedGuessFromPendingContext();
        }
        return submitted;
    }

    scheduleMoveRetry(delayMs = 600) {
        if (this.pendingMoveTimer || this.gameOver || !this.isReadyToGuess()) {
            return;
        }
        this.pendingMoveTimer = setTimeout(() => {
            this.pendingMoveTimer = null;
            this.makeMove();
        }, delayMs);
    }

    async makeMove() {
        if (this.thinking || this.typing || this.pendingMoveTimer || this.moveRequestInFlight || !this.isReadyToGuess()) return;
        this.pendingGuessMemoryEntry = null;
        this.thinking = true;
        this.updateUI();
        const actionToken = this.roundActionToken;

        let delay = 2000;
        let systemPrompt = `You are playing Wordle in ${this.language}. The solution is a ${this.wordLength}-letter word.`;
        systemPrompt += ' Green means exact letter in exact slot. Yellow means the letter exists but in a different slot. Gray or grey means absent unless duplicate-count rules explicitly say otherwise.';
        systemPrompt += ' Never reinterpret these color meanings. Obey fixed positions, exact counts, and the app regex gate exactly.';
        if (getLanguageKey(this.language) !== 'english') {
            systemPrompt += ` Use only common standalone ${this.language} words. Do not switch to English unless the word is also a standard ${this.language} word.`;
        }

        if (this.tactic === 'calm') {
            delay = 3000 + Math.random() * 2000;
            systemPrompt += " You are a 'calm' player. Think strategically and use the best possible word to eliminate candidates.";
        } else if (this.tactic === 'impatient') {
            delay = 500 + Math.random() * 1000;
            systemPrompt += " You are an 'impatient' player. Guess quickly, maybe not even using all the clues perfectly.";
        } else {
            delay = 1500 + Math.random() * 1500;
            systemPrompt += ' You are a balanced player.';
        }

        this.pendingMoveTimer = setTimeout(async () => {
            this.pendingMoveTimer = null;
            if (!this.isReadyToGuess() || actionToken !== this.roundActionToken) {
                this.thinking = false;
                this.currentGuess = '';
                this.pendingGuessMemoryEntry = null;
                this.updateUI();
                return;
            }

            let aiGuess = '';
            try {
                this.moveRequestInFlight = true;
                aiGuess = await this.runLLMTaskProvider(async () => {
                    if (!this.isReadyToGuess() || actionToken !== this.roundActionToken) return '';
                    let revisionSnapshot = this.getRoundRevision();
                    let nextGuess = '';
                    for (let pass = 0; pass < AI_RETHINK_MAX_PASSES; pass++) {
                        if (!this.isReadyToGuess() || actionToken !== this.roundActionToken) {
                            nextGuess = '';
                            break;
                        }
                        const sharedContext = this.getSharedRoundContext();
                        nextGuess = await this.generateGuessFromContext(systemPrompt, sharedContext);
                        if (!nextGuess) break;
                        if (actionToken !== this.roundActionToken || !this.isReadyToGuess()) {
                            nextGuess = '';
                            break;
                        }

                        const latestRevision = this.getRoundRevision();
                        if (latestRevision === revisionSnapshot) {
                            break;
                        }

                        revisionSnapshot = latestRevision;
                        nextGuess = '';
                    }
                    return nextGuess;
                });
            } catch (error) {
                console.error('Ollama error, try again later', error);
            } finally {
                this.moveRequestInFlight = false;
                this.thinking = false;
                if (actionToken !== this.roundActionToken) {
                    this.currentGuess = '';
                    this.pendingGuessMemoryEntry = null;
                    this.updateUI();
                    return;
                }
                this.updateUI();
                if (!this.isReadyToGuess()) return;

                if (!aiGuess) {
                    this.markFailedTurn('No valid guess produced');
                    const revealed = await this.tryRevealSolutionWhenStuck(systemPrompt, actionToken, 'No app-valid guess found');
                    if (revealed || !this.isReadyToGuess()) {
                        return;
                    }
                    console.warn('AI produced no valid guess, retrying...');
                    this.scheduleMoveRetry(600);
                    return;
                }

                const finalGuessEntries = this.getKnownGuessEntries(this.getSharedRoundContext());
                const finalConstraints = deriveWordleConstraints(finalGuessEntries, this.wordLength);
                const finalRegexInfo = buildConstraintRegex(finalConstraints, this.wordLength, this.styleOptions);
                this.pendingGuessMemoryEntry = {
                    ...this.createConstraintMemorySnapshot(finalConstraints, finalRegexInfo),
                    guess: aiGuess,
                    guessNumber: this.guesses.length + 1,
                    effectiveness: 0,
                    solved: false,
                    count: 1,
                    lastUsedAt: Date.now()
                };

                const submitted = await this.typeAndSubmitGuess(aiGuess, actionToken);
                if (submitted) {
                    this.clearFailedTurnStreak();
                    if (this.memoryEnabledProvider()) {
                        this.rememberWordHook(this.model, this.language, aiGuess, this.wordLength, this.styleOptions);
                    }
                } else if (this.isReadyToGuess()) {
                    this.pendingGuessMemoryEntry = null;
                    this.markFailedTurn('Guess rejected by validator');
                    const revealed = await this.tryRevealSolutionWhenStuck(systemPrompt, actionToken, 'Board rejected repeated AI guesses');
                    if (revealed || !this.isReadyToGuess()) {
                        return;
                    }
                    console.warn('AI guess was rejected by the board validator, retrying...');
                    this.scheduleMoveRetry(600);
                }
            }
        }, delay);
    }
}
