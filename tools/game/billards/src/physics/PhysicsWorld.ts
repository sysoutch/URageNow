// =========================================================
// PhysicsWorld - Core Simulation Engine
// =========================================================

import { Vec2 } from './Vec2';
import { Ball, BallType } from './Ball';
import { Pocket, TableGeometry, createStandardTable } from './Table';
import { DEFAULT_PHYSICS_CONFIG, PhysicsConfig } from './PhysicsConfig';

export interface PocketedBallEvent {
  ballId: number;
  pocketId: number;
}

export interface BallCollisionEvent {
  ballA: number;
  ballB: number;
}

export type PhysicsEventListener = (event: PhysicsEvent) => void;

export type PhysicsEvent =
  | { type: 'BALL_POCKETED'; event: PocketedBallEvent }
  | { type: 'BALL_COLLISION'; event: BallCollisionEvent };

/**
 * The main physics simulation world.
 * Contains all balls, the table geometry, and runs the fixed-timestep simulation.
 */
export class PhysicsWorld {
  private readonly config: PhysicsConfig;
  private readonly table: TableGeometry;
  private readonly pockets: Pocket[];
  public readonly balls: Ball[] = [];

  private listeners: Set<PhysicsEventListener> = new Set();
  private _allStopped = true;

  // Collision debug data (reset each frame)
  collisionCount = 0;

