# HTML5 Billiards

A browser-based billiards game designed to start as a **local, single-player game against bots**, while keeping the architecture ready for **local multiplayer, LAN multiplayer, and eventually online multiplayer**.

The core principle is:

> **Keep the game simulation deterministic and independent from rendering, input, UI, and networking.**

That makes bots, replays, multiplayer synchronization, and testing substantially easier later.

---

## 1. Goals

### Initial release

* HTML5 browser game
* Mouse and touch controls
* One player vs AI
* Smooth 60 FPS rendering
* Realistic 2D billiards physics
* At least one complete ruleset, preferably 8-ball
* Configurable AI difficulty
* Local game state only
* No backend required

### Future releases

* Two players on the same machine
* LAN multiplayer
* Online multiplayer
* Private rooms
* Matchmaking
* Spectator mode
* Replays
* Game statistics
* Multiple table/rule variants
* Optional ranked play

### Non-goals initially

Do not start with:

* Accounts
* Matchmaking servers
* WebSockets
* Persistent player databases
* Complex 3D graphics
* Server-authoritative infrastructure
* Huge collection of game modes

Build the simulation first.

---

# 2. Recommended Architecture

Use a layered architecture:

```text
┌───────────────────────────────────────────┐
│                  UI Layer                 │
│ menus / HUD / settings / matchmaking     │
└─────────────────────┬─────────────────────┘
                      │
┌─────────────────────▼─────────────────────┐
│               Game Controller              │
│ input → commands → simulation → events    │
└─────────────────────┬─────────────────────┘
                      │
┌─────────────────────▼─────────────────────┐
│                 Simulation                 │
│ physics + rules + turns + game state      │
└───────────────┬───────────────────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
   AI Player          Network
   later              later
       │                 │
       └────────┬────────┘
                ▼
        deterministic commands
```

Rendering should never directly modify the simulation.

Input should also never directly mutate balls.

Instead:

```text
Mouse drag
   ↓
Aim command
   ↓
Game simulation
   ↓
Shot
   ↓
Physics
   ↓
Rule evaluation
   ↓
Game events
   ↓
Renderer/UI
```

---

# 3. Technology

Keep the initial stack deliberately small.

Recommended:

* TypeScript
* HTML5 Canvas 2D
* CSS
* Vite
* Vitest or equivalent test runner

No game engine is required.

A possible project structure:

```text
billiards/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
│
├── src/
│   ├── main.ts
│   │
│   ├── game/
│   │   ├── Game.ts
│   │   ├── GameState.ts
│   │   ├── GameConfig.ts
│   │   ├── GameCommand.ts
│   │   └── GameEvent.ts
│   │
│   ├── physics/
│   │   ├── Vec2.ts
│   │   ├── Ball.ts
│   │   ├── PhysicsWorld.ts
│   │   ├── Collision.ts
│   │   ├── BallBallCollision.ts
│   │   ├── BallTableCollision.ts
│   │   └── PocketDetection.ts
│   │
│   ├── rules/
│   │   ├── Ruleset.ts
│   │   ├── EightBallRules.ts
│   │   └── TurnManager.ts
│   │
│   ├── ai/
│   │   ├── Bot.ts
│   │   ├── RandomBot.ts
│   │   ├── BasicBot.ts
│   │   └── StrategicBot.ts
│   │
│   ├── input/
│   │   ├── InputController.ts
│   │   └── AimController.ts
│   │
│   ├── rendering/
│   │   ├── Renderer.ts
│   │   ├── TableRenderer.ts
│   │   ├── BallRenderer.ts
│   │   └── HudRenderer.ts
│   │
│   ├── audio/
│   │   └── AudioManager.ts
│   │
│   └── ui/
│       ├── Menu.ts
│       └── GameUi.ts
│
└── tests/
    ├── physics/
    ├── rules/
    ├── ai/
    └── game/
```

The important architectural boundary is:

```text
game/
physics/
rules/
ai/
```

should not depend on Canvas, DOM, or browser rendering APIs.

---

# 4. Coordinate System

Use a physics coordinate system independent of pixels.

For example:

```text
Table:
width  = 2.24
height = 1.12
```

This corresponds approximately to a standard 2:1 playing surface.

Balls can have:

```text
radius = 0.0286
```

