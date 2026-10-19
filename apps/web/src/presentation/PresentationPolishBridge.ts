function applyPlayerFacingCopy(): boolean {
  const header = document.querySelector<HTMLElement>('.lab-header');
  const courseCard = document.querySelector<HTMLElement>('.course-card');
  if (!header || !courseCard) return false;

  const eyebrow = header.querySelector<HTMLElement>('.eyebrow');
  const title = header.querySelector<HTMLElement>('h1');
  const subtitle = header.querySelector<HTMLElement>('.subtitle');
  if (eyebrow) eyebrow.textContent = 'SOCCERSHOOTER · PHYSICAL FOOTBALL';
  if (title) title.textContent = 'SoccerShooter';
  if (subtitle) subtitle.textContent = 'Responsive football built around a free physical ball, visible world aim, legal contacts, and tactical opponents that play by the same physical rules.';

  const courseTitle = courseCard.querySelector<HTMLElement>('strong');
  if (courseTitle) courseTitle.textContent = 'Football principles';
  const principles = [
    'free physical ball',
    'aim where you look',
    'timed first touch',
    'body-aware passing',
    'physical shooting',
    'keeper angle coverage',
    'legal challenges',
    'no hidden stat cheating',
  ];
  const labels = courseCard.querySelectorAll<HTMLElement>('span');
  labels.forEach((label, index) => {
    if (principles[index]) label.textContent = principles[index]!;
  });

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
