const Game = {

    keptDice: [],       // locked dice
    rollDice: [],       // dice currently available
    selected: [],       // marked this roll

    turnScore: 0,

    player: 0,

    scores: [0, 0],           // total scores per player
    finalScores: [0, 0],      // final scores at game end
    busted: [false, false],   // whether a player busted

    numDice: 6,                // total dice in the game

    hotDiceBonus: 0,          // score from kept dice when all 6 were kept (hot dice)

    inheritance: {              // inheritance mechanic from README
        active: false,          // whether inheritance is enabled
        points: 0,              // points inherited from previous player
        targetPlayer: -1,       // which player inherits (index)
    },

    settings: {}               // game settings reference
};

function randomDie(){
    return Math.floor(Math.random()*6)+1;
}


function startRoll(){

    // Check if it's CPU's turn - trigger AI automatically
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;
    const isCPUturn = Players?.players[currentPlayer]?.name === 'CPU' && AICPU.enabled;

    if (isCPUturn) {
        // Reset all game state for fresh CPU turn
        Game.keptDice = [];
        Game.selected = [];
        Game.turnScore = 0;

        // Check if this is an inherited turn - use remaining dice count
        let diceCount = Game.numDice || 6;
        if (Game.inheritancePool && Game.inheritancePool[currentPlayer] && Game.inheritancePool[currentPlayer].points > 0) {
            diceCount = Game.inheritancePool[currentPlayer].remainingDice || diceCount;
        }

        // Generate initial dice for CPU
        AICPU.aiDice = [];
        for(let i=0;i<diceCount;i++){
            AICPU.aiDice.push(randomDie());
        }
        AICPU.keptDice = [];
        AICPU.cpuTurnScore = 0;

        Game.rollDice = [...AICPU.aiDice];

        updateTurnScore();
        renderDice();

        // Trigger CPU AI turn with delay - dice are already visible
        setTimeout(() => {
            cpuTurn();
        }, 800);
        return;
    }

    // If there are no rollDice yet (first turn or inherited turn), generate them
    if(!Game.rollDice || Game.rollDice.length === 0){
        // Check if this is an inherited turn - use remaining dice count
        let diceCount = Game.numDice || 6;

        // For human player, check inheritance pool
        if (Game.inheritancePool && Game.inheritancePool[currentPlayer] && Game.inheritancePool[currentPlayer].points > 0) {
            diceCount = Game.inheritancePool[currentPlayer].remainingDice || diceCount;
            console.log('=== Human inherited turn ===');
            console.log('Using remainingDice:', diceCount);
        }

        Game.rollDice = [];
        for(let i=0;i<diceCount;i++){
            Game.rollDice.push(randomDie());
        }
        updateTurnScore();
        renderDice();
        return;
    }

    // Move selected dice into locked area
    const selectedValues = Game.selected.map(
        i => Game.rollDice[i]
    );


    Game.keptDice.push(...selectedValues);


    Game.selected = [];


    // HOT DICE - when all dice have been kept, add bonus and roll again (if enabled)
    if (Rules.hotDice && Game.keptDice.length === Game.numDice && Game.rollDice.length === 0){

        // All dice were kept - this is a hot dice situation
        const hotBonus = getScore(Game.keptDice);
        showNotification(`🔥 Hot Dice! +${hotBonus} points! Rolling all ${Game.numDice} again...`, 'success');

        Game.hotDiceBonus = hotBonus;
        Game.keptDice = [];

    }


    // Roll remaining dice
    const amount = Game.numDice - Game.keptDice.length;


    Game.rollDice = [];


    for(let i=0;i<amount;i++){

        Game.rollDice.push(randomDie());

    }


    updateTurnScore();



    // If the new roll has no scoring option -> bust
    if(Game.rollDice.length > 0 && !hasPossibleScore(Game.rollDice)){


        bust();

        return;

    }


    renderDice();

}

