import { advanceCampaign, CAMPAIGN_ACTS, enterLegacy, finishLegacyGauntlet, type CampaignEncounter } from '@soccershooter/progression/campaign';
import { ARCHETYPE_MODIFIERS, awardEncounter, createFreshProfile, importProfile, selectArchetype, type PlayerArchetype, type PlayerProfile } from '@soccershooter/progression';
import { LocalStorageProfileStore, type ProfileStore } from '@soccershooter/progression/save';
import { PUBLIC_TEAMS } from '@soccershooter/content/teams/catalog';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderRoadToLegend(host: HTMLElement, profile: Readonly<PlayerProfile>): void {
  const actIndex = CAMPAIGN_ACTS.findIndex((act) => act.id === profile.campaignActId);
  const activeAct = CAMPAIGN_ACTS[actIndex];
  const currentEncounter = activeAct?.encounters[profile.campaignEncounterIndex];
  host.innerHTML = `
    <section class="road-to-legend" data-road-to-legend>
      <p class="eyebrow">SOLO CAREER · LOCAL PROFILE</p>
      <h1>Road to Legend</h1>
      <div class="career-summary"><strong>OVR ${profile.presentationOvr}</strong><span>Level ${profile.level} · ${profile.xp} XP</span><span>${profile.victories} wins · ${profile.defeats} losses</span></div>
      <section data-build-paths><h2>Choose your play style</h2><p>Switch freely between technique, pace, and power builds.</p><div>${(['technical', 'pace', 'power'] as const).map((archetype) => `<button type="button" data-archetype="${archetype}" aria-pressed="${profile.archetype === archetype}">${archetype}</button>`).join('')}</div><p data-build-modifiers>Contact timing ${ARCHETYPE_MODIFIERS[profile.archetype].contactTimingTicks > 0 ? 'forgiveness' : 'risk'} · sprint stamina ×${ARCHETYPE_MODIFIERS[profile.archetype].sprintStaminaCostScale.toFixed(2)} · strike power ×${ARCHETYPE_MODIFIERS[profile.archetype].strikeImpulseScale.toFixed(2)}</p><p data-equipped-slots>Equipped: ${profile.equippedTechniqueSlots.map(escapeHtml).join(' · ')}</p></section>
      ${currentEncounter ? `<section data-current-encounter data-encounter-id="${escapeHtml(currentEncounter.id)}"><h2>${escapeHtml(activeAct.name)} · ${escapeHtml(currentEncounter.id)}</h2><p>Tactical challenge: ${escapeHtml(currentEncounter.tacticalProblem.replaceAll('-', ' '))}</p><p>Suggested techniques: ${currentEncounter.recommended.map(escapeHtml).join(' · ')}</p></section>` : ''}
      ${profile.campaignComplete ? '<p data-campaign-complete>Campaign complete · Legacy gauntlets continue your mastery run.</p>' : ''}
      <ol>${CAMPAIGN_ACTS.map((act, index) => `<li data-act="${act.id}" data-active="${index === actIndex}" data-complete="${index < actIndex || profile.campaignComplete}"><strong>${act.name}</strong><span>${act.encounters.length} tactical challenge${act.encounters.length === 1 ? '' : 's'}</span></li>`).join('')}
      <li data-act="legacy" data-active="${profile.legacySeed !== null}"><strong>Legacy</strong><span>Seeded gauntlets · mastery levels · personal bests</span></li></ol>
      <section><h2>Technique mastery</h2><ul>${Object.entries(profile.techniqueMastery).map(([id, value]) => `<li>${escapeHtml(id)}: ${value}/100</li>`).join('') || '<li>Earn mastery through matches</li>'}</ul></section>
      <section class="public-team-grid" data-public-teams><h2>Fictional public teams</h2>${PUBLIC_TEAMS.map((team) => `<article><img src="${team.badgeAsset}" alt="${escapeHtml(team.displayName)} original badge"><strong>${escapeHtml(team.displayName)}</strong><span>${team.tacticalProfile.replaceAll('-', ' ')}</span></article>`).join('')}</section>
    </section>`;
}

export class RoadToLegendScreen {
  readonly root: HTMLElement;
  #profile: PlayerProfile = createFreshProfile();
  #activeEncounterId: string | null = null;
  #activeLegacySeed: number | null = null;

  constructor(
    host: HTMLElement,
    private readonly onContinuePractice: () => void,
    private readonly store: ProfileStore = new LocalStorageProfileStore(window.localStorage),
    private readonly onProfileChange: (profile: Readonly<PlayerProfile>) => void = () => {},
    private readonly onStartEncounter: (encounter: CampaignEncounter | { id: string; tacticalProblem: string }) => void = () => {},
    private readonly onEndEncounter: () => void = () => {},
  ) {
    this.root = document.createElement('main');
    this.root.hidden = true;
    host.append(this.root);
    void this.#initialize();
  }

