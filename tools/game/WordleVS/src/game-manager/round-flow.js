import {
    DEFAULT_AI_MODEL,
    DEFAULT_WORD_MODEL,
    ROUND_TRANSITION_DELAY_MS,
    clampWordLength,
    createWordMask,
    extractOllamaText,
    generateWithOllama
} from '../shared.js';
import { ComputerAI, OllamaAI, PlayerBoard } from '../players.js';

const AI_STUCK_REVEAL_FAILURE_THRESHOLD = 3;

export function installGameManagerRoundFlowMethods(GameManager) {
    class RoundFlowMethods {
        getActivePlayers() {
            if (this.mode === 'elimination') {
                return this.players.filter(player => player.status !== 'lost');
            }
            return this.players;
        }

        ensureFocusedPlayer() {
            const focusableHumans = this.getActivePlayers().filter(player => !player.isAI && !player.gameOver);
            if (focusableHumans.length === 0) return;
            const isFocusedValid = focusableHumans.some(player => player.id === this.focusedPlayerId);
            if (!isFocusedValid) {
                this.setFocusedPlayer(focusableHumans[0].id);
            }
        }

        getRoundRevision() {
            return this.roundSharedRevision;
        }

        async handleAIRevealSolution(payload = {}) {
            if (this.gameEnded || this.roundTransitioning) {
                return { handled: false, note: '' };
            }

            const playerId = parseInt(payload.playerId, 10);
            const player = this.players.find(currentPlayer => currentPlayer.id === playerId);
            if (!player || player.gameOver) {
                return { handled: false, note: '' };
            }

            const language = this.getSelectedLanguage();
            const candidate = String(payload.solution || player.solution || '').trim().toUpperCase();
            if (candidate.length !== this.wordLength) {
                return { handled: false, note: 'Reveal skipped because the round solution is unavailable.' };
            }

            let review = { accepted: false, yesVotes: 0, noVotes: 0, reviewers: [], reviewApplied: false };
            let languageAccepted = false;
            try {
                review = await this.reviewCandidateWithModels(candidate, language);
                languageAccepted = review.accepted ? await this.verifyWordLanguage(candidate, language) : false;
            } catch (error) {
                console.warn(`AI reveal review failed for "${candidate}"`, error);
            }

            const accepted = review.accepted && languageAccepted;
            let penaltyPoints = 0;
            if (accepted) {
                penaltyPoints = this.applyPenaltyPoints(
                    player,
                    this.getAIRevealPenaltyPoints(),
                    `-${this.getAIRevealPenaltyPoints()} pts for revealing a valid solution while stuck`
                );
            }

            const reviewSummary = review.reviewApplied
                ? `${review.yesVotes} yes / ${review.noVotes} no`
                : 'review skipped';
            const reasonNote = payload.reason ? ` Reason: ${payload.reason}.` : '';
            const statusMessage = accepted
                ? `${player.name} revealed the solution (${candidate}) after repeated failed turns.${reasonNote} Valid word confirmed (${reviewSummary}); penalty -${penaltyPoints} pts.`
                : `${player.name} revealed the solution (${candidate}) after repeated failed turns.${reasonNote} Validation did not confirm a valid ${language} word (${reviewSummary}); no penalty.`;

            player.markSkipped(
                accepted
                    ? `Revealed valid solution ${candidate}; penalty -${penaltyPoints} pts.`
                    : `Revealed ${candidate}; validation did not confirm validity, no penalty.`
            );
            player.roundNote = accepted
                ? `Revealed valid solution; penalty -${penaltyPoints} pts.`
                : 'Revealed solution, but validity was not confirmed.';
            player.updateUI();

            this.updateRoundStatus(statusMessage);
            this.checkGameStatus();
            return {
                handled: true,
                accepted,
                penaltyPoints,
                note: player.roundNote
            };
        }

        markRemainingPlayersSkipped(exemptPlayerId, note) {
            this.getActivePlayers().forEach(player => {
                if (player.id === exemptPlayerId || player.gameOver) return;
                player.markSkipped(note);
            });
        }

        shouldAutoCloseRoundOnSolve() {
            return this.peekMode === 'open' && this.mode !== 'elimination';
        }

        buildEliminationCheckpointRequirements(wordLength = this.wordLength, checkpointCount = this.eliminationCheckpointCount) {
            const normalizedLength = clampWordLength(wordLength);
            const normalizedCount = Math.max(1, Math.min(normalizedLength, parseInt(checkpointCount, 10) || 1));
            return Array.from({ length: normalizedCount }, (_, index) =>
                Math.max(1, Math.ceil((normalizedLength * (index + 1)) / normalizedCount))
            );
        }

        buildEliminationCheckpointTimes(roundTimeLimit = this.eliminationRoundTimeLimit, checkpointCount = this.eliminationCheckpointCount) {
            const totalTime = Math.max(5, parseInt(roundTimeLimit, 10) || 30);
            const normalizedCount = Math.max(1, parseInt(checkpointCount, 10) || 1);
            return Array.from({ length: normalizedCount }, (_, index) =>
                Math.max(1, Math.ceil((totalTime * (index + 1)) / normalizedCount))
            );
        }

        getPlayerLockedGreenCount(player) {
            if (!player || !Array.isArray(player.guesses)) return 0;
            const locked = new Set();
            player.guesses.forEach(guess => {
                if (!Array.isArray(guess?.result)) return;
                guess.result.forEach((state, index) => {
                    if (state === 'correct') {
                        locked.add(index);
                    }
                });
            });
            return locked.size;
        }

        describeGreenRequirement(requiredGreens) {
            const normalized = Math.max(1, parseInt(requiredGreens, 10) || 1);
            return `${normalized} green ${normalized === 1 ? 'letter' : 'letters'}`;
        }

        clearEliminationRoundTimer() {
            if (this.mode !== 'elimination') return;
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        updateEliminationRoundStatus(prefix = '') {
            const activePlayers = this.getActivePlayers();
            if (activePlayers.length === 0) {
                this.updateRoundStatus(prefix || 'Elimination round complete.');
                return;
            }
            const checkpointNumber = Math.min(this.eliminationCheckpointIndex + 1, this.eliminationCheckpointRequirements.length);
            const requirement = this.eliminationCheckpointRequirements[this.eliminationCheckpointIndex] || this.wordLength;
            const safeCount = activePlayers.filter(player => player.status === 'won').length;
            const baseText = `Round ${this.roundNumber}: checkpoint ${checkpointNumber}/${this.eliminationCheckpointRequirements.length} needs ${this.describeGreenRequirement(requirement)}. ${safeCount}/${activePlayers.length} safe. ${this.timeLeft}s left.`;
            this.updateRoundStatus(prefix ? `${prefix} ${baseText}` : baseText);
        }

        async evaluateEliminationCheckpoint(checkpointIndex = this.eliminationCheckpointIndex) {
            if (this.mode !== 'elimination' || this.gameEnded || this.roundTransitioning) return;
            const requirement = this.eliminationCheckpointRequirements[checkpointIndex];
            if (!Number.isFinite(requirement)) return;

            const checkpointNumber = checkpointIndex + 1;
            const totalCheckpoints = this.eliminationCheckpointRequirements.length;
            const isFinalCheckpoint = checkpointNumber >= totalCheckpoints;
            const activePlayers = this.getActivePlayers();

            activePlayers.forEach(player => {
                if (player.status === 'won') return;
                const greenCount = this.getPlayerLockedGreenCount(player);
                if (greenCount >= requirement) {
                    if (!player.gameOver) {
                        player.roundNote = `Checkpoint ${checkpointNumber}/${totalCheckpoints} cleared with ${greenCount}/${this.wordLength} greens.`;
                        player.updateUI();
                    }
                    return;
                }
                player.markLost(`Checkpoint ${checkpointNumber}/${totalCheckpoints} failed. Needed ${this.describeGreenRequirement(requirement)}, reached ${greenCount}.`);
            });

            this.eliminationCheckpointIndex = checkpointIndex + 1;
            const survivors = this.getActivePlayers();
            if (survivors.length === 0) {
                this.clearEliminationRoundTimer();
                this.endGame('All players were eliminated. No winner this match.');
                return;
            }
            if (survivors.length === 1) {
                this.clearEliminationRoundTimer();
                this.endGame(`${survivors[0].name} survived the checkpoints and wins!`);
                return;
            }
            if (isFinalCheckpoint) {
                this.clearEliminationRoundTimer();
                await this.queueNextRound(`${survivors.length} players cleared the final checkpoint.`);
                return;
            }

            this.updateEliminationRoundStatus(`Checkpoint ${checkpointNumber}/${totalCheckpoints} resolved.`);
        }

        getSharedGuessContext(forPlayerId) {
            return this.players
                .filter(player => player.id !== forPlayerId)
                .map(player => ({
                    player: player.name,
                    guesses: player.guesses.map(guess => ({ word: guess.word, result: guess.result }))
                }))
                .filter(entry => entry.guesses.length > 0);
        }

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async queueNextRound(reason) {
            if (this.gameEnded || this.roundTransitioning) return;
            this.roundTransitioning = true;
            this.clearEliminationRoundTimer();
            this.updateRoundStatus(`${reason} Next round starts soon...`);
            await this.sleep(ROUND_TRANSITION_DELAY_MS);
            if (this.gameEnded) return;
            await this.nextRound();
        }

        markUnfinishedPlayersAsSkipped() {
            this.getActivePlayers().forEach(player => {
                if (player.gameOver) return;
                player.markSkipped('Time expired before this board finished.');
            });
        }

        async handlePlayerFinished(event) {
            if (this.gameEnded) return;

            const detail = event?.detail || {};
            const player = this.players.find(currentPlayer => currentPlayer.id === detail.playerId);
            if (!player) {
                this.checkGameStatus();
                return;
            }

            if (detail.status === 'won') {
                const guessCount = detail.guessesUsed || player.guesses.length;
                const points = this.awardSolvePoints(player, guessCount);
                const stepLabel = this.describeSteps(guessCount);
                const language = this.getSelectedLanguage();

                if (this.shouldAutoCloseRoundOnSolve()) {
                    if (this.mode === 'standard') {
                        this.markRemainingPlayersSkipped(player.id, `${player.name} solved first and closed the match.`);
                        const solvedWordReview = await this.reviewSolvedWordForRound(player.solution, language);
                        const reviewSuffix = solvedWordReview.accepted ? '' : ' Word flagged invalid for future rounds.';
                        this.endGame(`${player.name} solved it in ${stepLabel} and wins with ${player.stats.points} pts.${reviewSuffix}`);
                        return;
                    }

                    if (this.mode === 'timed') {
                        this.markRemainingPlayersSkipped(player.id, `${player.name} solved first and the round moved on.`);
                        const solvedWordReview = await this.reviewSolvedWordForRound(player.solution, language);
                        const reviewSuffix = solvedWordReview.accepted ? '' : ' Word flagged invalid for future rounds.';
                        if (this.gamesToWin > 0 && player.stats.passed >= this.gamesToWin) {
                            this.endGame(`${player.name} reached the goal in ${stepLabel} and finished on ${player.stats.points} pts.${reviewSuffix}`);
                        } else {
                            this.queueNextRound(`${player.name} solved in ${stepLabel} for +${points} pts.${reviewSuffix}`);
                        }
                        return;
                    }
                }

                const solvedWordReview = await this.reviewSolvedWordForRound(player.solution, language);
                const reviewSuffix = solvedWordReview.accepted ? '' : ' Word flagged invalid for future rounds.';

                if (this.mode === 'elimination') {
                    const activePlayers = this.getActivePlayers();
                    const safeCount = activePlayers.filter(currentPlayer => currentPlayer.status === 'won').length;
                    this.updateEliminationRoundStatus(`${player.name} solved in ${stepLabel} for +${points} pts.${reviewSuffix}`);
                    if (!this.roundTransitioning && safeCount === activePlayers.length) {
                        this.clearEliminationRoundTimer();
                        this.queueNextRound(`${activePlayers.length} players solved before the next checkpoint.`);
                        return;
                    }
                } else if (!this.roundTransitioning) {
                    const activePlayers = this.getActivePlayers();
                    const safeCount = activePlayers.filter(currentPlayer => currentPlayer.status === 'won').length;
                    this.updateRoundStatus(`${player.name} solved in ${stepLabel} for +${points} pts.${reviewSuffix} ${safeCount}/${activePlayers.length} boards are safe.`);
                }
            }

            this.checkGameStatus();
        }

        showSetup() {
            this.gameEnded = false;
            this.roundTransitioning = false;
            this.roundNumber = 0;
            this.roundFirstSolverId = null;
            this.roundScoredPlayerIds = new Set();
            this.latestSolvedWordReview = null;
            this.currentRoundSolvedWordReview = null;
            this.peekMode = this.getSelectedPeekMode();
            this.currentSetupStepKey = 'basics';
            this.currentSetupSourcePanel = 'upload';
            this.rejectedGenerationWordsByLanguage = {};
            this.usedRoundSolutionsByLanguage = {};
            this.currentRoundAIKnowledgeSamples = {};
            this.currentRoundAIOpeningGuesses = {};
            this.currentRoundCandidatePool = [];
            this.currentMatchCandidatePool = [];
            this.timedRoundActive = false;
            this.updateRoundNumber(0);
            this.updateRoundStatus('Setup');
            this.setTimerVisibility(false);
            this.refreshWordSourceState();
            this.updateAIOptionsVisibility();
            this.updateSetupWizard();
            document.getElementById('time-left').textContent = '0';
            document.getElementById('setup-screen').classList.remove('hidden');
            document.getElementById('players-wrapper').classList.add('hidden');
            document.getElementById('team-panel').classList.add('hidden');
            document.getElementById('stats-screen').classList.add('hidden');
            this.setViewState('setup');
            document.body.dataset.peekMode = this.peekMode;
            document.body.dataset.playerCount = '0';
            this.players = [];
            this.teamModeEnabled = false;
            this.resetTeamState();
            clearInterval(this.timerInterval);
        }

        async startGame() {
            const humanPlayerCount = this.getSelectedHumanPlayerCount();
            const aiPlayerCount = this.getSelectedAIPlayerCount();
            const tactic = document.getElementById('ai-tactic').value;
            const language = this.getSelectedLanguage();
            this.wordLength = this.getSelectedWordLength();
            this.wordPoolSize = this.getSelectedWordPoolSize();
            this.wordStyleOptions = this.getWordStyleOptions(true);
            this.peekMode = this.getSelectedPeekMode();
            this.teamModeEnabled = this.isTeamModeEnabled();
            this.aiBackend = this.getSelectedAIBackend();
            this.aiWordKnowledge = this.getSelectedAIWordKnowledge();
            this.aiDecisionMode = this.getSelectedAIDecisionMode();
            this.aiGuessPoolTarget = this.getSelectedAIGuessPoolTarget();
            this.wordModel = this.getSelectedModel('word-model', 'custom-word-model', DEFAULT_WORD_MODEL);
            const selectedAIModels = this.aiBackend === 'llm'
                ? this.getSelectedAIModels(aiPlayerCount)
                : Array.from({ length: aiPlayerCount }, () => 'computer');
            const aiPlayerNames = this.aiBackend === 'llm'
                ? this.buildAIPlayerNames(selectedAIModels)
                : Array.from({ length: aiPlayerCount }, (_, index) => `Computer AI ${index + 1}`);
            this.aiModel = selectedAIModels[0] || DEFAULT_AI_MODEL;

            this.mode = document.getElementById('game-mode').value;
            this.gameEnded = false;
            this.roundTransitioning = false;
            this.roundNumber = 0;
            this.roundFirstSolverId = null;
            this.roundScoredPlayerIds = new Set();
            this.latestSolvedWordReview = null;
            this.currentRoundSolvedWordReview = null;
            this.eliminationRoundTimeLimit = this.getSelectedEliminationRoundTimeLimit();
            this.eliminationCheckpointCount = this.getSelectedEliminationCheckpointCount(this.wordLength);
            this.eliminationCheckpointIndex = 0;
            this.eliminationCheckpointRequirements = this.buildEliminationCheckpointRequirements(this.wordLength, this.eliminationCheckpointCount);
            this.eliminationCheckpointTimes = this.buildEliminationCheckpointTimes(this.eliminationRoundTimeLimit, this.eliminationCheckpointCount);
            this.rejectedGenerationWordsByLanguage = {};
            this.usedRoundSolutionsByLanguage = {};
            this.currentRoundAIKnowledgeSamples = {};
            this.currentRoundAIOpeningGuesses = {};
            this.currentRoundCandidatePool = [];
            this.currentMatchCandidatePool = [];
            this.timedRoundActive = false;
            this.updateRoundNumber(0);
            this.updateRoundStatus('Preparing match...');

            if (humanPlayerCount + aiPlayerCount <= 0) {
                this.updateRoundStatus('Add at least one human or AI player.');
                return;
            }

            document.getElementById('setup-screen').classList.add('hidden');
            const wrapper = document.getElementById('players-wrapper');
            wrapper.innerHTML = '';
            wrapper.classList.remove('hidden');
            this.resetTeamState();
            document.getElementById('stats-screen').classList.add('hidden');
            this.setViewState('match');
            document.body.dataset.peekMode = this.peekMode;
            document.body.dataset.playerCount = String(humanPlayerCount + aiPlayerCount);

            this.players = [];
            for (let index = 0; index < humanPlayerCount; index++) {
                this.players.push(new PlayerBoard(
                    index,
                    `Player ${index + 1}`,
                    wrapper,
                    false,
                    this.wordLength,
                    this.wordStyleOptions,
                    {
                        guessValidatorProvider: guess => this.validateSubmittedGuess(guess, language, this.wordLength, this.wordStyleOptions)
                    }
                ));
            }

            for (let index = 0; index < aiPlayerCount; index++) {
                const aiPlayerId = this.players.length;
                const aiName = aiPlayerNames[index] || selectedAIModels[index] || DEFAULT_AI_MODEL;
                const AIClass = this.aiBackend === 'computer' ? ComputerAI : OllamaAI;
                this.players.push(new AIClass(
                    aiPlayerId,
                    aiName,
                    wrapper,
                    tactic,
                    language,
                    selectedAIModels[index] || DEFAULT_AI_MODEL,
                    this.wordLength,
                    this.wordStyleOptions,
                    {
                        canGuessProvider: () => !this.gameEnded && !this.roundTransitioning,
                        memoryEnabledProvider: () => this.isLLMMemoryEnabled(),
                        memoryWordsProvider: (model, lang, wordLength, styleOptions) => this.getModelMemoryWords(model, lang, wordLength, styleOptions, 80, 'ai'),
                        memoryBankProvider: (model, lang, wordLength, styleOptions) => this.getModelGuessMemory(model, lang, wordLength, styleOptions, 160, 'ai'),
                        rememberWordHook: (model, lang, word, wordLength, styleOptions) => this.rememberModelWord(model, lang, word, wordLength, styleOptions, 'ai'),
                        rememberGuessMemoryHook: (model, lang, entry, wordLength, styleOptions) => this.rememberModelGuessMemory(model, lang, entry, wordLength, styleOptions, 'ai'),
                        dictionaryWordsProvider: (lang, wordLength, styleOptions) => this.getAIKnowledgeWords(
                            lang,
                            wordLength,
                            styleOptions,
                            aiPlayerId,
                            selectedAIModels[index] || DEFAULT_AI_MODEL
                        ),
                        openingGuessProvider: (lang, wordLength, styleOptions, playerId, model) => this.getAIOpeningGuess(
                            lang,
                            wordLength,
                            styleOptions,
                            playerId,
                            model
                        ),
                        knowledgeModeProvider: () => this.aiWordKnowledge,
                        decisionModeProvider: () => this.aiDecisionMode,
                        runLLMTaskProvider: task => this.runQueuedAITask(task),
                        revealFailureThresholdProvider: () => AI_STUCK_REVEAL_FAILURE_THRESHOLD,
                        handleRevealSolutionHook: payload => this.handleAIRevealSolution(payload),
                        matchStateProvider: () => ({
                            mode: this.mode,
                            roundNumber: this.roundNumber,
                            timeLeft: this.timeLeft,
                            targetGames: this.gamesToWin,
                            winsSoFar: this.players[aiPlayerId]?.stats?.passed || 0,
                            checkpointIndex: this.eliminationCheckpointIndex,
                            checkpointRequirement: this.eliminationCheckpointRequirements[this.eliminationCheckpointIndex] || 0
                        }),
                        allowedWordsProvider: (lang, wordLength, styleOptions) => this.getAllowedGuessWords(lang, wordLength, styleOptions),
                        guessPoolTarget: this.aiGuessPoolTarget,
                        getSharedRoundContext: () => (this.peekMode === 'open' && this.canPlayerPeekOthers(aiPlayerId))
                            ? this.getSharedGuessContext(aiPlayerId)
                            : [],
                        getRoundRevision: () => this.getRoundRevision(),
                        guessValidatorProvider: guess => this.validateSubmittedGuess(guess, language, this.wordLength, this.wordStyleOptions)
                    }
                ));
            }

            if (this.players.length > 0) {
                this.assignPlayerTeams();
                const firstHuman = this.players.find(player => !player.isAI);
                this.setFocusedPlayer((firstHuman || this.players[0]).id);
            }
            if (this.teamModeEnabled) {
                for (let teamId = 0; teamId < this.teamCount; teamId++) {
                    this.addTeamChatMessage(teamId, 'System', `${this.getTeamName(teamId)} channel ready. Share short clue hints here.`, 'system');
                }
            }
            this.applyPeekModePresentation();
            this.renderTeamPanel();

            clearInterval(this.timerInterval);
            if (this.mode === 'timed') {
                this.timeLeft = parseInt(document.getElementById('time-limit').value, 10);
                this.gamesToWin = Math.max(0, parseInt(document.getElementById('target-games').value, 10) || 0);
                this.setTimerVisibility(true);
                this.startTimer();
            } else if (this.mode === 'elimination') {
                this.timeLeft = this.eliminationRoundTimeLimit;
                document.getElementById('time-left').textContent = String(this.timeLeft);
                this.setTimerVisibility(true);
            } else {
                this.timeLeft = 0;
                document.getElementById('time-left').textContent = '0';
                this.setTimerVisibility(false);
            }

            document.getElementById('current-mode').textContent = this.mode === 'timed'
                ? this.gamesToWin > 0
                    ? `Timed · first to ${this.gamesToWin}`
                    : 'Timed · unlimited rounds'
                : this.mode === 'elimination'
                    ? `Elimination · ${this.eliminationCheckpointCount} checkpoints`
                    : 'Standard · first solve wins';
            await this.nextRound();
        }

        startTimer() {
            document.getElementById('time-left').textContent = String(this.timeLeft);
            this.timerInterval = setInterval(() => {
                if (this.gameEnded) return;
                if (!this.timedRoundActive) return;
                this.timeLeft = Math.max(0, this.timeLeft - 1);
                document.getElementById('time-left').textContent = String(this.timeLeft);
                if (this.timeLeft <= 0) {
                    clearInterval(this.timerInterval);
                    this.markUnfinishedPlayersAsSkipped();
                    this.endGame("Time's Up!");
                }
            }, 1000);
        }

        startEliminationRoundTimer() {
            this.clearEliminationRoundTimer();
            this.timeLeft = this.eliminationRoundTimeLimit;
            this.eliminationCheckpointIndex = 0;
            this.eliminationCheckpointRequirements = this.buildEliminationCheckpointRequirements(this.wordLength, this.eliminationCheckpointCount);
            this.eliminationCheckpointTimes = this.buildEliminationCheckpointTimes(this.eliminationRoundTimeLimit, this.eliminationCheckpointCount);
            document.getElementById('time-left').textContent = String(this.timeLeft);
            this.updateEliminationRoundStatus();

            this.timerInterval = setInterval(() => {
                if (this.gameEnded || this.roundTransitioning) return;
                this.timeLeft = Math.max(0, this.timeLeft - 1);
                document.getElementById('time-left').textContent = String(this.timeLeft);

                const elapsed = this.eliminationRoundTimeLimit - this.timeLeft;
                while (
                    this.eliminationCheckpointIndex < this.eliminationCheckpointTimes.length
                    && elapsed >= this.eliminationCheckpointTimes[this.eliminationCheckpointIndex]
                    && !this.gameEnded
                    && !this.roundTransitioning
                ) {
                    this.evaluateEliminationCheckpoint(this.eliminationCheckpointIndex);
                }

                if (!this.gameEnded && !this.roundTransitioning && this.timeLeft > 0) {
                    this.updateEliminationRoundStatus();
                }
            }, 1000);
        }

        async nextRound() {
            if (this.gameEnded) return;
            this.clearEliminationRoundTimer();
            this.roundTransitioning = true;
            this.timedRoundActive = false;
            this.currentRoundCandidatePool = [];
            this.roundNumber++;
            this.roundSharedRevision = 0;
            this.roundFirstSolverId = null;
            this.roundScoredPlayerIds = new Set();
            this.currentRoundSolvedWordReview = null;
            this.currentRoundAIKnowledgeSamples = {};
            this.currentRoundAIOpeningGuesses = {};
            this.updateRoundNumber(this.roundNumber);
            this.updateRoundStatus(`Generating ${this.wordLength}-letter word for round ${this.roundNumber}...`);

            const language = this.getSelectedLanguage();
            const styleOptions = this.wordStyleOptions;
            const targetPoolSize = this.wordPoolSize;
            const storedMemoryWords = this.getRoundMemoryWords(language, this.wordLength, styleOptions);
            const promptMemoryWords = this.getPromptMemoryWords(storedMemoryWords);
            let solution = '';
            let attempts = 0;
            const maxAttempts = 4;
            const rejectedWordsThisRound = new Set([
                ...this.getRejectedGenerationWords(language, this.wordLength, styleOptions),
                ...this.getPersistentlyRejectedWords(language, this.wordLength, styleOptions)
            ]);
            const shouldReuseExistingPool = this.mode !== 'standard'
                && this.currentMatchCandidatePool.length > 0
                && this.getCurrentMatchCandidatePool(this.wordLength, styleOptions)
                    .some(candidate => !this.getUsedRoundSolutions(language, this.wordLength, styleOptions).has(candidate));

            if (!solution && shouldReuseExistingPool) {
                const reusablePool = this.getCurrentMatchCandidatePool(this.wordLength, styleOptions)
                    .filter(candidate => !rejectedWordsThisRound.has(candidate));
                if (reusablePool.length > 0) {
                    this.currentRoundCandidatePool = [...reusablePool];
                    this.updateRoundStatus(`Round ${this.roundNumber}: reusing the match pool and picking a fresh random word...`);
                    solution = this.pickRandomRoundSolution(reusablePool, language, this.wordLength, styleOptions, rejectedWordsThisRound);
                }
            }

            if (this.isUploadedWordsEnabled()) {
                const uploadedWords = this.getUploadedWordsForLanguage(language, this.wordLength, styleOptions);
                if (uploadedWords.length > 0) {
                    this.currentRoundCandidatePool = [...uploadedWords];
                    this.currentMatchCandidatePool = [...uploadedWords];
                    this.updateRoundStatus(`Round ${this.roundNumber}: picking a random reusable ${this.wordLength}-letter word (${language}).`);
                    solution = this.pickRandomRoundSolution(uploadedWords, language, this.wordLength, styleOptions, rejectedWordsThisRound);
                    if (solution) {
                        console.log(`[Round ${this.roundNumber}] Uploaded solution picked (${language}, len ${this.wordLength}): ${solution}`);
                    } else {
                        this.updateRoundStatus(`No reusable ${this.wordLength}-letter words passed review for ${language}; using LLM generation.`);
                    }
                } else {
                    this.updateRoundStatus(`No reusable ${this.wordLength}-letter words found for ${language}; using LLM generation.`);
                }
            }

            while (solution.length !== this.wordLength && attempts < maxAttempts) {
                attempts++;
                try {
                    const memoryHint = promptMemoryWords.length
                        ? `- Previously confirmed valid words in ${language}: ${promptMemoryWords.join(', ')}.`
                        : '';
                    const rejectionHint = rejectedWordsThisRound.size
                        ? `- Do not include any of these rejected words for this round: ${Array.from(rejectedWordsThisRound).slice(0, 160).join(', ')}.`
                        : '';
                    const ruleLines = this.getWordPromptRuleLines(language, this.wordLength, styleOptions);
                    const basePrompt = `Task: Generate a candidate pool for a ${this.wordLength}-letter ${language} Wordle round.
Think of the full pool immediately and return JSON only with this schema:
{"candidates":["${createWordMask(this.wordLength)}"]}
Rules:
- Return exactly ${targetPoolSize} unique candidate words.
- WordleVS will randomly choose the final answer itself, so do not nominate a final word.
${ruleLines.join('\n')}
- Do not output anything except valid JSON.`;
                    const promptParts = [basePrompt];
                    if (memoryHint) promptParts.push(memoryHint);
                    if (rejectionHint) promptParts.push(rejectionHint);
                    const prompt = promptParts.join('\n');
                    console.log('[Word Generator Prompt]', prompt);

                    const data = await generateWithOllama({
                        model: this.wordModel,
                        prompt,
                        format: 'json',
                        stream: false,
                        think: false,
                        options: {
                            temperature: 0.2,
                            num_predict: Math.max(320, Math.min(1200, targetPoolSize * 16)),
                            top_p: 0.9
                        }
                    });

                    let generationData = await this.parseCandidatePoolResponse(
                        extractOllamaText(data),
                        targetPoolSize,
                        this.wordLength,
                        styleOptions,
                        language
                    );
                    let candidatePool = this.buildRoundCandidatePool(
                        generationData.candidates,
                        storedMemoryWords,
                        rejectedWordsThisRound,
                        this.wordLength,
                        styleOptions
                    );

                    if (candidatePool.length === 0) {
                        const retryRejectionHint = rejectedWordsThisRound.size
                            ? `- Do not include any of these words: ${Array.from(rejectedWordsThisRound).slice(0, 160).join(', ')}.`
                            : '';
                        const retryPrompt = `Retry the same task.
Return JSON only with schema:
{"candidates":["${createWordMask(this.wordLength)}"]}
Rules:
- Return exactly ${targetPoolSize} unique candidate words.
- WordleVS will randomly choose the final answer itself.
${ruleLines.join('\n')}
${retryRejectionHint}
- Do not output anything except valid JSON.`;
                        console.log('[Word Generator Retry Prompt]', retryPrompt);
                        const retryData = await generateWithOllama({
                            model: this.wordModel,
                            prompt: retryPrompt,
                            format: 'json',
                            stream: false,
                            think: false,
                            options: {
                                temperature: 0.0,
                                num_predict: Math.max(320, Math.min(1200, targetPoolSize * 16))
                            }
                        });
                        generationData = await this.parseCandidatePoolResponse(
                            extractOllamaText(retryData),
                            targetPoolSize,
                            this.wordLength,
                            styleOptions,
                            language
                        );
                        candidatePool = this.buildRoundCandidatePool(
                            generationData.candidates,
                            storedMemoryWords,
                            rejectedWordsThisRound,
                            this.wordLength,
                            styleOptions
                        );
                    }

                    if (candidatePool.length === 0 && attempts === maxAttempts) {
                        console.warn(`Word generator returned no usable candidates; expected ${targetPoolSize}, minimum target ${generationData.minimumPoolSize}.`);
                    }

                    if (generationData.isPartial && candidatePool.length > 0) {
                        console.warn(`[Round ${this.roundNumber}] Proceeding with a partial candidate pool (${generationData.poolSize}/${targetPoolSize}).`);
                    }

                    if (candidatePool.length > 0) {
                        this.currentRoundCandidatePool = [...candidatePool];
                        this.currentMatchCandidatePool = [...candidatePool];
                        console.log(`[Round ${this.roundNumber}] Candidate pool (${candidatePool.length})`, candidatePool);
                        this.updateRoundStatus(`Round ${this.roundNumber}: picking a random word from ${candidatePool.length} candidates...`);
                        solution = this.pickRandomRoundSolution(candidatePool, language, this.wordLength, styleOptions, rejectedWordsThisRound);
                    }
                } catch (error) {
                    console.error(`Ollama error generating solution (attempt ${attempts}/${maxAttempts})`, error);
                }
            }

            if (solution.length !== this.wordLength) {
                console.warn(`No valid ${this.wordLength}-letter ${language} word received after ${maxAttempts} attempts. Retrying round generation...`);
                this.roundNumber--;
                this.updateRoundNumber(this.roundNumber);
                this.roundTransitioning = false;
                this.updateRoundStatus(`No valid ${this.wordLength}-letter ${language} word from model. Retrying...`);
                await this.sleep(1500);
                if (!this.gameEnded) {
                    await this.nextRound();
                }
                return;
            }

            this.clearRejectedGenerationWords(language, this.wordLength, styleOptions);
            this.markUsedRoundSolution(language, solution, this.wordLength, styleOptions);
            this.rememberModelWord(this.wordModel, language, solution, this.wordLength, styleOptions, 'word');
            console.log(`[Round ${this.roundNumber}] Final solution (${language}, len ${this.wordLength}): ${solution}`);

            this.players.forEach(player => {
                if (this.mode === 'elimination' && player.status === 'lost') return;
                player.reset(solution, this.roundNumber);
            });

            const activePlayers = this.getActivePlayers();
            if (activePlayers.length === 0) {
                this.endGame('All players were eliminated. No winner this match.');
                return;
            }

            this.ensureFocusedPlayer();
            this.roundTransitioning = false;
            this.timedRoundActive = this.mode === 'timed';
            if (this.mode === 'elimination') {
                this.startEliminationRoundTimer();
            } else {
                this.updateRoundStatus(`Round ${this.roundNumber}: 0/${activePlayers.length} finished`);
            }
            this.triggerAITurns();
        }

        triggerAITurns() {
            this.players.forEach(player => {
                if (player instanceof OllamaAI && !player.gameOver) {
                    player.makeMove();
                }
            });
        }

        checkGameStatus() {
            if (this.gameEnded) return;

            const activePlayers = this.getActivePlayers();
            const finishedCount = activePlayers.filter(player => player.gameOver).length;
            this.ensureFocusedPlayer();
            if (!this.roundTransitioning && activePlayers.length > 0) {
                const safeCount = activePlayers.filter(player => player.status === 'won').length;
                if (this.mode === 'elimination') {
                    this.updateEliminationRoundStatus();
                } else {
                    this.updateRoundStatus(`Round ${this.roundNumber}: ${finishedCount}/${activePlayers.length} finished`);
                }
            }

            if (this.mode === 'standard') {
                if (activePlayers.length > 0 && finishedCount === activePlayers.length) {
                    const winners = activePlayers.filter(player => player.status === 'won');
                    if (winners.length === 1) {
                        this.endGame(`${winners[0].name} wins!`);
                    } else if (winners.length > 1) {
                        this.endGame(`Draw: ${winners.map(player => player.name).join(', ')} solved the word.`);
                    } else {
                        this.endGame('Round complete: no one solved the word.');
                    }
                }
            } else if (this.mode === 'timed') {
                const winner = this.gamesToWin > 0
                    ? this.players.find(player => player.stats.passed >= this.gamesToWin)
                    : null;
                if (winner) {
                    this.endGame(`${winner.name} Reached Goal!`);
                } else if (activePlayers.length > 0 && finishedCount === activePlayers.length) {
                    this.queueNextRound('Round complete.');
                }
            } else if (this.mode === 'elimination') {
                if (activePlayers.length === 0) {
                    this.endGame('All players were eliminated. No winner this match.');
                } else if (activePlayers.length === 1) {
                    this.endGame(`${activePlayers[0].name} is the Winner!`);
                } else if (finishedCount === activePlayers.length) {
                    this.clearEliminationRoundTimer();
                    this.queueNextRound(`${activePlayers.length} players remain.`);
                }
            }
        }
    }

    Object.getOwnPropertyNames(RoundFlowMethods.prototype).forEach(name => {
        if (name === 'constructor') return;
        GameManager.prototype[name] = RoundFlowMethods.prototype[name];
    });
}
