import type { BallContactCommand, FootballVec3 } from '@soccershooter/sim/football/types';

export const MAX_LEGAL_SHOT_SPEED = 36;
export const MAX_LEGAL_SHOT_IMPULSE = 15.5;

export function applyShotBuildModifier(
  shot: { launchVelocity: FootballVec3; command?: BallContactCommand },
  scale: number,
): { launchVelocity: FootballVec3; command: BallContactCommand | undefined } {
  const scaledVelocity = {
    x: shot.launchVelocity.x * scale,
    y: shot.launchVelocity.y * scale,
    z: shot.launchVelocity.z * scale,
  };
  const speed = Math.hypot(scaledVelocity.x, scaledVelocity.y, scaledVelocity.z);
  const velocityScale = speed > MAX_LEGAL_SHOT_SPEED ? MAX_LEGAL_SHOT_SPEED / speed : 1;
  const command = shot.command;
  return {
    launchVelocity: {
      x: scaledVelocity.x * velocityScale,
      y: scaledVelocity.y * velocityScale,
      z: scaledVelocity.z * velocityScale,
    },
    command: command ? {
      ...command,
      deltaVelocity: {
        x: command.deltaVelocity.x * scale,
        y: command.deltaVelocity.y * scale,
        z: command.deltaVelocity.z * scale,
      },
      maxImpulse: Math.min(command.maxImpulse * scale, MAX_LEGAL_SHOT_IMPULSE),
      diagnostic: `${command.diagnostic} build-power=${scale.toFixed(2)}`,
    } : undefined,
  };
}
