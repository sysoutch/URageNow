// UI functions for Dice 5 game

// Player management
const Players = {
    players: [
        { name: 'Player 1', score: 0, totalScore: 0, turnCount: 0 },
        { name: 'CPU', score: 0, totalScore: 0, turnCount: 0 }
    ],

    currentPlayerIndex: 0,
};

// Update which player card is highlighted as active
function updateActivePlayer() {
    // Remove active-player class from all player cards
    document.querySelectorAll('.player-card').forEach(card => {
        card.classList.remove('active-player');
    });

    // Add active-player class to current player's card
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayerIndex = Game.player % numPlayers;
    const currentPlayerCard = document.getElementById(`playerCard${currentPlayerIndex}`);
    if (currentPlayerCard) {
        currentPlayerCard.classList.add('active-player');
    }
}

// Render player cards - dynamically positioned around the table in a circle
function renderPlayers() {
    const topContainer = document.getElementById('players');
    const bottomContainer = document.getElementById('playersBottom');
    const gameWrapper = document.querySelector('.game-wrapper');

    if (!topContainer) return;

    // Clear existing content to prevent duplicates
    topContainer.innerHTML = '';
    if (bottomContainer) bottomContainer.innerHTML = '';

    const settingsObj = getSettings();
    const cpuEnabled = settingsObj && settingsObj.cpuEnabled;

    // Count actual visible players for positioning logic
    let playerCount = 0;
    Players.players.forEach((player, index) => {
        if (!cpuEnabled && index === 1) return;
        playerCount++;
    });

    Players.players.forEach((player, index) => {
        if (!cpuEnabled && index === 1) return; // Hide CPU in hotseat mode

        const card = document.createElement('div');
        card.className = 'player-card';
        card.id = `playerCard${index}`;

        card.innerHTML = `
            <div class="player-name">${player.name}</div>
            <div class="score-display">
                <span class="turn-score-label">Turn:</span>
                <span id="playerTurnScore${index}" class="turn-score">${player.score}</span>
            </div>
            <div class="total-score-display">
                <span class="total-score-label">Total:</span>
                <span id="playerTotalScore${index}" class="total-score">${player.totalScore}</span>
            </div>
            <div class="turn-count-display">
                Turns: ${player.turnCount}
            </div>
        `;

        // Position players around the table in a circular/poker layout
        if (index === 0) {
            // Player 1 - top center of table
            topContainer.appendChild(card);
        } else {
            // CPU players - positioned absolutely on game-wrapper for poker-table style
            // Assign positions dynamically based on player count to avoid overlap
            let posClass;

            if (playerCount <= 2) {
                // Only 1 CPU - position on right side
                posClass = 'position-right';
            } else if (playerCount === 3) {
                // 2 CPUs - left and right
                posClass = index === 1 ? 'position-left' : 'position-right';
            } else if (playerCount === 4) {
                // 3 CPUs - left, right, bottom-center
                if (index === 1) posClass = 'position-left-top';
                else if (index === 2) posClass = 'position-right-top';
                else posClass = 'position-bottom';
            } else if (playerCount === 5) {
                // 4 CPUs - left-top, left-bottom, right-top, right-bottom
                if (index === 1) posClass = 'position-left-top';
                else if (index === 2) posClass = 'position-left-bottom';
                else if (index === 3) posClass = 'position-right-top';
                else posClass = 'position-right-bottom';
            } else {
                // 5+ CPUs - spread around all sides + bottom
                const cpuIndex = index - 1; // Adjust for human player
                if (cpuIndex < 2) posClass = `position-left-${cpuIndex === 0 ? 'top' : 'bottom'}`;
                else if (cpuIndex < 4) posClass = `position-right-${cpuIndex === 2 ? 'top' : 'bottom'}`;
                else posClass = 'position-bottom';
            }

            card.classList.add(posClass);
            // Append directly to game-wrapper, not to #playersBottom
            if (gameWrapper) gameWrapper.appendChild(card);
        }
    });

    // Highlight current player
    updateActivePlayer();

    // Update CPU indicator on load
    updateCPUIndicator();
}

// Sync Game.numDice with the input element when it changes
function syncNumDice() {
    const diceEl = document.getElementById('numDice');
    if (diceEl && Game) {
        Game.numDice = parseInt(diceEl.value) || 6;
    }
}

// Listen for numDice changes
window.addEventListener('DOMContentLoaded', () => {
    const diceEl = document.getElementById('numDice');
    if (diceEl) {
        diceEl.addEventListener('change', syncNumDice);
    }
});

