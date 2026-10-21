function applyPlayerFacingCopy(): boolean {
  const header = document.querySelector<HTMLElement>('.lab-header');
  const controlCard = document.querySelector<HTMLElement>('.control-card');
  if (!header || !controlCard) return false;

  const eyebrow = header.querySelector<HTMLElement>('.eyebrow');
  const title = header.querySelector<HTMLElement>('h1');
  const subtitle = header.querySelector<HTMLElement>('.subtitle');
  if (eyebrow) eyebrow.textContent = 'SOCCERSHOOTER · PHYSICAL FOOTBALL';
  if (title) title.textContent = 'SoccerShooter';
  if (subtitle) subtitle.textContent = 'Train your touch, movement, passing and finishing.';

  const controlTitle = controlCard.querySelector<HTMLElement>('strong');
  if (controlTitle) controlTitle.textContent = 'Controls';
  const controlLines = [
    'WASD / left stick · move and carry direction',
    'Mouse / right stick · camera and world aim',
    'Shift / L3 · sprint with short carry touches',
    'RMB / LT · close-control precision',
    'F / View · receive or trap · add movement for an exit touch',
    'E / X · ground pass · Q · through pass · Y · Elastico in practice · R / LB · lofted pass',
    'RMB+E / LT+X · driven ground pass',
    'Ctrl+Q / R3+Y · chipped through ball',
    'LMB / RT · hold power, release shot · RMB+LMB / LT+RT · finesse · Ctrl+LMB / R3+RT · chip',
    'C or B / B · challenge · Shift+C commits · Space / A · aerial',
    'G · reset practice ball · T / D-pad Up · selected practice technique',
  ];
  const controlLabels = controlCard.querySelectorAll<HTMLElement>('span');
  controlLabels.forEach((label, index) => {
    if (controlLines[index]) label.textContent = controlLines[index]!;
    else label.hidden = true;
  });

  document.querySelector<HTMLElement>('.course-card')?.remove();

  const footer = document.querySelector<HTMLElement>('.lab-footer');
  const footerLines = footer?.querySelectorAll<HTMLElement>('span');
  if (footerLines && footerLines.length > 1) footerLines[footerLines.length - 1]!.hidden = true;

  document.title = 'SoccerShooter';
  return true;
}

function bootstrap(): void {
  if (applyPlayerFacingCopy()) return;
  const observer = new MutationObserver(() => {
    if (applyPlayerFacingCopy()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
