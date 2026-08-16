import { GameManager } from './src/game-manager.js';

const game = new GameManager();

window.game = game;
window.render_game_to_text = () => {
    const setupVisible = !document.getElementById('setup-screen').classList.contains('hidden');
    const statsVisible = !document.getElementById('stats-screen').classList.contains('hidden');
    const language = game.getSelectedLanguage();
    const wordLength = game.getSelectedWordLength();
    const styleOptions = game.getWordStyleOptions(true);
    const sourceWords = game.getUploadedWordsForLanguage(language, wordLength, styleOptions);

    return JSON.stringify({
        view: setupVisible ? 'setup' : statsVisible ? 'stats' : 'match',
        mode: game.mode,
        round: game.roundNumber,
        status: document.getElementById('round-status').textContent,
        focusedPlayerId: game.focusedPlayerId,
        focusedPlayerCanPeekOthers: game.canPlayerPeekOthers(game.focusedPlayerId),
        timeLeft: game.timeLeft,
        language,
        wordLength,
        poolSize: game.getSelectedWordPoolSize(),
        teamModeEnabled: game.teamModeEnabled,
        aiBackend: game.getSelectedAIBackend ? game.getSelectedAIBackend() : game.aiBackend,
        aiWordKnowledge: game.aiWordKnowledge,
        aiDecisionMode: game.getSelectedAIDecisionMode ? game.getSelectedAIDecisionMode() : game.aiDecisionMode,
        aiGuessPoolTarget: game.aiGuessPoolTarget,
        humanPlayerCount: game.players.filter(player => !player.isAI).length,
        aiPlayerCount: game.players.filter(player => player.isAI).length,
        currentRoundCandidateCount: game.getCurrentRoundCandidatePool(wordLength, styleOptions).length,
        reusableSourceCount: sourceWords.length,
        latestSolvedWordReview: game.latestSolvedWordReview,
        eliminationRoundTimeLimit: game.eliminationRoundTimeLimit,
        eliminationCheckpointCount: game.eliminationCheckpointCount,
        eliminationCheckpointIndex: game.eliminationCheckpointIndex,
        eliminationCheckpointRequirements: game.eliminationCheckpointRequirements,
        teamChats: Object.entries(game.teamChatByTeam || {}).map(([teamId, messages]) => ({
            teamId: Number(teamId),
            teamName: game.getTeamName(Number(teamId)),
            messageCount: Array.isArray(messages) ? messages.length : 0
        })),
        players: game.players.map(player => ({
            id: player.id,
            name: player.name,
            isAI: player.isAI,
            teamId: player.teamId ?? null,
            teamName: player.teamName || '',
            status: player.status,
            points: player.stats.points,
            solved: player.stats.passed,
            failed: player.stats.failed,
            skipped: player.stats.skipped,
            bestSolveSteps: player.stats.bestSolveSteps,
            averageSolveSteps: player.stats.passed > 0 ? Number((player.stats.totalSolveSteps / player.stats.passed).toFixed(1)) : null,
            guessCount: player.guesses.length,
            canPeekOthers: player.guesses.length > 0,
            currentGuess: player.currentGuess,
            roundNote: player.roundNote,
            lastRoundSummary: player.lastRoundSummary,
            guesses: player.guesses.map(entry => ({ word: entry.word, result: entry.result }))
        }))
    });
};
