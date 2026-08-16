// =========================================================
// Table - Table Geometry and Pockets
// =========================================================

import { Vec2 } from './Vec2';

export interface PocketDefinition {
  id: number;
  position: Vec2;
  captureRadius: number;
}

export class Pocket {
  public readonly definition: PocketDefinition;
  private _activeBalls: number[] = [];

  constructor(definition: PocketDefinition) {
    this.definition = definition;
  }

  get id(): number { return this.definition.id; }
  get position(): Vec2 { return this.definition.position.clone(); }
  get captureRadius(): number { return this.definition.captureRadius; }

  addBall(id: number): void {
    if (!this._activeBalls.includes(id)) {
      this._activeBalls.push(id);
    }
  }

  removeBall(id: number): void {
    const index = this._activeBalls.indexOf(id);
    if (index !== -1) {
      this._activeBalls.splice(index, 1);
    }
  }

  get activeBallIds(): readonly number[] {
    return [...this._activeBalls];
  }

  hasBall(id: number): boolean {
    return this._activeBalls.includes(id);
  }
}

export interface TableGeometry {
  width: number;
  height: number;
  cushions: CushionSegment[];
  pockets: PocketDefinition[];
}

export interface CushionSegment {
  /** Start point of the cushion. */
  start: Vec2;
  /** End point of the cushion. */
  end: Vec2;
  /** Normal pointing inward (toward table center). */
  normal: Vec2;
}

/**
 * Creates a standard 2:1 billiards table with 6 pockets.
 * Table center is at origin (0, 0).
 * Playing surface spans from (-width/2, -height/2) to (width/2, height/2).
 */
export function createStandardTable(): TableGeometry {
  const width = 2.24;
  const height = 1.12;

  const halfW = width / 2;
  const halfH = height / 2;

  // Cushion offset from playing surface edge (cushion thickness)
  const cushionOffset = 0.08;

  // Pocket positions (6 pockets: 4 corners + 2 side pockets)
  // Standard billiards table has 6 pockets: 4 at corners, 2 at midpoints of long sides
  const pocketRadius = 0.065;

  const pockets: PocketDefinition[] = [
    // Top-left corner pocket (positioned slightly inward from exact corner for proper cushion geometry)
    {
      id: 0,
      position: new Vec2(-halfW + pocketRadius * 1.2, -halfH + pocketRadius * 1.2),
      captureRadius: pocketRadius,
    },
    // Top-right corner pocket
    {
      id: 1,
      position: new Vec2(halfW - pocketRadius * 1.2, -halfH + pocketRadius * 1.2),
      captureRadius: pocketRadius,
    },
    // Bottom-left corner pocket
    {
      id: 2,
      position: new Vec2(-halfW + pocketRadius * 1.2, halfH - pocketRadius * 1.2),
      captureRadius: pocketRadius,
    },
    // Bottom-right corner pocket
    {
      id: 3,
      position: new Vec2(halfW - pocketRadius * 1.2, halfH - pocketRadius * 1.2),
      captureRadius: pocketRadius,
    },
    // Top side pocket (center of top long side)
    {
      id: 4,
      position: new Vec2(0, -halfH + pocketRadius * 0.5),
      captureRadius: pocketRadius * 1.3,
    },
    // Bottom side pocket (center of bottom long side)
    {
      id: 5,
      position: new Vec2(0, halfH - pocketRadius * 0.5),
      captureRadius: pocketRadius * 1.3,
    },
  ];

  // Cushion segments: the playing surface edges minus pocket openings
  const cushionTolerance = pocketRadius * 0.8;

  const sidePocketGap = pocketRadius * 1.5; // gap around side pockets

  const cushions: CushionSegment[] = [
    // Top-left horizontal (left of top-left corner pocket)
    {
      start: new Vec2(-halfW + cushionTolerance, -halfH),
      end: new Vec2(-sidePocketGap, -halfH),
      normal: Vec2.unitY(),
    },
    // Top-right horizontal (right of top-right corner pocket)
    {
      start: new Vec2(sidePocketGap, -halfH),
      end: new Vec2(halfW - cushionTolerance, -halfH),
      normal: Vec2.unitY(),
    },
    // Bottom-left horizontal
    {
      start: new Vec2(-halfW + cushionTolerance, halfH),
      end: new Vec2(-sidePocketGap, halfH),
      normal: Vec2.unitY().negate(),
    },
    // Bottom-right horizontal
    {
      start: new Vec2(cushionTolerance, halfH),
      end: new Vec2(halfW - cushionTolerance, halfH),
      normal: Vec2.unitY().negate(),
    },
    // Left vertical (between top-left and bottom-left corner pockets)
    {
      start: new Vec2(-halfW, -halfH + pocketRadius * 1.5),
      end: new Vec2(-halfW, halfH - pocketRadius * 1.5),
      normal: Vec2.unitX(),
    },
    // Right vertical (between top-right and bottom-right corner pockets)
    {
      start: new Vec2(halfW, -halfH + pocketRadius * 1.5),
      end: new Vec2(halfW, halfH - pocketRadius * 1.5),
      normal: Vec2.unitX().negate(),
    },
  ];

  return { width, height, cushions, pockets };
}