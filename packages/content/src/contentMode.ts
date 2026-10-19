export type ContentMode = 'FICTIONAL_PUBLIC' | 'PRIVATE';

export interface ContentModeSelection {
  mode: ContentMode;
  watermark: string | null;
}

export function selectContentMode(requested: string | undefined, production: boolean): ContentModeSelection {
  const mode: ContentMode = requested === 'PRIVATE' ? 'PRIVATE' : 'FICTIONAL_PUBLIC';
  if (production && mode !== 'FICTIONAL_PUBLIC') {
    throw new Error('Production builds require FICTIONAL_PUBLIC content mode');
  }
  return {
    mode,
    watermark: mode === 'PRIVATE' ? 'LOCAL CONTENT PREVIEW · NOT FOR DISTRIBUTION' : null,
  };
}
