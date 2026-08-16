// CPU AI logic for Dice 5 game

const AICPU = {
    difficulty: 'safe', // safe, gambler
    enabled: false,

    keptDice: [], // dice the CPU has locked in during its turn
    aiDice: [], // dice currently being rolled by CPU
    aiSelected: [], // indices of dice CPU has selected

    cpuTurnScore: 0,
    maxDecisions: 20, // prevent infinite loops
    decisionCount: 0,

    // Helper to get current player index (handles multiple CPUs)
    getPlayerIndex: function() {
        const numPlayers = Players && Players.players ? Players.players.length : 1;
        return Game.player % numPlayers;
    },

    // Banking thresholds based on remaining dice count
    // {safe: {minBank, minRoll}, gambler: {minBank, minRoll}}
    bankThresholds: {
        safe:     { minBank: 300, minRoll: 4 },  // Bank early (300+), only roll with 4+ dice
        gambler:  { minBank: 150, minRoll: 2 },  // Bank later (150+), willing to roll with 2+ dice
    },
};

// Generate random delay between min and max
function getRandomDelay(minDelay, maxDelay) {
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
}

// Get CPU knock delay from settings
function getCpuKnockDelay() {
    const settings = window.getSettings ? window.getSettings() : {};
    const minDelay = settings.cpuKnockMinDelay || 4000;
    const maxDelay = settings.cpuKnockMaxDelay || 15000;
    return getRandomDelay(minDelay, maxDelay);
}

// Get CPU thinking delay from settings
function getCpuThinkingDelay() {
    const settings = window.getSettings ? window.getSettings() : {};
    const minDelay = settings.cpuMinDelay || 2000;
    const maxDelay = settings.cpuMaxDelay || 8000;
    return getRandomDelay(minDelay, maxDelay);
}

// AI decision making based on difficulty level - returns values to keep (not indices)
function getAIDecision(dice, difficulty) {
    // Check for straight FIRST - if we have a straight, take ALL dice
    const sorted = [...dice].sort();
    const isStraight = (
        sorted[0] === 1 &&
        sorted[1] === 2 &&
        sorted[2] === 3 &&
        sorted[3] === 4 &&
        sorted[4] === 5 &&
        sorted[5] === 6
    );

    if (isStraight) {
        const allValues = [...dice];
        return allValues;
    }

    // Use local findGroups to avoid scope issues
    const groups = _findLocalGroups(dice);

    if (groups.length === 0) {
        return []; // No scoring dice available
    }

    let selectedValues = [];

    switch(difficulty) {
        case 'safe':
            // Conservative: take triples on first roll, then only singles (1s and 5s)
            let foundTriple = false;
            for (const group of groups) {
                if (group.length >= 3 && !foundTriple) {
                    // Take the first triple found - gives CPU something to work with
                    for (const idx of group) selectedValues.push(dice[idx]);
                    foundTriple = true;
                } else if (group.length === 1 && (dice[group[0]] === 1 || dice[group[0]] === 5)) {
                    selectedValues.push(dice[group[0]]);
                }
            }
            break;

        case 'gambler':
            // Aggressive: take everything that scores, including all triples
            for (const group of groups) {
                if (group.length >= 3) {
                    for (const idx of group) selectedValues.push(dice[idx]);
                } else if (group.length === 1 && (dice[group[0]] === 1 || dice[group[0]] === 5)) {
                    selectedValues.push(dice[group[0]]);
                }
            }
            break;
    }

    return selectedValues;
}

// Calculate minimum score needed to bank based on remaining dice and difficulty
function getMinBankThreshold() {
    const thresholds = AICPU.bankThresholds[AICPU.difficulty] || AICPU.bankThresholds.safe;

    // Adjust threshold based on current turn score (more aggressive as we approach threshold)
    let adjustedMinBank = thresholds.minBank;

    if (AICPU.cpuTurnScore >= thresholds.minBank * 1.5) {
        // Already have good score, can be more conservative
        adjustedMinBank = Math.max(100, thresholds.minBank - 100);
    }

    return adjustedMinBank;
}

