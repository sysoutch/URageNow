// =========================================================
// PhysicsConfig - Tunable Physics Parameters
// =========================================================

export interface PhysicsConfig {
  fixedDt: number;
  ballRadius: number;
  ballMass: number;
  rollingResistance: number;
  ballRestitution: number;
  cushionRestitution: number;
  stopSpeed: number;
  pocketRadius: number;
  pocketCaptureRadius: number;
  maxShotSpeed: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  fixedDt: 1 / 120,
  ballRadius: 0.0286,
  ballMass: 1.0,
  rollingResistance: 1.5,
  ballRestitution: 0.92,
  cushionRestitution: 0.75,
  stopSpeed: 0.002,
  pocketRadius: 0.045,
  pocketCaptureRadius: 0.038,
  maxShotSpeed: 3.5,
};