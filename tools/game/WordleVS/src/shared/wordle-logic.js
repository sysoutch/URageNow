import {
    clampWordLength,
    getDefaultWordStyleOptions,
    normalizeToWordLength,
    normalizeWordArray,
    normalizeWordStyleOptions
} from './word-utils.js';

export function collectGuessEntries(selfGuesses, sharedContext, wordLength, styleOptions = getDefaultWordStyleOptions(), selfPlayerName = 'Ollama AI') {
    const normalizedLength = clampWordLength(wordLength);
    const entries = [];

    const pushGuess = (player, guess, isSelf) => {
        const word = normalizeToWordLength(guess?.word, normalizedLength, styleOptions);
        const result = Array.isArray(guess?.result) ? guess.result.slice(0, normalizedLength) : [];
        if (!word || result.length !== normalizedLength) return;
        entries.push({ player, word, result, isSelf: Boolean(isSelf) });
    };

    if (Array.isArray(selfGuesses)) {
        selfGuesses.forEach(guess => pushGuess(selfPlayerName, guess, true));
    }

    if (Array.isArray(sharedContext)) {
        sharedContext.forEach(entry => {
            const playerName = String(entry?.player || 'Other player');
            if (!Array.isArray(entry?.guesses)) return;
            entry.guesses.forEach(guess => pushGuess(playerName, guess, false));
        });
    }

    return entries;
}

export function deriveWordleConstraints(guessEntries, wordLength) {
    const normalizedLength = clampWordLength(wordLength);
    const fixedPositions = Array(normalizedLength).fill('');
    const inferredFixedPositions = Array(normalizedLength).fill(false);
    const excludedPositions = Array.from({ length: normalizedLength }, () => new Set());
    const minCounts = new Map();
    const maxCounts = new Map();
    const allGuessedWords = new Set();
    const selfGuessedWords = new Set();
    const otherPlayersGuessedWords = new Set();

    guessEntries.forEach(entry => {
        if (!entry || typeof entry.word !== 'string' || !Array.isArray(entry.result)) return;
        if (entry.word.length !== normalizedLength || entry.result.length !== normalizedLength) return;

        allGuessedWords.add(entry.word);
        if (entry.isSelf) {
            selfGuessedWords.add(entry.word);
        } else {
            otherPlayersGuessedWords.add(entry.word);
        }
        const guessCounts = new Map();
        const positiveCounts = new Map();

        for (let i = 0; i < normalizedLength; i++) {
            const letter = entry.word[i];
            const state = entry.result[i];
            guessCounts.set(letter, (guessCounts.get(letter) || 0) + 1);

            if (state === 'correct') {
                fixedPositions[i] = letter;
                positiveCounts.set(letter, (positiveCounts.get(letter) || 0) + 1);
            } else {
                excludedPositions[i].add(letter);
                if (state === 'present') {
                    positiveCounts.set(letter, (positiveCounts.get(letter) || 0) + 1);
                }
            }
        }

        guessCounts.forEach((totalCount, letter) => {
            const positiveCount = positiveCounts.get(letter) || 0;
            if (positiveCount > (minCounts.get(letter) || 0)) {
                minCounts.set(letter, positiveCount);
            }
            if (positiveCount < totalCount) {
                const currentMax = maxCounts.has(letter) ? maxCounts.get(letter) : Infinity;
                maxCounts.set(letter, Math.min(currentMax, positiveCount));
            }
        });
    });

    minCounts.forEach((minCount, letter) => {
        if (maxCounts.has(letter) && maxCounts.get(letter) < minCount) {
            maxCounts.set(letter, minCount);
        }
    });

    let changed = true;
    while (changed) {
        changed = false;
        const fixedCounts = new Map();
        fixedPositions.forEach(letter => {
            if (!letter) return;
            fixedCounts.set(letter, (fixedCounts.get(letter) || 0) + 1);
        });

        minCounts.forEach((minCount, letter) => {
            const fixedCount = fixedCounts.get(letter) || 0;
            const remainingNeeded = Math.max(0, minCount - fixedCount);
            if (remainingNeeded <= 0) return;

            const candidatePositions = [];
            for (let index = 0; index < normalizedLength; index++) {
                if (fixedPositions[index] === letter) continue;
                if (fixedPositions[index]) continue;
                if (!excludedPositions[index].has(letter)) {
                    candidatePositions.push(index);
                }
            }

            if (candidatePositions.length === remainingNeeded) {
                candidatePositions.forEach(index => {
                    fixedPositions[index] = letter;
                    inferredFixedPositions[index] = true;
                    changed = true;
                });
            }
        });
    }

    return {
        fixedPositions,
        inferredFixedPositions,
        excludedPositions,
        minCounts,
        maxCounts,
        allGuessedWords,
        selfGuessedWords,
        otherPlayersGuessedWords
    };
}

