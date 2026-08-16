// =========================================================
// Renderer - Canvas Rendering System
// =========================================================

import { Vec2 } from '../physics/Vec2';
import { Ball, BallType } from '../physics/Ball';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export interface GameHUDData {
  phase: string;
  currentPlayer: number;
  player1Group: BallType.SOLID | BallType.STRIPE | null;
  player2Group: BallType.SOLID | BallType.STRIPE | null;
  player1Remaining: number;
  player2Remaining: number;
  messages: Array<{ text: string; color: string }>;
  gameOver: boolean;
  winner?: number;
}

export interface ScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts world coordinates to screen coordinates.
 */
function worldToScreen(worldPos: Vec2, bounds: ScreenBounds): Vec2 {
  const scaleX = bounds.width / 2;
  const scaleY = bounds.height / 2;
  return new Vec2(
    worldPos.x * scaleX + bounds.x + bounds.width / 2,
    -worldPos.y * scaleY + bounds.y + bounds.height / 2
  );
}

/**
 * Converts screen coordinates to world coordinates.
 */
function screenToWorld(screenPos: Vec2, bounds: ScreenBounds): Vec2 {
  const scaleX = 2 / (bounds.width);
  const scaleY = 2 / (bounds.height);
  return new Vec2(
    (screenPos.x - bounds.x - bounds.width / 2) * scaleX,
    -(screenPos.y - bounds.y - bounds.height / 2) * scaleY
  );
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr: number = 1;
  private _bounds: ScreenBounds = { x: 0, y: 0, width: 0, height: 0 };

  // Debug visualization toggles
  showCollisionCircles: boolean = false;
  showVelocityVectors: boolean = false;
  showPocketRadii: boolean = false;
  showCushionNormals: boolean = false;
  showPhysicsBounds: boolean = true;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) throw new Error(`Canvas with id "${canvasId}" not found`);

    this.ctx = this.canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;

    this.setupResizeHandler();
    this.resize();
  }

  private setupResizeHandler(): void {
    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.canvas.parentElement || document.body);
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    this._bounds = { x: 0, y: 0, width: rect.width, height: rect.height };

    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get bounds(): ScreenBounds { return this._bounds; }

  /** Renders the complete game frame. */
  render(world: PhysicsWorld): void {
    const ctx = this.ctx;
    const bounds = this.bounds;

    // Clear background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, bounds.width, bounds.height);

    // Draw table frame (outer border)
    this.drawTableFrame(world, bounds);

    // Draw playing surface
    this.drawPlayingSurface(world, bounds);

    // Draw cushions
    this.drawCushions(world, bounds);

    // Draw pockets
    this.drawPockets(world, bounds);

    // Draw debug info if enabled
    if (this.showPocketRadii) {
      this.drawPocketDebug(world, bounds);
    }
    if (this.showPhysicsBounds) {
      this.drawCushionDebug(world, bounds);
    }

    // Draw balls
    this.drawBalls(world, bounds);

    // Draw debug info
    if (this.showCollisionCircles) {
      this.drawCollisionDebug(world, bounds);
    }
    if (this.showVelocityVectors) {
      this.drawVelocityDebug(world, bounds);
    }

    // Draw HUD overlay
    this.drawHUD(ctx, world, bounds);
  }

  private drawTableFrame(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;

    const left = worldToScreen(new Vec2(-world.width / 2 - 0.15, -world.height / 2 - 0.15), bounds);
    const right = worldToScreen(new Vec2(world.width / 2 + 0.15, world.height / 2 + 0.15), bounds);

    ctx.fillStyle = '#3d2b1f';
    ctx.fillRect(left.x, left.y, right.x - left.x, right.y - left.y);

    // Frame border highlight
    ctx.strokeStyle = '#5a4232';
    ctx.lineWidth = 2;
    ctx.strokeRect(left.x, left.y, right.x - left.x, right.y - left.y);
  }

  private drawPlayingSurface(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;

    const topLeft = worldToScreen(
      new Vec2(-world.width / 2, -world.height / 2),
      bounds
    );
    const bottomRight = worldToScreen(
      new Vec2(world.width / 2, world.height / 2),
      bounds
    );

    // Green felt
    ctx.fillStyle = '#1a6b3c';
    ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

    // Subtle texture overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let x = topLeft.x; x < bottomRight.x; x += 8) {
      for (let y = topLeft.y; y < bottomRight.y; y += 8) {
        if ((Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0) {
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    // Head string line (dashed)
    const headStringX = worldToScreen(new Vec2(-world.width * 0.25, -world.height / 2), bounds).x;
    const headStringY1 = worldToScreen(new Vec2(-world.width * 0.25, -world.height / 2), bounds).y;
    const headStringY2 = worldToScreen(new Vec2(-world.width * 0.25, world.height / 2), bounds).y;

    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headStringX, headStringY1);
    ctx.lineTo(headStringX, headStringY2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Spot (foot spot)
    const footSpot = worldToScreen(new Vec2(world.width * 0.25, 0), bounds);
    ctx.beginPath();
    ctx.arc(footSpot.x, footSpot.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fill();
  }

  private drawCushions(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;

    for (const cushion of world.getCushions()) {
      const start = worldToScreen(cushion.start, bounds);
      const end = worldToScreen(cushion.end, bounds);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = '#2d5a3f';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  private drawPockets(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;

    // Calculate scale factor from world to screen coordinates
    const scaleX = bounds.width / (world.width + 0.3);
    const scaleY = bounds.height / (world.height + 0.3);
    const scale = Math.min(scaleX, scaleY);

    for (const pocket of world.getPockets()) {
      const pos = worldToScreen(pocket.position, bounds);
      // Scale pocket radius proportionally to the table size on screen
      const radius = pocket.captureRadius * scale;

      // Pocket shadow / depth effect
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius * 1.5);
      gradient.addColorStop(0, '#050505');
      gradient.addColorStop(0.4, '#0d0d0d');
      gradient.addColorStop(0.8, '#1a1a1a');
      gradient.addColorStop(1, 'rgba(26, 26, 26, 0)');

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Pocket rim (subtle edge highlight)
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 1.1, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(90, 66, 50, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Dark center fill
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();
    }
  }

  private drawBalls(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;

    for (const ball of world.balls) {
      if (ball.pocketed) continue;

      const pos = worldToScreen(ball.position, bounds);
      const radius = ball.radius * Math.min(bounds.width, bounds.height) / 2;

      // Ball shadow
      ctx.beginPath();
      ctx.arc(pos.x + radius * 0.15, pos.y + radius * 0.15, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();

      // Ball body
      let color: string;
      switch (ball.type) {
        case BallType.CUE:
          color = '#f5f5f0';
          break;
        case BallType.SOLID:
          color = this.getSolidColor(ball.id);
          break;
        case BallType.STRIPE:
          color = this.getStripeColor(ball.id);
          break;
        case BallType.EIGHT:
          color = '#1a1a1a';
          break;
      }

      // Draw solid base
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = ball.type === BallType.STRIPE ? '#f5f5f0' : color;
      ctx.fill();

      // Stripe band
      if (ball.type === BallType.STRIPE) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(pos.x - radius, pos.y - radius * 0.4, radius * 2, radius * 0.8);
        ctx.restore();
      }

      // Number circle
      if (ball.id > 0) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();

        // Number text
        ctx.font = `bold ${Math.max(radius * 0.6, 8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a1a1a';
        ctx.fillText(ball.id.toString(), pos.x, pos.y + 1);
      }

      // Cue ball dot
      if (ball.type === BallType.CUE) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#cc3333';
        ctx.fill();
      }

      // Highlight (specular)
      const highlightGrad = ctx.createRadialGradient(
        pos.x - radius * 0.3, pos.y - radius * 0.3, 0,
        pos.x, pos.y, radius
      );
      highlightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      highlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = highlightGrad;
      ctx.fill();
    }
  }

  private getSolidColor(id: number): string {
    const colors: Record<number, string> = {
      1: '#e6b800', // yellow
      2: '#00457c', // blue
      3: '#cc3333', // red
      4: '#6b2fa0', // purple
      5: '#e66a00', // orange
      6: '#1a6b3c', // green
      7: '#4a1a2a', // maroon
    };
    return colors[id] || '#888888';
  }

  private getStripeColor(id: number): string {
    const colors: Record<number, string> = {
      9: '#e6b800', // yellow
      10: '#00457c', // blue
      11: '#cc3333', // red
      12: '#6b2fa0', // purple
      13: '#e66a00', // orange
      14: '#1a6b3c', // green
      15: '#4a1a2a', // maroon
    };
    return colors[id] || '#888888';
  }

  private drawHUD(ctx: CanvasRenderingContext2D, world: PhysicsWorld, bounds: ScreenBounds): void {
    const fps = this.getFpsDisplay();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(bounds.width - 140, 5, 135, 72);

    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';

    const lines = [
      `FPS: ${fps}`,
      `Balls: ${world.getActiveBalls().length} active`,
      `Stopped: ${world.allStopped}`,
      `Collisions: ${world.collisionCount}`,
    ];

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bounds.width - 132, 10 + i * 16);
    }
  }

  private lastFpsTime: number = performance.now();
  private frameCount: number = 0;

  getFpsDisplay(): string {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
      return fps.toString();
    }
    return '?';
  }

  // =========================================================
  // Debug Visualization
  // =========================================================

  private drawPocketDebug(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;
    for (const pocket of world.getPockets()) {
      const pos = worldToScreen(pocket.position, bounds);
      const radius = pocket.captureRadius * Math.min(bounds.width, bounds.height) / 2;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private drawCushionDebug(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;
    for (const cushion of world.getCushions()) {
      const start = worldToScreen(cushion.start, bounds);
      const end = worldToScreen(cushion.end, bounds);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.strokeStyle = 'rgba(255, 255, 100, 0.4)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Normal indicator
      const midX = (start.x + end.x) / 2;
      const midY = (start.y + end.y) / 2;
      const normalScale = 15;
      const nx = midX + cushion.normal.x * normalScale;
      const ny = midY + cushion.normal.y * normalScale;

      ctx.beginPath();
      ctx.moveTo(midX, midY);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = 'rgba(255, 100, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private drawCollisionDebug(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;
    for (const ball of world.getActiveBalls()) {
      const pos = worldToScreen(ball.position, bounds);
      const radius = ball.radius * Math.min(bounds.width, bounds.height) / 2;

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100, 255, 100, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private drawVelocityDebug(world: PhysicsWorld, bounds: ScreenBounds): void {
    const ctx = this.ctx;
    for (const ball of world.getActiveBalls()) {
      if (ball.speed < 0.01) continue;

      const pos = worldToScreen(ball.position, bounds);
      const scale = 30;
      const endPos = worldToScreen(
        ball.position.add(ball.velocity.multiplyScalar(scale)),
        bounds
      );

      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(endPos.x, endPos.y);
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  /** Draws a cue stick visualization from the cue ball in the aim direction. */
  drawCueStick(world: PhysicsWorld, aimAngle: number, aimPower: number, bounds: ScreenBounds): void {
    const ctx = this.ctx;
    const cue = world.getCueBall();
    if (!cue) return;

    const cuePos = worldToScreen(cue.position, bounds);
    const direction = Vec2.fromAngle(aimAngle);

    // Cue stick position (behind the cue ball)
    const stickOffset = cue.radius * Math.min(bounds.width, bounds.height) / 2 + 0.05;
    const stickStart = cuePos.subtract(direction.multiplyScalar(stickOffset));
    const stickEnd = cuePos.subtract(direction.multiplyScalar(stickOffset + 0.4));

    const startScreen = worldToScreen(stickStart, bounds);
    const endScreen = worldToScreen(stickEnd, bounds);

    // Draw cue stick
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.strokeStyle = '#c8a96e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Cue tip (blue)
    const tipPos = worldToScreen(
      cue.position.subtract(direction.multiplyScalar(stickOffset - 0.02)),
      bounds
    );
    ctx.beginPath();
    ctx.arc(tipPos.x, tipPos.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#4488cc';
    ctx.fill();

    // Power indicator line (from cue ball in shot direction)
    if (aimPower > 0) {
      const powerLength = aimPower * 0.3;
      const powerEnd = worldToScreen(
        cue.position.add(direction.multiplyScalar(powerLength)),
        bounds
      );

      ctx.beginPath();
      ctx.moveTo(cuePos.x, cuePos.y);
      ctx.lineTo(powerEnd.x, powerEnd.y);
      ctx.strokeStyle = `rgba(255, ${Math.round(255 * (1 - aimPower))}, 0, 0.6)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** Draws aiming guide line from cue ball forward. */
  drawAimGuide(world: PhysicsWorld, aimAngle: number, bounds: ScreenBounds): void {
    const ctx = this.ctx;
    const cue = world.getCueBall();
    if (!cue) return;

    const cuePos = worldToScreen(cue.position, bounds);
    const direction = Vec2.fromAngle(aimAngle);

    // Draw guide line extending from cue ball
    const guideLength = 1.5; // world units
    const guideEnd = worldToScreen(
      cue.position.add(direction.multiplyScalar(guideLength)),
      bounds
    );

    ctx.beginPath();
    ctx.moveTo(cuePos.x, cuePos.y);
    ctx.lineTo(guideEnd.x, guideEnd.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** Resets the FPS counter. */
  resetFpsCounter(): void {
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
  }

  // =========================================================
  // Game HUD Overlay (8-Ball Rules)
  // =========================================================

  drawGameHUD(data: GameHUDData): void {
    const ctx = this.ctx;
    const bounds = this.bounds;

    // Draw top bar background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, bounds.width, 48);

    const currentPlayer = data.currentPlayer;

    // Player info (top-left)
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';

    // Current player label
    const p1Label = `P${currentPlayer + 1}:`;
    const p1Color = currentPlayer === 0 ? '#ffcc00' : '#aaaaaa';
    ctx.fillStyle = p1Color;
    ctx.fillText(p1Label, 12, 16);

    if (data.player1Group) {
      const groupLabel = data.player1Group === BallType.SOLID ? 'Solids' : 'Stripes';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${groupLabel} (${data.player1Remaining})`, 70, 16);
    } else {
      ctx.fillStyle = '#888888';
      ctx.fillText('Open Table', 70, 16);
    }

    // Player 2 info
    const p2Label = `P${currentPlayer + 1}:`;
    const p2Color = currentPlayer === 1 ? '#ffcc00' : '#aaaaaa';
    ctx.fillStyle = p2Color;
    ctx.fillText(p2Label, 12, 34);

    if (data.player2Group) {
      const groupLabel = data.player2Group === BallType.SOLID ? 'Solids' : 'Stripes';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${groupLabel} (${data.player2Remaining})`, 70, 34);
    } else {
      ctx.fillStyle = '#888888';
      ctx.fillText('Open Table', 70, 34);
    }

    // Game phase (top-center)
    const phaseText = data.gameOver ? 'GAME OVER' : data.phase.toUpperCase();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(phaseText, bounds.width / 2, 20);

    // Current player indicator (top-right)
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px monospace';
    const turnLabel = data.gameOver ? '' : `Player ${currentPlayer + 1}'s Turn`;
    ctx.fillStyle = currentPlayer === 0 ? '#ff6644' : '#4488ff';
    ctx.fillText(turnLabel, bounds.width - 12, 20);

    // Game over overlay
    if (data.gameOver && data.winner !== undefined) {
      const winnerLabel = `Player ${data.winner + 1}`;
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#ffcc00';
      ctx.fillText(`${winnerLabel} Wins!`, bounds.width / 2, bounds.height / 2 - 20);

      ctx.font = '16px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Press R to restart', bounds.width / 2, bounds.height / 2 + 20);
    }

    // Game messages (bottom-left)
    const msgY = bounds.height - 12;
    for (let i = Math.max(0, data.messages.length - 3); i < data.messages.length; i++) {
      const msg = data.messages[i];
      ctx.textAlign = 'left';
      ctx.font = '13px monospace';
      ctx.fillStyle = msg.color;
      ctx.fillText(msg.text, 12, msgY - (data.messages.length - i) * 18);
    }
  }
}