  constructor(config?: Partial<PhysicsConfig>) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...(config || {}) };
    this.table = createStandardTable();

    // Create pocket objects
    this.pockets = this.table.pockets.map(
      (def) => new Pocket(def)
    );
  }

  get allStopped(): boolean {
    return this._allStopped;
  }

  get width(): number {
    return this.table.width;
  }

  get height(): number {
    return this.table.height;
  }

  getPockets(): readonly Pocket[] {
    return this.pockets;
  }

  getCushions(): readonly import('./Table').CushionSegment[] {
    return this.table.cushions;
  }

  getConfig(): Readonly<PhysicsConfig> {
    return this.config;
  }

  /** Returns the cue ball, or null if none exists. */
  getCueBall(): Ball | null {
    return this.balls.find((b) => b.type === BallType.CUE) || null;
  }

  getActiveBalls(): readonly Ball[] {
    return this.balls.filter((b) => !b.pocketed);
  }

  /** Returns all balls that were pocketed since the last reset. */
  getPocketedBalls(): readonly Ball[] {
    return this.balls.filter((b) => b.pocketed);
  }

  on(event: PhysicsEventListener): () => void {
    this.listeners.add(event);
    return () => this.listeners.delete(event);
  }

  private emit(event: PhysicsEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  // =========================================================
  // Ball Management
  // =========================================================

  addBall(ball: Ball): void {
    this.balls.push(ball);
  }

  removeBall(id: number): void {
    const index = this.balls.findIndex((b) => b.id === id);
    if (index !== -1) {
      const ball = this.balls[index];
      // Remove from pocket tracking
      for (const pocket of this.pockets) {
        pocket.removeBall(ball.id);
      }
      this.balls.splice(index, 1);
    }
  }

  clear(): void {
    this.balls.length = 0;
    this._allStopped = true;
    // Clear pockets
    for (const pocket of this.pockets) {
      pocket.activeBallIds.forEach((id) => pocket.removeBall(id));
    }
  }

  /** Creates a standard rack of 15 object balls in triangle formation. */
  createStandardRack(): Ball[] {
    const { ballRadius, ballMass } = this.config;
    const spacing = ballRadius * 2.05; // slight gap for visual clarity
    const cueBall = new Ball(
      { id: 0, type: BallType.CUE, radius: ballRadius, mass: ballMass },
      new Vec2(-this.table.width * 0.25, 0)
    );
    this.addBall(cueBall);

    // Triangle rack positions (pointing right, toward +x)
    const rackX = this.table.width * 0.25;
    const rackY = 0;
    const balls: Ball[] = [];
    let id = 1;

    // Standard 8-ball rack pattern (row by row):
    // Row 0: 1 ball (apex)
    // Row 1: 2 balls
    // Row 2: 3 balls (8-ball in center)
    // Row 3: 4 balls
    // Row 4: 5 balls
    const rackRows = [
      { count: 1, positions: [[0, 0]] },
      { count: 2, positions: [[-spacing * 0.5, spacing * 0.866], [spacing * 0.5, spacing * 0.866]] },
      { count: 3, positions: [[-spacing, spacing * 1.732], [0, spacing * 1.732], [spacing, spacing * 1.732]] },
      { count: 4, positions: [[-spacing * 1.5, spacing * 2.598], [-spacing * 0.5, spacing * 2.598], [spacing * 0.5, spacing * 2.598], [spacing * 1.5, spacing * 2.598]] },
      { count: 5, positions: [[-spacing * 2, spacing * 3.464], [-spacing, spacing * 3.464], [0, spacing * 3.464], [spacing, spacing * 3.464], [spacing * 2, spacing * 3.464]] },
    ];

    // Ball type assignment for 8-ball:
    // Row 0: solid (1) or stripe (9) — we'll use solid
    // Row 2 center (index 1): 8-ball
    // Remaining: alternate solids (2-7) and stripes (10-15)
    const ballTypes: { number: number; type: BallType }[] = [
      { number: 1, type: BallType.SOLID },     // apex
      { number: 8, type: BallType.EIGHT },     // row 2 center
      { number: 2, type: BallType.SOLID },
      { number: 3, type: BallType.SOLID },
      { number: 4, type: BallType.SOLID },
      { number: 5, type: BallType.SOLID },
      { number: 6, type: BallType.SOLID },
      { number: 7, type: BallType.SOLID },
      { number: 9, type: BallType.STRIPE },
      { number: 10, type: BallType.STRIPE },
      { number: 11, type: BallType.STRIPE },
      { number: 12, type: BallType.STRIPE },
      { number: 13, type: BallType.STRIPE },
      { number: 14, type: BallType.STRIPE },
      { number: 15, type: BallType.STRIPE },
    ];

    let ballIndex = 0;
    for (const row of rackRows) {
      for (let i = 0; i < row.count; i++) {
        const [dx, dy] = row.positions[i];
        const pos = new Vec2(rackX + dx, rackY + dy);

        let ballType: BallType;
        if (ballIndex === 1) {
          // Row 2 center position = 8-ball
          ballType = BallType.EIGHT;
        } else {
          const bt = ballTypes[ballIndex];
          ballType = bt.type;
        }

        const numberId = ballIndex + 1;
        const ball = new Ball(
          { id: numberId, type: ballType, radius: ballRadius, mass: ballMass },
          pos
        );
        this.addBall(ball);
        balls.push(ball);
        ballIndex++;
      }
    }

    return balls;
  }

  // =========================================================
  // Physics Step (Fixed Timestep)
  // =========================================================

  /** Advances simulation by one fixed timestep. */
  step(dt: number): void {
    this.collisionCount = 0;

    // Apply friction to all moving balls
    this.applyFriction(dt);

    // Move balls
    for (const ball of this.balls) {
      if (ball.pocketed) continue;
      ball.position = ball.position.add(ball.velocity.multiplyScalar(dt));
    }

    // Ball-ball collisions
    this.resolveBallCollisions();

    // Ball-cushion collisions
    this.resolveCushionCollisions();

    // Pocket detection
    this.checkPockets(dt);

    // Check if balls are settling
    this._allStopped = this.balls.every(
      (b) => b.pocketed || b.speed < this.config.stopSpeed
    );
  }

  /** Applies rolling friction to all moving balls. */
  private applyFriction(dt: number): void {
    for (const ball of this.balls) {
      if (ball.pocketed) continue;

      const speed = ball.speed;
      if (speed < this.config.stopSpeed) {
        ball.stop();
        continue;
      }

      // Physically meaningful deceleration: a = μg
      // Simplified: velocity -= normalize(velocity) * resistance * dt
      const deceleration = this.config.rollingResistance;
      const speedChange = deceleration * dt;

      if (speed <= speedChange) {
        ball.stop();
      } else {
        ball.velocity = ball.velocity.multiplyScalar(1 - speedChange / speed);
      }
    }
  }

  /** Resolves all ball-ball collisions using impulse-based resolution. */
  private resolveBallCollisions(): void {
    const activeBalls = this.getActiveBalls();

    for (let i = 0; i < activeBalls.length; i++) {
      for (let j = i + 1; j < activeBalls.length; j++) {
        const a = activeBalls[i];
        const b = activeBalls[j];

        if (!a.collidesWith(b)) continue;

        this.collisionCount++;

        // Collision normal: from a to b
        const delta = b.position.subtract(a.position);
        const distance = delta.length;
        if (distance === 0) continue;

        const normal = delta.normalized();
        const radiusSum = a.radius + b.radius;

        // Positional correction: separate overlapping balls
        const overlap = radiusSum - distance;
        if (overlap > 0) {
          const correction = normal.multiplyScalar(overlap / 2);
          a.position = a.position.subtract(correction);
          b.position = b.position.add(correction);
        }

        // Relative velocity along collision normal
        const relativeVelocity = a.velocity.subtract(b.velocity);
        const normalComponent = relativeVelocity.dot(normal);

        // Only resolve if balls are moving toward each other
        if (normalComponent <= 0) continue;

        // Impulse scalar (equal mass, coefficient of restitution)
        const e = this.config.ballRestitution;
        const impulse = normalComponent * (1 + e) / 2;

        // Apply impulse
        const impulseVector = normal.multiplyScalar(impulse);
        a.velocity = a.velocity.subtract(impulseVector);
        b.velocity = b.velocity.add(impulseVector);

        this.emit({ type: 'BALL_COLLISION', event: { ballA: a.id, ballB: b.id } });
      }
    }
  }

  /** Resolves all ball-cushion collisions. */
  private resolveCushionCollisions(): void {
    const activeBalls = this.getActiveBalls();

    for (const ball of activeBalls) {
      for (const cushion of this.table.cushions) {
        // Project ball center onto the cushion line segment
        const segStart = cushion.start;
        const segEnd = cushion.end;
        const segDir = segEnd.subtract(segStart);
        const segLength = segDir.length;

        if (segLength === 0) continue;

        const toBall = ball.position.subtract(segStart);
        let t = toBall.dot(segDir) / (segLength * segLength);
        t = Math.max(0, Math.min(1, t)); // clamp to segment

        const closestPoint = segStart.add(segDir.multiplyScalar(t));
        const distVec = ball.position.subtract(closestPoint);
        const distance = distVec.length;

        if (distance < ball.radius) {
          // Collision detected
          const normal = distVec.normalized();

          // Positional correction: push ball out of cushion
          const penetration = ball.radius - distance;
          ball.position = ball.position.add(normal.multiplyScalar(penetration));

          // Reflect velocity around cushion normal
          const velDotNormal = ball.velocity.dot(normal);
          if (velDotNormal < 0) {
            const reflection = normal.multiplyScalar(velDotNormal * (1 + this.config.cushionRestitution));
            ball.velocity = ball.velocity.subtract(reflection);
          }
        }
      }
    }
  }

  /** Checks all balls against pocket capture zones. */
  private checkPockets(_dt: number): void {
    const activeBalls = this.getActiveBalls();

    for (const ball of activeBalls) {
      for (let i = 0; i < this.pockets.length; i++) {
        const pocket = this.pockets[i];
        const dist = ball.position.distanceTo(pocket.position);

        if (dist < pocket.captureRadius + ball.radius * 0.3) {
          // Pocket the ball
          ball.stop();
          ball.velocity = Vec2.zero();
          pocket.addBall(ball.id);

          this.emit({ type: 'BALL_POCKETED', event: { ballId: ball.id, pocketId: pocket.id } });
        }
      }
    }
  }

  // =========================================================
  // Shot Execution
  // =========================================================

  shootCue(power: number, angle: number): void {
    const cue = this.getCueBall();
    if (!cue) return;

    const speed = power * this.config.maxShotSpeed;
    const direction = Vec2.fromAngle(angle);
    cue.velocity = direction.multiplyScalar(speed);
  }

  // =========================================================
  // State Management (for replays, networking, etc.)
  // =========================================================

  /** Creates a deep snapshot of the current state. */
  serialize(): string {
    const data = {
      balls: this.balls.map((b) => ({
        id: b.id,
        type: b.type,
        x: b.position.x,
        y: b.position.y,
        vx: b.velocity.x,
        vy: b.velocity.y,
        pocketed: b.pocketed,
      })),
    };
    return JSON.stringify(data);
  }

  /** Restores state from a serialized snapshot. */
  deserialize(json: string): void {
    const data = JSON.parse(json) as { balls: Array<{ id: number; type: string; x: number; y: number; vx: number; vy: number; pocketed: boolean }> };

    // Clear and rebuild
    this.clear();

    for (const b of data.balls) {
      const ball = new Ball(
        { id: b.id, type: b.type as BallType, radius: this.config.ballRadius, mass: this.config.ballMass },
        new Vec2(b.x, b.y)
      );
      ball.velocity = new Vec2(b.vx, b.vy);
      if (b.pocketed) {
        ball.stop();
        // Find which pocket it belongs to
        for (const pocket of this.pockets) {
          pocket.addBall(ball.id);
        }
        ball.pocketed = true;
      }
      this.addBall(ball);
    }
  }

  /** Creates a clone of this physics world. */
  clone(): PhysicsWorld {
    const cloned = new PhysicsWorld();
    for (const ball of this.balls) {
      cloned.addBall(ball.clone());
    }
    return cloned;
  }
}