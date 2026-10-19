import { CAMPAIGN_ACTS } from '@soccershooter/progression/campaign';
import { ARCHETYPE_MODIFIERS, createFreshProfile, importProfile, selectArchetype, type PlayerArchetype, type PlayerProfile } from '@soccershooter/progression';
import { LocalStorageProfileStore, type ProfileStore } from '@soccershooter/progression/save';
import { PUBLIC_TEAMS } from '@soccershooter/content/teams/catalog';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function renderRoadToLegend(host: HTMLElement, profile: Readonly<PlayerProfile>): void {
  const actIndex = CAMPAIGN_ACTS.findIndex((act) => act.id === profile.campaignActId);
  host.innerHTML = `
    <section class="road-to-legend" data-road-to-legend>
      <p class="eyebrow">SOLO CAREER · LOCAL PROFILE</p>
      <h1>Road to Legend</h1>
      <div class="career-summary"><strong>OVR ${profile.presentationOvr}</strong><span>Level ${profile.level} · ${profile.xp} XP</span><span>${profile.victories} wins · ${profile.defeats} losses</span></div>
      <section data-build-paths><h2>Choose your play style</h2><p>Switch freely between technique, pace, and power builds.</p><div>${(['technical', 'pace', 'power'] as const).map((archetype) => `<button type="button" data-archetype="${archetype}" aria-pressed="${profile.archetype === archetype}">${archetype}</button>`).join('')}</div><p data-build-modifiers>Contact timing ${ARCHETYPE_MODIFIERS[profile.archetype].contactTimingTicks > 0 ? 'forgiveness' : 'risk'} · sprint stamina ×${ARCHETYPE_MODIFIERS[profile.archetype].sprintStaminaCostScale.toFixed(2)} · strike power ×${ARCHETYPE_MODIFIERS[profile.archetype].strikeImpulseScale.toFixed(2)}</p><p data-equipped-slots>Equipped: ${profile.equippedTechniqueSlots.map(escapeHtml).join(' · ')}</p></section>
      <ol>${CAMPAIGN_ACTS.map((act, index) => `<li data-act="${act.id}" data-active="${index === actIndex}" data-complete="${index < actIndex || profile.campaignComplete}"><strong>${act.name}</strong><span>${act.encounters.length} tactical challenge${act.encounters.length === 1 ? '' : 's'}</span></li>`).join('')}
      <li data-act="legacy" data-active="${profile.legacySeed !== null}"><strong>Legacy</strong><span>Seeded gauntlets · mastery levels · personal bests</span></li></ol>
      <section><h2>Technique mastery</h2><ul>${Object.entries(profile.techniqueMastery).map(([id, value]) => `<li>${escapeHtml(id)}: ${value}/100</li>`).join('') || '<li>Earn mastery through matches</li>'}</ul></section>
      <section class="public-team-grid" data-public-teams><h2>Fictional public teams</h2>${PUBLIC_TEAMS.map((team) => `<article><img src="${team.badgeAsset}" alt="${escapeHtml(team.displayName)} original badge"><strong>${escapeHtml(team.displayName)}</strong><span>${team.tacticalProfile.replaceAll('-', ' ')}</span></article>`).join('')}</section>
    </section>`;
}

export class RoadToLegendScreen {
  readonly root: HTMLElement;
  #profile: PlayerProfile = createFreshProfile();

  constructor(host: HTMLElement, private readonly onContinuePractice: () => void, private readonly store: ProfileStore = new LocalStorageProfileStore(window.localStorage)) {
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
    this.#render();
  }

  #render(): void {
    this.root.innerHTML = '';
    renderRoadToLegend(this.root, this.#profile);
    const controls = document.createElement('div');
    controls.className = 'career-actions';
    controls.innerHTML = '<button type="button" data-career-practice>Open practice</button><button type="button" data-career-export>Export save</button><button type="button" data-career-import>Import save</button><input type="file" accept="application/json" data-career-file hidden>';
    this.root.append(controls);
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-archetype]')) {
      button.addEventListener('click', () => {
        const archetype = button.dataset.archetype as PlayerArchetype;
        this.#profile = selectArchetype(this.#profile, archetype);
        void this.store.save(this.#profile).then(() => this.#render());
      });
    }
    controls.querySelector('[data-career-practice]')?.addEventListener('click', this.onContinuePractice);
    controls.querySelector('[data-career-export]')?.addEventListener('click', () => this.#downloadSave());
    const input = controls.querySelector<HTMLInputElement>('[data-career-file]')!;
    controls.querySelector('[data-career-import]')?.addEventListener('click', () => input.click());
    input.addEventListener('change', () => void this.#importFile(input));
  }

  async #importFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    if (!file) return;
    try {
      this.#profile = importProfile(await file.text());
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
