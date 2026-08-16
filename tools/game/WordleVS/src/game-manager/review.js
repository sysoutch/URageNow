import {
    clampWordLength,
    extractOllamaText,
    generateWithOllama,
    getLanguageKey,
    normalizeToWordLength
} from '../shared.js';
import { OllamaAI } from '../players.js';

export function installGameManagerReviewMethods(GameManager) {
    class ReviewMethods {
        getReviewerModels() {
            const activeAIModels = this.players
                .filter(player => player instanceof OllamaAI && !player.isLocalHeuristic)
                .map(player => player.model);
            const configuredAIModels = this.getSelectedAIBackend() === 'llm'
                ? this.getSelectedAIModels()
                : [];
            return [...new Set([
                this.wordModel,
                ...activeAIModels,
                ...configuredAIModels
            ].filter(Boolean))].slice(0, 3);
        }

        async askWordYesNoWithModel(model, prompt) {
            const data = await generateWithOllama({
                model,
                prompt,
                stream: false,
                think: false,
                options: {
                    temperature: 0.0,
                    num_predict: 3
                }
            });
            const verdict = extractOllamaText(data).trim().toUpperCase();
            return verdict.startsWith('YES');
        }

        async reviewCandidateWithModels(word, language) {
            const candidate = normalizeToWordLength(word, this.wordLength, this.wordStyleOptions);
            if (candidate.length !== this.wordLength) {
                return { accepted: false, yesVotes: 0, noVotes: 1, reviewers: [] };
            }

            const reviewers = [];
            let yesVotes = 0;
            let noVotes = 0;
            const models = this.getReviewerModels();
            if (models.length < 2) {
                return { accepted: true, yesVotes: 0, noVotes: 0, reviewers, reviewApplied: false };
            }

            const prompt = `Answer ONLY YES or NO.
You are reviewing a possible ${language} Wordle solution.
Is "${candidate}" a common standalone ${language} word suitable for Wordle?
Answer NO if it feels obscure, malformed, not really a word, or mainly from a different language.`;

            for (const model of models) {
                try {
                    const voteYes = await this.askWordYesNoWithModel(model, prompt);
                    reviewers.push({ model, vote: voteYes ? 'YES' : 'NO' });
                    if (voteYes) {
                        yesVotes++;
                    } else {
                        noVotes++;
                    }
                } catch (error) {
                    console.warn(`Reviewer model "${model}" failed while checking "${candidate}".`, error);
                }
            }

            const accepted = yesVotes >= noVotes;
            return { accepted, yesVotes, noVotes, reviewers, reviewApplied: true };
        }

        applySolvedWordReviewSummary(solution, reviewResult) {
            if (!reviewResult || !solution) return;
            this.latestSolvedWordReview = {
                word: solution,
                ...reviewResult
            };
            this.players.forEach(player => {
                if (player.solution !== solution) return;
                if (player.lastRoundSummary) {
                    player.lastRoundSummary.text = `${player.lastRoundSummary.text} · ${reviewResult.note}`;
                } else {
                    player.roundNote = reviewResult.note;
                }
                player.updateUI();
            });
        }

        async reviewSolvedWordForRound(solution, language, wordLength = this.wordLength, styleOptions = this.wordStyleOptions) {
            const normalized = normalizeToWordLength(solution, wordLength, styleOptions);
            if (normalized.length !== clampWordLength(wordLength)) {
                return {
                    accepted: false,
                    note: 'Post-solve review flagged the solution as malformed and removed it for future rounds.'
                };
            }

            const cached = this.currentRoundSolvedWordReview;
            if (cached && cached.roundNumber === this.roundNumber && cached.word === normalized) {
                return cached.promise;
            }

            const promise = (async () => {
                const review = await this.reviewCandidateWithModels(normalized, language);
                const languageAccepted = review.accepted ? await this.verifyWordLanguage(normalized, language) : false;
                const accepted = review.accepted && languageAccepted;
                const note = accepted
                    ? review.reviewApplied
                        ? `Post-solve review accepted the word (${review.yesVotes} yes / ${review.noVotes} no).`
                        : 'Post-solve review accepted the word.'
                    : review.reviewApplied
                        ? `Post-solve review flagged the word invalid for future rounds (${review.noVotes} no / ${review.yesVotes} yes).`
                        : 'Post-solve review flagged the word invalid for future rounds.';

                if (accepted) {
                    this.rememberModelWord(this.wordModel, language, normalized, wordLength, styleOptions, 'word');
                    const activeAIModels = [...new Set(
                        this.players
                            .filter(player => player instanceof OllamaAI && !player.isLocalHeuristic)
                            .map(player => player.model)
                    )];
                    activeAIModels.forEach(model => this.rememberModelWord(model, language, normalized, wordLength, styleOptions, 'ai'));
                } else {
                    this.addRejectedGenerationWord(language, normalized, wordLength, styleOptions);
                    this.rememberPersistentlyRejectedWord(language, normalized, wordLength, styleOptions, {
                        yesVotes: review.yesVotes || 0,
                        noVotes: Math.max(1, review.noVotes || 0),
                        reviewers: Array.isArray(review.reviewers) ? review.reviewers : [],
                        reviewedAt: Date.now()
                    });
                }

                const result = {
                    accepted,
                    reviewApplied: Boolean(review.reviewApplied),
                    yesVotes: review.yesVotes || 0,
                    noVotes: review.noVotes || 0,
                    reviewers: Array.isArray(review.reviewers) ? review.reviewers : [],
                    note,
                    reviewedAt: Date.now()
                };
                this.applySolvedWordReviewSummary(normalized, result);
                return result;
            })();

            this.currentRoundSolvedWordReview = {
                roundNumber: this.roundNumber,
                word: normalized,
                promise
            };
            return promise;
        }

        async askWordYesNo(prompt) {
            const data = await generateWithOllama({
                model: this.wordModel,
                prompt,
                stream: false,
                think: false,
                options: {
                    temperature: 0.0,
                    num_predict: 3
                }
            });
            const verdict = extractOllamaText(data).trim().toUpperCase();
            return verdict.startsWith('YES');
        }

        async phraseRecheckWordValidity(word, language) {
            const candidate = normalizeToWordLength(word, this.wordLength, this.wordStyleOptions);
            if (candidate.length !== this.wordLength) return false;

            const prompt = `You are doing a second validation check for a ${language} Wordle word.
Return JSON only:
{"is_valid":true|false,"sentences":["<sentence1>","<sentence2>"]}
Rules:
- If "${candidate}" is a valid standalone ${language} word, set is_valid=true and provide two different natural ${language} sentences containing the exact token "${candidate}".
- If not valid, set is_valid=false and return sentences as [].
- Do not output anything except valid JSON.`;

            try {
                const data = await generateWithOllama({
                    model: this.wordModel,
                    prompt,
                    format: 'json',
                    stream: false,
                    think: false,
                    options: {
                        temperature: 0.0,
                        num_predict: 140
                    }
                });

                const raw = extractOllamaText(data);
                const parsed = JSON.parse(raw);
                const isValid = Boolean(parsed?.is_valid);
                const sentences = Array.isArray(parsed?.sentences) ? parsed.sentences : [];
                const hasTwoWithWord = sentences.length >= 2 && sentences.every(sentence =>
                    String(sentence || '').toUpperCase().includes(candidate)
                );
                return isValid && hasTwoWithWord;
            } catch (error) {
                console.warn(`Phrase recheck failed for "${candidate}" (${language})`, error);
                return false;
            }
        }

        async verifyWordLanguage(word, language) {
            const candidate = normalizeToWordLength(word, this.wordLength, this.wordStyleOptions);
            if (candidate.length !== this.wordLength) return false;

            const targetCheckPrompt = `Answer ONLY YES or NO.
Is "${candidate}" a common standalone ${language} word suitable for a Wordle game?
If language is not English, answer NO when the word is mainly English.`;

            const targetYes = await this.askWordYesNo(targetCheckPrompt);
            if (!targetYes) {
                return this.phraseRecheckWordValidity(candidate, language);
            }

            if (this.wordStyleOptions.onlySingular) {
                const singularNoun = await this.askWordYesNo(
                    `Answer ONLY YES or NO.
Is "${candidate}" a singular noun in ${language}?`
                );
                if (!singularNoun) {
                    return false;
                }
            }

            const languageKey = getLanguageKey(language);
            if (languageKey !== 'english') {
                const mostlyEnglishNotTarget = await this.askWordYesNo(
                    `Answer ONLY YES or NO.
Is "${candidate}" mainly English and NOT a common standalone ${language} word?`
                );
                if (mostlyEnglishNotTarget) {
                    return this.phraseRecheckWordValidity(candidate, language);
                }
            }

            return true;
        }
    }

    Object.getOwnPropertyNames(ReviewMethods.prototype).forEach(name => {
        if (name === 'constructor') return;
        GameManager.prototype[name] = ReviewMethods.prototype[name];
    });
}
