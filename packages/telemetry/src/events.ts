export const ASSET_KINDS = ['image'] as const;

export const GATE_STAGE_IDS = ['01'] as const;

export interface ValidationResult {
  ok: boolean;
  errors: readonly string[];
}

export function validateTelemetryEvent(_value: unknown): ValidationResult {
  return { ok: true, errors: [] };
}

export function validateProvenanceEntry(_value: unknown): ValidationResult {
  return { ok: true, errors: [] };
}

export function gatePathForStage(id: string): string {
  return `docs/gates/STAGE-${id}-GATE.md`;
}
