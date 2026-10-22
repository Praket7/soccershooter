interface StageGuideAction {
  label: string;
  target: string;
}

interface StageGuideEntry {
  stage: number;
  title: string;
  description: string;
  surface: string;
  checks: readonly string[];
  actions: readonly StageGuideAction[];
  acceptance: string;
}

export const STAGE_TEST_GUIDE: readonly StageGuideEntry[] = [
  {
    stage: 6,
    title: 'Tactical decisions',
    description: 'See how teammates support, press, cover, and recover in a 3v3 attack.',
    surface: 'Tactical Bot Lab · role labels start hidden',
    checks: [
      'Watch first with role labels hidden: look for useful support, spacing, and a goalkeeper who stays connected to goal.',
      'Use Force Turnover several times. Check that one defender presses while teammates recover or cover instead of swarming.',
      'Only then show the role labels and compare them with the movement you saw.',
    ],
    actions: [{ label: 'Open Tactical Bot Lab', target: '[data-mode-tactical-bots]' }],
    acceptance: 'Owner check: behavior should make sense without debug labels.',
  },
  {
    stage: 7,
    title: 'Fair adaptive difficulty',
    description: 'Compare bot cognition and personality while the authoritative physical rules stay the same.',
    surface: 'Adaptive Bot Debug + human-playable Adaptive Bot Playtest',
    checks: [
      'Compare novice, standard, and elite decisions on the same seeded situation; confirm the physical snapshot is identical.',
      'Try a mid-possession tier change, then a restart-boundary change. In PvP, adaptation must stay off.',
      'In the playtest, you control h-1 only throughout: WASD moves, Shift sprints, E passes, Space shoots, and C challenges. Confirm both goals remain visible in the page view. Compare team playstyles in live play. Learned policy must remain disabled.',
      'Judge whether novice feels beatable, standard helpful, and elite challenging without physical cheating.',
    ],
    actions: [
      { label: 'Open Adaptive Debug', target: '[data-mode-adaptive-bots]' },
      { label: 'Open Adaptive Bot Playtest', target: '[data-mode-physical-bots]' },
    ],
    acceptance: 'Owner check: personality and difficulty should be legible and fair.',
  },
  {
    stage: 8,
    title: 'Techniques and evolutions',
    description: 'Try contextual moves as physical football actions with timing, risk, and counterplay.',
    surface: 'Football Practice · technique selector and contact guide',
    checks: [
      'Choose two different techniques and try each in its valid setup; use T when the contact window is ready.',
      'Explain when each move is useful, and notice its stamina cost, failure/recovery, and counter window.',
      'Confirm the move changes a physical contact rather than forcing a guaranteed animation or result.',
    ],
    actions: [{ label: 'Open Football Practice', target: '[data-mode-practice]' }],
    acceptance: 'Owner check: you can explain when at least two techniques fit.',
  },
  {
    stage: 9,
    title: 'Road to Legend',
    description: 'Check whether a first-time player can understand and begin the solo career without coaching.',
    surface: 'Road to Legend · current Act 1 challenge',
    checks: [
      'Without developer explanation, choose a play style and start the current challenge.',
      'See whether the objective, recommended approach, and physical-goal progression are clear.',
      'Notice that this preview is a physical-goal challenge slice, not a complete user-controlled full-team match.',
    ],
    actions: [{ label: 'Open Road to Legend', target: '[data-mode-career]' }],
    acceptance: 'Owner check: a new tester completes Act 1 without developer explanation.',
  },
  {
    stage: 10,
    title: 'Teams and public content',
    description: 'Review the fictional public identities and production content boundary; this is not a playable team-selection mode.',
    surface: 'Road to Legend · Fictional public teams',
    checks: [
      'Scroll to Fictional public teams and review each badge, palette, name, and tactical identity.',
      'Confirm the header reports FICTIONAL_PUBLIC. Team cards are a content preview, not a team-selection mode.',
      'The private-content production rejection and bundle scan are engineering checks; they are not a playable preview step.',
    ],
    actions: [{ label: 'Open team content preview', target: '[data-mode-career]' }],
    acceptance: 'Engineering gate: public build contains fictional content only.',
  },
];

function createGuide(): HTMLElement {
  const guide = document.createElement('aside');
  guide.className = 'stage-testing-guide';
  guide.dataset.stageTestingGuide = 'true';
  guide.id = 'stage-testing-guide';
  guide.hidden = true;
  guide.setAttribute('aria-labelledby', 'stage-testing-guide-title');
  guide.innerHTML = `
    <header class="stage-testing-guide__header">
      <div><h2 id="stage-testing-guide-title">Stages 6–10 · Testing guide</h2><p>Open a preview, follow the checks, and separate human feel from automated proof.</p></div>
      <button type="button" data-stage-guide-close aria-label="Close testing guide">Close</button>
    </header>
    <div class="stage-testing-guide__grid">
      ${STAGE_TEST_GUIDE.map((entry) => `
        <article class="stage-testing-guide__item" data-stage="${entry.stage}">
          <div class="stage-testing-guide__title"><span>STAGE ${String(entry.stage).padStart(2, '0')}</span><h3>${entry.title}</h3></div>
          <p>${entry.description}</p>
          <p class="stage-testing-guide__surface"><strong>Preview:</strong> ${entry.surface}</p>
          <ul>${entry.checks.map((check) => `<li>${check}</li>`).join('')}</ul>
          <div class="stage-testing-guide__actions">${entry.actions.map((action) => `<button type="button" data-stage-guide-open="${action.target}">${action.label}</button>`).join('')}</div>
          <p class="stage-testing-guide__acceptance">${entry.acceptance}</p>
        </article>`).join('')}
    </div>
  `;
  return guide;
}

function install(): void {
  const modeSwitch = document.querySelector<HTMLElement>('.mode-switch');
  const viewport = document.querySelector<HTMLElement>('#game-viewport');
  if (!modeSwitch || !viewport) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.modeTestingGuide = 'true';
  button.dataset.active = 'false';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'stage-testing-guide');
  button.textContent = 'Testing Guide';
  modeSwitch.append(button);

  const guide = createGuide();
  viewport.append(guide);
  const close = guide.querySelector<HTMLButtonElement>('[data-stage-guide-close]');
  button.addEventListener('click', () => {
    guide.hidden = false;
    button.dataset.active = 'true';
    button.setAttribute('aria-expanded', 'true');
    close?.focus();
  });
  close?.addEventListener('click', () => {
    guide.hidden = true;
    button.dataset.active = 'false';
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  });
  guide.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-stage-guide-open]');
    if (!target) return;
    const modeButton = document.querySelector<HTMLButtonElement>(target.dataset.stageGuideOpen ?? '');
    if (!modeButton) return;
    modeButton.click();
    guide.hidden = true;
    button.dataset.active = 'false';
    button.setAttribute('aria-expanded', 'false');
    button.focus();
    if (target.dataset.stageGuideOpen === '[data-mode-career]' && target.closest('[data-stage="10"]')) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-public-teams]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  });
}

if (typeof document !== 'undefined') install();
