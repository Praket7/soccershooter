import { createPhysicalScrimmage, stepPhysicalScrimmage } from '../../packages/bots/src/physicalScrimmage';
import { BOT_DIFFICULTY_TIERS, type BotDifficultyTier } from '../../packages/bots/src/difficulty';
import { TEAM_PLAYSTYLES, type TeamPlaystyle } from '../../packages/bots/src/runtime';
import type { TeamId } from '../../packages/bots/src/types';

interface TeamAudit {
  goals: number;
  possessionTicks: number;
  passes: number;
  shots: number;
  saves: number;
  claims: number;
  supportSpaceTotal: number;
  supportSamples: number;
  idleFieldPlayerTicks: number;
  fieldPlayerTicks: number;
  carrierDecisionTicks: number;
  carrierShotIntentTicks: number;
  carrierPassIntentTicks: number;
  carrierDribbleIntentTicks: number;
}

interface MatchAudit {
  seed: number;
  homeStyle: TeamPlaystyle;
  awayStyle: TeamPlaystyle;
  homeTier: BotDifficultyTier;
  awayTier: BotDifficultyTier;
  kickoffTeam: TeamId;
  ticks: number;
  home: TeamAudit;
  away: TeamAudit;
  looseBallRatio: number;
  possessionChanges: number;
}

const emptyTeam = (): TeamAudit => ({
  goals: 0,
  possessionTicks: 0,
  passes: 0,
  shots: 0,
  saves: 0,
  claims: 0,
  supportSpaceTotal: 0,
  supportSamples: 0,
  idleFieldPlayerTicks: 0,
  fieldPlayerTicks: 0,
  carrierDecisionTicks: 0,
  carrierShotIntentTicks: 0,
  carrierPassIntentTicks: 0,
  carrierDribbleIntentTicks: 0,
});

function options(): { ticks: number; seeds: number } {
  const args = process.argv.slice(2);
  const value = (name: string, fallback: number) => {
    const arg = args.find((entry) => entry.startsWith(`--${name}=`));
    const parsed = arg ? Number(arg.slice(name.length + 3)) : fallback;
    if (!Number.isInteger(parsed) || parsed <= 0) throw new RangeError(`--${name} must be a positive integer`);
    return parsed;
  };
  return { ticks: value('ticks', 1800), seeds: value('seeds', 2) };
}

