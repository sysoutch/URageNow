// =========================================================
// Ruleset - Abstract Rules Interface
// =========================================================

import { Ball, BallType } from '../physics/Ball';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export interface PocketedBallInfo {
  ballId: number;
  type: BallType;
}

export interface ShotResult {
  foul: boolean;
  foulReason?: string;
  pocketedBalls: PocketedBallInfo[];
  cueBallPocketed: boolean;
  turnContinues: boolean;
  assignedGroups?: { player1Group: BallType.SOLID | BallType.STRIPE | null; player2Group: BallType.SOLID | BallType.STRIPE | null };
  eightBallStatus?: 'none' | 'legalPocket' | 'illegalPocket' | 'win' | 'loss';
  winner?: number;
}

export interface PlayerState {
  id: number;
  group: BallType.SOLID | BallType.STRIPE | null;
  ballsRemaining: Set<number>;
}

export type GamePhase = 'break' | 'open' | 'groupAssigned' | 'eightBall';

export abstract class Ruleset {
  abstract initialize(world: PhysicsWorld): void;
  abstract evaluateShot(
    world: PhysicsWorld,
    pocketedBalls: PocketedBallInfo[],
    cueBallPocketed: boolean,
    firstContactBallId: number | null
  ): ShotResult;
  abstract applyResult(result: ShotResult): void;
  abstract get currentPlayer(): number;
  abstract set currentPlayer(value: number);
  abstract isGameOver(): boolean;
  abstract getWinner(): number | null;
}