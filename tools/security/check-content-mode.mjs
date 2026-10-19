import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function validateContentBuildMode(mode, production) {
  const normalized = mode === 'PRIVATE' ? 'PRIVATE' : 'FICTIONAL_PUBLIC';
  if (production && normalized !== 'FICTIONAL_PUBLIC') {
    throw new Error('Production builds require FICTIONAL_PUBLIC content mode');
  }
  return normalized;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
    const mode = validateContentBuildMode(process.env.VITE_CONTENT_MODE, production);
    console.log(`Content build mode accepted: ${mode}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