export function wordFitsConstraints(word, constraints, wordLength, styleOptions = getDefaultWordStyleOptions()) {
    const normalized = normalizeToWordLength(word, wordLength, styleOptions);
    if (!normalized) return false;

    const normalizedLength = clampWordLength(wordLength);
    const letterCounts = new Map();

    for (let i = 0; i < normalizedLength; i++) {
        const letter = normalized[i];
        const fixedLetter = constraints.fixedPositions[i];
        if (fixedLetter && fixedLetter !== letter) return false;
        if (!fixedLetter && constraints.excludedPositions[i].has(letter)) return false;
        letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    }

    for (const [letter, minCount] of constraints.minCounts.entries()) {
        if ((letterCounts.get(letter) || 0) < minCount) return false;
    }

    for (const [letter, maxCount] of constraints.maxCounts.entries()) {
        if ((letterCounts.get(letter) || 0) > maxCount) return false;
    }

    return true;
}

export function describeGuessEntry(entry) {
    if (!entry || typeof entry.word !== 'string' || !Array.isArray(entry.result)) return '';
    const details = entry.result.map((state, index) => {
        const letter = entry.word[index];
        if (state === 'correct') return `${letter} correct at ${index + 1}`;
        if (state === 'present') return `${letter} present not ${index + 1}`;
        return `${letter} absent`;
    });
    return `${entry.player}: ${entry.word} -> ${details.join('; ')}`;
}

export function describeGuessColors(entry) {
    if (!entry || typeof entry.word !== 'string' || !Array.isArray(entry.result)) return '';

    const greens = [];
    const yellows = [];
    const grays = [];

    entry.result.forEach((state, index) => {
        const letter = entry.word[index];
        if (state === 'correct') {
            greens.push(`${index + 1}=${letter}`);
        } else if (state === 'present') {
            yellows.push(`${letter} not ${index + 1}`);
        } else {
            grays.push(letter);
        }
    });

    const roleLabel = entry.isSelf ? 'self' : 'other';
    return `${entry.player} (${roleLabel}) ${entry.word}: green [${greens.length ? greens.join(', ') : 'none'}], yellow [${yellows.length ? yellows.join(', ') : 'none'}], gray [${grays.length ? grays.join(', ') : 'none'}]`;
}

export function formatConstraintsForPrompt(constraints) {
    const inferredFlags = Array.isArray(constraints.inferredFixedPositions)
        ? constraints.inferredFixedPositions
        : Array(constraints.fixedPositions.length).fill(false);
    const fixedParts = constraints.fixedPositions
        .map((letter, index) => {
            if (!letter) return '';
            return inferredFlags[index]
                ? `${index + 1}=${letter} inferred`
                : `${index + 1}=${letter}`;
        })
        .filter(Boolean);

    const fixedCounts = new Map();
    constraints.fixedPositions.forEach(letter => {
        if (!letter) return;
        fixedCounts.set(letter, (fixedCounts.get(letter) || 0) + 1);
    });
    const fullyResolvedLetters = new Set();
    constraints.maxCounts.forEach((maxCount, letter) => {
        if (maxCount !== Infinity && (fixedCounts.get(letter) || 0) >= maxCount) {
            fullyResolvedLetters.add(letter);
        }
    });
    constraints.minCounts.forEach((minCount, letter) => {
        const fixedCount = fixedCounts.get(letter) || 0;
        if (fixedCount < minCount || fullyResolvedLetters.has(letter)) return;

        let openCandidatePositions = 0;
        for (let index = 0; index < constraints.fixedPositions.length; index++) {
            if (constraints.fixedPositions[index] === letter) continue;
            if (constraints.fixedPositions[index]) continue;
            if (!constraints.excludedPositions[index].has(letter)) {
                openCandidatePositions++;
            }
        }

        if (openCandidatePositions === 0) {
            fullyResolvedLetters.add(letter);
        }
    });

    const misplacedParts = [];
    constraints.excludedPositions.forEach((letters, index) => {
        letters.forEach(letter => {
            if (
                (constraints.minCounts.get(letter) || 0) > 0
                && constraints.fixedPositions[index] !== letter
                && !fullyResolvedLetters.has(letter)
            ) {
                misplacedParts.push(`${letter} not ${index + 1}`);
            }
        });
    });

    const absentLetters = [];
    constraints.maxCounts.forEach((maxCount, letter) => {
        if (maxCount === 0) absentLetters.push(letter);
    });

    const countRules = [];
    const trackedLetters = new Set([
        ...constraints.minCounts.keys(),
        ...constraints.maxCounts.keys()
    ]);
    trackedLetters.forEach(letter => {
        const minCount = constraints.minCounts.get(letter) || 0;
        const maxCount = constraints.maxCounts.has(letter) ? constraints.maxCounts.get(letter) : Infinity;
        if (maxCount === 0) return;
        if (maxCount !== Infinity && maxCount === minCount) {
            countRules.push(`${letter} exactly ${minCount}`);
        } else if (minCount > 0 && maxCount !== Infinity) {
            countRules.push(`${letter} between ${minCount} and ${maxCount}`);
        } else if (minCount > 0) {
            countRules.push(`${letter} at least ${minCount}`);
        }
    });

    return [
        `Fixed positions: ${fixedParts.length ? fixedParts.join(', ') : 'none'}`,
        `Misplaced letters: ${misplacedParts.length ? misplacedParts.join(', ') : 'none'}`,
        `Absent letters: ${absentLetters.length ? absentLetters.sort().join(', ') : 'none'}`,
        `Letter counts: ${countRules.length ? countRules.join(', ') : 'none'}`
    ].join('\n');
}