function auditMatch(
  seed: number,
  ticks: number,
  homeStyle: TeamPlaystyle,
  awayStyle: TeamPlaystyle,
  homeTier: BotDifficultyTier,
  awayTier: BotDifficultyTier,
  kickoffTeam: TeamId,
): MatchAudit {
  let state = createPhysicalScrimmage(seed, kickoffTeam);
  let previousEvent = state.lastEvent;
  const home = emptyTeam();
  const away = emptyTeam();

  for (let index = 0; index < ticks; index += 1) {
    state = stepPhysicalScrimmage(
      state,
      1 / 30,
      homeTier,
      {},
      undefined,
      { home: homeStyle, away: awayStyle },
      { home: homeTier, away: awayTier },
    );
    home.goals = state.score.home;
    away.goals = state.score.away;
    if (state.possessionTeam === 'home') home.possessionTicks += 1;
    if (state.possessionTeam === 'away') away.possessionTicks += 1;
    for (const contact of state.recentContacts) {
      if (contact.tick !== state.tick) continue;
      const team = contact.playerId.startsWith('h-') ? home : away;
      if (contact.kind === 'pass') team.passes += 1;
      if (contact.kind === 'shot') team.shots += 1;
    }
    if (state.lastEvent !== previousEvent) {
      if (state.lastEvent.startsWith('save:')) {
        const keeperTeam = state.lastEvent.includes(':h-gk:') ? 'home' : 'away';
        (keeperTeam === 'home' ? home : away).saves += 1;
      }
      if (state.lastEvent.startsWith('claim:')) {
        const keeperTeam = state.lastEvent.includes(':h-gk') ? 'home' : 'away';
        (keeperTeam === 'home' ? home : away).claims += 1;
      }
      previousEvent = state.lastEvent;
    }

    if (state.tick % 6 === 0) {
      for (const [teamId, runtime, own, opposing] of [
        ['home', state.homeRuntime, home, state.players.filter((player) => player.team === 'away')],
        ['away', state.awayRuntime, away, state.players.filter((player) => player.team === 'home')],
      ] as const) {
        const carrierIntent = runtime.lastIntents?.find((intent) => intent.role === 'ball-carrier');
        if (carrierIntent) {
          own.carrierDecisionTicks += 1;
          if (carrierIntent.action === 'shoot') own.carrierShotIntentTicks += 1;
          if (carrierIntent.action === 'pass') own.carrierPassIntentTicks += 1;
          if (carrierIntent.action === 'dribble') own.carrierDribbleIntentTicks += 1;
        }
        const support = runtime.lastIntents?.filter((intent) => intent.role === 'immediate-support' || intent.role === 'width-support') ?? [];
        for (const intent of support) {
          const nearestOpponent = Math.min(...opposing.map((opponent) => Math.hypot(intent.targetPosition.x - opponent.position.x, intent.targetPosition.z - opponent.position.z)), 8);
          own.supportSpaceTotal += nearestOpponent;
          own.supportSamples += 1;
        }
        for (const player of state.players.filter((candidate) => candidate.team === teamId && !candidate.goalkeeper)) {
          own.fieldPlayerTicks += 1;
          const distanceFromBall = Math.hypot(player.position.x - state.ball.position.x, player.position.z - state.ball.position.z);
          if (Math.hypot(player.velocity.x, player.velocity.z) < 0.18 && distanceFromBall > 3) own.idleFieldPlayerTicks += 1;
        }
      }
    }
  }

  return {
    seed,
    homeStyle,
    awayStyle,
    homeTier,
    awayTier,
    kickoffTeam,
    ticks: state.tick,
    home,
    away,
    looseBallRatio: state.looseBallTicks / Math.max(1, state.tick),
    possessionChanges: state.possessionChanges,
  };
}

export function runPhysicalStyleAudit(ticks = 1800, seeds = 2): MatchAudit[] {
  const matches: MatchAudit[] = [];
  const seedBase = 0x7b07a11;
  for (let styleIndex = 0; styleIndex < TEAM_PLAYSTYLES.length; styleIndex += 1) {
    const style = TEAM_PLAYSTYLES[styleIndex]!;
    for (let homeTierIndex = 0; homeTierIndex < BOT_DIFFICULTY_TIERS.length; homeTierIndex += 1) {
      const homeTier = BOT_DIFFICULTY_TIERS[homeTierIndex]!;
      for (let awayTierIndex = 0; awayTierIndex < BOT_DIFFICULTY_TIERS.length; awayTierIndex += 1) {
        const awayTier = BOT_DIFFICULTY_TIERS[awayTierIndex]!;
        for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
          const seed = (seedBase + styleIndex * 1000 + homeTierIndex * 100 + awayTierIndex * 10 + seedIndex) >>> 0;
          matches.push(auditMatch(seed, ticks, style, 'balanced', homeTier, awayTier, 'home'));
          matches.push(auditMatch(seed, ticks, 'balanced', style, awayTier, homeTier, 'away'));
        }
      }
    }
  }
  return matches;
}