// Update player scores
function updatePlayerScores() {
    Players.players.forEach((player, index) => {
        const turnScoreEl = document.getElementById(`playerTurnScore${index}`);
        const totalScoreEl = document.getElementById(`playerTotalScore${index}`);

        if (turnScoreEl && totalScoreEl) {
            turnScoreEl.textContent = player.score;
            totalScoreEl.textContent = player.totalScore;

            // Highlight current player's score
            if (index === Players.currentPlayerIndex) {
                turnScoreEl.classList.add('active-turn-score');
                totalScoreEl.classList.add('active-total-score');
            } else {
                turnScoreEl.classList.remove('active-turn-score');
                totalScoreEl.classList.remove('active-total-score');
            }
        }
    });
}

// Message notifications system
function showNotification(message, type = 'info') {
    const container = document.getElementById('messageContainer');
    if (!container) return;

    // Clear existing messages after 3 seconds
    setTimeout(() => {
        if (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }, 3000);

    const msg = document.createElement('div');
    msg.className = `notification notification-${type}`;
    msg.textContent = message;

    container.appendChild(msg);
}

// Game over handling - Endgame Chase Mechanic
let endgameChaseActive = false;
let endgameLeaderIndex = -1;
let endgameChaseRounds = 0;
const MAX_CHASE_ROUNDS = 2; // Each player gets one additional turn after leader emerges

function startEndgameChase(leaderIdx) {
    endgameChaseActive = true;
    endgameLeaderIndex = leaderIdx;
    endgameChaseRounds = 0;

    const playerName = Players.players[leaderIdx].name;
    showNotification(`${playerName} reached the target! Starting endgame chase...`, 'warning');

    // Continue game - next player will try to overtake
    nextPlayerForChase();
}

function nextPlayerForChase() {
    if (!endgameChaseActive) {
        nextPlayer();
        return;
    }

    endgameChaseRounds++;

    // Check if all players have had their chase turns
    const numPlayers = Players.players.length;
    if (endgameChaseRounds >= numPlayers) {
        // All players had chances - determine winner
        determineWinner();
        return;
    }

    // Next player's turn to try to overtake
    Game.player++;

    const newPlayer = Game.player % numPlayers;
    if (Game.busted) {
        Game.busted[newPlayer] = false;
    }

    // Reset player turn score when switching players
    if (Players && Players.players[newPlayer]) {
        Players.players[newPlayer].score = 0;
    }

    Game.keptDice = [];
    Game.rollDice = [];
    Game.selected = [];
    Game.turnScore = 0;

    updateTurnScore();

    if (window.updatePlayerScores) {
        updatePlayerScores();
    }

    startRoll();
}

function determineWinner() {
    endgameChaseActive = false;

    // Find the player with highest score
    let winnerIdx = 0;
    let maxScore = Players.players[0].totalScore;

    for (let i = 1; i < Players.players.length; i++) {
        if (Players.players[i].totalScore > maxScore) {
            maxScore = Players.players[i].totalScore;
            winnerIdx = i;
        }
    }

    showGameOverModal(Players.players[winnerIdx]);
}

function checkForNewLeader() {
    if (!endgameChaseActive || endgameLeaderIndex === -1) return false;

    const numPlayers = Players.players.length;
    const leaderScore = Players.players[endgameLeaderIndex].totalScore;

    for (let i = 0; i < numPlayers; i++) {
        if (i !== endgameLeaderIndex && Players.players[i].totalScore > leaderScore) {
            // New leader! Update and reset chase rounds
            endgameLeaderIndex = i;
            endgameChaseRounds = 0;

            showNotification(`${Players.players[i].name} took the lead!`, 'warning');
            return true;
        }
    }

    return false;
}

function checkGameOver() {
    const settingsObj = getSettings();
    const targetScore = (settingsObj && settingsObj.targetScore) ? settingsObj.targetScore : 10000;

    // Check if any player has reached the target score
    for (let i = 0; i < Players.players.length; i++) {
        if (Players.players[i].totalScore >= targetScore && !endgameChaseActive) {
            startEndgameChase(i);
            return true;
        }
    }

    // Check if all players have busted and no more turns possible
    const busted = Game.busted || [false, false];
    let allBusted = true;
    for (let i = 0; i < Players.players.length; i++) {
        if (!busted[i]) {
            allBusted = false;
            break;
        }
    }

    if (allBusted) {
        showDrawModal();
        return true;
    }

    return false;
}

// Check for straight when rolling dice - update knock button visibility
function checkForStraight() {
    if (!endgameChaseActive) return;

    // After each bank, check if someone overtook the leader
    checkForNewLeader();
}

function showGameOverModal(winner) {
    const modal = document.getElementById('gameOverModal');
    if (!modal) return;

    // Show modal with active class
    modal.classList.add('active');

    // Update winner display
    document.getElementById('winnerDisplay').textContent = `🏆 Winner: ${winner.name}`;

    const finalScore1El = document.getElementById('finalScore1');
    const finalScore2El = document.getElementById('finalScore2');
    if (finalScore1El) finalScore1El.textContent = `Player 1: ${Players.players[0].totalScore}`;
    if (finalScore2El) finalScore2El.textContent = `${Players.players[1] ? Players.players[1].name : 'CPU'}: ${Players.players[1] ? Players.players[1].totalScore : 0}`;

    // Update winner message
    const winnerMessageEl = document.getElementById('winnerMessage');
    if (winnerMessageEl) {
        if (endgameChaseActive || endgameLeaderIndex !== -1) {
            winnerMessageEl.textContent = `${winner.name} wins with ${winner.totalScore} points after the endgame chase!`;
        } else {
            const settingsObj = getSettings();
            if (settingsObj && settingsObj.cpuEnabled) {
                winnerMessageEl.textContent = `${winner.name} wins with ${winner.totalScore} points!`;
            } else {
                winnerMessageEl.textContent = 'Draw! Both players have the same score.';
            }
        }
    }

    // Show modal
    modal.style.display = 'flex';
}

function showDrawModal() {
    const modal = document.getElementById('gameOverModal');
    if (!modal) return;

    // Show modal with active class
    modal.classList.add('active');

    document.getElementById('winnerDisplay').textContent = '🤝 Draw!';
    document.getElementById('finalScore1').textContent = `Player 1: ${Players.players[0].totalScore}`;
    document.getElementById('finalScore2').textContent = `CPU: ${Players.players[1].totalScore}`;

    const winnerMessageEl = document.getElementById('winnerMessage');
    if (winnerMessageEl) {
        winnerMessageEl.textContent = 'It\'s a draw! Both players have the same score.';
    }

    modal.style.display = 'flex';
}

// Get CPU count from input element directly (for real-time access)
function getCpuCount() {
    const cpuCountEl = document.getElementById('cpuCount');
    if (!cpuCountEl) return 1;
    const val = parseInt(cpuCountEl.value);
    return isNaN(val) ? 1 : Math.max(1, Math.min(5, val));
}

// Settings management
function getSettings() {
    const saved = localStorage.getItem('dice5-settings');
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch (e) {
            console.error('Error parsing settings:', e);
        }
    }
    // Default settings
    return {
        playerNames: ['Player 1', 'CPU'],
        targetScore: 10000,
        numDice: 6,
        cpuEnabled: true,
        cpuCount: 1,
        aiDifficulty: 'safe',
        enableInheritance: true,
        enableHotDice: true,
        enableEndgameChase: true,
        straightValue: 1000,
        kindMode: 'add',
        cpuMinDelay: 2000,
        cpuMaxDelay: 8000,
        cpuKnockMinDelay: 4000,
        cpuKnockMaxDelay: 15000
    };
}

