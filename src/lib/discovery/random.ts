/** A source of uniform numbers in [0, 1). Injected so selection is testable. */
export type Rng = () => number;

/** Cryptographically strong RNG for real spins (avoids Math.random bias). */
export function cryptoRng(): Rng {
  const buffer = new Uint32Array(1);
  return () => {
    crypto.getRandomValues(buffer);
    return buffer[0] / 2 ** 32;
  };
}

/** Deterministic RNG (mulberry32) for tests and reproducible fixtures. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomIndex(length: number, rng: Rng): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}

/** Uniform sample of `count` distinct items (partial Fisher–Yates). */
export function sample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const copy = items.slice();
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i++) {
    const j = i + randomIndex(copy.length - i, rng);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}