// Calculate minimum dice needed to risk rolling again
function getMinDiceToRoll() {
    const thresholds = AICPU.bankThresholds[AICPU.difficulty] || AICPU.bankThresholds.safe;

    // Adjust based on turn score - more willing to roll with higher current score
    if (AICPU.cpuTurnScore >= thresholds.minBank * 2) {
        return Math.max(1, thresholds.minRoll - 1); // Willing to risk fewer dice
    }

    return thresholds.minRoll;
}

// Should CPU bank or continue? Decision based on current score vs threshold and remaining dice
function AICPU_shouldContinue(currentScore, targetScore) {
    const minBank = getMinBankThreshold();
    const minDiceToRoll = getMinDiceToRoll();

    // If we have enough score to bank AND few dice left, always bank
    if (currentScore >= minBank && AICPU.aiDice.length < minDiceToRoll) {
        return false; // Don't continue - bank now
    }

    // If we don't have minimum threshold yet, must continue (if we have dice)
    if (currentScore < minBank && AICPU.aiDice.length >= 1) {
        return true; // Must continue rolling
    }

    // Calculate expected value of continuing
    const remainingDice = AICPU.aiDice.length;

    // Gambler is more willing to risk
    if (AICPU.difficulty === 'gambler') {
        // Only bank if we have good score AND few dice left
        return !(currentScore >= minBank * 1.5 && remainingDice <= 2);
    }

    // Safe strategy: bank when we have decent score and few dice
    if (remainingDice <= 2 && currentScore >= minBank) {
        return false; // Bank with 2 or fewer dice once we hit threshold
    }
    if (remainingDice <= 1 && currentScore >= minBank * 0.7) {
        return false; // Bank even earlier with just 1 die left
    }

    return true; // Continue rolling
}

