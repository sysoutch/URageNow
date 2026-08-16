import {
    AI_GUESS_POOL_TARGET,
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
    clampWordLength,
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
    getExtendedKeyboardRow,
    getHardAbsentLetters,
    getLanguageKey,
    getSolvedWordFromConstraints,
    normalizeWordArray,
    normalizeWordStyleOptions,
    parseWordArrayText,
    scoreCandidateWord,
    wordFitsConstraints
} from '../shared.js';

const MAX_GUESSES = 6;

export class PlayerBoard {
    constructor(id, name, container, isAI = false, wordLength = DEFAULT_WORD_LENGTH, styleOptions = getDefaultWordStyleOptions(), options = {}) {
        this.id = id;
        this.name = name;
        this.container = container;
        this.isAI = isAI;
        this.wordLength = clampWordLength(wordLength);
        this.styleOptions = normalizeWordStyleOptions(styleOptions);
        this.guesses = [];
        this.currentGuess = '';
        this.solution = '';
        this.gameOver = false;
        this.thinking = false;
        this.typing = false;
        this.status = 'playing';
        this.peekMode = 'open';
        this.isFocusedBoard = false;
        this.canPeekOtherBoards = false;
        this.roundActionToken = 0;
        this.pendingMoveTimer = null;
        this.guessValidatorProvider = options.guessValidatorProvider || (() => ({ allowed: true, reason: '' }));
        this.guessPoolTarget = Math.max(1, parseInt(options.guessPoolTarget, 10) || AI_GUESS_POOL_TARGET);
        this.stats = {
            passed: 0,
            failed: 0,
            skipped: 0,
            points: 0,
            totalSolveSteps: 0,
            bestSolveSteps: null
        };
        this.roundNote = 'Awaiting round start';
        this.lastRoundSummary = null;
        this.validationMessage = '';
        this.render();
    }

    reset(solution, roundNumber = 0) {
        this.roundActionToken++;
        this.clearPendingMoveTimer();
        this.solution = solution;
        this.guesses = [];
        this.currentGuess = '';
        this.gameOver = false;
        this.thinking = false;
        this.typing = false;
        this.status = 'playing';
        this.validationMessage = '';
        this.roundNote = roundNumber > 0 ? `Round ${roundNumber} is live.` : 'New round ready.';
        this.updateUI();
    }