// Handle bust during CPU turn - check before calling bust() from cpuMakeDecision
function handleCPUBust() {
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;

    showNotification(`🤖 ${Players.players[currentPlayer]?.name || 'CPU'} busted! Lost turn score.`, 'warning');

    // Remove inherited points if player busts (temporary inheritance)
    if (Players && Players.players[currentPlayer]) {
        const inherited = Players.players[currentPlayer].inheritedPoints || 0;
        if (inherited > 0) {
            showNotification(`💥 ${Players.players[currentPlayer].name} busted! Lost ${inherited} inherited points!`, 'error');
            Players.players[currentPlayer].totalScore -= inherited;
            Players.players[currentPlayer].inheritedPoints = 0;

            // Update total score display
            const totalScoreEl = document.getElementById(`playerTotalScore${currentPlayer}`);
            if (totalScoreEl) {
                totalScoreEl.textContent = Players.players[currentPlayer].totalScore;
            }
        }
    }

    // Reset CPU state
    AICPU.keptDice = [];
    AICPU.aiDice = [];
    AICPU.cpuTurnScore = 0;

    // Sync Game state - clear dice
    Game.keptDice = [];
    Game.rollDice = [];
    Game.selected = [];
    Game.turnScore = 0;

    if (window.updateTurnScore) {
        updateTurnScore();
    }

    // Next player turn after delay
    setTimeout(() => {
        if (window.nextPlayer) {
            window.nextPlayer();
        }
    }, 1000);
}



function keepDie(index){

    const groups = findGroups(Game.rollDice);

    const group = groups.find(
        g => g.includes(index)
    );


    if(!group){
        return;
    }


    // triple or more
    if(group.length >= 3){

        const selected =
            group.every(
                i => Game.selected && Game.selected.includes(i)
            );


        if(selected){

            // unselect whole group
            Game.selected =
                Game.selected ? Game.selected.filter(
                    i => !group.includes(i)
                ) : [];

        }
        else{

            // select whole group
            if (!Game.selected) Game.selected = [];
            group.forEach(i=>{

                if(!Game.selected.includes(i)){
                    Game.selected.push(i);
                }

            });

        }

    }
    else {

        // single 1 or 5 toggle
        if(Game.selected && Game.selected.includes(index)){

            Game.selected =
                Game.selected.filter(
                    i => i !== index
                );

        }
        else{

            if (!Game.selected) Game.selected = [];
            Game.selected.push(index);

        }

    }


    updateTurnScore();

    renderDice();

}

function updateTurnScore(){

    const turnScoreEl = document.getElementById("turnScore");
    if (!turnScoreEl) return;

    const locked = getScore(Game.keptDice || []);
    const selectedValues = (Game.selected || []).map(i => Game.rollDice ? Game.rollDice[i] : 0);
    const selected = getScore(selectedValues);


    // Add hot dice bonus if applicable (preserves score after keeping all 6 dice)
    const hotBonus = Game.hotDiceBonus || 0;

    Game.turnScore = hotBonus + locked + selected;

    turnScoreEl.textContent = Game.turnScore;

    // Update current player's turn score display in real-time
    updateCurrentPlayerDisplay();

}

function updateCurrentPlayerDisplay(){
    if (!Players || !Players.players) return;

    const numPlayers = Players.players.length;
    const currentPlayer = Game.player % numPlayers;
    const player = Players.players[currentPlayer];

    if (!player) return;

    // Update the player's turn score
    const turnScoreEl = document.getElementById(`playerTurnScore${currentPlayer}`);
    if (turnScoreEl) {
        turnScoreEl.textContent = player.score;
    }

    // Highlight current player
    const card = document.getElementById(`playerCard${currentPlayer}`);
    if (card) {
        card.classList.add('active-player');
    }

    // Update CPU indicator
    updateCPUIndicator();
}

function updateCPUIndicator(){
    const indicator = document.getElementById('cpuIndicator');
    if (!indicator || !Players || !Players.players) return;

    const numPlayers = Players.players.length;
    const currentPlayer = Game.player % numPlayers;
    const player = Players.players[currentPlayer];

    if (player && player.name === 'CPU') {
        indicator.textContent = "🎯 CPU's Turn";
        indicator.classList.add('active');
    } else {
        indicator.textContent = "🎲 Player 1's Turn";
        indicator.classList.remove('active');
    }
}

function knock(){

    if (!hasStraight(Game.rollDice)) return;

    showNotification(`STRAIGHT! Player knocks for ${Rules.straightValue} points!`, 'success');

    Game.turnScore += Rules.straightValue;

    updateTurnScore();

    // Hide knock button after use - will be reset on next roll
    const knockBtn = document.getElementById('knock');
    if (knockBtn) {
        knockBtn.style.display = 'none';
    }

}


