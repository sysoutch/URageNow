// =========================================================
// Vec2 - 2D Vector Math
// =========================================================

export class Vec2 {
  public readonly x: number;
  public readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  static zero(): Vec2 { return new Vec2(0, 0); }
  static unitX(): Vec2 { return new Vec2(1, 0); }
  static unitY(): Vec2 { return new Vec2(0, 1); }

  get length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  get isZero(): boolean {
    return this.x === 0 && this.y === 0;
  }

  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  multiplyScalar(scalar: number): Vec2 {
    return new Vec2(this.x * scalar, this.y * scalar);
  }

  divideScalar(scalar: number): Vec2 {
    if (scalar === 0) throw new Error('Cannot divide by zero');
    return new Vec2(this.x / scalar, this.y / scalar);
  }

  normalized(): Vec2 {
    const len = this.length;
    if (len === 0) return Vec2.zero();
    return this.divideScalar(len);
  }

  dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }

  distanceTo(other: Vec2): number {
    return this.subtract(other).length;
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  equals(other: Vec2): boolean {
    return this.x === other.x && this.y === other.y;
  }

  negate(): Vec2 {
    return new Vec2(-this.x, -this.y);
  }

  static lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return a.add(b.subtract(a).multiplyScalar(t));
  }

  static fromAngle(angle: number, length: number = 1): Vec2 {
    return new Vec2(
      Math.cos(angle) * length,
      Math.sin(angle) * length
    );
  }
}