function saveSettings() {
    const settings = {
        playerNames: [
            document.getElementById('playerName1').value.trim() || 'Player 1',
            document.getElementById('playerName2').value.trim() || (getSettings()?.cpuEnabled ? 'CPU' : 'Player 2')
        ],
        targetScore: parseInt(document.getElementById('targetScore').value) || 10000,
        numDice: parseInt(document.getElementById('numDice').value) || 6,
        cpuEnabled: document.getElementById('cpuEnabled').value === 'true',
        cpuCount: getCpuCount(),
        aiDifficulty: document.getElementById('aiDifficulty').value || 'safe',
        enableInheritance: document.getElementById('enableInheritance').value === 'true',
        enableHotDice: document.getElementById('enableHotDice')?.value === 'true',
        enableEndgameChase: document.getElementById('enableEndgameChase')?.value === 'true',
        straightValue: parseInt(document.getElementById('straightValue')?.value) || 1000,
        kindMode: document.getElementById('kindMode')?.value || 'add',
        cpuMinDelay: parseInt(document.getElementById('cpuMinDelay').value) || 2000,
        cpuMaxDelay: parseInt(document.getElementById('cpuMaxDelay').value) || 8000,
        cpuKnockMinDelay: parseInt(document.getElementById('cpuKnockMinDelay').value) || 4000,
        cpuKnockMaxDelay: parseInt(document.getElementById('cpuKnockMaxDelay').value) || 15000
    };

    localStorage.setItem('dice5-settings', JSON.stringify(settings));

    // Update game settings
    Game.settings = settings;

    // Update UI
    renderPlayers();
    updateAISettings();

    showNotification('Settings saved!', 'success');
}

