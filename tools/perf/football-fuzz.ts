import { buildControlTouch } from '../../packages/sim/src/football/controlEnvelope';
import { solvePass, type PassType } from '../../packages/sim/src/football/passing';
import { buildShot, type ShotStyle } from '../../packages/sim/src/football/shooting';
import {
  createDefenderActionState,
  evaluateInterception,
  resolveChallenge,
} from '../../packages/sim/src/football/defending';
import { evaluateAerialContact, type AerialContactKind } from '../../packages/sim/src/football/aerial';
import {
  applyBallContact,
  magnitude3,
  type BallContactCommand,
  type FootballActorSnapshot,
  type FootballBallSnapshot,
} from '../../packages/sim/src/football/types';

export interface FootballFuzzOptions {
  cases?: number;
  seed?: number;
}

export interface FootballFuzzReport {
  cases: number;
  actionsChecked: number;
  contactsApplied: number;
  failures: number;
  checksum: string;
  maxImpulseObserved: number;
  maxResultSpeed: number;
}

const PASS_TYPES: readonly PassType[] = ['ground', 'driven', 'lofted', 'through'];
const SHOT_STYLES: readonly ShotStyle[] = ['normal', 'driven', 'finesse', 'chip', 'knuckle', 'outside-foot'];
const AERIAL_KINDS: readonly AerialContactKind[] = ['header', 'volley'];

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function range(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

function choose<T>(random: () => number, values: readonly T[]): T {
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]!;
}

function finiteValues(values: readonly number[]): boolean {
  return values.every(Number.isFinite);
}

function hashWord(hash: number, value: number): number {
  let result = hash >>> 0;
  let word = value >>> 0;
  for (let index = 0; index < 4; index += 1) {
    result ^= word & 0xff;
    result = Math.imul(result, 0x01000193) >>> 0;
    word >>>= 8;
  }
  return result;
}

function quantize(value: number): number {
  if (!Number.isFinite(value)) return 0x7fffffff;
  return Math.trunc(value * 10000) | 0;
}

function actorFrom(random: () => number): FootballActorSnapshot {
  const yaw = range(random, -Math.PI, Math.PI);
  const speed = range(random, 0, 9.2);
  const direction = yaw + range(random, -1.4, 1.4);
  return {
    position: { x: range(random, -8, 8), y: 0, z: range(random, -12, 10) },
    velocity: { x: Math.sin(direction) * speed, y: 0, z: Math.cos(direction) * speed },
    facingYaw: yaw,
    balance: range(random, 0.45, 1),
    pressure: range(random, 0, 1),
    sprinting: speed > 6.2,
    preferredFoot: random() < 0.5 ? 'left' : 'right',
  };
}

function ballNearActor(random: () => number, actor: Readonly<FootballActorSnapshot>): FootballBallSnapshot {
  const relativeAngle = actor.facingYaw + range(random, -2.7, 2.7);
  const distance = range(random, 0.15, 2.6);
  const speed = range(random, 0, 34);
  const velocityAngle = range(random, -Math.PI, Math.PI);
  return {
    position: {
      x: actor.position.x + Math.sin(relativeAngle) * distance,
      y: range(random, 0.11, 2.5),
      z: actor.position.z + Math.cos(relativeAngle) * distance,
    },
    velocity: {
      x: Math.sin(velocityAngle) * speed,
      y: range(random, -8, 8),
      z: Math.cos(velocityAngle) * speed,
    },
    angularVelocity: {
      x: range(random, -150, 150),
      y: range(random, -150, 150),
      z: range(random, -50, 50),
    },
    radius: 0.11,
    mass: 0.436,
    grounded: random() < 0.62,
  };
}

function validateCommand(
  ball: Readonly<FootballBallSnapshot>,
  command: Readonly<BallContactCommand> | undefined,
): { ok: boolean; impulse: number; resultSpeed: number; hashParts: number[] } {
  if (!command) return { ok: true, impulse: 0, resultSpeed: magnitude3(ball.velocity), hashParts: [0] };
  const requestedImpulse = ball.mass * magnitude3(command.deltaVelocity);
  const next = applyBallContact(ball, command);
  const positionUntouched = next.position.x === ball.position.x
    && next.position.y === ball.position.y
    && next.position.z === ball.position.z;
  const finite = finiteValues([
    next.position.x, next.position.y, next.position.z,
    next.velocity.x, next.velocity.y, next.velocity.z,
    next.angularVelocity.x, next.angularVelocity.y, next.angularVelocity.z,
    command.maxImpulse,
  ]);
  const resultSpeed = magnitude3(next.velocity);
  const appliedImpulse = ball.mass * Math.hypot(
    next.velocity.x - ball.velocity.x,
    next.velocity.y - ball.velocity.y,
    next.velocity.z - ball.velocity.z,
  );
  const bounded = appliedImpulse <= command.maxImpulse + 1e-8;
  return {
    ok: positionUntouched && finite && bounded && requestedImpulse >= 0,
    impulse: appliedImpulse,
    resultSpeed,
    hashParts: [
      quantize(next.velocity.x), quantize(next.velocity.y), quantize(next.velocity.z),
      quantize(next.angularVelocity.x), quantize(next.angularVelocity.y), quantize(next.angularVelocity.z),
      quantize(command.maxImpulse),
    ],
  };
}

