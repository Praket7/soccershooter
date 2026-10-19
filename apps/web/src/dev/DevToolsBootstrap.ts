export function shouldLoadDevLabs(isDevelopment: boolean, search: string): boolean {
  if (isDevelopment) return true;
  return new URLSearchParams(search).get('devLabs') === '1';
}

async function loadDeveloperLabs(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!shouldLoadDevLabs(import.meta.env.DEV, window.location.search)) return;

  await Promise.all([
    import('./BotTacticalLab'),
    import('./AdaptiveBotLab'),
    import('./PhysicalBotScrimmage'),
  ]);
}

void loadDeveloperLabs();
