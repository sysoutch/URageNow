// =========================================================
// main.ts - Game Entry Point with 8-Ball Rules
// =========================================================

import { Vec2 } from './physics/Vec2';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { Ball, BallType } from './physics/Ball';
import { Renderer, GameHUDData } from './rendering/Renderer';
import { EightBallRules } from './rules/EightBallRules';

// =========================================================
// Game State & Configuration
// =========================================================

enum GameState {
  AIMING = 'aiming',
  SHOOTING = 'shooting',
  SETTLING = 'settling',
  GAME_OVER = 'game-over',
}

type MessageLevel = 'info' | 'foul' | 'win' | 'system';

interface GameMessage {
  text: string;
  level: MessageLevel;
  timestamp: number;
}

// =========================================================
// Initialization
// =========================================================

function init(): void {
  // Create physics world with default config
  const world = new PhysicsWorld();

  // Create balls (cue + rack)
  world.createStandardRack();

  // Initialize rules system
  const rules = new EightBallRules();
  rules.initialize(world);

  // Create renderer
  const renderer = new Renderer('gameCanvas');

  // Game state
  let currentState = GameState.AIMING;
  let aimAngle = 0;
  let aimPower = 0;
  let isAiming = false;
  let aimStartPos: Vec2 | null = null;

  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

  // Game messages queue
  const messages: GameMessage[] = [];
  let lastWinner: number | undefined = undefined;

  // =========================================================
  // Message System
  // =========================================================

  function addMessage(text: string, level: MessageLevel = 'info'): void {
    messages.push({ text, level, timestamp: Date.now() });
    if (messages.length > 5) messages.shift();
  }

  function clearMessages(): void {
    messages.length = 0;
  }

  // =========================================================
  // Input Handling (Mouse + Touch)
  // =========================================================

  function getCanvasPosition(clientX: number, clientY: number): Vec2 {
    const rect = canvas.getBoundingClientRect();
    return new Vec2(
      clientX - rect.left,
      clientY - rect.top
    );
  }

  function startAiming(screenPos: Vec2): void {
    if (currentState === GameState.GAME_OVER) return;
    const cueBall = world.getCueBall();
    if (!cueBall || currentState !== GameState.AIMING) return;

    isAiming = true;
    aimStartPos = screenPos;

    // Calculate angle from cue ball to pointer position (in world coords)
    const cueWorldPos = new Vec2(
      screenPos.x - renderer.bounds.width / 2,
      -(screenPos.y - renderer.bounds.height / 2)
    );
    const dx = screenPos.x - cueWorldPos.x;
    const dy = -(screenPos.y - cueWorldPos.y); // flip Y for world coords
    aimAngle = Math.atan2(dy, dx);
  }

  function updateAiming(screenPos: Vec2): void {
    if (!isAiming) return;

    const cueBall = world.getCueBall();
    if (!cueBall) return;

    // Calculate angle from cue ball to pointer position
    const cueWorldPos = new Vec2(
      screenPos.x - renderer.bounds.width / 2,
      -(screenPos.y - renderer.bounds.height / 2)
    );
    const dx = screenPos.x - cueWorldPos.x;
    const dy = -(screenPos.y - cueWorldPos.y);
    aimAngle = Math.atan2(dy, dx);

    // Calculate power based on drag distance
    if (aimStartPos) {
      const dragDistance = screenPos.subtract(aimStartPos).length;
      const maxDrag = canvas.getBoundingClientRect().width * 0.4;
      aimPower = Math.min(dragDistance / maxDrag, 1);
    }
  }

  function endAiming(): void {
    if (!isAiming) return;
    isAiming = false;
    aimStartPos = null;

    // Shoot if power is sufficient
    if (aimPower > 0.05 && currentState === GameState.AIMING) {
      world.shootCue(aimPower, aimAngle);
      currentState = GameState.SHOOTING;
      clearMessages();
    }

    aimPower = 0;
  }

  // Mouse events
  canvas.addEventListener('mousedown', (e) => {
    const pos = getCanvasPosition(e.clientX, e.clientY);
    startAiming(pos);
  });

  canvas.addEventListener('mousemove', (e) => {
    const pos = getCanvasPosition(e.clientX, e.clientY);
    updateAiming(pos);
  });

  canvas.addEventListener('mouseup', () => {
    endAiming();
  });

  // Touch events
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getCanvasPosition(touch.clientX, touch.clientY);
    startAiming(pos);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const pos = getCanvasPosition(touch.clientX, touch.clientY);
    updateAiming(pos);
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    endAiming();
  });

  // Keyboard shortcuts for debug mode and restart
  document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
      case 'r':
        // Reset game
        world.clear();
        world.createStandardRack();
        rules.reset();
        currentState = GameState.AIMING;
        lastWinner = undefined;
        clearMessages();
        addMessage('Game reset. Player 1 breaks.', 'system');
        break;
      case 'd':
        // Toggle debug visualization
        renderer.showPhysicsBounds = !renderer.showPhysicsBounds;
        break;
      case 'p':
        // Toggle pocket radii
        renderer.showPocketRadii = !renderer.showPocketRadii;
        break;
      case 'v':
        // Toggle velocity vectors
        renderer.showVelocityVectors = !renderer.showVelocityVectors;
        break;
      case 'c':
        // Toggle collision circles
        renderer.showCollisionCircles = !renderer.showCollisionCircles;
        break;
    }
  });

  // =========================================================
  // Shot Resolution & Rules Integration
  // =========================================================

  function resolveShot(): void {
    const cueBall = world.getCueBall();
    if (!cueBall) return;

    // Collect pocketed balls this shot
    const pocketedBalls: Array<{ ballId: number; type: BallType }> = [];
    for (const ball of world.balls) {
      if (ball.pocketed && ball.type !== BallType.CUE) {
        pocketedBalls.push({ ballId: ball.id, type: ball.type });
      }
    }

    const cueBallPocketed = cueBall.pocketed;

    // Determine first contact ball - use physics collision tracking
    let firstContactBallId: number | null = null;
    // For now, we'll track this via a simple heuristic in the future
    // Currently set to null (no illegal first contact detection)

    // Evaluate shot through rules system
    const result = rules.evaluateShot(
      world,
      pocketedBalls,
      cueBallPocketed,
      firstContactBallId
    );

    // Apply rule results
    rules.applyResult(result);

    // Handle game over
    if (rules.isGameOver()) {
      lastWinner = rules.getWinner() ?? 0;
      currentState = GameState.GAME_OVER;
      const winnerLabel = `Player ${lastWinner + 1}`;
      addMessage(`${winnerLabel} wins the game!`, 'win');
      return;
    }

    // Handle eight ball pocketing outcomes
    if (result.eightBallStatus === 'win') {
      currentState = GameState.GAME_OVER;
      lastWinner = rules.currentPlayer ?? 0;
      const winnerLabel = `Player ${lastWinner + 1}`;
      addMessage(`${winnerLabel} legally pockets the eight ball!`, 'win');
      return;
    } else if (result.eightBallStatus === 'loss') {
      currentState = GameState.GAME_OVER;
      lastWinner = rules.currentPlayer === 0 ? 1 : 0; // Safe: currentPlayer is always 0 or 1
      const winnerLabel = `Player ${lastWinner + 1}`;
      addMessage(`Player ${rules.currentPlayer + 1} loses on the eight ball! ${winnerLabel} wins.`, 'win');
      return;
    }

    // Handle fouls
    if (result.foul) {
      const foulReason = result.foulReason || 'Unknown foul';
      addMessage(`Foul: ${foulReason}`, 'foul');

      // Reset cue ball position after scratch
      if (cueBallPocketed) {
        // Remove pocketed cue ball and create a new one
        world.removeBall(cueBall.id);
        const newCue = new Ball(
          { id: 0, type: BallType.CUE, radius: world.getConfig().ballRadius, mass: world.getConfig().ballMass },
          new Vec2(-world.width / 4, 0)
        );
        world.addBall(newCue);
      }

      // Switch player handled by rules
    } else {
      // Check group assignment messages
      const p1State = rules.getPlayerState(0);
      const p2State = rules.getPlayerState(1);

      if (p1State && !p1State.group && result.assignedGroups) {
        const p1GroupLabel = result.assignedGroups.player1Group === BallType.SOLID ? 'Solids' : 'Stripes';
        const p2GroupLabel = result.assignedGroups.player2Group === BallType.SOLID ? 'Solids' : 'Stripes';
        addMessage(`Player 1: ${p1GroupLabel} | Player 2: ${p2GroupLabel}`, 'info');
      }

      // Turn continuation message
      if (result.turnContinues) {
        addMessage(`Player ${rules.currentPlayer + 1} continues`, 'info');
      } else {
        const nextPlayer = rules.currentPlayer === 0 ? 2 : 1;
        addMessage(`Player ${nextPlayer}'s turn`, 'info');
      }

      // Check if player entered eight ball phase
      const currentPlayerState = rules.getPlayerState(rules.currentPlayer);
      if (currentPlayerState && currentPlayerState.group) {
        const remainingCount = currentPlayerState.ballsRemaining.size;
        if (remainingCount === 0) {
          addMessage(`Player ${rules.currentPlayer + 1}: All clear! Target the eight ball.`, 'info');
        }
      }
    }

    // Check for game over after rules processing
    if (rules.isGameOver()) {
      const w = rules.getWinner();
      lastWinner = w ?? undefined;
      currentState = GameState.GAME_OVER;
    }
  }

  // =========================================================
  // Game Loop (Fixed Timestep)
  // =========================================================

  const FIXED_DT = 1 / 120;
  let accumulator = 0;
  let lastTimestamp = 0;

  function gameLoop(timestamp: number): void {
    if (lastTimestamp === 0) {
      lastTimestamp = timestamp;
    }

    const delta = (timestamp - lastTimestamp) / 1000; // convert to seconds
    lastTimestamp = timestamp;
    accumulator += Math.min(delta, 0.1); // cap accumulator to prevent spiral of death

    // Fixed timestep physics updates
    let physicsSteps = 0;
    while (accumulator >= FIXED_DT && physicsSteps < 8) {
      world.step(FIXED_DT);
      accumulator -= FIXED_DT;
      physicsSteps++;

      // Check state transitions
      if (currentState === GameState.SHOOTING && world.allStopped) {
        currentState = GameState.SETTLING;
      }
      if (currentState === GameState.SETTLING && world.allStopped) {
        // Resolve shot through rules system
        resolveShot();
        currentState = GameState.AIMING;
        aimPower = 0;
      }
    }

    // Render
    renderer.resetFpsCounter();
    renderer.render(world);

    // Draw aiming UI elements
    if (currentState === GameState.AIMING && isAiming) {
      const cueBall = world.getCueBall();
      if (cueBall) {
        renderer.drawCueStick(world, aimAngle, aimPower, renderer.bounds);
        renderer.drawAimGuide(world, aimAngle, renderer.bounds);
      }
    } else if (currentState === GameState.AIMING) {
      // Show cue stick when hovering near cue ball
      const cueBall = world.getCueBall();
      if (cueBall) {
        renderer.drawCueStick(world, aimAngle, 0, renderer.bounds);
      }
    }

    // Draw HUD overlay
    drawGameHUD(renderer, rules, currentState, messages, lastWinner);

    requestAnimationFrame(gameLoop);
  }

  // =========================================================
  // Game HUD Rendering (via Renderer)
  // =========================================================

  function drawGameHUD(
    renderer: Renderer,
    rules: EightBallRules,
    gameState: GameState,
    gameMessages: GameMessage[],
    winner: number | undefined
  ): void {
    const p1State = rules.getPlayerState(0);
    const p2State = rules.getPlayerState(1);

    const hudData: GameHUDData = {
      phase: gameState === GameState.GAME_OVER ? 'game-over' : rules.phase,
      currentPlayer: rules.currentPlayer,
      player1Group: p1State?.group ?? null,
      player2Group: p2State?.group ?? null,
      player1Remaining: p1State?.ballsRemaining.size ?? 0,
      player2Remaining: p2State?.ballsRemaining.size ?? 0,
      messages: gameMessages.map(m => ({
        text: m.text,
        color: m.level === 'foul' ? '#ff4444' :
               m.level === 'win' ? '#ffcc00' :
               m.level === 'system' ? '#88ff88' : '#ffffff',
      })),
      gameOver: gameState === GameState.GAME_OVER,
      winner,
    };

    renderer.drawGameHUD(hudData);
  }

  // =========================================================
  // Start the game loop
  // =========================================================

  addMessage('Game started. Player 1 breaks.', 'system');

  requestAnimationFrame(gameLoop);

  console.log('%c 8-Ball Billiards ', 'background: #1a6b3c; color: #fff; font-size: 14px; padding: 4px 8px;');
  console.log('Controls:');
  console.log('  Mouse/Touch drag to aim and set power');
  console.log('  Release to shoot');
  console.log('  R - Reset game');
  console.log('  D - Toggle physics bounds debug');
  console.log('  P - Toggle pocket radii debug');
  console.log('  V - Toggle velocity vectors debug');
  console.log('  C - Toggle collision circles debug');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}