function cpuTurn() {
    if (!AICPU.enabled) return;

    const settings = window.getSettings ? window.getSettings() : (window.__settings || {});
    AICPU.difficulty = settings.aiDifficulty || 'safe';

    // Reset AI state for fresh turn
    AICPU.keptDice = [];
    AICPU.cpuTurnScore = 0;
    AICPU.decisionCount = 0;

    // Check if this is an inherited turn - use remaining dice count
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;
    let diceCount = Game.numDice || 6;

    if (Game.inheritancePool && Game.inheritancePool[currentPlayer] && Game.inheritancePool[currentPlayer].points > 0) {
        diceCount = Game.inheritancePool[currentPlayer].remainingDice || diceCount;
        showNotification(`🤖 ${Players.players[currentPlayer]?.name || 'CPU'} inherits with ${diceCount} dice!`, 'info');
    }

    // Generate initial dice for CPU turn (with inherited count if applicable)
    AICPU.aiDice = [];
    for (let i = 0; i < diceCount; i++) {
        AICPU.aiDice.push(randomDie());
    }
    Game.rollDice = [...AICPU.aiDice];

    // Ensure dice are visible before CPU starts making decisions
    if (window.renderDice) {
        renderDice();
    }

    const cpuIdx = AICPU.getPlayerIndex();

    // Show CPU is thinking - wait then make decisions
    showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} is thinking...`, 'info');

    // Delay so user can see the dice before CPU acts - use configurable delay
    const thinkingDelay = getCpuThinkingDelay();
    setTimeout(() => {
        cpuMakeDecision();
    }, thinkingDelay);
}

// Get inherited dice count for CPU turn
function getInheritedDiceCount() {
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;

    if (Game.inheritancePool && Game.inheritancePool[currentPlayer]) {
        return Game.inheritancePool[currentPlayer].remainingDice || null;
    }
    return null;
}

function cpuMakeDecision() {
    const settingsObj = window.getSettings ? window.getSettings() : (window.__settings || {});
    const targetScore = (settingsObj && settingsObj.targetScore) ? settingsObj.targetScore : 10000;

    // Safety: prevent infinite loops
    AICPU.decisionCount++;
    const cpuIdx = AICPU.getPlayerIndex();

    if (AICPU.decisionCount > AICPU.maxDecisions) {
        showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} stops after too many decisions!`, 'warning');
        cpuBankPoints();
        return;
    }

    // Calculate current score from kept dice
    AICPU.cpuTurnScore = getScore(AICPU.keptDice);

    // Check for straight in remaining dice
    if (AICPU.aiDice && hasStraight(AICPU.aiDice)) {
        AICPU.cpuTurnScore += Rules.straightValue;
        showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} rolled a STRAIGHT! +${Rules.straightValue} points!`, 'success');
    }

    if (!AICPU.aiDice || AICPU.aiDice.length === 0) {
        // No dice left to roll - must bank what we have (or pass if nothing scored)
        if (AICPU.cpuTurnScore > 0) {
            cpuBankPoints();
        } else {
            showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} passes - no scoring dice!`, 'info');
            cpuPassTurn();
        }
        return;
    }

    // AI decides which values to keep from remaining dice
    const selectedValues = getAIDecision(AICPU.aiDice, AICPU.difficulty);

    if (selectedValues.length > 0) {
        // Find indices of these values in aiDice and keep them
        let keptCount = 0;
        for (const val of selectedValues) {
            const idx = AICPU.aiDice.indexOf(val);
            if (idx >= 0) {
                AICPU.keptDice.push(val);
                // Remove this index from aiDice
                AICPU.aiDice.splice(idx, 1);
                keptCount++;
            }
        }

        // Sync to Game state so UI shows what CPU is doing
        Game.keptDice = [...AICPU.keptDice];
        Game.rollDice = [...AICPU.aiDice];
        Game.selected = [];
        Game.turnScore = getScore(Game.keptDice);

        // Update turn score display
        if (window.updateTurnScore) {
            updateTurnScore();
        }

        // Render the dice to show CPU's action visually
        if (window.renderDice) {
            renderDice();
        }

        showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} keeps ${keptCount} scoring die${keptCount > 1 ? 's' : ''}!`, 'info');

        // Check hot dice (all 6 kept, reset and roll again)
        if (AICPU.keptDice.length >= 6) {
            showNotification('🔥 Hot Dice! CPU rolls again!', 'warning');

            setTimeout(() => {
                // Reset kept dice for hot dice rule
                AICPU.keptDice = [];
                Game.keptDice = [];

                // Roll all 6 dice
                AICPU.aiDice = [];
                for (let i = 0; i < 6; i++) {
                    AICPU.aiDice.push(randomDie());
                }
                Game.rollDice = [...AICPU.aiDice];
                Game.turnScore = 0;

                if (window.updateTurnScore) updateTurnScore();
                if (window.renderDice) renderDice();

                // Longer pause after hot dice reset for dramatic effect
                setTimeout(() => {
                    cpuMakeDecision();
                }, 1200);
            }, 800);
            return;
        }

        // After keeping scoring dice, offer bank or continue decision
        const shouldContinue = AICPU_shouldContinue(AICPU.cpuTurnScore, targetScore);

        if (!shouldContinue) {
            // Bank the score - add thinking pause before banking (use configurable delay for knock situations like straight)
            const bankDelay = AICPU.cpuTurnScore >= Rules.straightValue ? getCpuKnockDelay() : getCpuThinkingDelay();
            setTimeout(() => cpuBankPoints(), bankDelay);
        } else if (AICPU.aiDice.length > 0) {
            // Roll remaining dice for more - add thinking pause before rolling
            showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} considers rolling ${AICPU.aiDice.length} die${AICPU.aiDice.length > 1 ? 's' : ''}...`, 'info');

            setTimeout(() => {
                // Simulate "rolling" animation time
                const newRolls = [];
                for (let i = 0; i < AICPU.aiDice.length; i++) {
                    newRolls.push(randomDie());
                }

                // Check if the roll results in bust (no scoring options)
                if (!hasPossibleScore(newRolls)) {
                    showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} busted on ${AICPU.aiDice.length} dice! Lost turn score.`, 'warning');

                    // Turn ends - CPU loses its turn score
                    AICPU.keptDice = [];
                    AICPU.aiDice = [];
                    AICPU.cpuTurnScore = 0;

                    Game.keptDice = [];
                    Game.rollDice = [];
                    Game.selected = [];
                    Game.turnScore = 0;

                    if (window.updateTurnScore) updateTurnScore();
                    if (window.renderDice) renderDice();

                    setTimeout(() => {
                        if (window.nextPlayer) window.nextPlayer();
                    }, 1500);
                    return;
                }

                AICPU.aiDice = newRolls;
                Game.rollDice = [...newRolls];
                Game.selected = [];
                Game.turnScore = getScore(Game.keptDice);

                if (window.updateTurnScore) updateTurnScore();
                if (window.renderDice) renderDice();

                // Continue making decisions with new roll - longer pause to see new dice
                setTimeout(() => {
                    cpuMakeDecision();
                }, 1500);
            }, 600);
        } else {
            // No dice left to roll - bank what we have with pause
            setTimeout(() => cpuBankPoints(), 800);
        }
    } else {
        // No scoring values found in remaining dice
        if (AICPU.keptDice.length > 0 && AICPU.cpuTurnScore > 0) {
            // We have kept dice with score but no more scoring from remaining
            // CPU must bank - can't roll without having scored first
            showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} banks ${AICPU.cpuTurnScore} points!`, 'success');
            // Pause before banking to let notification be read - use configurable delay for knock situations
            const bankDelay = AICPU.cpuTurnScore >= Rules.straightValue ? getCpuKnockDelay() : getCpuThinkingDelay();
            setTimeout(() => cpuBankPoints(), bankDelay);
        } else {
            // No kept dice and no scoring - pass turn (nothing to bank)
            showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} has no scoring dice...`, 'info');

            // Brief pause so user sees the dice that were rolled
            setTimeout(() => {
                showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} passes - nothing to keep!`, 'warning');

                AICPU.keptDice = [];
                AICPU.aiDice = [];
                AICPU.cpuTurnScore = 0;

                Game.keptDice = [];
                Game.rollDice = [];
                Game.selected = [];
                Game.turnScore = 0;

                if (window.updateTurnScore) updateTurnScore();
                if (window.renderDice) renderDice();

                setTimeout(() => {
                    if (window.nextPlayer) window.nextPlayer();
                }, 1200);
            }, 1500);
        }
    }
}