Rendering then converts world coordinates into screen coordinates.

```ts
screenX = worldX * scale + offsetX;
screenY = worldY * scale + offsetY;
```

This makes physics independent of window resolution.

Do not make the physics engine operate directly in CSS pixels.

---

# 5. Core Game State

The complete game should be representable as serializable data.

Example:

```ts
interface GameState {
  version: number;

  phase:
    | "setup"
    | "aiming"
    | "shooting"
    | "settling"
    | "game-over";

  players: PlayerState[];

  currentPlayer: number;

  balls: BallState[];

  table: TableState;

  rules: RulesState;

  shot: ShotState | null;

  turn: TurnState;

  winner: number | null;
}
```

Ball state:

```ts
interface BallState {
  id: number;
  type: "cue" | "solid" | "stripe" | "eight";
  position: Vec2;
  velocity: Vec2;
  radius: number;
  pocketed: boolean;
}
```

Avoid putting UI state into `GameState`.

For example, this belongs outside the simulation:

```ts
crosshairVisible
menuOpen
volume
showPowerMeter
```

---

# 6. Commands and Events

A useful distinction is:

### Commands

Things that request a change.

```ts
type GameCommand =
  | {
      type: "AIM";
      angle: number;
    }
  | {
      type: "SET_POWER";
      power: number;
    }
  | {
      type: "SHOOT";
    }
  | {
      type: "RESTART";
    };
```

### Events

Things that happened.

```ts
type GameEvent =
  | { type: "SHOT_STARTED" }
  | { type: "BALL_POCKETED"; ballId: number }
  | { type: "FOUL"; reason: string }
  | { type: "SHOT_FINISHED" }
  | { type: "TURN_CHANGED"; player: number }
  | { type: "GAME_OVER"; winner: number };
```

This separation becomes extremely valuable for:

* audio
* animations
* UI
* replays
* debugging
* networking

---

# 7. Game Loop

Use a fixed timestep for physics.

Do not make physics depend directly on the browser's frame rate.

Conceptually:

```ts
const FIXED_DT = 1 / 120;

function frame(timestamp: number) {
  accumulator += timestamp - previousTimestamp;
  previousTimestamp = timestamp;

  while (accumulator >= FIXED_DT) {
    game.update(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  renderer.render(game.state);

  requestAnimationFrame(frame);
}
```

A physics rate of **120 Hz** is a good starting point.

Rendering can remain at approximately 60 FPS or whatever the display supports.

---

# 8. Physics

The physics system is the most important part of the project.

Implement it independently and test it heavily.

## 8.1 Ball movement

Basic integration:

```text
position += velocity * dt
```

Velocity should gradually decrease because of table friction.

A simple model:

```text
speed = length(velocity)

if speed > 0:
    velocity *= frictionFactor
```

A better implementation uses a physically meaningful deceleration:

```text
velocity -= normalize(velocity) * rollingResistance * dt
```

Clamp very small velocities to zero:

```ts
if (velocity.length() < STOP_THRESHOLD) {
  velocity.set(0, 0);
}
```

This prevents balls from spending excessive time moving at microscopic speeds.

---

# 9. Ball-Ball Collisions

For two balls:

```text
delta = B.position - A.position
distance = length(delta)
```

Collision occurs when:

```text
distance < A.radius + B.radius
```

Calculate collision normal:

```text
normal = normalize(delta)
```

Resolve overlap first:

```text
overlap = radiusSum - distance

A.position -= normal * overlap / 2
B.position += normal * overlap / 2
```

Then resolve velocity along the collision normal.

For equal masses, the normal components can be exchanged.

A general impulse implementation is preferable because it allows:

* different ball masses later
* configurable restitution
* more realistic collision behavior

Use a restitution coefficient rather than assuming perfectly elastic collisions.

---

# 10. Ball-Table Collisions

The playing surface consists of boundaries.

For each ball:

```text
x - radius >= left
x + radius <= right
y - radius >= top
y + radius <= bottom
```

When a ball hits a cushion, reflect its velocity around the cushion normal.

Conceptually:

```text
v' = v - 2(v · n)n
```

Then multiply the reflected component by cushion restitution.

The actual table should not simply be a rectangle, however.

Pockets create openings in the cushion.