export function getSolvedWordFromConstraints(constraints, wordLength, styleOptions = getDefaultWordStyleOptions()) {
    const normalizedLength = clampWordLength(wordLength);
    if (constraints.fixedPositions.some(letter => !letter)) return '';

    const solvedWord = constraints.fixedPositions.join('');
    const normalized = normalizeToWordLength(solvedWord, normalizedLength, styleOptions);
    if (!normalized) return '';
    return wordFitsConstraints(normalized, constraints, normalizedLength, styleOptions) ? normalized : '';
}

function escapeRegexLiteral(value) {
    return String(value || '').replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function escapeRegexCharacterClass(value) {
    return String(value || '').replace(/[\\\]-^]/g, '\\$&');
}

export function getHardAbsentLetters(constraints) {
    const absentLetters = new Set();
    constraints.maxCounts.forEach((maxCount, letter) => {
        if (maxCount === 0) {
            absentLetters.add(letter);
        }
    });
    return absentLetters;
}

export function buildConstraintRegex(constraints, wordLength, styleOptions = getDefaultWordStyleOptions()) {
    const normalizedStyle = normalizeWordStyleOptions(styleOptions);
    const hardAbsentLetters = getHardAbsentLetters(constraints);

    const parts = constraints.fixedPositions.map((fixedLetter, index) => {
        if (fixedLetter) {
            return escapeRegexLiteral(fixedLetter);
        }

        const blockedLetters = new Set(hardAbsentLetters);
        constraints.excludedPositions[index].forEach(letter => blockedLetters.add(letter));
        if (blockedLetters.size === 0) {
            return normalizedStyle.allowExtendedLetters ? '[\\p{L}]' : '[A-Z]';
        }

        const blocked = Array.from(blockedLetters)
            .sort()
            .map(escapeRegexCharacterClass)
            .join('');
        return `[^${blocked}]`;
    });

    const source = `^${parts.join('')}$`;
    const flags = normalizedStyle.allowExtendedLetters ? 'u' : '';
    return {
        source,
        regex: new RegExp(source, flags)
    };
}

export function filterWordsByRegex(words, constraints, wordLength, styleOptions = getDefaultWordStyleOptions(), regexInfo = buildConstraintRegex(constraints, wordLength, styleOptions)) {
    const normalizedWords = normalizeWordArray(words, wordLength, styleOptions);
    return normalizedWords.filter(word =>
        regexInfo.regex.test(word)
        && wordFitsConstraints(word, constraints, wordLength, styleOptions)
    );
}

export function scoreCandidateWord(word, candidatePool, wordLength) {
    const normalizedLength = clampWordLength(wordLength);
    const overallFreq = new Map();
    const positionFreq = Array.from({ length: normalizedLength }, () => new Map());

    candidatePool.forEach(candidate => {
        const seenInWord = new Set();
        for (let i = 0; i < normalizedLength; i++) {
            const letter = candidate[i];
            positionFreq[i].set(letter, (positionFreq[i].get(letter) || 0) + 1);
            if (!seenInWord.has(letter)) {
                overallFreq.set(letter, (overallFreq.get(letter) || 0) + 1);
                seenInWord.add(letter);
            }
        }
    });

    const seen = new Set();
    let score = 0;
    for (let i = 0; i < normalizedLength; i++) {
        const letter = word[i];
        score += (positionFreq[i].get(letter) || 0) * 2;
        if (!seen.has(letter)) {
            score += overallFreq.get(letter) || 0;
            seen.add(letter);
        } else {
            score -= 1.5;
        }
    }
    return score;
}