  async #initialize(): Promise<void> {
    try {
      this.#profile = await this.store.load() ?? createFreshProfile();
      await this.store.save(this.#profile);
    } catch {
      this.#profile = createFreshProfile();
    }
    this.onProfileChange(this.#profile);
    this.#render();
  }

  #render(): void {
    this.root.innerHTML = '';
    renderRoadToLegend(this.root, this.#profile);
    const controls = document.createElement('div');
    controls.className = 'career-actions';
    controls.innerHTML = '<button type="button" data-career-practice>Open practice</button><button type="button" data-career-start-encounter>Start current challenge</button><button type="button" data-career-start-legacy>Start Legacy gauntlet</button><button type="button" data-career-abandon-encounter>Abandon current challenge</button><button type="button" data-career-export>Export save</button><button type="button" data-career-import>Import save</button><input type="file" accept="application/json" data-career-file hidden>';
    this.root.append(controls);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-archetype]')) {
      button.addEventListener('click', () => {
        const archetype = button.dataset.archetype as PlayerArchetype;
        this.#profile = selectArchetype(this.#profile, archetype);
        this.onProfileChange(this.#profile);
        void this.store.save(this.#profile).then(() => this.#render());
      });
    }
    controls.querySelector('[data-career-practice]')?.addEventListener('click', this.onContinuePractice);
    const startEncounter = controls.querySelector<HTMLButtonElement>('[data-career-start-encounter]')!;
    startEncounter.hidden = this.#profile.campaignComplete || this.#activeEncounterId !== null;
    startEncounter.addEventListener('click', () => {
      const act = CAMPAIGN_ACTS.find(({ id }) => id === this.#profile.campaignActId);
      const encounter = act?.encounters[this.#profile.campaignEncounterIndex];
      if (!encounter) return;
      this.#activeEncounterId = encounter.id;
      this.onStartEncounter(encounter);
      this.#render();
    });
    const startLegacy = controls.querySelector<HTMLButtonElement>('[data-career-start-legacy]')!;
    startLegacy.hidden = !this.#profile.campaignComplete;
    startLegacy.addEventListener('click', () => {
      const seed = this.#profile.legacySeed ?? ((Math.imul(this.#profile.legacyLevel + 1, 1664525) + this.#profile.xp + 1013904223) >>> 0);
      this.#profile = enterLegacy(this.#profile, seed);
      this.#activeLegacySeed = seed;
      this.#activeEncounterId = `legacy-${this.#profile.legacyLevel}-${seed}`;
      void this.store.save(this.#profile);
      this.onStartEncounter({ id: this.#activeEncounterId, tacticalProblem: 'legacy-gauntlet' });
      this.#render();
    });
    const abandon = controls.querySelector<HTMLButtonElement>('[data-career-abandon-encounter]')!;
    abandon.hidden = this.#activeEncounterId === null;
    abandon.addEventListener('click', () => void this.abandonCurrentEncounter());
    controls.querySelector('[data-career-export]')?.addEventListener('click', () => this.#downloadSave());
    const input = controls.querySelector<HTMLInputElement>('[data-career-file]')!;
    controls.querySelector('[data-career-import]')?.addEventListener('click', () => input.click());
    input.addEventListener('change', () => void this.#importFile(input));
  }

  async notifyCampaignGoal(): Promise<void> {
    if (!this.#activeEncounterId) return;
    if (this.#activeLegacySeed !== null) {
      this.#profile = finishLegacyGauntlet(this.#profile, this.#activeLegacySeed, true, { score: 1, perfectClear: true });
      this.#activeLegacySeed = null;
    } else {
      const encounterId = this.#activeEncounterId;
      const seed = [...encounterId].reduce((hash, character) => (Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0), 2166136261);
      const awarded = awardEncounter(this.#profile, { encounterId, outcome: 'win', goalsFor: 1, goalsAgainst: 0, seed });
      this.#profile = advanceCampaign(awarded.profile, true);
    }
    this.#activeEncounterId = null;
    await this.store.save(this.#profile);
    this.onProfileChange(this.#profile);
    this.root.dataset.campaignResult = 'goal-scored';
    this.onEndEncounter();
    this.#render();
  }

  async abandonCurrentEncounter(): Promise<void> {
    if (!this.#activeEncounterId) return;
    if (this.#activeLegacySeed !== null) {
      this.#profile = finishLegacyGauntlet(this.#profile, this.#activeLegacySeed, false);
      this.#activeLegacySeed = null;
    } else {
      const encounterId = this.#activeEncounterId;
      const seed = [...encounterId].reduce((hash, character) => (Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0), 2166136261);
      this.#profile = awardEncounter(this.#profile, { encounterId, outcome: 'loss', goalsFor: 0, goalsAgainst: 0, seed }).profile;
    }
    this.#activeEncounterId = null;
    await this.store.save(this.#profile);
    this.onProfileChange(this.#profile);
    this.onEndEncounter();
    this.#render();
  }

  async #importFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.#profile = importProfile(await file.text());
      this.onProfileChange(this.#profile);
      await this.store.save(this.#profile);
      this.#render();
    } catch {
      this.root.dataset.importError = 'invalid-save';
    }
    input.value = '';
  }

  #downloadSave(): void {
    const blob = new Blob([JSON.stringify(this.#profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'soccershooter-save.json';
    link.click();
    URL.revokeObjectURL(url);
  }
}