Therefore the collision system should eventually model the table as:

```text
Table
 ├── playing surface
 ├── cushion segments
 └── pockets
```

rather than one giant rectangle.

---

# 11. Pockets

Represent pockets explicitly:

```ts
interface Pocket {
  id: number;
  position: Vec2;
  radius: number;
}
```

After movement/collision resolution:

```text
for each ball:
    for each pocket:
        if distance(ball, pocket) < pocket.captureRadius:
            pocketBall(ball)
```

Once pocketed:

```ts
ball.pocketed = true;
ball.velocity = Vec2.zero();
```

Remove it from normal physics while keeping it in game state.

This is important because rules need to know which balls were pocketed during the current shot.

---

# 12. Ball Settling

A shot should not finish immediately when the cue ball stops.

All balls need to stop.

Define:

```ts
function allBallsStopped(): boolean
```

A ball is stopped when:

```text
speed < STOP_THRESHOLD
```

The game transitions:

```text
AIMING
   ↓
SHOOTING
   ↓
SETTLING
   ↓
RULE EVALUATION
   ↓
NEXT TURN / GAME OVER
```

This creates a clean boundary between physics and rules.

---

# 13. Shot Model

A shot should be represented explicitly.

```ts
interface Shot {
  playerId: number;
  angle: number;
  power: number;

  cueBallPosition: Vec2;

  pocketedBalls: number[];

  firstContactBallId: number | null;

  cueBallPocketed: boolean;

  foul: boolean;
}
```

When the player shoots:

```text
create Shot
↓
apply initial cue velocity
↓
simulate until all balls stop
↓
record result
↓
rules evaluate Shot
```

This is much easier to reason about than having rules inspect arbitrary physics state.

---

# 14. Rules Engine

Keep rules independent from physics.

Create an interface:

```ts
interface Ruleset {
  startGame(state: GameState): void;

  validateShot(
    state: GameState,
    shot: Shot
  ): RuleResult;

  applyResult(
    state: GameState,
    result: RuleResult
  ): void;

  isGameOver(state: GameState): boolean;

  getWinner(state: GameState): number | null;
}
```

Then 8-ball is simply one implementation.

Later:

```text
Ruleset
 ├── EightBallRules
 ├── NineBallRules
 ├── StraightPoolRules
 └── PracticeRules
```

This prevents the game engine from becoming hard-coded around one ruleset.

---

# 15. 8-Ball Rules

For the first complete ruleset, implement standard-ish 8-ball behavior.

At minimum:

* players alternate turns
* solids/stripes assignment
* legal first contact
* pocketed object balls
* cue-ball scratch
* illegal first contact
* eight-ball win
* eight-ball loss
* foul handling
* ball-in-hand

Keep exact rules configurable rather than scattering constants throughout the code.

Example:

```ts
interface EightBallConfig {
  ballInHandAfterScratch: boolean;
  allowOpenTableCombination: boolean;
  eightBallOnBreakWins: boolean;
  eightBallOnBreakLoses: boolean;
}
```

Document which rules the game actually implements.

Do not claim "official WPA rules" unless the implementation has been verified against the intended ruleset.

---

# 16. Input

The input layer should produce game commands.

Mouse:

```text
pointerdown
    ↓
start aiming

pointermove
    ↓
update aim direction

pointerup
    ↓
set shot power / shoot
```

Touch should use the same command interface.

Do not have separate gameplay logic for mouse and touch.

Instead:

```text
Mouse ──┐
        ├──> InputController ──> GameCommand
Touch ──┘
```

---

# 17. Aiming

Aiming should calculate an angle from the cue ball to the pointer.

```ts
direction = pointerPosition - cueBallPosition;

angle = Math.atan2(
  direction.y,
  direction.x
);
```

The visual cue can then extend backwards from the cue ball.

Do not use the rendered cue graphic as the source of truth.

The source of truth is:

```ts
shot.angle
```

---

# 18. Power

Power should be normalized:

```text
0.0 → minimum
1.0 → maximum
```

Then convert it to initial velocity:

```ts
cueBall.velocity =
  direction.normalized() *
  power *
  MAX_SHOT_SPEED;
```

Keep `MAX_SHOT_SPEED` in the physics configuration.

---

# 19. Renderer

