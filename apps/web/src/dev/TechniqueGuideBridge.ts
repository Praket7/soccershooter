import { TECHNIQUE_BY_ID } from '@soccershooter/content/techniques/catalog';
import { describeTechniqueForPlayer } from './TechniquePlayerGuide';

function installTechniqueGuide(): boolean {
  const root = document.querySelector<HTMLElement>('[data-football-practice]');
  const panel = root?.querySelector<HTMLElement>('.practice-technique-panel');
  const selector = root?.querySelector<HTMLSelectElement>('[data-technique-select]');
  if (!root || !panel || !selector) return false;
  if (panel.querySelector('[data-technique-player-guide]')) return true;

  const eyebrow = root.querySelector<HTMLElement>('.football-practice-heading div > span');
  if (eyebrow) eyebrow.textContent = 'THE TRAINING GROUND';
  const heading = root.querySelector<HTMLElement>('.football-practice-heading strong');
  if (heading) heading.textContent = 'Football Practice';
  const intro = Array.from(root.children).find((child): child is HTMLParagraphElement => child.tagName === 'P');
  if (intro) {
    intro.textContent = 'Carry at pace with WASD. Use Shift to sprint and RMB for close control. F receives; aim passes and shots through the reticle.';
  }

  const guideRoot = document.createElement('section');
  guideRoot.className = 'technique-player-guide';
  guideRoot.dataset.techniquePlayerGuide = 'true';
  guideRoot.setAttribute('aria-live', 'polite');
  panel.append(guideRoot);

  const render = (): void => {
    const definition = TECHNIQUE_BY_ID.get(selector.value);
    if (!definition) {
      guideRoot.textContent = 'Select a technique to see its physical contact window.';
      return;
    }
    const guide = describeTechniqueForPlayer(definition);
    guideRoot.replaceChildren();

    const header = document.createElement('div');
    const family = document.createElement('span');
    family.textContent = guide.family;
    const name = document.createElement('strong');
    name.textContent = guide.name;
    header.append(family, name);

    const grid = document.createElement('dl');
    const rows: readonly [string, string][] = [
      ['Setup', guide.setup],
      ['Movement', guide.speed],
      ['Pressure', guide.pressure],
      ['Cost', guide.cost],
      ['Contact', guide.contact],
      ['Risk', guide.risk],
    ];
    for (const [label, value] of rows) {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      grid.append(dt, dd);
    }

    const hint = document.createElement('p');
    hint.innerHTML = 'When the setup is valid, press <kbd>T</kbd>. A failed setup keeps the ball physical and enters the normal recovery path.';
    guideRoot.append(header, grid, hint);
  };

  selector.addEventListener('change', render);
  render();
  return true;
}

function bootstrap(): void {
  if (installTechniqueGuide()) return;
  const observer = new MutationObserver(() => {
    if (installTechniqueGuide()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