export function runFootballFuzz(options: FootballFuzzOptions = {}): FootballFuzzReport {
  const cases = Math.max(1, Math.trunc(options.cases ?? 250_000));
  const random = lcg(options.seed ?? 0x5a1705);
  let failures = 0;
  let actionsChecked = 0;
  let contactsApplied = 0;
  let maxImpulseObserved = 0;
  let maxResultSpeed = 0;
  let hash = 0x811c9dc5;

  for (let index = 0; index < cases; index += 1) {
    const actor = actorFrom(random);
    const ball = ballNearActor(random, actor);
    const aimAngle = range(random, -Math.PI, Math.PI);
    const aim = { x: Math.sin(aimAngle), z: Math.cos(aimAngle) };

    const control = buildControlTouch({
      actor,
      ball,
      desiredDirection: aim,
      precision: random() < 0.35,
      sprint: random() < 0.3,
      pressure: range(random, 0, 1),
    });
    const receiver = {
      position: { x: actor.position.x + range(random, -18, 18), y: 0, z: actor.position.z + range(random, -6, 28) },
      velocity: { x: range(random, -7, 7), y: 0, z: range(random, -7, 7) },
    };
    const pass = solvePass({
      type: choose(random, PASS_TYPES),
      passer: actor,
      ball,
      receiver,
      userAim: aim,
      assist: range(random, 0, 1),
      pressure: range(random, 0, 1),
      allowBehindBodyTechnique: false,
    });
    const shot = buildShot({
      style: choose(random, SHOT_STYLES),
      shooter: actor,
      ball,
      aim,
      charge: range(random, 0, 1),
      spinInput: range(random, -1, 1),
      pressure: range(random, 0, 1),
      balance: range(random, 0.35, 1),
      contactFoot: random() < 0.5 ? 'left' : 'right',
    });
    const challenge = resolveChallenge({
      kind: random() < 0.48 ? 'standing' : 'committed',
      state: createDefenderActionState(),
      defender: actor,
      ball,
      opponentPosition: { x: ball.position.x + range(random, -0.8, 0.8), y: 0, z: ball.position.z + range(random, -0.8, 0.8) },
    });
    const interception = evaluateInterception({ defender: actor, ball, horizonSeconds: range(random, 0.05, 1.2) });
    const aerial = evaluateAerialContact({
      kind: choose(random, AERIAL_KINDS),
      actor,
      ball,
      jumpRequested: random() < 0.5,
    });

    const commands = [control.command, pass.command, shot.command, challenge.command] as const;
    for (const command of commands) {
      actionsChecked += 1;
      const result = validateCommand(ball, command);
      if (!result.ok) failures += 1;
      if (command) contactsApplied += 1;
      maxImpulseObserved = Math.max(maxImpulseObserved, result.impulse);
      maxResultSpeed = Math.max(maxResultSpeed, result.resultSpeed);
      for (const part of result.hashParts) hash = hashWord(hash, part);
    }

    const scalars = [
      control.quality, control.touchDistance, control.targetBallSpeed,
      pass.launchSpeed, pass.targetPoint.x, pass.targetPoint.z,
      shot.launchSpeed, shot.alignment, shot.effectiveBalance,
      challenge.nextState.recoverySeconds,
      interception.timeToWindow, interception.closestDistance,
      aerial.horizontalDistance, aerial.contactHeight, aerial.timingScore,
    ];
    if (!finiteValues(scalars)) failures += 1;
    hash = hashWord(hash, control.eligible ? 1 : 0);
    hash = hashWord(hash, pass.legal ? 1 : 0);
    hash = hashWord(hash, shot.legal ? 1 : 0);
    hash = hashWord(hash, challenge.wonBall ? 1 : 0);
    hash = hashWord(hash, interception.eligible ? 1 : 0);
    hash = hashWord(hash, aerial.eligible ? 1 : 0);
    for (const scalar of scalars) hash = hashWord(hash, quantize(scalar));
  }

  return {
    cases,
    actionsChecked,
    contactsApplied,
    failures,
    checksum: hash.toString(16).padStart(8, '0'),
    maxImpulseObserved,
    maxResultSpeed,
  };
}

function parseIntegerFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new RangeError(`${name} must be a positive integer`);
  return parsed;
}

if (process.argv[1]?.endsWith('football-fuzz.ts')) {
  const report = runFootballFuzz({
    cases: parseIntegerFlag('cases', 250_000),
    seed: parseIntegerFlag('seed', 0x5a1705),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.failures > 0) process.exitCode = 1;
}