    render() {
        this.boardElement = document.createElement('div');
        this.boardElement.className = 'player-board';
        this.boardElement.classList.toggle('is-ai', this.isAI);
        this.boardElement.id = `player-${this.id}`;
        this.boardElement.onclick = () => {
            window.dispatchEvent(new CustomEvent('player-focus', { detail: { playerId: this.id } }));
        };

        const headerEl = document.createElement('div');
        headerEl.className = 'board-header';

        const headingEl = document.createElement('div');
        headingEl.className = 'board-heading';

        const kickerEl = document.createElement('div');
        kickerEl.className = 'player-kicker';
        kickerEl.textContent = this.isAI ? 'AI Board' : 'Human Board';
        headingEl.appendChild(kickerEl);

        const nameEl = document.createElement('div');
        nameEl.className = 'player-name';
        nameEl.textContent = this.name;
        headingEl.appendChild(nameEl);

        this.playerTeamElement = document.createElement('div');
        this.playerTeamElement.className = 'player-team hidden';
        headingEl.appendChild(this.playerTeamElement);

        this.playerSubtitleElement = document.createElement('div');
        this.playerSubtitleElement.className = 'player-subtitle hidden';
        headingEl.appendChild(this.playerSubtitleElement);

        this.reactionsElement = document.createElement('div');
        this.reactionsElement.className = 'board-reactions';

        this.primaryReactionElement = document.createElement('div');
        this.primaryReactionElement.className = 'board-reaction hidden';
        this.primaryReactionElement.setAttribute('aria-hidden', 'true');

        this.secondaryReactionElement = document.createElement('div');
        this.secondaryReactionElement.className = 'board-reaction board-reaction-secondary hidden';
        this.secondaryReactionElement.setAttribute('aria-hidden', 'true');

        this.reactionsElement.appendChild(this.primaryReactionElement);
        this.reactionsElement.appendChild(this.secondaryReactionElement);
        headingEl.appendChild(this.reactionsElement);

        this.boardStateElement = document.createElement('div');
        this.boardStateElement.className = 'board-state';
        this.boardStateElement.textContent = 'Ready';

        headerEl.appendChild(headingEl);
        headerEl.appendChild(this.boardStateElement);
        this.boardElement.appendChild(headerEl);

        this.boardMetricsElement = document.createElement('div');
        this.boardMetricsElement.className = 'board-metrics';
        this.boardMetricValues = {};
        [
            ['points', 'Score'],
            ['solved', 'Solved'],
            ['best', 'Best'],
            ['average', 'Avg']
        ].forEach(([key, label]) => {
            this.boardMetricsElement.appendChild(this.createMetric(key, label));
        });
        this.boardElement.appendChild(this.boardMetricsElement);

        this.boardSummaryElement = document.createElement('div');
        this.boardSummaryElement.className = 'board-summary';
        this.boardSummaryTitleElement = document.createElement('div');
        this.boardSummaryTitleElement.className = 'board-summary-title';
        this.boardSummaryTextElement = document.createElement('div');
        this.boardSummaryTextElement.className = 'board-summary-text';
        this.boardSummaryElement.appendChild(this.boardSummaryTitleElement);
        this.boardSummaryElement.appendChild(this.boardSummaryTextElement);
        this.boardElement.appendChild(this.boardSummaryElement);

        this.gridElement = document.createElement('div');
        this.gridElement.className = 'wordle-grid';
        this.gridElement.style.setProperty('--word-length', String(this.wordLength));
        for (let i = 0; i < MAX_GUESSES; i++) {
            const row = document.createElement('div');
            row.className = 'row';
            row.style.setProperty('--word-length', String(this.wordLength));
            for (let j = 0; j < this.wordLength; j++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.setAttribute('data-state', 'tbd');
                row.appendChild(tile);
            }
            this.gridElement.appendChild(row);
        }
        this.boardElement.appendChild(this.gridElement);

        this.kbElement = document.createElement('div');
        this.kbElement.className = 'keyboard';
        this.renderKeyboard();
        this.boardElement.appendChild(this.kbElement);

        this.container.appendChild(this.boardElement);
    }

    setSubtitle(text = '') {
        if (!this.playerSubtitleElement) return;
        const value = String(text || '').trim();
        this.playerSubtitleElement.textContent = value;
        this.playerSubtitleElement.classList.toggle('hidden', value.length === 0);
    }

    setTeamLabel(text = '') {
        if (!this.playerTeamElement) return;
        const value = String(text || '').trim();
        this.playerTeamElement.textContent = value;
        this.playerTeamElement.classList.toggle('hidden', value.length === 0);
    }

    setPresentation(peekMode = 'open', focusedPlayerId = this.id, canPeekOtherBoards = false) {
        this.peekMode = peekMode;
        this.isFocusedBoard = focusedPlayerId === this.id;
        this.canPeekOtherBoards = Boolean(canPeekOtherBoards);
        this.boardElement.classList.toggle('show-keyboard', !this.isAI && this.isFocusedBoard);
        this.updateUI();
    }

    createMetric(key, label) {
        const metric = document.createElement('div');
        metric.className = 'board-metric';

        const metricLabel = document.createElement('span');
        metricLabel.className = 'board-metric-label';
        metricLabel.textContent = label;

        const metricValue = document.createElement('strong');
        metricValue.className = 'board-metric-value';
        metricValue.textContent = '0';

        metric.appendChild(metricLabel);
        metric.appendChild(metricValue);
        this.boardMetricValues[key] = metricValue;
        return metric;
    }

