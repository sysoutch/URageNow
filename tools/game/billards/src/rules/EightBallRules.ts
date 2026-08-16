// =========================================================
// EightBallRules - Standard 8-Ball Ruleset Implementation
// =========================================================

import { BallType } from '../physics/Ball';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { Ruleset, ShotResult, PlayerState, GamePhase, PocketedBallInfo } from './Ruleset';

export class EightBallRules extends Ruleset {
  private _world: PhysicsWorld | null = null;
  private _currentPlayerIndex: number = 0;
  private _players: Map<number, PlayerState> = new Map();
  private _phase: GamePhase = 'break';
  private _winner: number | null = null;

  // Ball ID to type mapping for standard 8-ball rack
  private static readonly BALL_TYPES: Record<number, BallType> = {
    0: BallType.CUE,
    1: BallType.SOLID,
    2: BallType.SOLID,
    3: BallType.SOLID,
    4: BallType.SOLID,
    5: BallType.SOLID,
    6: BallType.SOLID,
    7: BallType.SOLID,
    8: BallType.EIGHT,
    9: BallType.STRIPE,
    10: BallType.STRIPE,
    11: BallType.STRIPE,
    12: BallType.STRIPE,
    13: BallType.STRIPE,
    14: BallType.STRIPE,
    15: BallType.STRIPE,
    16: BallType.STRIPE,
  };

  get currentPlayer(): number {
    return this._currentPlayerIndex;
  }

  set currentPlayer(value: number) {
    this._currentPlayerIndex = value;
  }

  get phase(): GamePhase {
    return this._phase;
  }

  initialize(world: PhysicsWorld): void {
    this._world = world;
    this._phase = 'break';
    this._currentPlayerIndex = 0;
    this._winner = null;
    this._players.clear();

    // Initialize player states for both players
    for (let i = 0; i < 2; i++) {
      const state: PlayerState = {
        id: i,
        group: null,
        ballsRemaining: new Set(),
      };
      this._players.set(i, state);
    }

    // Initialize remaining balls for each player (solids and stripes)
    for (const [id, type] of Object.entries(EightBallRules.BALL_TYPES)) {
      const ballId = parseInt(id);
      if (type === BallType.SOLID || type === BallType.STRIPE) {
        this._players.get(0)?.ballsRemaining.add(ballId);
        this._players.get(1)?.ballsRemaining.add(ballId);
      }
    }
  }

  evaluateShot(
    world: PhysicsWorld,
    pocketedBalls: PocketedBallInfo[],
    cueBallPocketed: boolean,
    firstContactBallId: number | null
  ): ShotResult {
    const result: ShotResult = {
      foul: false,
      pocketedBalls,
      cueBallPocketed,
      turnContinues: false,
    };

    // Check if eight ball was pocketed this shot
    const eightBallPocketed = pocketedBalls.some(b => b.type === BallType.EIGHT);

    if (eightBallPocketed) {
      result.eightBallStatus = 'illegalPocket';
    }

    // Check fouls first
    if (cueBallPocketed) {
      result.foul = true;
      result.foulReason = 'Cue ball scratched';
    }

    // During non-eight-ball phase, check legal first contact and group assignment
    if (this._phase !== 'eightBall') {
      const solidPocketed = pocketedBalls.some(b => b.type === BallType.SOLID);
      const stripePocketed = pocketedBalls.some(b => b.type === BallType.STRIPE);

      // Group assignment: first legal pocketing of a single group assigns groups
      if (solidPocketed && !stripePocketed) {
        result.assignedGroups = { player1Group: BallType.SOLID, player2Group: BallType.STRIPE };
      } else if (stripePocketed && !solidPocketed) {
        result.assignedGroups = { player1Group: BallType.STRIPE, player2Group: BallType.SOLID };
      }

      // Illegal first contact check
      if (!result.foul && firstContactBallId !== null) {
        const firstContactType = EightBallRules.BALL_TYPES[firstContactBallId];
        if (firstContactType === BallType.CUE || firstContactType === BallType.EIGHT) {
          result.foul = true;
          result.foulReason = `Illegal first contact: ${firstContactType}`;
        }
      }
    } else {
      // Eight ball phase - check if player hit eight-ball before clearing group
      const currentPlayerState = this._players.get(this._currentPlayerIndex);
      if (currentPlayerState && !this._isGroupCleared(currentPlayerState)) {
        result.foul = true;
        result.foulReason = 'Hit eight ball before clearing your group';
      }
    }

    return result;
  }