function resetGame() {
    // Reset endgame chase state
    endgameChaseActive = false;
    endgameLeaderIndex = -1;
    endgameChaseRounds = 0;

    // Reset all game state
    Game.keptDice = [];
    Game.rollDice = [];
    Game.selected = [];
    Game.turnScore = 0;
    Game.scores = [0, 0];
    Game.finalScores = [0, 0];
    Game.busted = [false, false];
    Game.player = 0;

    // Get player names from settings or inputs
    const settingsObj = getSettings();
    const name1 = document.getElementById('playerName1').value.trim() || 'Player 1';
    const name2El = document.getElementById('playerName2');
    const cpuEnabled = settingsObj && settingsObj.cpuEnabled;
    const name2 = name2El ? name2El.value.trim() : (cpuEnabled ? 'CPU' : 'Player 2');

    // Reset players with current names
    Players.players = [
        { name: name1, score: 0, totalScore: 0, turnCount: 0 },
        { name: name2, score: 0, totalScore: 0, turnCount: 0 }
    ];

    // Clear CPU state
    AICPU.keptDice = [];
    AICPU.aiDice = [];
    AICPU.aiSelected = [];
    AICPU.cpuTurnScore = 0;

    // Clear settings
    localStorage.removeItem('dice5-settings');

    // Reset UI elements
    document.getElementById('playerName1').value = 'Player 1';
    document.getElementById('playerName2').value = 'CPU';
    document.getElementById('targetScore').value = 10000;
    document.getElementById('numDice').value = 6;
    if (document.getElementById('enableHotDice')) document.getElementById('enableHotDice').value = 'true';
    if (document.getElementById('enableEndgameChase')) document.getElementById('enableEndgameChase').value = 'true';
    if (document.getElementById('straightValue')) document.getElementById('straightValue').value = 1000;
    if (document.getElementById('kindMode')) document.getElementById('kindMode').value = 'add';

    // Clear modals by removing active class
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
    if (document.getElementById('messageContainer')) {
        document.getElementById('messageContainer').innerHTML = '';
    }

    // Re-render UI
    renderPlayers();
    renderDice();

    showNotification('Game reset!', 'success');
}

// Initialize UI functions
function initUI() {
    // Override nextPlayer to use chase system when endgame is active
    const originalNextPlayer = window.nextPlayer;

    // Event listeners - use the standalone functions directly
    const rollBtn = document.getElementById('roll');
    if (rollBtn) rollBtn.onclick = startRoll;

    // Inheritance decision buttons
    const acceptInheritBtn = document.getElementById('acceptInheritance');
    const declineInheritBtn = document.getElementById('declineInheritance');

    if (acceptInheritBtn) {
        acceptInheritBtn.onclick = function() {
            handleAcceptInheritance();
            hideInheritanceUI();
        };
    }

    if (declineInheritBtn) {
        declineInheritBtn.onclick = function() {
            handleDeclineInheritance();
            hideInheritanceUI();
        };
    }

    const bankBtn = document.getElementById('bank');
    if (bankBtn) {
        bankBtn.onclick = function() {
            // Check for new leader before banking in endgame
            if (endgameChaseActive && endgameLeaderIndex !== -1) {
                checkForNewLeader();
            }
            bankPoints();
        };
    }

    const knockBtn = document.getElementById('knock');
    if (knockBtn) knockBtn.onclick = knock;

    // Settings button - use active class for modal visibility
    const settingsButton = document.getElementById('settingsButton');
    if (settingsButton) {
        settingsButton.onclick = () => {
            const modal = document.getElementById('settingsModal');
            modal.classList.toggle('active');
        };

        // Save button - also update player initialization
        document.getElementById('saveSettings').onclick = function() {
            saveSettings();
            updatePlayerInitialization();
            renderPlayers();
        };

        // Reset button
        document.getElementById('resetGame').onclick = resetGame;
    }

    // Play again button
    const playAgainBtn = document.getElementById('playAgain');
    if (playAgainBtn) {
        playAgainBtn.onclick = () => {
            resetGame();

            // Re-render UI and start game
            renderPlayers();
            renderDice();

            showNotification('Game reset! Playing again...', 'success');
        };
    }

    // Dark mode toggle button
    const darkModeToggleBtn = document.getElementById('darkModeToggle');
    if (darkModeToggleBtn) {
        darkModeToggleBtn.onclick = toggleDarkMode;
    }

    // Apply settings to game state and initialize players
    applySettingsToGame();
    updatePlayerInitialization();

    // Initial render
    renderPlayers();
    renderDice();
}