The renderer receives state and draws it.

```ts
renderer.render(state);
```

It should not do:

```ts
ball.position.x += ...
```

The renderer is read-only with respect to simulation state.

Recommended render order:

```text
1. background
2. table
3. cushions
4. pockets
5. balls
6. cue
7. aiming guides
8. power UI
9. HUD
```

---

# 20. Canvas Scaling

The canvas should support high-DPI displays.

Use:

```ts
const dpr = window.devicePixelRatio;
```

Then render at the appropriate backing resolution while keeping CSS dimensions independent.

The physics world remains unchanged.

For example:

```text
Physics:
2.24 × 1.12 world units

Canvas:
1920 × 960 pixels
```

Both represent the same table.

---

# 21. Camera / Table Layout

The table should preserve its aspect ratio.

Given a canvas:

```text
canvasWidth
canvasHeight
```

calculate the largest table rectangle that fits while preserving:

```text
TABLE_WIDTH / TABLE_HEIGHT
```

Center it.

Keep conversion functions centralized:

```ts
worldToScreen(position)
screenToWorld(position)
```

This is particularly important for touch input.

---

# 22. AI Architecture

Bots should interact with the game through the same command interface as humans.

A bot should not directly mutate balls.

Instead:

```text
Game State
    ↓
Bot
    ↓
choose shot
    ↓
GameCommand
    ↓
Simulation
```

Example:

```ts
interface Bot {
  chooseShot(state: GameState): Promise<ShotCommand>;
}
```

---

# 23. Bot Difficulty

Start with three levels.

### Easy

* chooses roughly sensible targets
* imperfect aim
* random power
* no advanced position planning

### Medium

* calculates direct pot shots
* accounts for pocket direction
* estimates collision geometry
* uses reasonable power

### Hard

* considers cue-ball position
* evaluates multiple candidate shots
* plans positional play
* accounts for clusters
* considers safety shots

The difficulty should primarily affect decision quality, not secretly alter physics.

Avoid:

```text
"Hard bot gets +20% ball accuracy."
```

Prefer:

```text
Easy:
    aim error ±5°

Medium:
    aim error ±1.5°

Hard:
    aim error ±0.3°
```

Even better, make the error emerge from the bot's shot evaluation.

---

# 24. Bot Shot Selection

A first bot can use a simple candidate-generation system.

For every legal target ball:

```text
target ball
     ↓
pocket
     ↓
calculate required object-ball path
     ↓
calculate cue-ball contact point
     ↓
check whether path is unobstructed
     ↓
calculate shot quality
```

Candidate score could consider:

```text
+ successful pot probability
+ favorable cue-ball position
+ easy shot
+ strategic value

- collision risk
- pocket difficulty
- excessive power
- poor position
```

Choose the highest-scoring candidate.

---

# 25. Geometry for Potting

To pocket an object ball, the object ball must arrive at the pocket along a valid trajectory.

Calculate:

```text
pocket → object ball
```

The cue ball must contact the object ball at the appropriate ghost-ball position.

Conceptually:

```text
Pocket
   ↑
   │ target line
   │
Object Ball
   ○
   ◉ Ghost Ball
      \
       \
      Cue Ball
```

This gives the bot a physically meaningful aiming solution.

---

# 26. Bot Simulation

A stronger bot should eventually simulate candidate shots.

For each candidate:

```text
clone state
↓
apply candidate shot
↓
simulate physics
↓
evaluate result
```

Do not run this against the live game state.

Use:

```ts
const simulation = game.clone();
```

or an equivalent immutable state representation.

This also lays the groundwork for:

* replay systems
* prediction
* network rollback
* automated testing

---

# 27. Determinism

Design the simulation to be deterministic.

Given:

```text
same GameState
+
same GameCommand
+
same random seed
```

the result should be identical.

Avoid physics depending on:

* render frame rate
* wall-clock time
* browser-specific animation timing
* uncontrolled `Math.random()`

Use an explicit seeded RNG:

```ts
interface Random {
  next(): number;
}
```

This becomes extremely useful for:

* bots
* testing
* replays
* multiplayer
* debugging

---

# 28. Randomness

All gameplay randomness should originate from the game simulation.

Example:

```ts
rng.next()
```

rather than:

```ts
Math.random()
```

