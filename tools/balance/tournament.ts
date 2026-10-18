import { runTacticalTournament, type TacticalTournamentOptions, type TacticalTournamentReport } from './tacticalTournament';

export * from './tacticalTournament';

export interface TacticalTournamentGateResult {
  pass: boolean;
  failures: string[];
}

export function evaluateTacticalTournamentGate(report: Readonly<TacticalTournamentReport>): TacticalTournamentGateResult {
  const failures: string[] = [];
  if (report.possessionsCompleted !== report.possessionsRequested) failures.push('not all requested possessions completed');
  if (report.failures !== 0) failures.push(`simulation failures=${report.failures}`);
  if (report.keeperAbandonments !== 0) failures.push(`keeper abandonments=${report.keeperAbandonments}`);
  if (report.permanentSwarmPossessions !== 0) failures.push(`permanent swarm possessions=${report.permanentSwarmPossessions}`);
  if (report.clusterRatio >= 0.12) failures.push(`cluster ratio=${report.clusterRatio.toFixed(4)} >= 0.12`);
  if (report.idleRatio >= 0.08) failures.push(`idle ratio=${report.idleRatio.toFixed(4)} >= 0.08`);
  if (report.passAttempts <= report.possessionsCompleted * 0.65) failures.push('passing is not common enough');
  if (report.completedPasses <= report.passAttempts * 0.52) failures.push('pass completion is below the useful-passing floor');
  if (report.multiPassPossessions <= report.possessionsCompleted * 0.18) failures.push('multi-pass possessions are too rare');
  if (report.shots <= 0) failures.push('no shots produced');
  if (report.averageSupportDistance <= 3.2 || report.averageSupportDistance >= 10.5) {
    failures.push(`average support distance=${report.averageSupportDistance.toFixed(3)} outside (3.2, 10.5)`);
  }
  if (report.averageDecisionMsPerTeam >= 1) failures.push(`average tactical decision=${report.averageDecisionMsPerTeam.toFixed(4)}ms >= 1ms`);
  if (report.maxDecisionMsPerTeam >= 12) failures.push(`max tactical decision=${report.maxDecisionMsPerTeam.toFixed(4)}ms >= 12ms`);
  return { pass: failures.length === 0, failures };
}

function parseCli(): TacticalTournamentOptions {
  let possessions = 5000;
  let seed = 0x51a6e006;
  for (const argument of process.argv.slice(2)) {
    if (argument.startsWith('--possessions=')) possessions = Number(argument.slice('--possessions='.length));
    if (argument.startsWith('--seed=')) seed = Number(argument.slice('--seed='.length));
  }
  return { possessions, seed };
}

function main(): void {
  const report = runTacticalTournament(parseCli());
  const gate = evaluateTacticalTournamentGate(report);
  process.stdout.write(`${JSON.stringify({ ...report, gate }, null, 2)}\n`);
  if (!gate.pass) {
    process.stderr.write(`Stage 06 tactical tournament gate failed:\n- ${gate.failures.join('\n- ')}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith('tournament.ts')) main();