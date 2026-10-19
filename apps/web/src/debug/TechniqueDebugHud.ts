import type { TechniqueDefinition } from '@soccershooter/content/techniques/schema';

export interface TechniqueDebugState {
  technique: Readonly<TechniqueDefinition> | null;
  eligible: boolean;
  timingWindowTicks: number;
  failureReason: string;
  contactTick: number | null;
  counterUntilTick: number | null;
}

export class TechniqueDebugHud {
  readonly root: HTMLOutputElement;

  constructor(host: HTMLElement) {
    this.root = document.createElement('output');
    this.root.dataset.techniqueDebug = 'true';
    this.root.className = 'technique-debug-hud';
    this.root.hidden = true;
    host.append(this.root);
  }

  update(state: Readonly<TechniqueDebugState>): void {
    const technique = state.technique;
    this.root.hidden = technique === null;
    if (!technique) return;
    this.root.dataset.technique = technique.id;
    this.root.dataset.eligible = String(state.eligible);
    this.root.dataset.timingWindowTicks = String(state.timingWindowTicks);
    this.root.dataset.failureReason = state.failureReason;
    this.root.dataset.contactTick = state.contactTick === null ? '' : String(state.contactTick);
    this.root.dataset.counterUntilTick = state.counterUntilTick === null ? '' : String(state.counterUntilTick);
    this.root.textContent = `${technique.displayName} · ${state.eligible ? `WINDOW ${state.timingWindowTicks}t` : state.failureReason || 'NOT ELIGIBLE'}`;
  }
}