// Apply settings from localStorage to Game object and Rules
function applySettingsToGame() {
    const settingsObj = getSettings();

    // Initialize Game.settings if it doesn't exist
    if (!Game.settings) {
        Game.settings = {};
    }

    if (settingsObj && settingsObj.targetScore) {
        Rules.winningScore = settingsObj.targetScore;
        Game.settings.targetScore = settingsObj.targetScore;
    }

    if (settingsObj && settingsObj.numDice) {
        Game.numDice = settingsObj.numDice;
        Game.settings.numDice = settingsObj.numDice;
    }

    // Apply new settings to Rules object
    if (settingsObj.enableHotDice !== undefined) {
        Rules.hotDice = settingsObj.enableHotDice;
    }
    if (settingsObj.straightValue) {
        Rules.straightValue = settingsObj.straightValue;
    }
    if (settingsObj.kindMode) {
        Rules.kindMode = settingsObj.kindMode;
    }

    // Store full settings in Game for easy access
    Object.assign(Game.settings, settingsObj);
}

// Update player initialization when settings change - use real-time input value
function updatePlayerInitialization() {
    const cpuEnabledEl = document.getElementById('cpuEnabled');
    const cpuEnabled = cpuEnabledEl && cpuEnabledEl.value === 'true';
    const cpuCount = (cpuEnabled) ? getCpuCount() : 0;

    // Rebuild player list based on current settings with isHuman flag
    Players.players = [
        { name: document.getElementById('playerName1').value.trim() || 'Player 1', score: 0, totalScore: 0, turnCount: 0, inheritedPoints: 0, isHuman: true }
    ];

    if (cpuEnabled) {
        for (let i = 0; i < cpuCount; i++) {
            Players.players.push({
                name: 'CPU',
                score: 0,
                totalScore: 0,
                turnCount: 0,
                inheritedPoints: 0,
                isHuman: false
            });
        }
    } else if (Players.players.length < 2) {
        const name2 = document.getElementById('playerName2').value.trim() || 'Player 2';
        Players.players.push({
            name: name2,
            score: 0,
            totalScore: 0,
            turnCount: 0,
            inheritedPoints: 0,
            isHuman: true
        });
    }

    Game.player = 0;
}

// Update Roll button state - disable if no scoring dice kept yet
function updateRollButtonState() {
    const rollBtn = document.getElementById('roll');
    if (!rollBtn) return;

    // Farkle rule: You must keep at least one scoring die before you can re-roll.
    // On a fresh start (no dice rolled yet), allow rolling immediately.
    const hasRollableDice = Game.rollDice && Game.rollDice.length > 0;
    const hasKeptScoringDice = Game.keptDice && Game.keptDice.length > 0;

    if (!hasRollableDice && !hasKeptScoringDice) {
        // Fresh start - allow first roll
        rollBtn.disabled = false;
        rollBtn.style.opacity = '1';
        rollBtn.style.pointerEvents = 'auto';
    } else if (hasRollableDice && hasKeptScoringDice) {
        // Already kept scoring dice this turn - allow re-roll
        rollBtn.disabled = false;
        rollBtn.style.opacity = '1';
        rollBtn.style.pointerEvents = 'auto';
    } else if (hasRollableDice && !hasKeptScoringDice) {
        // Have dice to roll but haven't kept any scoring dice yet.
        // This is the first roll of a new turn - still allow rolling.
        rollBtn.disabled = false;
        rollBtn.style.opacity = '1';
        rollBtn.style.pointerEvents = 'auto';
    } else {
        // No dice to roll and nothing to keep - disable
        rollBtn.disabled = true;
        rollBtn.style.opacity = '0.5';
        rollBtn.style.pointerEvents = 'none';
    }
}

// Export for use by other modules
window.updateRollButtonState = updateRollButtonState;