function bankPoints(){
    const settingsObj = getSettings();

    // Check for new leader before banking in endgame (only if chase is active)
    if (window.endgameChaseActive && window.endgameLeaderIndex !== -1 &&
        (!settingsObj || settingsObj.enableEndgameChase !== false)) {
        window.checkForNewLeader();
    }

    // Handle inheritance mechanic from README:
    // When a player banks their score the next player inherits the remaining dice and the banked score.
    if (settingsObj && settingsObj.enableInheritance) {
        handleInheritance();
    }

    // Add turn score to current player's total:
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;

    if (Players && Players.players[currentPlayer]) {
        Players.players[currentPlayer].score += Game.turnScore;
        Players.players[currentPlayer].totalScore += Game.turnScore;
        Players.players[currentPlayer].turnCount++;

        // Update total score display immediately
        const totalScoreEl = document.getElementById(`playerTotalScore${currentPlayer}`);
        if (totalScoreEl) {
            totalScoreEl.textContent = Players.players[currentPlayer].totalScore;
        }
    }

    showNotification(`Banked ${Game.turnScore} points!`, 'success');

    // Check win condition after banking (only if endgame chase is enabled)
    const targetScore = (settingsObj && settingsObj.targetScore) ? settingsObj.targetScore : 10000;
    if (settingsObj && settingsObj.enableEndgameChase === false) {
        // Instant win - no chase needed
        if (Players.players[currentPlayer].totalScore >= targetScore) {
            showGameOverModal(Players.players[currentPlayer]);
            return;
        }
    } else {
        // Endgame chase enabled
        if (Players.players[currentPlayer].totalScore >= targetScore) {
            // Player reached target - trigger endgame chase
            if (window.startEndgameChase) {
                window.startEndgameChase(currentPlayer);
            }
            return;
        }
    }


    Game.keptDice=[];
    Game.rollDice=[];
    Game.selected=[];
    Game.hotDiceBonus = 0;
    Game.turnScore=0;

    updateTurnScore();

    // Update player displays
    if (window.updatePlayerScores) {
        updatePlayerScores();
    }


    nextPlayer();

}



// Available inheritance pool - stores banked scores available for each player to inherit
Game.inheritancePool = {}; // { playerIndex: { points: number, fromPlayer: number } }

function handleInheritance() {
    const settingsObj = getSettings();
    // Inheritance is always enabled in this implementation per README
    if (!settingsObj || !settingsObj.enableInheritance) {
        console.log('❌ Inheritance disabled in settings');
        return;
    }

    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;
    const nextPlayerIdx = (currentPlayer + 1) % numPlayers;

    console.log('=== handleInheritance() ===');
    console.log('Game.player before modulo:', Game.player);
    console.log('numPlayers:', numPlayers);
    console.log('currentPlayer (who just banked):', currentPlayer, '-', Players?.players?.[currentPlayer]?.name);
    console.log('nextPlayerIdx (who inherits):', nextPlayerIdx, '-', Players?.players?.[nextPlayerIdx]?.name);
    console.log('keptDice count:', Game.keptDice.length);

    // Store available inheritance for the next player
    // Include remaining dice count: numDice - keptDice
    if (!Game.inheritancePool) Game.inheritancePool = {};
    const remainingDice = Game.numDice - Game.keptDice.length;
    Game.inheritancePool[nextPlayerIdx] = {
        points: Game.turnScore,
        fromPlayer: currentPlayer,
        remainingDice: remainingDice  // how many dice the next player rolls with
    };

    console.log('✅ Inheritance stored for player', nextPlayerIdx, ':', JSON.stringify(Game.inheritancePool));
    showNotification(`🔄 ${Players.players[nextPlayerIdx]?.name || 'Next Player'} can inherit ${Game.turnScore} points + ${remainingDice} dice!`, 'info');
}