Store the seed in the match state when necessary.

For example:

```ts
interface MatchState {
  seed: number;
}
```

A replay can then reproduce the same game.

---

# 29. Replay System

Even if replay functionality isn't exposed initially, structure the engine so that a game can be reconstructed from:

```text
initial state
+
commands
+
random seed
```

Example:

```text
Initial State
     ↓
AIM
     ↓
POWER
     ↓
SHOOT
     ↓
simulation
     ↓
AIM
     ↓
SHOOT
     ↓
...
```

Store commands rather than every rendered frame.

This produces much smaller replay files.

---

# 30. Multiplayer Strategy

Do not implement networking yet.

Design for it.

The important separation is:

```text
Player
  ↓
Command
  ↓
Simulation
  ↓
State
```

rather than:

```text
Player
  ↓
directly modifies physics
```

That means a network player can eventually replace the local player.

---

# 31. Local Multiplayer

Local two-player support should be trivial if the architecture is correct.

Instead of:

```ts
const bot = new Bot();
```

have:

```ts
players = [
  HumanPlayer,
  HumanPlayer
];
```

Both humans produce commands.

The simulation remains unchanged.

---

# 32. LAN Multiplayer

For LAN multiplayer, introduce a transport layer:

```ts
interface Transport {
  connect(): Promise<void>;
  send(message: NetworkMessage): void;
  onMessage(callback): void;
  disconnect(): void;
}
```

Possible implementation later:

```text
WebRTC
```

or a small local WebSocket server.

Do not make `Game` depend directly on WebSocket APIs.

---

# 33. Online Multiplayer

For online games, prefer a server-authoritative architecture.

Conceptually:

```text
Client A ──┐
           │
           ▼
       Game Server
           │
           ├── authoritative simulation
           │
           ├── validation
           │
           └── match state
           │
           ▼
Client B
```

The server should validate:

* whose turn it is
* legal commands
* shot parameters
* game state
* win/loss conditions

Clients should not be trusted to declare their own results.

---

# 34. Networking Protocol

Design network messages around commands/events rather than rendering state.

For example:

```json
{
  "type": "shoot",
  "playerId": "p1",
  "angle": 1.234,
  "power": 0.82,
  "sequence": 17
}
```

The server processes it and broadcasts the authoritative result.

Do not continuously send every ball's position at 60 FPS unless there is a specific need.

For a turn-based billiards game, command-based synchronization is much simpler.

---

# 35. Network Synchronization

The ideal architecture is:

```text
Client:
    input
      ↓
    command
      ↓
    server
      ↓
    authoritative command/result
      ↓
    local simulation
```

Because the simulation is deterministic, clients can potentially reproduce the same shot locally.

For a first online implementation, however, prioritize correctness over prediction.

A simple model is:

```text
Player shoots
↓
server accepts command
↓
server simulates shot
↓
server sends authoritative result/state
↓
clients animate/display it
```

Later, prediction and rollback can be added if needed.

---

# 36. State Serialization

`GameState` should be serializable.

Provide:

```ts
serializeState(state): string
deserializeState(data): GameState
```

This allows:

* debugging
* save games
* replay development
* network transport
* test fixtures

Keep serialization versioned:

```json
{
  "version": 1,
  "state": {}
}
```

---

# 37. Testing Strategy

Physics requires automated tests.

Do not rely solely on visually playing the game.

## Vector tests

Test:

* addition
* subtraction
* normalization
* dot product
* length
* reflection

## Collision tests

Test:

* head-on collision
* angled collision
* overlapping balls
* cushion reflection
* pocket capture

## Physics tests

Test:

* stationary balls remain stationary
* friction stops balls
* balls don't pass through each other
* balls don't pass through cushions
* pocketed balls stop participating

## Rules tests

Test:

* legal shot
* scratch
* wrong-ball contact
* legal pocket
* turn continuation
* turn change
* eight-ball win
* eight-ball loss

## Determinism tests

Run the same:

```text
state + commands + seed
```

multiple times and verify identical results.

---

# 38. Debug Mode

Build a debug overlay early.

Useful information:

```text
FPS
Physics tick
Ball positions
Ball velocities
Current player
Current state
Shot phase
First contact
Pocketed balls
Collision count
RNG seed
```

