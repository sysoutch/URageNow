import {
    DEFAULT_AI_MODEL,
    DEFAULT_AI_GUESS_POOL_TARGET,
    DEFAULT_WORD_LENGTH,
    DEFAULT_WORD_MODEL,
    DEFAULT_WORD_POOL_SIZE,
    MIN_WORD_POOL_SIZE,
    clampWordLength,
    clampAIGuessPoolTarget,
    clampWordPoolSize,
    getDefaultWordStyleOptions,
    normalizeBucketKey,
    normalizeWordStyleOptions
} from './shared.js';
import { installGameManagerModelUIMethods } from './game-manager/model-ui.js';
import { installGameManagerReviewMethods } from './game-manager/review.js';
import { installGameManagerRoundFlowMethods } from './game-manager/round-flow.js';
import { installGameManagerScoringMethods } from './game-manager/scoring.js';
import { installGameManagerSetupMethods } from './game-manager/setup-ui.js';
import { installGameManagerWordSourceMethods } from './game-manager/word-sources.js';

const MEMORY_HINT_LIMIT = 24;
const ROUND_MEMORY_POOL_LIMIT = 80;
const FIRST_SOLVE_BONUS = 2;
const AI_REVEAL_VALID_WORD_PENALTY = 3;

export class GameManager {
    constructor() {
        this.players = [];
        this.focusedPlayerId = 0;
        this.mode = 'standard';
        this.wordModel = DEFAULT_WORD_MODEL;
        this.aiModel = DEFAULT_AI_MODEL;
        this.wordLength = DEFAULT_WORD_LENGTH;
        this.wordPoolSize = DEFAULT_WORD_POOL_SIZE;
        this.wordStyleOptions = getDefaultWordStyleOptions();
        this.timeLeft = 0;
        this.timerInterval = null;
        this.gamesToWin = 1;
        this.timedRoundActive = false;
        this.eliminationRoundTimeLimit = 30;
        this.eliminationCheckpointCount = 3;
        this.eliminationCheckpointIndex = 0;
        this.eliminationCheckpointRequirements = [];
        this.eliminationCheckpointTimes = [];
        this.roundNumber = 0;
        this.gameEnded = false;
        this.roundTransitioning = false;
        this.roundSharedRevision = 0;
        this.roundFirstSolverId = null;
        this.roundScoredPlayerIds = new Set();
        this.peekMode = 'open';
        this.aiWordKnowledge = 'sample';
        this.aiBackend = 'llm';
        this.aiDecisionMode = 'llm';
        this.aiGuessPoolTarget = DEFAULT_AI_GUESS_POOL_TARGET;
        this.teamModeEnabled = false;
        this.teamCount = 2;
        this.teamAssignments = {};
        this.teamChatByTeam = {};
        this.currentSetupStepKey = 'basics';
        this.currentSetupSourcePanel = 'upload';
        this.latestSolvedWordReview = null;
        this.currentRoundSolvedWordReview = null;
        this.availableModelNames = null;
        this.rejectedGenerationWordsByLanguage = {};
        this.uploadedWordsByLanguage = {};
        this.usedUploadedWordsByLanguage = {};
        this.usedRoundSolutionsByLanguage = {};
        this.currentRoundAIKnowledgeSamples = {};
        this.currentRoundAIOpeningGuesses = {};
        this.wordSourceMetaByLanguage = {};
        this.currentRoundCandidatePool = [];
        this.currentMatchCandidatePool = [];
        this.aiTurnQueue = Promise.resolve();
        this.setupEventListeners();
        this.setTimerVisibility(false);
        this.updateRoundNumber(0);
        this.updateRoundStatus('Setup');
        this.updateWordFileStatus('No word file loaded.');
        this.updateWordlistStatus('No generated wordlist yet for the current selection.');
        this.renderWordlistPreview([]);
        this.updateAIOptionsVisibility();
        this.updateSetupWizard();
        this.updateSetupSidebarSummary();
        this.setViewState('setup');
        document.body.dataset.peekMode = this.peekMode;
        document.body.dataset.playerCount = '0';
        this.loadAvailableModels();
    }