function cpuPassTurn() {
    // Reset CPU state - no score was banked
    AICPU.keptDice = [];
    AICPU.aiDice = [];
    AICPU.cpuTurnScore = 0;
    AICPU.decisionCount = 0;

    // Sync Game state
    Game.keptDice = [];
    Game.rollDice = [];
    Game.selected = [];
    Game.turnScore = 0;

    if (window.updateTurnScore) {
        updateTurnScore();
    }
    if (window.renderDice) {
        renderDice();
    }

    setTimeout(() => {
        if (window.nextPlayer) window.nextPlayer();
    }, 1500);
}

// Helper function to find scoring groups locally (avoids scope issues)
function _findLocalGroups(dice) {
    const groups = [];

    if (!dice || dice.length === 0) return groups;

    // Singles: 1s and 5s
    dice.forEach((v, i) => {
        if (v === 1 || v === 5) {
            groups.push([i]);
        }
    });

    // Triples or more
    const counts = {};
    dice.forEach(v => { counts[v] = (counts[v] || 0) + 1; });

    Object.keys(counts).forEach(number => {
        if (counts[number] >= 3) {
            const group = [];
            dice.forEach((v, i) => {
                if (parseInt(v) === parseInt(number)) group.push(i);
            });
            groups.push(group);
        }
    });

    return groups;
}

// (AICPU_shouldContinue is now defined above with the new threshold-based system)