Also provide toggles for:

```text
☑ collision circles
☑ velocity vectors
☑ pocket radii
☑ cushion normals
☑ bot candidate shots
☑ ghost ball
☑ physics boundaries
```

This will save enormous amounts of development time.

---

# 39. Physics Tuning

Put all tunable values in one configuration object.

Example:

```ts
interface PhysicsConfig {
  fixedDt: number;

  ballRadius: number;

  rollingResistance: number;

  ballRestitution: number;

  cushionRestitution: number;

  stopSpeed: number;

  pocketCaptureRadius: number;

  maxShotSpeed: number;
}
```

Do not scatter numbers such as:

```ts
0.0037
0.81
0.12
```

throughout the physics code.

---

# 40. Audio

Audio should react to game events rather than physics code directly.

For example:

```text
BALL_BALL_COLLISION
BALL_CUSHION_COLLISION
BALL_POCKETED
SHOT_STARTED
GAME_WON
```

The physics system emits events.

The audio manager decides how to represent them.

This makes sound effects easy to replace later.

---

# 41. Animation

Avoid tying gameplay to animation.

For example, a pocketed ball can disappear from the simulation immediately while the renderer displays a short pocket animation.

```text
Simulation:
ball.pocketed = true

Renderer:
play pocket animation
```

Visual effects should never delay or alter the simulation.

---

# 42. UI States

Use explicit application states:

```text
MAIN_MENU
GAME_SETUP
PLAYING
PAUSED
GAME_OVER
SETTINGS
```

Inside `PLAYING`, the game simulation has its own phase:

```text
AIMING
SHOOTING
SETTLING
RULE_EVALUATION
```

Do not mix application state and physics state.

---

# 43. Performance

The game should be lightweight.

For 16 balls, collision detection is tiny:

```text
16 × 16
```

Even at a high physics tick rate, this is trivial for modern browsers.

Start with straightforward O(n²) collision checks.

Do not introduce spatial partitioning prematurely.

If additional objects are later introduced, such as:

* many particles
* hundreds of objects
* multiplayer effects

then consider spatial hashing.

---

# 44. Mobile

The game should work on touch devices from the beginning.

Use pointer events rather than separate mouse/touch systems.

Important considerations:

* responsive canvas
* prevent accidental page scrolling while aiming
* sufficiently large controls
* portrait/landscape handling
* no hover-only functionality
* optional haptic feedback

The physics remains identical.

---

# 45. Accessibility

Even though billiards is visually oriented, basic accessibility should still exist.

Provide:

* keyboard navigation for menus
* visible focus states
* readable contrast
* text labels for important controls
* reduced-motion option
* volume controls
* pause functionality

The canvas should not be the only way to understand menu state.

---

# 46. Security Considerations for Online Play

When online multiplayer is eventually introduced:

**Never trust the client.**

The server must determine:

```text
current player
legal shot
rules
ball positions
pocketed balls
winner
```

Do not accept:

```json
{
  "winner": "player1"
}
```

from a client.

Instead accept a command such as:

```json
{
  "type": "shoot",
  "angle": 1.2,
  "power": 0.8
}
```

and let the authoritative simulation determine the result.

---

# 47. Suggested Development Phases

## Phase 1 — Physics sandbox

Build only:

* vectors
* balls
* table
* cushions
* pockets
* friction
* collisions

No menus and no bots.

Goal:

> A cue ball can hit every other ball and the physics feels good.

**Status: COMPLETE**

All files implemented:
- `Vec2.ts` — 2D vector math with full arithmetic operations
- `Ball.ts` — Ball class with collision detection, colors, types
- `Table.ts` — Table geometry with cushions, rails, and pockets
- `PhysicsWorld.ts` — Core simulation engine with fixed timestep
- `PhysicsConfig.ts` — Tunable physics parameters

---

## Phase 2 — Playable local game

Add:

* aiming
* power
* shooting
* ball settling
* basic UI
* restart

Goal:

> A human can play a complete practice game.

**Status: COMPLETE**

All files implemented:
- `Renderer.ts` — Canvas rendering with high-DPI support, debug visualization
- `main.ts` (Phase 2) — Mouse/touch aiming, power control, shooting, restart
- Debug toggles: collision circles, velocity vectors, pocket radii, physics bounds

