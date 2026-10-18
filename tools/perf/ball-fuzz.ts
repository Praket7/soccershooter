import { pathToFileURL } from 'node:url';
import { BALL_CONSTANTS, assertFiniteBallState, createBallState } from '../../packages/physics/src/ball/BallState';
import { BALL_SUBSTEP_DT, STANDARD_GOAL_FRAME, stepBall } from '../../packages/physics/src/ball/trajectory';
import { magnitude } from '../../packages/physics/src/ball/vector';

export interface BallFuzzOptions {
  launches: number;
  seed: number;
  substepsPerLaunch: number;
}

export interface BallFuzzResult {
  launches: number;
  failures: number;
  checksum: string;
  maxSpeedObserved: number;
  maxSpinObserved: number;
  statesChecked: number;
}

interface RngState {
  value: number;
}

function nextU32(rng: RngState): number {
  let x = rng.value >>> 0;
  if (x === 0) x = 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rng.value = x >>> 0;
  return rng.value;
}

function unit(rng: RngState): number {
  return nextU32(rng) / 0x1_0000_0000;
}

function between(rng: RngState, min: number, max: number): number {
  return min + (max - min) * unit(rng);
}

function mixChecksum(hash: number, value: number): number {
  const quantized = Math.trunc(value * 10_000);
  hash ^= quantized;
  return Math.imul(hash, 0x01000193) >>> 0;
}

function parseIntegerFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const argument = process.argv.find((entry) => entry.startsWith(prefix));
  if (!argument) return fallback;
  const parsed = Number(argument.slice(prefix.length));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function runBallFuzz(options: BallFuzzOptions): BallFuzzResult {
  const launches = Math.max(0, Math.trunc(options.launches));
  const substepsPerLaunch = Math.max(1, Math.trunc(options.substepsPerLaunch));
  const rng: RngState = { value: options.seed >>> 0 || 0x4ba11 };
  let failures = 0;
  let checksum = 0x811c9dc5;
  let maxSpeedObserved = 0;
  let maxSpinObserved = 0;
  let statesChecked = 0;

  for (let launchIndex = 0; launchIndex < launches; launchIndex += 1) {
    const speed = between(rng, 0, 45);
    const elevation = between(rng, -5, 50) * Math.PI / 180;
    const azimuth = between(rng, -Math.PI, Math.PI);
    const horizontalSpeed = Math.cos(elevation) * speed;
    const spinRate = between(rng, 0, 180);
    const spinPolar = between(rng, 0, Math.PI);
    const spinAzimuth = between(rng, -Math.PI, Math.PI);
    const sinPolar = Math.sin(spinPolar);

    let state = createBallState({
      position: {
        x: between(rng, -4.5, 4.5),
        y: BALL_CONSTANTS.radius + between(rng, 0, 1.5),
        z: between(rng, -8, 10.5),
      },
      velocity: {
        x: Math.sin(azimuth) * horizontalSpeed,
        y: Math.sin(elevation) * speed,
        z: Math.cos(azimuth) * horizontalSpeed,
      },
      angularVelocity: {
        x: Math.sin(spinAzimuth) * sinPolar * spinRate,
        y: Math.cos(spinPolar) * spinRate,
        z: Math.cos(spinAzimuth) * sinPolar * spinRate,
      },
      knuckleSeed: nextU32(rng),
    });

    try {
      assertFiniteBallState(state);
      for (let substep = 0; substep < substepsPerLaunch; substep += 1) {
        state = stepBall(state, BALL_SUBSTEP_DT, undefined, STANDARD_GOAL_FRAME);
        assertFiniteBallState(state);
        statesChecked += 1;
        maxSpeedObserved = Math.max(maxSpeedObserved, magnitude(state.velocity));
        maxSpinObserved = Math.max(maxSpinObserved, magnitude(state.angularVelocity));
      }
      checksum = mixChecksum(checksum, state.position.x);
      checksum = mixChecksum(checksum, state.position.y);
      checksum = mixChecksum(checksum, state.position.z);
      checksum = mixChecksum(checksum, state.velocity.x);
      checksum = mixChecksum(checksum, state.velocity.y);
      checksum = mixChecksum(checksum, state.velocity.z);
    } catch {
      failures += 1;
      checksum = Math.imul(checksum ^ launchIndex, 0x01000193) >>> 0;
    }
  }

  return {
    launches,
    failures,
    checksum: checksum.toString(16).padStart(8, '0'),
    maxSpeedObserved,
    maxSpinObserved,
    statesChecked,
  };
}

function runCli(): void {
  const result = runBallFuzz({
    launches: parseIntegerFlag('launches', 1_000_000),
    seed: parseIntegerFlag('seed', 0x4ba11),
    substepsPerLaunch: parseIntegerFlag('substeps', 4),
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.failures !== 0) process.exitCode = 1;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) runCli();