  applyResult(result: ShotResult): void {
    if (!this._world) return;

    // Handle game over conditions first
    if (result.eightBallStatus === 'illegalPocket') {
      this._handleEightBallPocketed(result);
      return;
    }

    // Handle fouls - switch turn
    if (result.foul) {
      this._switchPlayer();
      return;
    }

    // Check if current player pocketed their own group balls
    const currentPlayerState = this._players.get(this._currentPlayerIndex);
    let pocketedOwnBall = false;

    if (currentPlayerState && currentPlayerState.group) {
      const ownGroup = currentPlayerState.group;
      pocketedOwnBall = result.pocketedBalls.some(b => b.type === ownGroup);
    } else if (!currentPlayerState?.group && this._phase !== 'eightBall') {
      // Open table - any ball pocketed is fine for continuing
      pocketedOwnBall = result.pocketedBalls.length > 0;
    }

    // Handle group assignment state update
    if (result.assignedGroups) {
      const p1Group = result.assignedGroups.player1Group!;
      const p2Group = result.assignedGroups.player2Group!;

      for (const [id, state] of this._players.entries()) {
        state.group = id === 0 ? p1Group : p2Group;
        // Remove assigned balls from opponent's remaining set
        const opponentState = this._players.get(id === 0 ? 1 : 0);
        if (opponentState) {
          for (const ballId of opponentState.ballsRemaining) {
            const type = EightBallRules.BALL_TYPES[ballId];
            if (type === state.group) {
              opponentState.ballsRemaining.delete(ballId);
            }
          }
        }
      }

      this._phase = 'groupAssigned';
    }

    // Remove pocketed balls from all players' remaining sets
    for (const pocketed of result.pocketedBalls) {
      if (pocketed.type === BallType.CUE || pocketed.type === BallType.EIGHT) continue;
      for (const state of this._players.values()) {
        state.ballsRemaining.delete(pocketed.ballId);
      }
    }

    // Turn continuation logic
    if (!result.foul && pocketedOwnBall) {
      result.turnContinues = true;
    } else if (!result.foul) {
      this._switchPlayer();
    }

    // Check if we should enter eight ball phase
    for (const [id, state] of this._players.entries()) {
      if (this._isGroupCleared(state) && id === this._currentPlayerIndex) {
        this._phase = 'eightBall';
      }
    }
  }

  private _handleEightBallPocketed(result: ShotResult): void {
    const currentPlayerState = this._players.get(this._currentPlayerIndex);
    const isEightBallPhase = this._phase === 'eightBall';
    const groupCleared = currentPlayerState ? this._isGroupCleared(currentPlayerState) : false;

    if (isEightBallPhase && !result.foul && groupCleared) {
      // Clean eight ball pocket = win for current player
      result.eightBallStatus = 'win';
      this._winner = this._currentPlayerIndex;
    } else if (result.cueBallPocketed || !groupCleared) {
      // Pocketing eight ball with scratch, or before clearing group = loss
      result.eightBallStatus = 'loss';
      this._winner = this._currentPlayerIndex === 0 ? 1 : 0;
    } else {
      // Eight ball pocketed illegally during group phase = loss
      result.eightBallStatus = 'loss';
      this._winner = this._currentPlayerIndex === 0 ? 1 : 0;
    }
  }

  private _isGroupCleared(state: PlayerState): boolean {
    if (!state.group) return false;
    // Group is cleared when no balls of that group remain on table
    for (const [id, s] of this._players.entries()) {
      if (s === state) continue;
      for (const ballId of s.ballsRemaining) {
        const type = EightBallRules.BALL_TYPES[ballId];
        if (type === state.group) return false;
      }
    }
    // Also check own remaining set
    for (const ballId of state.ballsRemaining) {
      const type = EightBallRules.BALL_TYPES[ballId];
      if (type === state.group) return false;
    }
    return true;
  }

  private _switchPlayer(): void {
    this._currentPlayerIndex = this._currentPlayerIndex === 0 ? 1 : 0;
  }

  isGameOver(): boolean {
    return this._winner !== null;
  }

  getWinner(): number | null {
    return this._winner;
  }

  getPlayerState(playerId: number): PlayerState | undefined {
    return this._players.get(playerId);
  }

  getAllPlayerStates(): Map<number, PlayerState> {
    return new Map(this._players);
  }

  reset(): void {
    this._phase = 'break';
    this._currentPlayerIndex = 0;
    this._winner = null;
    this._players.clear();

    for (let i = 0; i < 2; i++) {
      const state: PlayerState = {
        id: i,
        group: null,
        ballsRemaining: new Set(),
      };
      this._players.set(i, state);
    }

    // Re-add all solid and stripe balls to both players' remaining sets
    for (const [id, type] of Object.entries(EightBallRules.BALL_TYPES)) {
      if (type === BallType.SOLID || type === BallType.STRIPE) {
        const ballId = parseInt(id);
        this._players.get(0)?.ballsRemaining.add(ballId);
        this._players.get(1)?.ballsRemaining.add(ballId);
      }
    }
  }
}