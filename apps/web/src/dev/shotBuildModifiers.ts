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
  const launchVelocity = {
    x: scaledVelocity.x * velocityScale,
    y: scaledVelocity.y * velocityScale,
    z: scaledVelocity.z * velocityScale,
  };
  return {
    launchVelocity,
    command: command ? {
      ...command,
      deltaVelocity: {
        x: launchVelocity.x - (shot.launchVelocity.x - command.deltaVelocity.x),
        y: launchVelocity.y - (shot.launchVelocity.y - command.deltaVelocity.y),
        z: launchVelocity.z - (shot.launchVelocity.z - command.deltaVelocity.z),
      },
      maxImpulse: Math.min(command.maxImpulse * scale, MAX_LEGAL_SHOT_IMPULSE),
      diagnostic: `${command.diagnostic} build-power=${scale.toFixed(2)}`,
    } : undefined,
  };
}