// Export functions for endgame chase and game flow
window.updateRollButtonState = updateRollButtonState;
window.getSettings = getSettings;
window.getCpuCount = getCpuCount;
window.saveSettings = saveSettings;
window.initializePlayers = initializePlayers;
window.updatePlayerInitialization = updatePlayerInitialization;
window.Players = Players;
window.renderPlayers = renderPlayers;
window.updatePlayerScores = updatePlayerScores;
window.showNotification = showNotification;
window.checkGameOver = checkGameOver;
window.showGameOverModal = showGameOverModal;
window.showDrawModal = showDrawModal;
window.getSettings = getSettings;
window.saveSettings = saveSettings;
window.resetGame = resetGame;
window.initUI = initUI;
window.startEndgameChase = startEndgameChase;
window.determineWinner = determineWinner;
window.checkForNewLeader = checkForNewLeader;

// Toggle CPU count visibility based on CPU mode
function toggleCPUCount() {
    const cpuEnabled = document.getElementById('cpuEnabled');
    const cpuCountGroup = document.getElementById('cpuCountGroup');
    if (cpuEnabled && cpuCountGroup) {
        cpuCountGroup.style.display = cpuEnabled.value === 'true' ? 'block' : 'none';
    }
}

// Initialize players based on real-time settings
function initializePlayers() {
    const cpuEnabledEl = document.getElementById('cpuEnabled');
    const cpuEnabled = cpuEnabledEl && cpuEnabledEl.value === 'true';
    const cpuCount = cpuEnabled ? getCpuCount() : 0;

    Players.players = [];

    // Add human player
    const name1El = document.getElementById('playerName1');
    Players.players.push({
        name: name1El ? name1El.value.trim() || 'Player 1' : 'Player 1',
        score: 0,
        totalScore: 0,
        turnCount: 0,
        inheritedPoints: 0
    });

    // Add CPU players
    if (cpuEnabled) {
        for (let i = 0; i < cpuCount; i++) {
            Players.players.push({
                name: 'CPU',
                score: 0,
                totalScore: 0,
                turnCount: 0,
                inheritedPoints: 0
            });
        }
    }

    // Reset game player index
    Game.player = 0;
}

// Handle accept inheritance decision
function handleAcceptInheritance() {
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;

    if (!Game.inheritancePool || !Game.inheritancePool[currentPlayer]) {
        return;
    }

    const inherited = Game.inheritancePool[currentPlayer];

    // Add inherited points to player's score and totalScore
    if (Players && Players.players[currentPlayer]) {
        Players.players[currentPlayer].score += inherited.points;
        Players.players[currentPlayer].totalScore += inherited.points;
        Players.players[currentPlayer].inheritedPoints = inherited.points;

        // Update UI displays
        const turnScoreEl = document.getElementById(`playerTurnScore${currentPlayer}`);
        const totalScoreEl = document.getElementById(`playerTotalScore${currentPlayer}`);
        if (turnScoreEl) turnScoreEl.textContent = Players.players[currentPlayer].score;
        if (totalScoreEl) totalScoreEl.textContent = Players.players[currentPlayer].totalScore;

        showNotification(`${Players.players[currentPlayer].name} accepts ${inherited.points} inherited points!`, 'success');
    }

    // Mark as inherited turn - player rolls with remaining dice from previous player's kept dice
    Game.isInheritedTurn = true;
    Game.inheritedPoints = inherited.points;

    // Clear inheritance pool for this player
    delete Game.inheritancePool[currentPlayer];

    // Enable roll button and start the turn with REMAINING DICE (numDice - previous keptDice)
    const rollBtn = document.getElementById('roll');
    if (rollBtn) {
        rollBtn.disabled = false;
        rollBtn.style.opacity = '1';
        rollBtn.style.pointerEvents = 'auto';
    }

    // Generate initial dice for the turn - use remainingDice count from inheritance
    Game.keptDice = [];
    Game.selected = [];
    Game.rollDice = [];
    const diceCount = inherited.remainingDice || Game.numDice;  // default to all dice if not specified
    console.log('=== handleAcceptInheritance ===');
    console.log('Generating', diceCount, 'dice for inheritance');
    for (let i = 0; i < diceCount; i++) {
        Game.rollDice.push(randomDie());
    }
    Game.turnScore = inherited.points; // Start with inherited points

    if (window.updateTurnScore) window.updateTurnScore();
    if (window.renderDice) window.renderDice();
}

