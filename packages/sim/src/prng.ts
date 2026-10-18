const ZERO_SEED_FALLBACK = 0x6d2b79f5;

export interface DeterministicPrng {
  state: number;
}

export function normalizeSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) {
    throw new TypeError('seed must be a safe integer');
  }
  const normalized = seed >>> 0;
  return normalized === 0 ? ZERO_SEED_FALLBACK : normalized;
}

export function createPrng(seed: number): DeterministicPrng {
  return { state: normalizeSeed(seed) };
}

export function nextUint32(prng: DeterministicPrng): number {
  let x = prng.state >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  prng.state = x >>> 0;
  return prng.state;
}

export function nextFloat01(prng: DeterministicPrng): number {
  return nextUint32(prng) / 0x1_0000_0000;
}
