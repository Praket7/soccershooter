import { describe, expect, test } from 'vitest';
import { Scene } from 'three';
import { BALL_CONSTANTS, createBallState, type BallState } from '../../../../packages/physics/src/ball/BallState';
import { MATCH_BALL_PROFILE } from '../../../../packages/physics/src/ball/aerodynamics';
import { BALL_SUBSTEP_DT, stepBall } from '../../../../packages/physics/src/ball/trajectory';
import { createPlayerState } from '../../../../packages/sim/src/player/PlayerState';
import { constrainBodyTurnToBall } from '../../../../packages/sim/src/player/athleticMotion';
import { createFlatMovementWorld, stepPlayerMovement } from '../../../../packages/sim/src/player/movement';
import { createPlannedDribbleState, stepPlannedDribble } from '../../../../packages/sim/src/football/dribblePlanner';
import type { FootballActorSnapshot, FootballBallSnapshot } from '../../../../packages/sim/src/football/types';
import { ProceduralAthleteProxy } from './ProceduralAthleteProxy';

const DT = 1 / 60;
const WORLD = createFlatMovementWorld({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 });

function snapshot(ball: Readonly<BallState>): FootballBallSnapshot {
  return {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    angularVelocity: { ...ball.angularVelocity },
    radius: BALL_CONSTANTS.radius,
    mass: BALL_CONSTANTS.mass,
    grounded: ball.grounded,
  };
}

function applyContact(ball: BallState, velocity: FootballBallSnapshot['velocity'], angularVelocity: FootballBallSnapshot['angularVelocity']): BallState {
  return { ...ball, velocity: { ...velocity }, angularVelocity: { ...angularVelocity } };
}

describe('rendered 180-degree dribble reversal', () => {
  test('the ball stays in front of the avatar while its body turns through the reversal', () => {
    const proxy = new ProceduralAthleteProxy(new Scene());
    let player = createPlayerState({ position: { x: 0, y: 0, z: 0 }, facingYaw: 0 });
    let ball = createBallState({ position: { x: 0, y: BALL_CONSTANTS.radius, z: 0.68 }, grounded: true });
    let planner = createPlannedDribbleState();
    let maximumBehindDistance = 0;
    let maximumBehindDetails = '';

    for (let tick = 0; tick < 150; tick += 1) {
      const reversing = tick >= 48;
      const aimYaw = reversing ? Math.PI : 0;
      player = stepPlayerMovement(player, {
        moveX: 0,
        moveY: 1,
        aimYaw,
        sprint: false,
        actionBits: 0,
      }, WORLD, DT);
      const actor: FootballActorSnapshot = {
        position: { ...player.position },
        velocity: { ...player.velocity },
        facingYaw: player.athleticMotion.bodyYaw,
        balance: 1,
        pressure: 0,
        sprinting: false,
        preferredFoot: 'right',
      };
      const direction = { x: Math.sin(aimYaw), z: Math.cos(aimYaw) };
      const result = stepPlannedDribble({
        tick,
        state: planner,
        actor,
        motion: player.athleticMotion,
        ball: snapshot(ball),
        desiredDirection: direction,
        precision: false,
        sprint: false,
        pressure: 0,
        moveIntentMagnitude: 1,
        receiveMode: null,
      });
      planner = result.state;
      if (result.contactApplied) ball = applyContact(ball, result.ball.velocity, result.ball.angularVelocity);
      ball = stepBall(stepBall(ball, BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null), BALL_SUBSTEP_DT, MATCH_BALL_PROFILE, null);
      if (reversing && Math.hypot(ball.position.x - player.position.x, ball.position.z - player.position.z) <= 1.5) {
        player.athleticMotion = constrainBodyTurnToBall(player.athleticMotion, player.position, ball.position, DT);
      }
      proxy.update({ player, plan: planner.activePlan, simulationTick: tick, interpolationAlpha: 1 });

      if (reversing) {
        const facing = { x: Math.sin(proxy.group.rotation.y), z: Math.cos(proxy.group.rotation.y) };
        const relative = { x: ball.position.x - player.position.x, z: ball.position.z - player.position.z };
        const behind = -(relative.x * facing.x + relative.z * facing.z);
        if (behind > maximumBehindDistance) {
          maximumBehindDistance = behind;
          maximumBehindDetails = JSON.stringify({ tick, yaw: proxy.group.rotation.y, bodyYaw: player.athleticMotion.bodyYaw, player: player.position, ball: ball.position, velocity: ball.velocity, relative, behind });
        }
      }
    }

    proxy.dispose();
    expect(maximumBehindDistance, maximumBehindDetails).toBeLessThan(0.28);
  });
});