---

## Phase 3 — Rules

Add:

* 8-ball rules
* fouls
* turns
* ball-in-hand
* win/loss

Goal:

> A complete local 8-ball match is possible.

**Status: COMPLETE**

All files implemented:
- `Ruleset.ts` — Abstract rules interface with shot evaluation and state management
- `EightBallRules.ts` — Full 8-ball implementation including:
  - Group assignment (solids/stripes) on first legal pocket
  - Legal first contact detection
  - Cue ball scratch handling
  - Eight ball win/loss conditions
  - Turn management with continuation logic
  - Open table, group-assigned, and eight-ball phases
- `main.ts` (Phase 3) — Integrated rules engine with:
  - HUD overlay showing current player, groups, remaining balls
  - Game messages for fouls, turn changes, group assignments
  - Complete game flow from break to conclusion

---

## Phase 4 — AI

Implement:

1. Random bot
2. Basic direct-shot bot
3. Medium bot
4. Strategic bot

Goal:

> Single-player is genuinely playable.

---

## Phase 5 — Polish

Add:

* sound
* animations
* better table graphics
* responsive layout
* touch controls
* settings
* difficulty selection

Goal:

> Release-quality local game.

---

## Phase 6 — Local multiplayer

Replace:

```text
Human + Bot
```

with:

```text
Human + Human
```

without changing the simulation.

Goal:

> Two people can play on one device.

---

## Phase 7 — LAN

Introduce:

```ts
Transport
```

and a simple host/client model.

Goal:

> Two browser instances can play together over a local network.

---

## Phase 8 — Online

Add:

* authoritative server
* rooms
* player identities
* reconnect handling
* synchronization
* latency handling
* server-side validation

Goal:

> Reliable online matches.

---

# 48. Definition of Done for V1

V1 should be considered complete when:

* [ ] A table renders correctly at arbitrary browser sizes.
* [ ] Balls collide correctly.
* [ ] Balls bounce from cushions.
* [ ] Balls enter pockets.
* [ ] Friction brings balls to rest.
* [ ] Physics runs at a fixed timestep.
* [ ] A player can aim and shoot.
* [ ] A complete 8-ball game can be played.
* [ ] Fouls are detected.
* [ ] Turns are handled correctly.
* [ ] At least three AI difficulty levels work.
* [ ] Game state is serializable.
* [ ] Simulation is deterministic given the same seed and commands.
* [ ] Physics has automated tests.
* [ ] Rendering is independent from simulation.
* [ ] Input is converted into commands.
* [ ] No networking code is required to run the game.

---

# 49. Most Important Design Rules

Keep these rules visible during development.

### Rule 1

**Physics does not know about Canvas.**

### Rule 2

**Rules do not know about Canvas.**

### Rule 3

**Bots do not directly modify game state.**

### Rule 4

**Players produce commands.**

### Rule 5

**The simulation produces authoritative state/events.**

### Rule 6

**Use a fixed physics timestep.**

### Rule 7

**Keep the simulation deterministic.**

### Rule 8

**Keep rules separate from physics.**

### Rule 9

**Keep networking behind a transport/interface layer.**

### Rule 10

**Do not prematurely build multiplayer infrastructure.**

If these boundaries are maintained, LAN and online multiplayer can be added later without rewriting the actual billiards engine.

---

# 50. Recommended First Implementation Order

Start coding in exactly this order:

```text
Vec2
  ↓
Ball
  ↓
Table geometry
  ↓
Ball-ball collision
  ↓
Ball-cushion collision
  ↓
Pocket detection
  ↓
Friction / stopping
  ↓
Fixed timestep
  ↓
Shot system
  ↓
Canvas renderer
  ↓
Mouse/touch aiming
  ↓
8-ball rules
  ↓
Game UI
  ↓
Basic bot
  ↓
Better bot
```

Only after this is stable should you introduce:

```text
local multiplayer
      ↓
transport abstraction
      ↓
LAN
      ↓
server
      ↓
online multiplayer
```

The most valuable early investment is therefore **a clean deterministic simulation**, not networking or graphics. If the simulation is good and everything interacts with it through commands/events, the same core can power the single-player game, local multiplayer, bots, replays, LAN games, and eventually the online server.
