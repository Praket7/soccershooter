export function shouldLoadDevLabs(isDevelopment: boolean, search: string): boolean {
  if (isDevelopment) return true;
  return new URLSearchParams(search).get('devLabs') === '1';
}

async function loadDeveloperLabs(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!shouldLoadDevLabs(import.meta.env.DEV, window.location.search)) return;

  // Preserve the original install order because later labs attach deactivation
  // listeners to mode buttons created by earlier labs.
  await import('./BotTacticalLab');
  await import('./AdaptiveBotLab');
  await import('./PhysicalBotScrimmage');
  await import('./StageTestingGuide');
}

void loadDeveloperLabs();
