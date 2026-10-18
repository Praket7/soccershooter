export interface AimVec3 {
  x: number;
  y: number;
  z: number;
}

const EPSILON = 1e-9;

function finite(vector: Readonly<AimVec3>): boolean {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function pointAt(origin: Readonly<AimVec3>, direction: Readonly<AimVec3>, t: number): AimVec3 {
  return {
    x: origin.x + direction.x * t,
    y: origin.y + direction.y * t,
    z: origin.z + direction.z * t,
  };
}

export function intersectAimRayWithGround(
  origin: Readonly<AimVec3>,
  direction: Readonly<AimVec3>,
  groundY = 0,
): AimVec3 | null {
  if (!finite(origin) || !finite(direction) || !Number.isFinite(groundY)) return null;
  if (Math.abs(direction.y) <= EPSILON) return null;
  const t = (groundY - origin.y) / direction.y;
  if (t <= 0) return null;
  return pointAt(origin, direction, t);
}

export function intersectAimRayWithPlaneZ(
  origin: Readonly<AimVec3>,
  direction: Readonly<AimVec3>,
  planeZ: number,
): AimVec3 | null {
  if (!finite(origin) || !finite(direction) || !Number.isFinite(planeZ)) return null;
  if (Math.abs(direction.z) <= EPSILON) return null;
  const t = (planeZ - origin.z) / direction.z;
  if (t <= 0) return null;
  return pointAt(origin, direction, t);
}