// Check if current player has inheritance available and let them decide
function askInheritanceDecision() {
    const numPlayers = Players && Players.players ? Players.players.length : 2;

    console.log('=== nextPlayer() - checking inheritance ===');
    console.log('Game.player:', Game.player);
    console.log('numPlayers:', numPlayers);

    // Calculate current player the same way nextPlayer does
    const currentPlayer = Game.player % numPlayers;

    console.log('=== askInheritanceDecision ===');
    console.log('currentPlayer (Game.player % numPlayers):', currentPlayer);
    console.log('Players.players[currentPlayer]?.name:', Players?.players?.[currentPlayer]?.name);
    console.log('Players.players[currentPlayer]?.isHuman:', Players?.players?.[currentPlayer]?.isHuman);
    console.log('Game.inheritancePool:', JSON.stringify(Game.inheritancePool));

    // Check if this player has inheritance available
    if (!Game.inheritancePool || !Game.inheritancePool[currentPlayer] || Game.inheritancePool[currentPlayer].points <= 0) {
        console.log('❌ No inheritance available for currentPlayer', currentPlayer);
        return false; // No inheritance available
    }

    const inherited = Game.inheritancePool[currentPlayer];
    const playerName = Players.players[currentPlayer]?.name || 'Player';

    showNotification(`${playerName}, you can inherit ${inherited.points} points from ${Players.players[inherited.fromPlayer].name}!`, 'warning');

    // Show inheritance UI for player decision (only for human players using isHuman flag)
    if (Players && Players.players[currentPlayer] && Players.players[currentPlayer].isHuman) {
        // Show the inheritance buttons and wait for user decision
        if (window.showInheritanceUI) {
            window.showInheritanceUI();
        }

        // Disable roll button until player makes a decision
        const rollBtn = document.getElementById('roll');
        if (rollBtn) {
            rollBtn.disabled = true;
            rollBtn.style.opacity = '0.5';
        }

        return 'waiting'; // Return special value indicating we're waiting for UI decision
    } else if (Players && Players.players[currentPlayer] && !Players.players[currentPlayer].isHuman) {
        // CPU makes intelligent decision about inheritance based on risk/reward analysis
        const cpuAccepts = cpuDecideInheritance(inherited.points);

        if (cpuAccepts) {
            if (Players && Players.players[currentPlayer]) {
                Players.players[currentPlayer].score += inherited.points;
                Players.players[currentPlayer].totalScore += inherited.points;
                Players.players[currentPlayer].inheritedPoints = inherited.points;

                showNotification(`${playerName} accepts ${inherited.points} inherited points!`, 'success');
            }

            Game.isInheritedTurn = true;
            Game.inheritedPoints = inherited.points;

            delete Game.inheritancePool[currentPlayer];

            return true;
        } else {
            showNotification(`${playerName} declines inheritance - risk too high!`, 'info');
        }
    }

    // Clear inheritance pool for this player (either declined or no decision needed)
    if (Game.inheritancePool && Game.inheritancePool[currentPlayer]) {
        delete Game.inheritancePool[currentPlayer];
    }

    return false;
}

// CPU decides whether to accept inheritance based on risk/reward analysis
function cpuDecideInheritance(inheritedPoints) {
    // Get AI difficulty for risk tolerance
    const settings = window.getSettings ? window.getSettings() : (window.__settings || {});
    const difficulty = settings?.aiDifficulty || 'safe';

    // Calculate probability of scoring with 6 dice on first roll
    // With 6 dice, very high chance of getting at least some scoring dice
    const firstRollSuccessChance = 0.95; // ~95% chance to get scoring dice with 6 dice

    // Expected score from a single roll with 6 dice (average)
    const expectedFirstRollScore = 150; // Average scoring combination

    // Expected value of accepting inheritance vs risk of losing it
    // Risk: probability of bust * inherited points lost
    // Reward: expected score gain from having more dice to work with

    const riskOfBust = 0.05; // 5% chance of immediate bust with 6 dice
    const expectedGain = expectedFirstRollScore * firstRollSuccessChance;

    // Calculate decision threshold based on difficulty
    let riskTolerance;
    if (difficulty === 'safe') {
        // Safe AI: only accept if inheritance is substantial relative to risk
        riskTolerance = 0.3; // Need at least 300 points inherited to justify 5% bust risk
    } else {
        // Gambler AI: more willing to take risks
        riskTolerance = 0.15; // Willing to accept even smaller inheritances
    }

    const expectedLoss = riskOfBust * inheritedPoints;
    const netExpectedValue = expectedGain - expectedLoss;

    // Decision logic based on inheritance amount and difficulty
    if (inheritedPoints >= 1000) {
        // Large inheritance - always worth trying to keep
        return true;
    } else if (inheritedPoints >= 500) {
        // Medium inheritance - accept unless very conservative AI
        return difficulty !== 'safe' || Math.random() > 0.3;
    } else if (inheritedPoints >= 200) {
        // Small inheritance - only accept if gambler or lucky roll
        return difficulty === 'gambler' && Math.random() > 0.4;
    } else {
        // Very small inheritance - not worth the risk
        return false;
    }
}

