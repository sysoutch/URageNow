# Memory Bank - Dice 5 Game

## Project Overview
A browser-based dice game inspired by Farkle with regional mechanics including hot dice, turn inheritance (manual decision), endgame chase, and CPU AI. Pure HTML/CSS/JavaScript — no frameworks or dependencies.

## File Structure
```
├── index.html          # Main HTML file
├── README.md           # Game rules and documentation
├── MEMORY.md           # Development history and changelog (this file)
├── css/
│   ├── base.css        # Variables, reset, base styles, modals
│   ├── components.css  # Dice, buttons, player cards, UI components
│   └── layout.css      # Table layout, positioning, responsive
└── js/
    ├── ai.js           # CPU AI logic and decision-making
    ├── game.js         # Core game mechanics (roll, bank, bust)
    ├── rules.js        # Global rule constants
    ├── scoring.js      # Score calculation & dice grouping
    └── ui.js           # UI rendering & settings management
```

---

## COMPLETED WORK ✅

### Bug Fixes

| Issue | Status | Fix |
|-------|--------|-----|
| Redeclaration of `const singles` in ai.js | ✅ Fixed | Removed duplicate, used local `_findLocalGroups()` function |
| `initAI is not a function` error | ✅ Fixed | Exported `initAI` to window scope + called it in DOMContentLoaded |
| `renderDice is not defined` error | ✅ Fixed | Added complete `renderDice()` and `createDieElement()` functions with export |
| `Game.settings is undefined` error | ✅ Fixed | All settings access uses `getSettings()` with safe optional chaining |
| Duplicate player cards rendering | ✅ Fixed | Added `container.innerHTML = ''` at start of renderPlayers() |
| Player cards not visually unselected on turn change | ✅ Fixed | Created `updateActivePlayer()` function that manages `.active-player` class |
| Game object missing properties | ✅ Fixed | Added `scores`, `finalScores`, `busted`, `numDice` to Game object |
| startRoll() crashed on first turn | ✅ Fixed | Added check for empty rollDice to generate initial dice |
| initAI() never called - CPU not playing | ✅ Fixed | Added `window.initAI()` call in ui.js DOMContentLoaded handler |

### Features Implemented

1. **Endgame Chase Mechanic**
   - When a player reaches target score, chase begins
   - Each other player gets one turn to overtake
   - Leader tracking with dynamic updates
   - Highest score wins after all chase turns complete

2. **Real-time Score Sync**
   - Player cards show individual turn scores and total scores
   - Scores update in real-time as player keeps dice
   - `updateCurrentPlayerDisplay()` syncs UI with game state

3. **Enhanced Dice UI**
   - 90px dice with Unicode faces (⚀⚁⚂⚃⚄⚅)
   - Visual sections for "Kept Dice" and "Roll Dice"
   - Selected dice highlighted, kept dice locked visually
   - CSS animations on roll

4. **CPU Turn Automation**
   - AI plays automatically with natural delays (configurable 2-8s default)
   - Smart decision-making based on difficulty (safe vs gambler)
   - Game state synced during CPU turns so UI shows exactly what CPU is doing
   - Notifications for each CPU action

5. **Hot Dice Bonus System**
   - When all 6 dice are kept, bonus awarded and all dice roll again
   - `Game.hotDiceBonus` preserves score after hot dice reset
   - Scoring: 4+ 1's gives +1000 per additional 1 (e.g., 4 ones = 2000 points)

6. **Knock Button Straight Detection**
   - Shows when player has a straight and can knock for bonus points
   - Hidden after use, resets on next roll

7. **Manual Inheritance System**
   - Player decides whether to accept or decline inheritance when offered
   - Accept: gain inherited points + play with remaining dice from previous player
   - Decline: start fresh with 0 points and all 6 dice
   - Bust after accepting: lose the inherited points
   - CPU auto-decides based on risk/reward analysis

8. **Dynamic Player Positioning (Poker-style Layout)**
   - Players positioned around table edges using absolute positioning
   - CSS classes for different positions (left, right, bottom)
   - Dynamic position assignment based on player count

9. **Dark Mode Theme**
   - Toggle between dark/light themes
   - Preference saved in localStorage as 'dice5-darkMode'
   - Default to dark mode on first visit

10. **Configurable Settings**
    - Winning score, number of dice, CPU count/difficulty
    - Enable/disable inheritance, hot dice, endgame chase
    - Straight value, four/five/six of a kind scoring mode
    - CPU thinking delays (min/max for normal and knock decisions)

### CSS Refactoring

