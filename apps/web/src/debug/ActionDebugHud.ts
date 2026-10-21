import '../stage05.css';

export interface ActionDebugSnapshot {
  action: string;
  success: boolean;
  reason: string;
  controlQuality: number | null;
  shotCharge: number;
  tackleRecovery: number;
  goals: number;
  saves: number;
  shotStyle: string;
  passType: string;
}

export class ActionDebugHud {
  readonly root: HTMLElement;

  constructor(host: HTMLElement) {
    this.root = document.createElement('aside');
    this.root.className = 'action-debug-hud';
    this.root.dataset.actionDebug = 'true';
    this.root.setAttribute('aria-live', 'polite');
    host.append(this.root);

    // Mode switches live outside the canvas. Releasing their button focus after
    // activation keeps number/letter gameplay shortcuts active without weakening
    // the deliberate input/select/textarea typing guards in Ball Lab.
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLButtonElement && target.matches('[data-mode-practice], [data-mode-ball-lab]')) {
        target.blur();
      }
    });

    this.update({
      action: 'ready',
      success: true,
      reason: 'practice-ready',
      controlQuality: null,
      shotCharge: 0,
      tackleRecovery: 0,
      goals: 0,
      saves: 0,
      shotStyle: 'normal',
      passType: 'ground',
    });
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  update(snapshot: Readonly<ActionDebugSnapshot>): void {
    const quality = snapshot.controlQuality === null ? '—' : `${Math.round(snapshot.controlQuality * 100)}%`;
    const resultText = snapshot.action === 'ready'
      ? 'Ready for your next touch'
      : snapshot.success
        ? 'Action accepted'
        : 'Adjust your touch and try again';
    this.root.dataset.action = snapshot.action;
    this.root.dataset.success = String(snapshot.success);
    this.root.dataset.reason = snapshot.reason;
    this.root.dataset.controlQuality = snapshot.controlQuality === null ? '' : snapshot.controlQuality.toFixed(4);
    this.root.dataset.shotCharge = snapshot.shotCharge.toFixed(4);
    this.root.dataset.tackleRecovery = snapshot.tackleRecovery.toFixed(4);
    this.root.dataset.goals = String(snapshot.goals);
    this.root.dataset.saves = String(snapshot.saves);
    this.root.dataset.shotStyle = snapshot.shotStyle;
    this.root.dataset.passType = snapshot.passType;
    this.root.innerHTML = `
      <div class="action-debug-heading">
        <span>Session status</span>
        <strong>${snapshot.action.toUpperCase()}</strong>
      </div>
      <div class="action-debug-result" data-ok="${snapshot.success}">${resultText}</div>
      <div class="action-debug-grid">
        <span>touch <b>${quality}</b></span>
        <span>shot power <b>${Math.round(snapshot.shotCharge * 100)}%</b></span>
        <span>recovery <b>${snapshot.tackleRecovery.toFixed(2)}s</b></span>
        <span>shot <b>${snapshot.shotStyle}</b></span>
        <span>pass <b>${snapshot.passType}</b></span>
        <span>score <b>${snapshot.goals}–${snapshot.saves}</b></span>
      </div>
    `;
  }
}