// Get the number of dice remaining for re-roll (dice that were NOT kept by previous player)
function getInheritedDice() {
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;

    // If this player has inheritance, they can only roll the remaining dice (not the ones kept by previous player)
    if (Game.inheritancePool && Game.inheritancePool[currentPlayer] && Game.inheritancePool[currentPlayer].points > 0) {
        // Return a fresh set of dice equal to numDice - the "kept" dice from previous turn
        // For simplicity, give all dice but mark them as inherited
        return null; // null means use all dice
    }

    return null;
}

function bust(){
    // Preserve hot dice bonus when busting after a hot dice roll
    const hadHotDice = Game.rollDice.length === 0 && Game.keptDice.length === 0;

    // Handle inheritance on bust - if player was inheriting, they lose the inherited points (temporary, only for this turn)
    {
        const numPlayers = Players && Players.players ? Players.players.length : 2;
        const currentPlayer = Game.player % numPlayers;

        if (Players && Players.players[currentPlayer]) {
            const inherited = Players.players[currentPlayer].inheritedPoints || 0;
            if (inherited > 0) {
                showNotification(`💥 ${Players.players[currentPlayer].name} busted! Lost ${inherited} inherited points!`, 'error');
                // Remove the temporary inherited points from turn score
                Players.players[currentPlayer].score -= inherited;
                Players.players[currentPlayer].inheritedPoints = 0;

                // Update turn score display
                const turnScoreEl = document.getElementById(`playerTurnScore${currentPlayer}`);
                if (turnScoreEl) {
                    turnScoreEl.textContent = Players.players[currentPlayer].score;
                }
            }
        }
    }

    showNotification(`Bust! Lost ${Game.turnScore} points!`, 'error');

    // Mark busted for current player - turn score is lost
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const currentPlayer = Game.player % numPlayers;

    if (Game.busted) {
        Game.busted[currentPlayer] = true;
    }

    // Reset turn score since it was lost
    if (Players && Players.players[currentPlayer]) {
        Players.players[currentPlayer].score = 0;
    }


    nextPlayer();

}



function nextPlayer(){
    Game.player++;

    // Reset busted for the new player
    const numPlayers = Players && Players.players ? Players.players.length : 2;
    const newPlayer = Game.player % numPlayers;

    if (Game.busted) {
        Game.busted[newPlayer] = false;
    }

    // Reset player turn scores when switching players
    if (Players && Players.players[newPlayer]) {
        Players.players[newPlayer].score = 0;
        Players.players[newPlayer].inheritedPoints = 0;
    }

    Game.selected=[];
    Game.hotDiceBonus = 0;
    Game.turnScore=0;

    // Check if this player has inheritance available BEFORE clearing kept dice
    const hasInheritance = !(!Game.inheritancePool || !Game.inheritancePool[newPlayer] || Game.inheritancePool[newPlayer].points <= 0);

    // Store previous player's kept dice for display during inheritance decision
    let prevKeptDice = [...Game.keptDice];

    if (!hasInheritance) {
        // No inheritance - clear and generate fresh dice
        Game.keptDice=[];
        Game.rollDice=[];

        updateTurnScore();

        // Update player displays
        if (window.updatePlayerScores) {
            updatePlayerScores();
        }

        // Update active player visual highlight
        if (window.updateActivePlayerDisplay) {
            window.updateActivePlayerDisplay();
        }

        startRoll();
    } else {
        // Has inheritance - show previous player's kept dice and ask decision
        // Keep prevKeptDice visible so human can see what was banked

        updateTurnScore();

        // Update player displays
        if (window.updatePlayerScores) {
            updatePlayerScores();
        }

        // Update active player visual highlight
        if (window.updateActivePlayerDisplay) {
            window.updateActivePlayerDisplay();
        }

        // Render the previous player's kept dice while waiting for inheritance decision
        renderDice();

        // Check inheritance and generate dice after decision
        const inheritDecision = askInheritanceDecision();

        // If waiting for UI decision, don't call startRoll yet - wait for user to click accept/decline
        if (inheritDecision === 'waiting') {
            return;
        }

        if (inheritDecision) {
            Game.isInheritedTurn = true;
        } else {
            Game.isInheritedTurn = false;
        }

        startRoll();
    }
}

