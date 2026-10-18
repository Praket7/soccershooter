import { runReferenceTrace } from '@soccershooter/sim/referenceTrace';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

const result = runReferenceTrace();

app.innerHTML = `
  <section style="font-family: Inter, system-ui, sans-serif; max-width: 760px; margin: 8vh auto; padding: 32px; color: #f4f6f8; background: #0b1020; border: 1px solid #313a4e; border-radius: 16px;">
    <p style="margin: 0 0 8px; color: #aeb7c6; text-transform: uppercase; letter-spacing: .12em; font-size: 12px;">Stage 02 runtime shell</p>
    <h1 style="margin: 0 0 16px; font-size: 36px;">SoccerShooter Foundation</h1>
    <p style="line-height: 1.6; color: #aeb7c6;">This page proves the browser can execute the same deterministic simulation trace as the Node test harness. Gameplay presentation begins in later stages.</p>
    <dl style="display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; margin-top: 24px;">
      <dt>Content mode</dt><dd>FICTIONAL_PUBLIC</dd>
      <dt>Trace ticks</dt><dd>${result.ticks.toLocaleString()}</dd>
      <dt>State hash</dt><dd><code>${result.hash}</code></dd>
    </dl>
    <output data-determinism-hash="${result.hash}" data-determinism-ticks="${result.ticks}" hidden>${result.hash}</output>
  </section>
`;
