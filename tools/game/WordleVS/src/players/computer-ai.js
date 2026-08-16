import {
    buildConstraintRegex,
    deriveWordleConstraints,
    getSolvedWordFromConstraints,
    normalizeWordArray
} from '../shared.js';
import { OllamaAI } from './ollama-ai.js';

export class ComputerAI extends OllamaAI {
    constructor(...args) {
        super(...args);
        this.isLocalHeuristic = true;
    }

    getTacticLabel() {
        if (this.tactic === 'calm') return 'Local strategist';
        if (this.tactic === 'impatient') return 'Local sprinter';
        return 'Local heuristic';
    }

    getLocalCandidateUniverse(guessEntries) {
        return this.normalizeCandidatePoolForHeuristics([
            ...this.getKnownWordUniverse(guessEntries, true),
            ...this.allowedWordsProvider(this.language, this.wordLength, this.styleOptions)
        ]);
    }

    resolveLastGuessLocally(guessEntries, constraints, regexInfo) {
        const exactUniverse = this.getLocalCandidateUniverse(guessEntries);
        const exactCandidates = this.rankCandidates(
            this.getRegexMatchedCandidates(exactUniverse, constraints, regexInfo),
            exactUniverse,
            constraints,
            guessEntries
        ).map(entry => entry.word);

        if (exactCandidates.length > 0) {
            return exactCandidates[0];
        }

        const semiConstrained = this.getSemiConstrainedCandidates(exactUniverse, constraints, guessEntries, 2);
        return semiConstrained[0] || '';
    }

    resolveNearSolvedLocally(guessEntries, constraints, regexInfo) {
        const fixedCount = constraints.fixedPositions.filter(Boolean).length;
        const unresolvedPositions = constraints.fixedPositions
            .map((letter, index) => (letter ? -1 : index))
            .filter(index => index >= 0);
        if (fixedCount < this.wordLength - 2 || unresolvedPositions.length === 0 || unresolvedPositions.length > 2) {
            return '';
        }

        const localUniverse = this.getLocalCandidateUniverse(guessEntries);
        const exactCandidates = this.getRegexMatchedCandidates(localUniverse, constraints, regexInfo);
        if (exactCandidates.length > 0) {
            return this.pickBestCandidate(exactCandidates, exactCandidates, constraints, guessEntries);
        }

        return '';
    }

    async generateGuessFromContext(_systemPrompt, sharedContext) {
        const guessEntries = this.getKnownGuessEntries(sharedContext);
        const constraints = deriveWordleConstraints(guessEntries, this.wordLength);
        const regexInfo = buildConstraintRegex(constraints, this.wordLength, this.styleOptions);
        const guessesRemaining = this.getGuessesRemaining();
        const avoidLooseFallbacks = this.shouldAvoidLooseFallbacks(constraints);

        if (guessEntries.length === 0 && this.guesses.length === 0) {
            const openingGuess = this.getAppOpeningGuess();
            if (openingGuess && !constraints.allGuessedWords.has(openingGuess)) {
                return openingGuess;
            }
        }

        const solvedWord = getSolvedWordFromConstraints(constraints, this.wordLength, this.styleOptions);
        if (solvedWord && !constraints.allGuessedWords.has(solvedWord)) {
            return solvedWord;
        }

        if (guessesRemaining <= 1) {
            const lastGuess = this.resolveLastGuessLocally(guessEntries, constraints, regexInfo);
            if (lastGuess) {
                return lastGuess;
            }
        }

        const nearSolvedGuess = this.resolveNearSolvedLocally(guessEntries, constraints, regexInfo);
        if (nearSolvedGuess) {
            return nearSolvedGuess;
        }

        const localUniverse = this.getLocalCandidateUniverse(guessEntries);
        const exactCandidates = this.getRegexMatchedCandidates(localUniverse, constraints, regexInfo);
        if (exactCandidates.length > 0) {
            return this.pickBestCandidate(exactCandidates, exactCandidates, constraints, guessEntries);
        }

        const semiConstrained = this.getSemiConstrainedCandidates(
            localUniverse,
            constraints,
            guessEntries,
            avoidLooseFallbacks ? 2 : 4
        );
        if (semiConstrained.length > 0) {
            return semiConstrained[0];
        }

        if (!avoidLooseFallbacks) {
            const exploratory = this.getExploratoryProbe(guessEntries, constraints, localUniverse);
            if (exploratory) {
                return exploratory;
            }
        }

        const fallbackPool = normalizeWordArray(localUniverse, this.wordLength, this.styleOptions)
            .filter(word => !constraints.allGuessedWords.has(word));
        if (fallbackPool.length > 0) {
            return this.pickBestCandidate(fallbackPool, fallbackPool, constraints, guessEntries);
        }

        return '';
    }
}