    setupEventListeners() {
        document.getElementById('start-game').onclick = () => this.startGame();
        document.getElementById('restart-game').onclick = () => this.showSetup();
        document.getElementById('preset-you-vs-ai').onclick = () => this.applyMatchPreset('you-vs-ai');
        document.getElementById('preset-ai-vs-ai').onclick = () => this.applyMatchPreset('ai-vs-ai');
        document.getElementById('setup-prev').onclick = () => this.stepSetupWizard(-1);
        document.getElementById('setup-next').onclick = () => this.stepSetupWizard(1);
        document.querySelectorAll('.setup-wizard-tab').forEach(button => {
            button.onclick = () => this.setSetupWizardStep(button.dataset.stepKey || 'basics');
        });
        document.querySelectorAll('.setup-source-tab').forEach(button => {
            button.onclick = () => this.setSetupSourcePanel(button.dataset.sourcePanel || 'upload');
        });
        document.getElementById('game-mode').onchange = event => {
            document.getElementById('timed-options').classList.toggle('hidden', event.target.value !== 'timed');
            document.getElementById('elimination-options').classList.toggle('hidden', event.target.value !== 'elimination');
        };
        document.getElementById('ai-player-count').onchange = () => this.updateAIOptionsVisibility();
        document.getElementById('ai-backend').onchange = () => this.updateAIOptionsVisibility();
        document.getElementById('peek-mode').onchange = event => {
            this.peekMode = this.normalizePeekMode(event.target.value);
            document.body.dataset.peekMode = this.peekMode;
            this.applyPeekModePresentation();
        };
        document.getElementById('team-mode-enabled').onchange = () => this.updateSetupSidebarSummary();
        document.getElementById('game-language').onchange = event => {
            document.getElementById('custom-language').classList.toggle('hidden', event.target.value !== 'custom');
            this.refreshWordSourceState();
        };
        document.getElementById('custom-language').oninput = () => this.refreshWordSourceState();
        document.getElementById('word-length').onchange = () => this.refreshWordSourceState();
        document.getElementById('word-style-extended').onchange = () => this.refreshWordSourceState();
        document.getElementById('word-model').onchange = () => this.toggleCustomModelInput('word-model', 'custom-word-model');
        document.getElementById('word-file-input').onchange = event => this.handleWordFileUpload(event);
        document.getElementById('reset-llm-memory').onclick = () => this.resetSelectedLLMMemory();
        document.getElementById('generate-wordlist').onclick = () => this.generateWordListWithLLM();
        document.getElementById('download-wordlist').onclick = () => this.downloadCurrentWordList();
        document.getElementById('setup-screen').addEventListener('change', () => this.updateSetupSidebarSummary());
        document.getElementById('setup-screen').addEventListener('input', () => this.updateSetupSidebarSummary());
        document.getElementById('team-chat-send').onclick = () => this.submitFocusedTeamHint();
        document.getElementById('team-chat-input').addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.submitFocusedTeamHint();
            }
        });

        window.addEventListener('player-focus', event => {
            this.setFocusedPlayer(event.detail.playerId);
        });

        window.addEventListener('keydown', event => {
            if (this.gameEnded || this.roundTransitioning) return;
            const player = this.players.find(currentPlayer => currentPlayer.id === this.focusedPlayerId);
            if (player && !player.isAI && !player.gameOver) {
                let key = event.key.toUpperCase();
                if (key === 'BACKSPACE') key = 'DEL';
                player.handleInput(key);
            }
        });

        window.addEventListener('player-finished', event => this.handlePlayerFinished(event));
        window.addEventListener('player-submitted-guess', event => {
            if (this.gameEnded || this.roundTransitioning) return;
            this.roundSharedRevision++;
            this.handleTeamGuessSubmitted(event);
        });
    }


    applyPeekModePresentation() {
        const focusedPlayer = this.players.find(player => player.id === this.focusedPlayerId);
        const canPeekOtherBoards = Boolean(focusedPlayer && focusedPlayer.guesses.length > 0);
        this.players.forEach(player => {
            if (typeof player.setPresentation === 'function') {
                player.setPresentation(this.peekMode, this.focusedPlayerId, canPeekOtherBoards);
            }
        });
    }

    canPlayerPeekOthers(playerId) {
        const player = this.players.find(currentPlayer => currentPlayer.id === playerId);
        return Boolean(player && player.guesses.length > 0);
    }

    setFocusedPlayer(playerId) {
        this.focusedPlayerId = playerId;
        this.players.forEach(player => {
            player.boardElement.classList.toggle('is-focused', player.id === this.focusedPlayerId);
        });
        this.applyPeekModePresentation();
        this.renderTeamPanel();
    }

    setTimerVisibility(show) {
        document.getElementById('timer').classList.toggle('hidden', !show);
    }

    setViewState(view) {
        document.body.dataset.view = view;
        this.renderTeamPanel();
    }

    updateRoundNumber(value) {
        const element = document.getElementById('round-number');
        if (element) element.textContent = String(value);
    }

    updateRoundStatus(text) {
        const element = document.getElementById('round-status');
        if (element) element.textContent = text;
    }

    isTeamModeEnabled() {
        const input = document.getElementById('team-mode-enabled');
        return Boolean(input?.checked);
    }

    getTeamName(teamId) {
        return `Team ${String.fromCharCode(65 + Math.max(0, parseInt(teamId, 10) || 0))}`;
    }

    resetTeamState() {
        this.teamAssignments = {};
        this.teamChatByTeam = {};
        for (let teamId = 0; teamId < this.teamCount; teamId++) {
            this.teamChatByTeam[teamId] = [];
        }
        this.renderTeamPanel();
    }

    assignPlayerTeams() {
        if (!this.teamModeEnabled) {
            this.players.forEach(player => {
                player.teamId = null;
                player.teamName = '';
                if (typeof player.setTeamLabel === 'function') {
                    player.setTeamLabel('');
                }
            });
            return;
        }

        this.players.forEach((player, index) => {
            const teamId = index % this.teamCount;
            const teamName = this.getTeamName(teamId);
            player.teamId = teamId;
            player.teamName = teamName;
            this.teamAssignments[player.id] = teamId;
            if (typeof player.setTeamLabel === 'function') {
                player.setTeamLabel(teamName);
            }
        });
    }

    getTeamMembers(teamId) {
        return this.players.filter(player => player.teamId === teamId);
    }

    getFocusedHumanTeamPlayer() {
        const player = this.players.find(currentPlayer => currentPlayer.id === this.focusedPlayerId);
        return player && !player.isAI && Number.isInteger(player.teamId) ? player : null;
    }

    addTeamChatMessage(teamId, author, text, type = 'hint') {
        if (!this.teamModeEnabled || !Number.isInteger(teamId)) return;
        const normalizedText = String(text || '').trim();
        if (!normalizedText) return;
        this.teamChatByTeam[teamId] = this.teamChatByTeam[teamId] || [];
        this.teamChatByTeam[teamId].push({
            author: String(author || 'System').trim() || 'System',
            text: normalizedText,
            type,
            createdAt: Date.now()
        });
        this.teamChatByTeam[teamId] = this.teamChatByTeam[teamId].slice(-10);
        this.renderTeamPanel();
    }

    summarizeGuessForTeam(word, result = []) {
        const parts = [];
        result.forEach((state, index) => {
            const letter = word[index];
            if (!letter) return;
            if (state === 'correct') {
                parts.push(`${index + 1}=${letter}`);
            } else if (state === 'present') {
                parts.push(`${letter} not ${index + 1}`);
            }
        });
        if (parts.length === 0) {
            return `${word}: no new green or yellow clues.`;
        }
        return `${word}: ${parts.join(', ')}`;
    }

    handleTeamGuessSubmitted(event) {
        if (!this.teamModeEnabled) return;
        const detail = event?.detail || {};
        const player = this.players.find(currentPlayer => currentPlayer.id === detail.playerId);
        if (!player || !Number.isInteger(player.teamId) || !detail.word) return;
        this.addTeamChatMessage(
            player.teamId,
            player.name,
            this.summarizeGuessForTeam(detail.word, detail.result),
            player.isAI ? 'ai' : 'hint'
        );
    }

    submitFocusedTeamHint() {
        if (!this.teamModeEnabled) return;
        const player = this.getFocusedHumanTeamPlayer();
        const input = document.getElementById('team-chat-input');
        if (!player || !input) return;
        const text = String(input.value || '').trim();
        if (!text) return;
        this.addTeamChatMessage(player.teamId, player.name, text, 'hint');
        input.value = '';
        this.renderTeamPanel();
    }

    renderTeamPanel() {
        const teamPanel = document.getElementById('team-panel');
        const summaryStrip = document.getElementById('team-summary-strip');
        const chatColumns = document.getElementById('team-chat-columns');
        const chatTarget = document.getElementById('team-chat-target');
        const chatInput = document.getElementById('team-chat-input');
        const sendButton = document.getElementById('team-chat-send');
        if (!teamPanel || !summaryStrip || !chatColumns || !chatTarget || !chatInput || !sendButton) return;

        const shouldShow = this.teamModeEnabled && this.players.length > 0 && document.body.dataset.view === 'match';
        teamPanel.classList.toggle('hidden', !shouldShow);
        if (!shouldShow) {
            return;
        }

        summaryStrip.innerHTML = Array.from({ length: this.teamCount }, (_, teamId) => {
            const members = this.getTeamMembers(teamId);
            const points = members.reduce((sum, player) => sum + (player.stats?.points || 0), 0);
            return `<article class="team-summary-card">
                <span class="team-summary-kicker">${this.getTeamName(teamId)}</span>
                <strong>${members.length} player${members.length === 1 ? '' : 's'}</strong>
                <span>${points} pts</span>
            </article>`;
        }).join('');

        chatColumns.innerHTML = Array.from({ length: this.teamCount }, (_, teamId) => {
            const teamName = this.getTeamName(teamId);
            const members = this.getTeamMembers(teamId);
            const messages = (this.teamChatByTeam[teamId] || []).slice(-8);
            const messageMarkup = messages.length > 0
                ? messages.map(message => `<div class="team-chat-message" data-type="${message.type}">
                    <strong>${message.author}</strong>
                    <span>${this.escapeHTML(message.text)}</span>
                </div>`).join('')
                : '<div class="team-chat-empty">No team hints yet.</div>';
            return `<section class="team-chat-card">
                <div class="team-chat-card-header">
                    <div>
                        <h3>${teamName}</h3>
                        <p>${members.map(player => this.escapeHTML(player.name)).join(', ') || 'No members'}</p>
                    </div>
                </div>
                <div class="team-chat-log">${messageMarkup}</div>
            </section>`;
        }).join('');

        const focusedTeamPlayer = this.getFocusedHumanTeamPlayer();
        if (focusedTeamPlayer) {
            chatTarget.textContent = `${focusedTeamPlayer.name} is sending to ${focusedTeamPlayer.teamName}.`;
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatInput.placeholder = `Hint for ${focusedTeamPlayer.teamName}`;
        } else {
            chatTarget.textContent = 'Select a human board in team mode to send a hint.';
            chatInput.disabled = true;
            sendButton.disabled = true;
            chatInput.placeholder = 'Team chat is available for focused human boards';
        }
    }

    runQueuedAITask(task) {
        const previousQueue = this.aiTurnQueue;
        let releaseQueue = () => {};
        this.aiTurnQueue = new Promise(resolve => {
            releaseQueue = resolve;
        });

        return previousQueue
            .catch(() => {})
            .then(async () => {
                try {
                    return await task();
                } finally {
                    releaseQueue();
                }
            });
    }

    getSelectedLanguage() {
        const selectedLanguage = document.getElementById('game-language').value;
        return selectedLanguage === 'custom' ? document.getElementById('custom-language').value : selectedLanguage;
    }

    getLanguageTag(language = this.getSelectedLanguage()) {
        return normalizeBucketKey(language, 'english');
    }

    getSelectedWordLength() {
        const input = document.getElementById('word-length');
        const selected = clampWordLength(input ? input.value : DEFAULT_WORD_LENGTH);
        if (input) input.value = String(selected);
        return selected;
    }

    getSelectedWordPoolSize() {
        const input = document.getElementById('word-pool-size');
        const selected = clampWordPoolSize(input ? input.value : DEFAULT_WORD_POOL_SIZE);
        if (input) input.value = String(selected);
        return selected;
    }

    getSelectedHumanPlayerCount() {
        const input = document.getElementById('human-player-count');
        const parsed = parseInt(input ? input.value : '0', 10);
        const selected = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(4, parsed));
        if (input) input.value = String(selected);
        return selected;
    }

    getSelectedAIPlayerCount() {
        const input = document.getElementById('ai-player-count');
        const parsed = parseInt(input ? input.value : '0', 10);
        const selected = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(4, parsed));
        if (input) input.value = String(selected);
        return selected;
    }

    normalizePeekMode(value) {
        if (value === 'colors' || value === 'none') {
            return value;
        }
        return 'open';
    }

    getSelectedPeekMode() {
        const input = document.getElementById('peek-mode');
        const selected = this.normalizePeekMode(input ? input.value : 'open');
        if (input) input.value = selected;
        return selected;
    }

    getSelectedAIWordKnowledge() {
        const input = document.getElementById('ai-word-knowledge');
        const selected = input && ['full', 'sample', 'free'].includes(input.value) ? input.value : 'sample';
        if (input) input.value = selected;
        return selected;
    }

    getSelectedAIBackend() {
        const input = document.getElementById('ai-backend');
        const selected = input && ['llm', 'computer'].includes(input.value) ? input.value : 'llm';
        if (input) input.value = selected;
        return selected;
    }

    getSelectedAIDecisionMode() {
        const input = document.getElementById('ai-decision-mode');
        const selected = input && ['llm', 'hybrid', 'assisted'].includes(input.value) ? input.value : 'llm';
        if (input) input.value = selected;
        return selected;
    }

    getSelectedAIGuessPoolTarget() {
        const input = document.getElementById('ai-guess-pool-target');
        const selected = clampAIGuessPoolTarget(input ? input.value : DEFAULT_AI_GUESS_POOL_TARGET);
        if (input) input.value = String(selected);
        return selected;
    }

    getSelectedEliminationRoundTimeLimit() {
        const input = document.getElementById('elimination-round-time');
        const parsed = parseInt(input ? input.value : '30', 10);
        const selected = Number.isNaN(parsed) ? 30 : Math.max(5, parsed);
        if (input) input.value = String(selected);
        return selected;
    }

    getSelectedEliminationCheckpointCount(wordLength = this.getSelectedWordLength()) {
        const input = document.getElementById('elimination-checkpoints');
        const parsed = parseInt(input ? input.value : '3', 10);
        const cappedWordLength = clampWordLength(wordLength);
        const selected = Number.isNaN(parsed) ? 3 : Math.max(1, Math.min(6, Math.min(cappedWordLength, parsed)));
        if (input) input.value = String(selected);
        return selected;
    }

    getWordStyleOptions(fromUI = false) {
        if (!fromUI) {
            return normalizeWordStyleOptions(this.wordStyleOptions);
        }

        const onlySingularInput = document.getElementById('word-style-singular');
        const allowExtendedInput = document.getElementById('word-style-extended');
        const customInstructionsInput = document.getElementById('word-style-custom');
        return normalizeWordStyleOptions({
            onlySingular: Boolean(onlySingularInput && onlySingularInput.checked),
            allowExtendedLetters: Boolean(allowExtendedInput && allowExtendedInput.checked),
            customInstructions: customInstructionsInput ? customInstructionsInput.value : ''
        });
    }

}

installGameManagerSetupMethods(GameManager);
installGameManagerModelUIMethods(GameManager);
installGameManagerWordSourceMethods(GameManager, { MEMORY_HINT_LIMIT, ROUND_MEMORY_POOL_LIMIT, MIN_WORD_POOL_SIZE });
installGameManagerReviewMethods(GameManager);
installGameManagerScoringMethods(GameManager, { FIRST_SOLVE_BONUS, AI_REVEAL_VALID_WORD_PENALTY });
installGameManagerRoundFlowMethods(GameManager);
