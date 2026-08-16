# Dice 5 / Sand

A browser implementation of the regional dice game often known as "5", "1" or "Sand".

The game is inspired by Farkle but contains several unique mechanics including hot dice, turn inheritance, endgame chase, and CPU AI.

## Features

- 🎲 Beautiful animated interface with Unicode dice faces
- 👥 Local multiplayer (2-6 players)
- 🤖 CPU opponents with adjustable difficulty (Safe/Gambler)
- ⚙️ Configurable rules via settings modal
- 🔥 Hot dice - roll again when all dice are scored
- 🔄 Turn inheritance - inherit points and remaining dice from previous player
- 🏆 Endgame chase - players get additional turns to overtake the leader
- 🌙 Dark mode theme with localStorage persistence

---

# Default Rules

## Dice

6 dice

## Scoring

Single 1 = 100

Single 5 = 50

Three of a kind

| Combination | Points |
|-------------|--------|
| 111         | 1000   |
| 222         | 200    |
| 333         | 300    |
| 444         | 400    |
| 555         | 500    |
| 666         | 600    |

Four/Five/Six of a kind - Configurable

**Option A (default)** — Each additional die adds another three-of-a-kind score.

```
4444   = 800
44444  = 1200
444444 = 1600
```

**Option B** — Each additional die doubles the score.

```
444    = 400
4444   = 800
44444  = 1600
444444 = 3200
```

Straight (1-6) = 1000 (configurable)

---

## Turn

1. Roll all dice.
2. A scoring combination must be kept.
3. Remaining dice may be rolled again.
4. The player may stop at any time and bank their points.
5. If no scoring dice are rolled the player busts and loses all unbanked points.

---

## Hot Dice

When every die has been scored all six dice become available again for another roll with bonus points.

---

## Inheritance

When a player banks their score:
1. The banked amount becomes available as inheritance for the next player.
2. The next player can **accept** (gain the inherited points and play with remaining dice) or **decline** (start fresh).
3. If they accept and later bust, they lose the inherited points.

---

## Endgame Chase

Winning score defaults to 10000.

When a player reaches the target:
1. They do NOT win immediately — endgame chase begins.
2. Each following player receives one turn to try to overtake.
3. If a player exceeds the leader they become the new leader.
4. When all players have had their chance, the highest score wins.

---

## Options

- Winning score (default: 10000)
- Human / CPU players (2-6 total)
- Number of CPUs (1-5)
- CPU difficulty (Safe / Gambler)
- Four/Five/Six of a kind scoring mode
- Enable inheritance toggle
- Enable hot dice toggle
- Enable endgame chase toggle
- Straight value
- CPU thinking delays

---

## File Structure

```
├── index.html          # Main HTML file
├── README.md           # Game rules and documentation
├── MEMORY.md           # Development history and changelog
├── css/
│   ├── base.css        # Variables, reset, base styles
│   ├── components.css  # Dice, buttons, player cards, modals
│   └── layout.css      # Table layout, positioning, responsive
└── js/
    ├── ai.js           # CPU AI logic and decision-making
    ├── game.js         # Core game mechanics (roll, bank, bust)
    ├── rules.js        # Global rule constants
    ├── scoring.js      # Score calculation & dice grouping
    └── ui.js           # UI rendering & settings management
```

---

## Controls

| Button | Action |
|--------|--------|
| **Roll** | Roll available dice |
| **Bank** | Bank turn score and pass to next player |
| **Knock!** | Score a straight (1-6) for bonus points |
| **Accept/Decline** | Decide on inheritance when offered |
| **⚙️ Settings** | Open settings modal |
| **🌙 Dark Mode** | Toggle theme |

---

## How to Play

1. Click **Roll** to start your turn.
2. Click on scoring dice (1s and 5s, or triples) to keep them.
3. Click **Roll** again with remaining dice to improve your score.
4. Click **Bank** when you're happy with your points.
5. First player to reach the target score (with endgame chase) wins!

---

## Technical Details

- Pure HTML/CSS/JavaScript — no frameworks or dependencies
- Settings persisted in localStorage
- Modular JavaScript architecture (Game, Players, AICPU, Rules objects)
- Responsive design with poker-style table layout