// Handle decline inheritance decision
function handleDeclineInheritance() {
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;

    // Clear inheritance pool for this player - they start fresh with all dice
    if (Game.inheritancePool) {
        delete Game.inheritancePool[currentPlayer];
    }

    Game.isInheritedTurn = false;
    Game.inheritedPoints = 0;

    showNotification(`${Players.players[currentPlayer]?.name || 'Player'} declines inheritance. Starting fresh with all dice!`, 'info');

    // Enable roll button and start the turn with ALL dice (fresh turn)
    const rollBtn = document.getElementById('roll');
    if (rollBtn) {
        rollBtn.disabled = false;
        rollBtn.style.opacity = '1';
        rollBtn.style.pointerEvents = 'auto';
    }

    // Generate initial dice for the turn - ALL dice since declining inheritance
    Game.keptDice = [];
    Game.selected = [];
    Game.rollDice = [];
    Game.turnScore = 0;

    for (let i = 0; i < Game.numDice; i++) {
        Game.rollDice.push(randomDie());
    }

    if (window.updateTurnScore) window.updateTurnScore();
    if (window.renderDice) window.renderDice();
}

// Show/hide inheritance UI
function showInheritanceUI() {
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;

    console.log('=== showInheritanceUI ===');
    console.log('currentPlayer:', currentPlayer);
    console.log('Game.inheritancePool:', JSON.stringify(Game.inheritancePool));

    if (!Game.inheritancePool || !Game.inheritancePool[currentPlayer]) {
        console.log('No inheritance pool for this player, hiding UI');
        hideInheritanceUI();
        return;
    }

    const inherited = Game.inheritancePool[currentPlayer];
    const fromPlayerName = Players.players[inherited.fromPlayer]?.name || 'Previous Player';

    const inheritBtns = document.getElementById('inheritanceButtons');
    const inheritInfo = document.getElementById('inheritanceInfo');
    const inheritDetails = document.getElementById('inheritanceDetails');

    console.log('inheritBtns element:', inheritBtns);
    console.log('inheritInfo element:', inheritInfo);
    console.log('inheritDetails element:', inheritDetails);

    if (inheritBtns) {
        inheritBtns.style.display = 'block';
        console.log('Inheritance buttons shown');
    } else {
        console.error('inheritanceButtons element NOT FOUND!');
    }
    if (inheritInfo) {
        inheritInfo.style.display = 'block';
        console.log('Inheritance info shown');
    }
    if (inheritDetails) {
        inheritDetails.textContent = `${inherited.points} points from ${fromPlayerName}`;
        console.log('Inheritance details updated:', inheritDetails.textContent);
    }

    // Also enable the bank button so player can continue playing after accepting
    const rollBtn = document.getElementById('roll');
    if (rollBtn) {
        rollBtn.disabled = false;
        rollBtn.style.opacity = '1';
        console.log('Roll button enabled');
    }
}

function hideInheritanceUI() {
    const inheritBtns = document.getElementById('inheritanceButtons');
    const inheritInfo = document.getElementById('inheritanceInfo');

    if (inheritBtns) inheritBtns.style.display = 'none';
    if (inheritInfo) inheritInfo.style.display = 'none';
}

// Export inheritance functions
window.handleAcceptInheritance = handleAcceptInheritance;
window.handleDeclineInheritance = handleDeclineInheritance;
window.showInheritanceUI = showInheritanceUI;
window.hideInheritanceUI = hideInheritanceUI;

// Dark mode toggle function
function toggleDarkMode() {
    const body = document.body;
    const toggleBtn = document.getElementById('darkModeToggle');

    if (body.classList.contains('dark-mode')) {
        // Switch to light mode
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        if (toggleBtn) {
            toggleBtn.textContent = '☀️ Light Mode';
            toggleBtn.classList.remove('active');
        }
        localStorage.setItem('dice5-darkMode', 'false');
    } else if (body.classList.contains('light-mode')) {
        // Switch to dark mode
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        if (toggleBtn) {
            toggleBtn.textContent = '🌙 Dark Mode';
            toggleBtn.classList.add('active');
        }
        localStorage.setItem('dice5-darkMode', 'true');
    } else {
        // Default to dark mode
        body.classList.add('dark-mode');
        if (toggleBtn) {
            toggleBtn.textContent = '☀️ Light Mode';
            toggleBtn.classList.add('active');
        }
        localStorage.setItem('dice5-darkMode', 'true');
    }
}

window.toggleDarkMode = toggleDarkMode;

// Update active player on score changes
function updateActivePlayerDisplay() {
    updateActivePlayer();
}

// Export for use by game.js
window.updateActivePlayerDisplay = updateActivePlayerDisplay;