function cpuBankPoints() {
    const settingsObj = window.getSettings ? window.getSettings() : (window.__settings || {});

    // Handle inheritance mechanic - same as bankPoints() in game.js
    if (settingsObj && settingsObj.enableInheritance) {
        handleInheritance();
    } else {
        console.log('⚠️ Inheritance disabled or not called from cpuBankPoints');
    }

    // Get current CPU player index dynamically
    const cpuIdx = AICPU.getPlayerIndex();

    if (Game.scores) {
        Game.scores[cpuIdx] += AICPU.cpuTurnScore;
    }

    // Update player total score
    if (Players && Players.players[cpuIdx]) {
        Players.players[cpuIdx].score = AICPU.cpuTurnScore;
        Players.players[cpuIdx].totalScore += AICPU.cpuTurnScore;
        Players.players[cpuIdx].turnCount++;

        const totalScoreEl = document.getElementById(`playerTotalScore${cpuIdx}`);
        if (totalScoreEl) {
            totalScoreEl.textContent = Players.players[cpuIdx].totalScore;
        }
    }

    showNotification(`🤖 ${Players.players[cpuIdx]?.name || 'CPU'} banks ${AICPU.cpuTurnScore} points!`, 'success');

    // Update player turn score display immediately (sync with Game.turnScore)
    const turnScoreEl = document.getElementById('turnScore');
    if (turnScoreEl) {
        turnScoreEl.textContent = AICPU.cpuTurnScore;
    }

    // Check for new leader in endgame chase
    if (window.checkForNewLeader && window.endgameChaseActive) {
        window.checkForNewLeader();
    }

    // Reset CPU state for next turn
    AICPU.keptDice = [];
    AICPU.aiDice = [];
    AICPU.cpuTurnScore = 0;
    AICPU.decisionCount = 0;

    // Sync Game state - clear dice (but keep keptDice for handleInheritance)
    const currentKeptDice = [...Game.keptDice];
    Game.rollDice = [];
    Game.selected = [];
    Game.turnScore = 0;

    if (window.updateTurnScore) {
        updateTurnScore();
    }

    // Check win condition - use dynamic CPU index
    const cpuIdx2 = AICPU.getPlayerIndex();
    if (Players && Players.players[cpuIdx2]) {
        const targetScore = settingsObj?.targetScore || 10000;
        if (Players.players[cpuIdx2].totalScore >= targetScore) {
            if (window.startEndgameChase) {
                window.startEndgameChase(cpuIdx2);
            }
            return;
        }
    }

    // Next player turn after delay - longer pause to see the banked score
    setTimeout(() => {
        // Restore keptDice temporarily so handleInheritance can calculate remaining dice
        Game.keptDice = currentKeptDice;

        if (window.nextPlayerForChase && window.endgameChaseActive) {
            window.nextPlayerForChase();
        } else if (window.nextPlayer) {
            window.nextPlayer();
        }
    }, 1500);
}

function aiGetTotalScore() {
    return getScore(AICPU.keptDice);
}

// Update settings for AI
function updateAISettings() {
    const settings = window.getSettings ? window.getSettings() : (window.__settings || {});

    if (settings.cpuEnabled) {
        AICPU.enabled = true;
        AICPU.difficulty = settings.aiDifficulty || 'safe';
        showNotification('AI enabled! Difficulty: ' + settings.aiDifficulty.toUpperCase(), 'info');
    } else {
        AICPU.enabled = false;
        showNotification('AI disabled. Hotseat mode.', 'info');
    }
}

// Initialize AI state
function initAI() {
    const settingsObj = window.getSettings ? window.getSettings() : (window.__settings || {});
    if (settingsObj && settingsObj.cpuEnabled) {
        AICPU.enabled = true;
        AICPU.difficulty = settingsObj.aiDifficulty || 'safe';
    } else {
        AICPU.enabled = false;
    }
}

// Export functions
window.AICPU = AICPU;
window.getAIDecision = getAIDecision;
window.cpuTurn = cpuTurn;
window.bankCPUPoints = cpuBankPoints; // Alias for export
window.aiGetTotalScore = aiGetTotalScore;
window.updateAISettings = updateAISettings;
window.initAI = initAI;
window.cpuMakeDecision = cpuMakeDecision;
window.AICPU_shouldContinue = AICPU_shouldContinue;
window.getInheritedDiceCount = getInheritedDiceCount;

// Note: initAI() is called from index.html's DOMContentLoaded handler
// Do NOT set __aiInitialized here to allow external initialization
