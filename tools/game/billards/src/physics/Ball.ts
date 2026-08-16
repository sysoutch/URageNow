// =========================================================
// Ball - Ball Entity
// =========================================================

import { Vec2 } from './Vec2';

export enum BallType {
  CUE = 'cue',
  SOLID = 'solid',
  STRIPE = 'stripe',
  EIGHT = 'eight',
}

export interface BallConfig {
  id: number;
  type: BallType;
  radius: number;
  mass: number;
}

export class Ball {
  public readonly config: BallConfig;
  public position: Vec2;
  public velocity: Vec2;
  public pocketed: boolean = false;

  private _cachedRadiusSumCache: number | null = null;
  private _lastOtherBall: Ball | null = null;

  constructor(config: BallConfig, position: Vec2) {
    this.config = config;
    this.position = position.clone();
    this.velocity = Vec2.zero();
  }

  get id(): number { return this.config.id; }
  get type(): BallType { return this.config.type; }
  get radius(): number { return this.config.radius; }
  get mass(): number { return this.config.mass; }

  get speed(): number {
    return this.velocity.length;
  }

  setVelocity(vx: number, vy: number): void {
    this.velocity = new Vec2(vx, vy);
  }

  addVelocity(other: Vec2): void {
    this.velocity = this.velocity.add(other);
  }

  stop(): void {
    this.velocity = Vec2.zero();
  }

  isMoving(): boolean {
    return this.speed > 0;
  }

  /** Returns true if this ball and other ball are overlapping. */
  collidesWith(other: Ball): boolean {
    const dx = this.position.x - other.position.x;
    const dy = this.position.y - other.position.y;
    const distanceSquared = dx * dx + dy * dy;
    const radiusSum = this.radius + other.radius;
    return distanceSquared < radiusSum * radiusSum;
  }

  /** Returns the distance between centers. */
  distanceTo(other: Ball): number {
    return this.position.distanceTo(other.position);
  }

  clone(): Ball {
    const ball = new Ball(this.config, this.position);
    ball.velocity = this.velocity.clone();
    return ball;
  }
}