| File | Contents |
|------|----------|
| `css/base.css` | CSS variables, reset, base styles, modal overlays |
| `css/components.css` | Dice styling, buttons, player cards, notifications, score displays |
| `css/layout.css` | Game wrapper, table layout, player positioning, responsive breakpoints |

---

## ARCHITECTURE OVERVIEW

### Global Objects

| Object | Purpose | Key Properties |
|--------|---------|----------------|
| `Game` | Core game state | `keptDice`, `rollDice`, `selected`, `turnScore`, `player`, `scores`, `busted`, `numDice`, `hotDiceBonus`, `inheritancePool`, `isInheritedTurn`, `inheritedPoints`, `settings` |
| `Players` | UI player management | `players[]` (with name, score, totalScore, turnCount, inheritedPoints, isHuman), `currentPlayerIndex` |
| `AICPU` | AI state and behavior | `difficulty`, `enabled`, `keptDice`, `aiDice`, `cpuTurnScore`, `decisionCount`, `bankThresholds` |
| `Rules` | Game constants | `winningScore`, `hotDice`, `straightValue`, `kindMode`, `inherit` |

### Function Flow

```
startRoll() → renderDice() → createDieElement()
keepDie(index) → updateTurnScore() → renderDice()
bankPoints() → handleInheritance() → nextPlayer() → askInheritanceDecision() → startRoll()
bust() → nextPlayer() → askInheritanceDecision() → startRoll()

renderPlayers() ← getSettings()
initUI() → renderPlayers() → renderDice()
updateActivePlayer() - manages .active-player class on player cards
```

### Script Loading Order (IMPORTANT)
1. rules.js (defines Rules object)
2. scoring.js (defines findGroups, getScore, hasPossibleScore, hasStraight)
3. game.js (defines Game object, startRoll, keepDie, bankPoints, bust, nextPlayer, renderDice)
4. ui.js (defines Players, initUI, renderPlayers, getSettings, etc.)
5. ai.js (defines AICPU, initAI, cpuTurn, etc.)

---

## KNOWN ISSUES & EDGE CASES

1. **Hot dice**: When all 6 dice are kept and bonus triggers, the player gets a fresh roll — correct per rules but can feel like the turn never ends if they keep getting hot dice repeatedly.
2. **Inheritance only shown to human players**: CPU auto-decides based on difficulty settings.
3. **Turn score display shows inherited points as part of turn total** when inheritance is accepted.
4. **Multiple CPUs in hotseat mode**: Not supported — hotseat mode only works with 2 human players.

---

## NEXT USEFUL STEPS / FUTURE ENHANCEMENTS

### High Priority
1. **Game Statistics Tracking** — Track wins/losses, longest turn, highest single turn for player analytics
2. **Sound Effects** — Add dice roll sounds, scoring chimes, bust alerts for enhanced feedback
3. **Dice Roll Animation** — CSS animation showing dice spinning before landing

### Medium Priority
4. **Mobile Touch Support** — Ensure tap targets are large enough, add haptic feedback options
5. **Keyboard Accessibility** — Full keyboard navigation for roll, bank, keep dice actions
6. **Game History Log** — Show a scrollable log of all turns with scores and decisions

### Lower Priority
7. **Online Multiplayer** — WebSocket-based game hosting for remote play
8. **Custom Theme Support** — Allow users to create and save custom color themes
9. **Export/Import Settings** — JSON export of settings for sharing between players
10. **Tutorial Mode** — Interactive tutorial explaining rules for new players

---

## CHANGELOG

### 2026-07-15/16 — Major Bug Fix & Feature Completion Session

#### Bugs Fixed
- Fixed `const singles` redeclaration in ai.js (line 24, 30)
- Fixed `initAI is not a function` by exporting to window scope and calling it
- Fixed `renderDice is not defined` by adding complete implementation
- Fixed `Game.settings is undefined` by using getSettings() pattern throughout
- Fixed CPU players not playing — initAI() was never called, AICPU.enabled stayed false

#### Features Added
- Dynamic player positioning around table (poker-style layout) with CSS classes for left/right/bottom positions
- Inheritance remaining dice count stored and used correctly
- startRoll() now uses inherited dice count for both human and CPU players
- isHuman flag added to player objects for reliable human vs CPU detection

#### CSS Refactoring
- Split single css/style.css into three files: base.css, components.css, layout.css
- Moved all inline styles from HTML to CSS classes
- Added responsive breakpoints for 1200px and 768px viewports

#### Documentation
- Updated README.md with complete game rules, features, file structure, controls guide
- Updated MEMORY.md with comprehensive development history and architecture notes