// Helper function to generate initial dice for a new turn
function generateInitialDice() {
    Game.rollDice = [];
    for (let i = 0; i < Game.numDice; i++) {
        Game.rollDice.push(randomDie());
    }
}

// Render dice display
function renderDice() {
    const diceContainer = document.getElementById('dice');
    if (!diceContainer) return;

    diceContainer.innerHTML = '';

    // Track which dice are new (need animation) - reset on each roll
    let isNewRoll = Game.rollDice && Game.rollDice.length > 0 && !Game._lastRollLength;
    Game._lastRollLength = Game.rollDice ? Game.rollDice.length : 0;

    // Show kept/locked dice section (if any)
    if (Game.keptDice && Game.keptDice.length > 0) {
        const keptSection = document.createElement('div');
        keptSection.className = 'dice-section kept-dice';

        // Add section label
        const label = document.createElement('div');
        label.className = 'section-label';
        label.textContent = '🔒 Kept Dice';
        keptSection.appendChild(label);

        Game.keptDice.forEach((value, index) => {
            const extraClass = 'die-kept';
            // Add bounce animation to kept dice on roll change
            let animClass = '';
            if (isNewRoll && index === 0) {
                animClass = 'animate-bounce';
            }
            const die = createDieElement(value, [extraClass, animClass].filter(Boolean).join(' ').trim());
            keptSection.appendChild(die);
        });

        diceContainer.appendChild(keptSection);
    }

    // Show rollable dice section (if any)
    if (Game.rollDice && Game.rollDice.length > 0) {
        const rollSection = document.createElement('div');
        rollSection.className = 'dice-section roll-dice';

        // Add section label
        const label = document.createElement('div');
        label.className = 'section-label';
        label.textContent = '🎲 Roll Dice (' + Game.rollDice.length + ')';
        rollSection.appendChild(label);

        Game.rollDice.forEach((value, index) => {
            const isSelected = Game.selected && Game.selected.includes(index);
            // Add roll animation to new dice with staggered delay per die position
            let extraClass = isSelected ? 'die-selected' : '';
            if (isNewRoll) {
                extraClass += ' animate-roll';
            }
            const die = createDieElement(value, extraClass.trim());
            die.setAttribute('data-index', index);
            die.style.pointerEvents = 'auto';
            die.style.cursor = 'pointer';

            // Use a closure to capture the correct index value
            (function(dieIdx) {
                die.onclick = function(e) {
                    if (e && e.preventDefault) {
                        e.preventDefault();
                    }
                    console.log('Die clicked, index:', dieIdx, 'rollDice length:', Game.rollDice.length);
                    keepDie(dieIdx);
                };
            })(index);

            rollSection.appendChild(die);
        });

        diceContainer.appendChild(rollSection);
    }

    // Show/hide knock button if straight is possible
    const knockBtn = document.getElementById('knock');
    if (knockBtn) {
        if (Game.rollDice && Game.rollDice.length === 6 && hasStraight(Game.rollDice)) {
            knockBtn.style.display = 'inline-block';
        } else {
            knockBtn.style.display = 'none';
        }
    }

    // Update current player display
    updateCurrentPlayerDisplay();
}

function createDieElement(value, extraClass) {
    const die = document.createElement('div');
    die.className = `die ${extraClass}`.trim();

    // Use Unicode dice faces
    const faces = ['', '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];
    die.textContent = faces[value] || '?';
    die.dataset.value = value;

    return die;
}

// Export functions for use by other modules and UI integration
window.renderDice = renderDice;
window.startRoll = startRoll;
window.bankPoints = bankPoints;
window.bust = bust;
window.nextPlayer = nextPlayer;
window.keepDie = keepDie;
window.updateTurnScore = updateTurnScore;
window.knock = knock;