function summarize(matches: readonly MatchAudit[]): object {
  const byStyle = TEAM_PLAYSTYLES.map((style) => {
    const games = matches.filter((match) => match.homeStyle === style || match.awayStyle === style);
    const homeGames = games.filter((match) => match.homeStyle === style);
    const awayGames = games.filter((match) => match.awayStyle === style);
    const goalsFor = [...homeGames.map((match) => match.home.goals), ...awayGames.map((match) => match.away.goals)];
    const goalsAgainst = [...homeGames.map((match) => match.away.goals), ...awayGames.map((match) => match.home.goals)];
    const teamAudits = [...homeGames.map((match) => match.home), ...awayGames.map((match) => match.away)];
    const totalTicks = teamAudits.reduce((sum, team) => sum + team.possessionTicks, 0);
    const totalShots = teamAudits.reduce((sum, team) => sum + team.shots, 0);
    const totalSaves = teamAudits.reduce((sum, team) => sum + team.saves, 0);
    const passes = teamAudits.reduce((sum, team) => sum + team.passes, 0);
    const supportSamples = teamAudits.reduce((sum, team) => sum + team.supportSamples, 0);
    const supportSpace = teamAudits.reduce((sum, team) => sum + team.supportSpaceTotal, 0);
    const idle = teamAudits.reduce((sum, team) => sum + team.idleFieldPlayerTicks, 0);
    const fieldTicks = teamAudits.reduce((sum, team) => sum + team.fieldPlayerTicks, 0);
    const carrierDecisionTicks = teamAudits.reduce((sum, team) => sum + team.carrierDecisionTicks, 0);
    const carrierShotIntentTicks = teamAudits.reduce((sum, team) => sum + team.carrierShotIntentTicks, 0);
    const carrierPassIntentTicks = teamAudits.reduce((sum, team) => sum + team.carrierPassIntentTicks, 0);
    const carrierDribbleIntentTicks = teamAudits.reduce((sum, team) => sum + team.carrierDribbleIntentTicks, 0);
    return {
      style,
      matches: games.length,
      goalsFor: goalsFor.reduce((sum, value) => sum + value, 0),
      goalsAgainst: goalsAgainst.reduce((sum, value) => sum + value, 0),
      possessionShare: totalTicks / Math.max(1, games.reduce((sum, match) => sum + match.ticks, 0)),
      passesPerMatch: passes / Math.max(1, games.length),
      shotsPerMatch: totalShots / Math.max(1, games.length),
      shotIntentShare: carrierShotIntentTicks / Math.max(1, carrierDecisionTicks),
      passIntentShare: carrierPassIntentTicks / Math.max(1, carrierDecisionTicks),
      dribbleIntentShare: carrierDribbleIntentTicks / Math.max(1, carrierDecisionTicks),
      goalkeeperSavesPerMatch: totalSaves / Math.max(1, games.length),
      meanSupportSpaceMetres: supportSpace / Math.max(1, supportSamples),
      stationaryPlayerSampleRatio: idle / Math.max(1, fieldTicks),
    };
  });
  const byTier = BOT_DIFFICULTY_TIERS.flatMap((tier) => ['home', 'away'].map((side) => {
    const teams = matches.map((match) => side === 'home' ? match.home : match.away)
      .filter((_, index) => {
        const match = matches[index]!;
        return (side === 'home' ? match.homeTier : match.awayTier) === tier;
      });
    const matchesAtTier = matches.filter((match) => (side === 'home' ? match.homeTier : match.awayTier) === tier);
    return {
      tier,
      side,
      matches: matchesAtTier.length,
      goals: teams.reduce((sum, team) => sum + team.goals, 0),
      passes: teams.reduce((sum, team) => sum + team.passes, 0),
      shots: teams.reduce((sum, team) => sum + team.shots, 0),
      saves: teams.reduce((sum, team) => sum + team.saves, 0),
      possessionShare: teams.reduce((sum, team) => sum + team.possessionTicks, 0) / Math.max(1, matchesAtTier.reduce((sum, match) => sum + match.ticks, 0)),
    };
  }));
  const totalGames = matches.length;
  const meanLoose = matches.reduce((sum, match) => sum + match.looseBallRatio, 0) / Math.max(1, totalGames);
  const draws = matches.filter((match) => match.home.goals === match.away.goals).length;
  return { generatedAt: new Date().toISOString(), seedPolicy: 'deterministic mirrored style-vs-balanced pairs; separate tier for each team', matchCount: totalGames, meanLooseBallRatio: meanLoose, drawRate: draws / Math.max(1, totalGames), styleSummary: byStyle, tierSummary: byTier, matches };
}

if (process.argv[1]?.endsWith('physicalStyleAudit.ts')) {
  const { ticks, seeds } = options();
  process.stdout.write(`${JSON.stringify(summarize(runPhysicalStyleAudit(ticks, seeds)), null, 2)}\n`);
}
