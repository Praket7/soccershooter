import { describe, expect, test } from 'vitest';
import type { InputIntent } from '@soccershooter/sim';
import { PlayerActionBits } from '@soccershooter/sim/player/PlayerState';
import { resolvePointerButtonDown } from './ActionMap';
import {
  CLOSE_CONTROL_MOVE_SCALE,
  resolveDribbleIntent,
  resolveStepOverBallVelocity,
  resolveElasticoBallVelocity,
  resolveStepOverExitIntent,
  resolveTechniqueMovementAuthority,
  resolveElasticoOutsideTouchVelocity,
  resolveElasticoExitDirectionForFoot,
  resolveElasticoBallAnchor,
  resolveTechniqueExitDirection,
  resolveTravelFacingYaw,
  shapeFootballMovementIntent,
  updateShotFacingLock,
} from './FootballControl';

describe('Stage 05 owner control feedback', () => {
  test('dribble direction follows the newly requested camera-relative input, not old player velocity', () => {
    const intent: InputIntent = {
      moveX: 1,
      moveY: 0,
      aimYaw: 0,
      sprint: true,
      actionBits: 0,
    };
    const resolved = resolveDribbleIntent(intent, { x: 0, z: 1 });
    expect(resolved.magnitude).toBeCloseTo(1, 8);
    expect(resolved.direction.x).toBeCloseTo(-1, 8);
    expect(resolved.direction.z).toBeCloseTo(0, 8);
  });

  test('a step-over carries the player into its left exit lane even when movement is released', () => {
    const intent: InputIntent = { moveX: 0, moveY: 0, aimYaw: 0, sprint: true, actionBits: 0 };
    const exit = resolveStepOverExitIntent(intent, { x: -1, z: 0 });
    const direction = resolveDribbleIntent(exit, { x: 0, z: 1 });

    expect(exit.sprint).toBe(true);
    expect(direction.magnitude).toBeCloseTo(0.72, 8);
    expect(direction.direction.x).toBeCloseTo(-1, 8);
    expect(direction.direction.z).toBeCloseTo(0, 8);
  });

  test('step-over exit touch inherits runner momentum instead of launching at a fixed speed', () => {
    const carry = resolveStepOverBallVelocity({ x: 0, z: 5 }, { x: -1, z: 0 });
    const stop = resolveStepOverBallVelocity({ x: 0, z: 0 }, { x: -1, z: 0 });
    expect(carry).toEqual({ x: -0.38, y: 0, z: 5 });
    expect(Math.hypot(stop.x, stop.z)).toBeCloseTo(1.8);
  });

  test('elastico exit stays near runner pace instead of dropping behind at a sprint', () => {
    const sprintExit = resolveElasticoBallVelocity({ x: 0, z: 7 }, { x: 0.8, z: 0.6 });
    const standingExit = resolveElasticoBallVelocity({ x: 0, z: 0 }, { x: 0.8, z: 0.6 });
    expect(Math.hypot(sprintExit.x, sprintExit.z)).toBeLessThan(7.7);
    expect(sprintExit.z).toBeGreaterThan(7);
    expect(Math.hypot(standingExit.x, standingExit.z)).toBeCloseTo(2.2, 8);
  });

  test('technique exit stays in front of the body through backward or sideways input', () => {
    const backward = resolveTechniqueExitDirection({ x: 0, z: -1 }, 0);
    const sideways = resolveTechniqueExitDirection({ x: 1, z: 0 }, 0);
    expect(backward.z).toBeGreaterThan(0.55);
    expect(sideways.z).toBeGreaterThan(0.55);
    expect(Math.hypot(backward.x, backward.z)).toBeCloseTo(1, 8);
    expect(Math.hypot(sideways.x, sideways.z)).toBeCloseTo(1, 8);
  });

  test('skill windup preserves running authority instead of braking the athlete', () => {
    expect(resolveTechniqueMovementAuthority(1, true)).toBe(1);
    expect(resolveTechniqueMovementAuthority(0.28, true)).toBe(0.28);
    expect(resolveTechniqueMovementAuthority(1, false)).toBe(1);
  });

  test('elastico outside touch carries the runner velocity before cutting across', () => {
    const running = resolveElasticoOutsideTouchVelocity({ x: 0, z: 6 }, { x: 1, z: 0 });
    const standing = resolveElasticoOutsideTouchVelocity({ x: 0, z: 0 }, { x: 1, z: 0 });
    expect(running).toEqual({ x: 0.75, y: 0, z: 6 });
    expect(Math.hypot(standing.x, standing.z)).toBeCloseTo(0.9, 8);
  });

  test('Elastico snap reverses the actual contact foot’s outside push', () => {
    const rightFoot = resolveElasticoExitDirectionForFoot(0, 'right');
    const leftFoot = resolveElasticoExitDirectionForFoot(0, 'left');
    expect(rightFoot.x).toBeLessThan(-0.5);
    expect(leftFoot.x).toBeGreaterThan(0.5);
    expect(rightFoot.z).toBeGreaterThan(0.5);
    expect(leftFoot.z).toBeGreaterThan(0.5);
  });

  test('Elastico ball anchor rolls outward around the foot then cuts across into the exit lane', () => {
    const start = { x: 0, z: 0.68 };
    const outside = resolveElasticoBallAnchor(0.55, 'right', start);
    const cut = resolveElasticoBallAnchor(0.94, 'right', start);
    const finish = resolveElasticoBallAnchor(1, 'right', start);
    expect(resolveElasticoBallAnchor(0, 'right', start)).toEqual(start);
    expect(outside.x).toBeGreaterThan(0.4);
    expect(cut.x).toBeLessThan(-0.2);
    expect(finish.z).toBeGreaterThan(0.85);
  });

  test('football body-facing follows travel direction during a reversal instead of stale camera yaw', () => {
    const reversed = resolveTravelFacingYaw({ x: 0, z: -6.5 }, 0);
    expect(Math.abs(Math.abs(reversed) - Math.PI)).toBeLessThan(1e-8);

    const idle = resolveTravelFacingYaw({ x: 0.05, z: 0.02 }, 0.7);
    expect(idle).toBeCloseTo(0.7, 8);
  });

  test('shot contact follows the visible current body as the player turns toward mouse aim', () => {
    const begin = updateShotFacingLock(null, PlayerActionBits.ShootHeld, 0.15);
    expect(begin.contactFacingYaw).toBeCloseTo(0.15, 8);

    const continued = updateShotFacingLock(begin.latchedYaw, PlayerActionBits.ShootHeld, 1.05);
    expect(continued.contactFacingYaw).toBeCloseTo(1.05, 8);

    const released = updateShotFacingLock(continued.latchedYaw, PlayerActionBits.ShootReleased, 1.05);
    expect(released.latchedYaw).toBeNull();
    expect(released.contactFacingYaw).toBeCloseTo(1.05, 8);
  });

  test('the first unlocked primary pointer-down requests camera capture and emits no football action', () => {
    const result = resolvePointerButtonDown({
      primaryDown: false,
      secondaryDown: false,
      button: 0,
      pointerLocked: false,
    });
    expect(result.requestPointerLock).toBe(true);
    expect(result.primaryDown).toBe(false);
    expect(result.actionBits & PlayerActionBits.ShootHeld).toBe(0);
  });

  test('RMB close control lowers locomotion authority and disables sprint while preserving requested direction', () => {
    const intent: InputIntent = {
      moveX: 0.6,
      moveY: 0.8,
      aimYaw: 0.4,
      sprint: true,
      actionBits: PlayerActionBits.Precision,
    };
    const shaped = shapeFootballMovementIntent(intent);
    expect(shaped.sprint).toBe(false);
    expect(Math.hypot(shaped.moveX, shaped.moveY)).toBeCloseTo(CLOSE_CONTROL_MOVE_SCALE, 8);
    expect(shaped.moveX / shaped.moveY).toBeCloseTo(intent.moveX / intent.moveY, 8);
  });

  test('normal locomotion is unchanged when close control is not held', () => {
    const intent: InputIntent = {
      moveX: -0.4,
      moveY: 0.7,
      aimYaw: -0.2,
      sprint: true,
      actionBits: 0,
    };
    expect(shapeFootballMovementIntent(intent)).toEqual(intent);
  });
});