    renderKeyboard() {
        const rows = [
            'QWERTYUIOP',
            'ASDFGHJKL',
            'ZXCVBNM'
        ];
        if (this.styleOptions.allowExtendedLetters) {
            rows.push(getExtendedKeyboardRow());
        }
        rows.forEach((row, idx) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'kb-row';
            if (idx === 2) {
                rowEl.appendChild(this.createKey('ENTER', 'wide'));
            }
            for (const char of row) {
                rowEl.appendChild(this.createKey(char));
            }
            if (idx === 2) {
                rowEl.appendChild(this.createKey('DEL', 'wide'));
            }
            this.kbElement.appendChild(rowEl);
        });
    }

    createKey(text, className = '') {
        const key = document.createElement('div');
        key.className = `key ${className}`;
        key.textContent = text;
        key.setAttribute('data-key', text);
        key.onclick = event => {
            event.stopPropagation();
            this.handleInput(text);
        };
        return key;
    }

    isValidLetterInput(key) {
        if (this.styleOptions.allowExtendedLetters) {
            return /^[\p{L}]$/u.test(key);
        }
        return /^[A-Z]$/.test(key);
    }

    getKeyElementByChar(char) {
        if (!char) return null;
        const escapedChar = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(char)
            : char.replace(/["\\]/g, '\\$&');
        return this.kbElement.querySelector(`.key[data-key="${escapedChar}"]`);
    }

    getGuessesRemaining() {
        return Math.max(0, MAX_GUESSES - this.guesses.length);
    }

    handleInput(key) {
        if (this.gameOver) return;

        if (key === 'ENTER') {
            this.submitGuess();
        } else if (key === 'DEL' || key === 'BACKSPACE') {
            this.validationMessage = '';
            this.currentGuess = this.currentGuess.slice(0, -1);
        } else if (this.isValidLetterInput(key) && this.currentGuess.length < this.wordLength) {
            this.validationMessage = '';
            this.currentGuess += key;
        }
        this.updateUI();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getGuessValidation(word) {
        const result = this.guessValidatorProvider(word, this);
        if (result === false) {
            return { allowed: false, reason: 'Guess is not allowed.' };
        }
        if (result === true || result == null) {
            return { allowed: true, reason: '' };
        }
        return {
            allowed: result.allowed !== false,
            reason: typeof result.reason === 'string' ? result.reason : ''
        };
    }

    describeSteps(steps) {
        if (!steps || steps <= 0) return '0 steps';
        return `${steps} ${steps === 1 ? 'step' : 'steps'}`;
    }

    getAverageSolveSteps() {
        if (this.stats.passed <= 0) return '\u2014';
        return (this.stats.totalSolveSteps / this.stats.passed).toFixed(1);
    }

    getRevealMode() {
        if (this.isFocusedBoard || this.peekMode === 'open') {
            return this.isFocusedBoard || this.canPeekOtherBoards ? 'open' : 'none';
        }
        if (!this.canPeekOtherBoards) {
            return 'none';
        }
        return this.peekMode === 'colors' ? 'colors' : 'none';
    }

    setRoundSummary(title, text) {
        this.lastRoundSummary = { title, text };
    }

    getPrimaryReaction() {
        if (this.status === 'won') {
            return { emoji: '\uD83E\uDD73', tone: 'celebrate', label: 'Solved' };
        }
        if (this.status === 'lost') {
            return { emoji: '\uD83D\uDE22', tone: 'bad', label: 'Out of guesses' };
        }
        if (this.status === 'skipped') {
            return { emoji: '\u23ED\uFE0F', tone: 'warn', label: 'Round skipped' };
        }
        if (this.validationMessage) {
            return { emoji: '\uD83D\uDEAB', tone: 'bad', label: 'Rejected guess' };
        }
        if (this.typing) {
            return { emoji: '\u270D\uFE0F', tone: 'focus', label: 'Typing guess' };
        }
        if (this.thinking) {
            return { emoji: '\uD83E\uDD14', tone: 'focus', label: 'Thinking' };
        }
        if (!Array.isArray(this.guesses) || this.guesses.length === 0) {
            return { emoji: '\uD83C\uDFAF', tone: 'focus', label: 'Ready to play' };
        }
        return null;
    }

    getSecondaryReaction() {
        if (!Array.isArray(this.guesses) || this.guesses.length === 0) {
            return null;
        }

        const latestGuess = this.guesses[this.guesses.length - 1];
        const result = Array.isArray(latestGuess?.result) ? latestGuess.result : [];
        const correctCount = result.filter(state => state === 'correct').length;
        const presentCount = result.filter(state => state === 'present').length;
        const progressScore = (correctCount * 2) + presentCount;
        const guessesRemaining = this.getGuessesRemaining();

        if (correctCount >= this.wordLength - 1 && guessesRemaining > 0) {
            return { emoji: '\uD83E\uDDD0', tone: 'focus', label: 'One move away' };
        }
        if (progressScore >= Math.max(4, this.wordLength + 1)) {
            return { emoji: '\uD83D\uDE0E', tone: 'celebrate', label: 'Excellent progress' };
        }
        if (correctCount >= 2 && presentCount >= 1) {
            return { emoji: '\uD83D\uDD25', tone: 'good', label: 'Hot trail' };
        }
        if (progressScore >= Math.max(3, this.wordLength - 1)) {
            return { emoji: '\uD83D\uDE42', tone: 'good', label: 'Strong progress' };
        }
        if (progressScore === 0) {
            return { emoji: '\uD83D\uDE1E', tone: 'bad', label: 'No useful clues' };
        }
        if (correctCount === 0 && presentCount <= 1) {
            return { emoji: '\uD83D\uDE15', tone: 'warn', label: 'Weak guess' };
        }
        return { emoji: '\uD83D\uDE42', tone: 'good', label: 'Some progress' };
    }

    setReactionElementState(element, reaction) {
        if (!element) return;
        element.classList.toggle('hidden', !reaction);
        if (reaction) {
            element.textContent = reaction.emoji;
            element.dataset.tone = reaction.tone;
            element.title = reaction.label;
            element.setAttribute('aria-label', reaction.label);
            return;
        }
        element.textContent = '';
        element.dataset.tone = '';
        element.title = '';
        element.setAttribute('aria-label', '');
    }

    clearPendingMoveTimer() {
        if (this.pendingMoveTimer) {
            clearTimeout(this.pendingMoveTimer);
            this.pendingMoveTimer = null;
        }
    }

    completeRound(status, note = '') {
        if (this.gameOver && this.status === status) return;

        this.roundActionToken++;
        this.clearPendingMoveTimer();
        this.gameOver = true;
        this.status = status;
        this.thinking = false;
        this.typing = false;
        this.validationMessage = '';
        const steps = this.guesses.length;

        if (status === 'won') {
            this.stats.passed++;
            this.stats.totalSolveSteps += steps;
            this.stats.bestSolveSteps = this.stats.bestSolveSteps === null
                ? steps
                : Math.min(this.stats.bestSolveSteps, steps);
            this.setRoundSummary(`Solved in ${this.describeSteps(steps)}`, note || 'Waiting for round score...');
        } else if (status === 'lost') {
            this.stats.failed++;
            this.setRoundSummary(`Missed after ${this.describeSteps(steps)}`, note || 'No score this round.');
        } else if (status === 'skipped') {
            this.stats.skipped++;
            this.setRoundSummary('Round closed early', note || 'This board did not finish before the round moved on.');
        }

        this.currentGuess = '';
        this.updateUI();
    }

    markLost(note = '') {
        if (this.gameOver) return;
        this.completeRound('lost', note);
    }

    markSkipped(note = '') {
        if (this.gameOver) return;
        this.completeRound('skipped', note);
    }

    applyPointDelta(delta, note = '') {
        const normalizedDelta = Number(delta);
        if (!Number.isFinite(normalizedDelta) || normalizedDelta === 0) {
            return 0;
        }
        this.stats.points += normalizedDelta;
        if (this.lastRoundSummary) {
            const fallback = `${normalizedDelta >= 0 ? '+' : ''}${normalizedDelta} points`;
            this.lastRoundSummary.text = note || fallback;
        }
        this.updateUI();
        return normalizedDelta;
    }

    awardSolvePoints(points, note = '') {
        const normalizedPoints = Math.max(0, parseInt(points, 10) || 0);
        this.applyPointDelta(normalizedPoints, note || `+${normalizedPoints} points`);
    }

    submitGuess() {
        if (typeof this.solution !== 'string' || this.solution.length !== this.wordLength) {
            return false;
        }
        if (this.gameOver || this.currentGuess.length !== this.wordLength) return false;

        const submittedWord = this.currentGuess;
        const validation = this.getGuessValidation(submittedWord);
        if (!validation.allowed) {
            this.validationMessage = validation.reason || 'Guess is not allowed.';
            this.roundNote = this.validationMessage;
            this.updateUI();
            return false;
        }

        this.validationMessage = '';
        const result = this.checkGuess(submittedWord);
        this.guesses.push({ word: submittedWord, result });
        window.dispatchEvent(new CustomEvent('player-submitted-guess', {
            detail: {
                playerId: this.id,
                word: submittedWord,
                result
            }
        }));

        if (submittedWord === this.solution) {
            this.completeRound('won');
            window.dispatchEvent(new CustomEvent('player-finished', {
                detail: {
                    playerId: this.id,
                    status: 'won',
                    guessesUsed: this.guesses.length
                }
            }));
        } else if (this.guesses.length >= MAX_GUESSES) {
            this.completeRound('lost', 'Out of guesses.');
            window.dispatchEvent(new CustomEvent('player-finished', {
                detail: {
                    playerId: this.id,
                    status: 'lost',
                    guessesUsed: this.guesses.length
                }
            }));
        } else if (this.isAI) {
            this.makeMove();
        }

        this.currentGuess = '';
        this.updateUI();
        return true;
    }

    checkGuess(guess) {
        const result = Array(this.wordLength).fill('absent');
        const solArr = this.solution.split('');
        const guessArr = guess.split('');

        for (let i = 0; i < this.wordLength; i++) {
            if (guessArr[i] === solArr[i]) {
                result[i] = 'correct';
                solArr[i] = null;
                guessArr[i] = null;
            }
        }

        for (let i = 0; i < this.wordLength; i++) {
            if (guessArr[i] && solArr.includes(guessArr[i])) {
                result[i] = 'present';
                solArr[solArr.indexOf(guessArr[i])] = null;
            }
        }
        return result;
    }

    updateUI() {
        const rows = this.gridElement.querySelectorAll('.row');
        const revealMode = this.getRevealMode();

        rows.forEach(row => {
            row.querySelectorAll('.tile').forEach(tile => {
                tile.textContent = '';
                tile.setAttribute('data-state', 'empty');
            });
        });

        this.kbElement.querySelectorAll('.key').forEach(key => key.removeAttribute('data-state'));

        this.guesses.forEach((guess, rowIndex) => {
            const tiles = rows[rowIndex].querySelectorAll('.tile');
            guess.word.split('').forEach((char, columnIndex) => {
                tiles[columnIndex].textContent = revealMode === 'open' ? char : '';
                tiles[columnIndex].setAttribute('data-state', revealMode === 'none' ? 'masked' : guess.result[columnIndex]);
            });
        });

        const shouldRenderLiveGuess = !this.gameOver && (this.isFocusedBoard || (this.isAI && (this.typing || this.currentGuess.length > 0)));
        if (shouldRenderLiveGuess) {
            const currentRow = rows[this.guesses.length];
            if (currentRow) {
                const tiles = currentRow.querySelectorAll('.tile');
                tiles.forEach((tile, index) => {
                    tile.textContent = this.currentGuess[index] || '';
                    tile.setAttribute('data-state', this.currentGuess[index] ? 'tbd' : 'empty');
                });
            }
        }

        this.guesses.forEach(guess => {
            guess.word.split('').forEach((char, index) => {
                const key = this.getKeyElementByChar(char);
                if (!key) return;
                const currentState = key.getAttribute('data-state');
                const newState = guess.result[index];

                if (newState === 'correct') {
                    key.setAttribute('data-state', 'correct');
                } else if (newState === 'present' && currentState !== 'correct') {
                    key.setAttribute('data-state', 'present');
                } else if (newState === 'absent' && !currentState) {
                    key.setAttribute('data-state', 'absent');
                }
            });
        });

        const guessCount = this.guesses.length;
        const stateLabel = this.status === 'won'
            ? `Solved in ${this.describeSteps(guessCount)}`
            : this.status === 'lost'
                ? `Missed after ${MAX_GUESSES} guesses`
                : this.status === 'skipped'
                    ? 'Round closed'
                    : this.typing
                        ? 'Typing'
                        : this.validationMessage
                            ? 'Rejected'
                            : this.thinking
                                ? 'Thinking'
                                : `${guessCount}/${MAX_GUESSES} guesses`;
        if (this.boardStateElement) {
            this.boardStateElement.textContent = stateLabel;
        }
        this.setReactionElementState(this.primaryReactionElement, this.getPrimaryReaction());
        this.setReactionElementState(this.secondaryReactionElement, this.getSecondaryReaction());
        if (this.boardMetricValues.points) {
            this.boardMetricValues.points.textContent = String(this.stats.points);
            this.boardMetricValues.solved.textContent = String(this.stats.passed);
            this.boardMetricValues.best.textContent = this.stats.bestSolveSteps === null ? '\u2014' : this.describeSteps(this.stats.bestSolveSteps);
            this.boardMetricValues.average.textContent = this.stats.passed > 0 ? this.getAverageSolveSteps() : '\u2014';
        }
        if (this.boardSummaryTitleElement && this.boardSummaryTextElement) {
            if (this.gameOver && this.lastRoundSummary) {
                this.boardSummaryTitleElement.textContent = this.lastRoundSummary.title;
                this.boardSummaryTextElement.textContent = this.lastRoundSummary.text;
            } else if (this.validationMessage) {
                this.boardSummaryTitleElement.textContent = 'Guess rejected';
                this.boardSummaryTextElement.textContent = this.validationMessage;
            } else if (!this.isFocusedBoard && !this.canPeekOtherBoards && this.peekMode !== 'none') {
                this.boardSummaryTitleElement.textContent = 'Peek locked';
                this.boardSummaryTextElement.textContent = 'Submit your first guess to unlock other boards.';
            } else if (!this.isFocusedBoard && revealMode === 'colors') {
                this.boardSummaryTitleElement.textContent = 'Peek mode: colors only';
                this.boardSummaryTextElement.textContent = 'Other boards expose clue colors, but not the guessed letters.';
            } else if (!this.isFocusedBoard && revealMode === 'none') {
                this.boardSummaryTitleElement.textContent = 'Peek mode: locked';
                this.boardSummaryTextElement.textContent = 'Other boards stay hidden until the round resolves.';
            } else {
                this.boardSummaryTitleElement.textContent = this.roundNote;
                this.boardSummaryTextElement.textContent = this.typing
                    ? `Typing guess: ${this.currentGuess || createWordMask(this.wordLength)}`
                    : this.thinking
                    ? 'Evaluating shared clues and candidate rankings.'
                    : guessCount > 0
                        ? `${this.describeSteps(guessCount)} used this round.`
                        : 'No guesses submitted in this round yet.';
            }
        }
        this.boardElement.classList.toggle('is-complete', this.gameOver);
        this.boardElement.classList.toggle('is-thinking', this.thinking);
        this.boardElement.classList.toggle('is-typing', this.typing);
        this.boardElement.dataset.status = this.status;
        this.boardElement.dataset.revealMode = revealMode;
    }
}