// Initialize on load - only once
if (!window.__uiInitialized) {
    window.__uiInitialized = true;

    window.addEventListener('DOMContentLoaded', () => {
        // Toggle CPU count visibility on change
        const cpuEnabledEl = document.getElementById('cpuEnabled');
        if (cpuEnabledEl) {
            cpuEnabledEl.addEventListener('change', toggleCPUCount);
        }

        // Load saved settings if available
        const savedSettings = localStorage.getItem('dice5-settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                const name1El = document.getElementById('playerName1');
                const name2El = document.getElementById('playerName2');
                const targetEl = document.getElementById('targetScore');
                const diceEl = document.getElementById('numDice');
                const cpuEl = document.getElementById('cpuEnabled');
                const diffEl = document.getElementById('aiDifficulty');
                const inhEl = document.getElementById('enableInheritance');
                const hotDiceEl = document.getElementById('enableHotDice');
                const endgameChaseEl = document.getElementById('enableEndgameChase');
                const straightValEl = document.getElementById('straightValue');
                const kindModeEl = document.getElementById('kindMode');
                const cpuCountEl = document.getElementById('cpuCount');
                const minDelayEl = document.getElementById('cpuMinDelay');
                const maxDelayEl = document.getElementById('cpuMaxDelay');
                const knockMinDelayEl = document.getElementById('cpuKnockMinDelay');
                const knockMaxDelayEl = document.getElementById('cpuKnockMaxDelay');


                if (name1El) name1El.value = settings.playerNames && settings.playerNames[0] ? settings.playerNames[0] : 'Player 1';
                if (name2El) name2El.value = settings.playerNames && settings.playerNames[1] ? settings.playerNames[1] : (settings.cpuEnabled ? 'CPU' : 'Player 2');
                if (targetEl) targetEl.value = settings.targetScore || 10000;
                if (diceEl) diceEl.value = settings.numDice || 6;
                if (cpuEl) cpuEl.value = settings.cpuEnabled ? 'true' : 'false';
                if (diffEl) diffEl.value = settings.aiDifficulty || 'safe';
                if (inhEl) inhEl.value = settings.enableInheritance !== undefined ? (settings.enableInheritance ? 'true' : 'false') : 'true';
                if (hotDiceEl) hotDiceEl.value = settings.enableHotDice !== undefined ? (settings.enableHotDice ? 'true' : 'false') : 'true';
                if (endgameChaseEl) endgameChaseEl.value = settings.enableEndgameChase !== undefined ? (settings.enableEndgameChase ? 'true' : 'false') : 'true';
                if (straightValEl) straightValEl.value = settings.straightValue || 1000;
                if (kindModeEl) kindModeEl.value = settings.kindMode || 'add';
                if (cpuCountEl && settings.cpuEnabled) {
                    cpuCountEl.value = settings.cpuCount || 1;
                }
                if (minDelayEl) minDelayEl.value = settings.cpuMinDelay || 2000;
                if (maxDelayEl) maxDelayEl.value = settings.cpuMaxDelay || 8000;
                if (knockMinDelayEl) knockMinDelayEl.value = settings.cpuKnockMinDelay || 4000;
                if (knockMaxDelayEl) knockMaxDelayEl.value = settings.cpuKnockMaxDelay || 15000;

                // Toggle CPU count visibility based on current setting
                toggleCPUCount();
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }

        // Apply saved CPU mode to toggle visibility
        const cpuEnabledEl2 = document.getElementById('cpuEnabled');
        if (cpuEnabledEl2) {
            toggleCPUCount();
        }

        // Load and apply saved dark mode preference
        const darkModeSaved = localStorage.getItem('dice5-darkMode');
        if (darkModeSaved === 'true') {
            document.body.classList.add('dark-mode');
            const darkBtn = document.getElementById('darkModeToggle');
            if (darkBtn) {
                darkBtn.textContent = '☀️ Light Mode';
                darkBtn.classList.add('active');
            }
        } else if (darkModeSaved === 'false') {
            document.body.classList.add('light-mode');
            const darkBtn = document.getElementById('darkModeToggle');
            if (darkBtn) {
                darkBtn.textContent = '🌙 Dark Mode';
                darkBtn.classList.remove('active');
            }
        } else {
            // Default to dark mode on first visit
            document.body.classList.add('dark-mode');
            const darkBtn = document.getElementById('darkModeToggle');
            if (darkBtn) {
                darkBtn.textContent = '☀️ Light Mode';
                darkBtn.classList.add('active');
            }
        }

        // Initialize players based on settings
        initializePlayers();

        // Initialize AI - this must be called so AICPU.enabled is set correctly
        if (window.initAI) {
            window.initAI();
        }

        // Initialize UI and game
        initUI();
    });
}
