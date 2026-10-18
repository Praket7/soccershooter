import type { Vec3 } from './BallState';

export const EPSILON = 1e-9;

export function add(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Readonly<Vec3>, scalar: number): Vec3 {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

export function dot(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function magnitudeSquared(v: Readonly<Vec3>): number {
  return dot(v, v);
}

export function magnitude(v: Readonly<Vec3>): number {
  return Math.sqrt(magnitudeSquared(v));
}

export function normalize(v: Readonly<Vec3>, fallback: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
  const length = magnitude(v);
  if (length <= EPSILON) return { ...fallback };
  return scale(v, 1 / length);
}

export function clampMagnitude(v: Readonly<Vec3>, max: number): Vec3 {
  const length = magnitude(v);
  return length <= max || length <= EPSILON ? { ...v } : scale(v, max / length);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
