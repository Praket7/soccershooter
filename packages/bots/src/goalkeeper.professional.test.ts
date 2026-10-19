import { describe, expect, test } from 'vitest';
import { computeGoalkeeperDecision, goalkeeperHomePosition } from './goalkeeper';
import type { BotPlayerSnapshot, BotWorldSnapshot, TeamId, Vec3 } from './types';

const field = { halfWidth: 12, halfLength: 18, goalHalfWidth: 3.66, goalHeight: 2.44 } as const;

function player(id: string, team: TeamId, x: number, z: number, goalkeeper = false): BotPlayerSnapshot {
  return {
    id,
    team,
    position: { x, y: 0, z },
    velocity: { x: 0, y: 0, z: 0 },
    facingYaw: team === 'home' ? 0 : Math.PI,
    goalkeeper,
  };
}

function snapshot(
  ballPosition: Vec3,
  ballVelocity: Vec3,
  possessionTeam: TeamId | null,
  possessionPlayerId: string | null,
): BotWorldSnapshot {
  return {
    tick: 200,
    timeSeconds: 6,
    field,
    ball: { position: ballPosition, velocity: ballVelocity },
    players: [
      player('h-gk', 'home', 0, -16.5, true),
      player('h-1', 'home', -4, -7),
      player('a-gk', 'away', 0, 16.5, true),
      player('a-1', 'away', 0, -13),
      player('a-2', 'away', 4, -6),
    ],
    possessionTeam,
    possessionPlayerId,
  };
}

describe('professional goalkeeper decisions', () => {
  test('home positioning stays on the ball-to-goal-center cover line', () => {
    const world = snapshot(
      { x: 8, y: 0.11, z: 0 },
      { x: 0, y: 0, z: 0 },
      'away',
      'a-2',
    );
    const home = goalkeeperHomePosition(world, 'h-gk');
    const depthFromGoal = home.z + field.halfLength;
    const expectedX = world.ball.position.x * depthFromGoal / (world.ball.position.z + field.halfLength);

    expect(home.x).toBeCloseTo(expectedX, 6);
    expect(Math.abs(home.x)).toBeLessThan(field.goalHalfWidth);
  });

  test('does not dive for a trajectory projected above the crossbar', () => {
    const decision = computeGoalkeeperDecision(
      snapshot(
        { x: 0, y: 4, z: -5 },
        { x: 0, y: 3, z: -20 },
        'away',
        'a-2',
      ),
      'h-gk',
    );

    expect(decision.kind).toBe('position');
  });

  test('does not claim a ball still controlled by an attacker', () => {
    const decision = computeGoalkeeperDecision(
      snapshot(
        { x: 0, y: 0.11, z: -13 },
        { x: 0, y: 0, z: 0 },
        'away',
        'a-1',
      ),
      'h-gk',
    );

    expect(decision.kind).toBe('position');
  });

  test('can still claim the same dangerous ball once possession is loose', () => {
    const decision = computeGoalkeeperDecision(
      snapshot(
        { x: 0, y: 0.11, z: -13 },
        { x: 0, y: 0, z: 0 },
        null,
        null,
      ),
      'h-gk',
    );

    expect(decision.kind).toBe('claim');
  });
});
