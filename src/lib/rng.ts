/**
 * Deterministic pseudo-random utilities.
 *
 * Every random-looking value in AETHER is derived from a fixed seed so the
 * simulation is reproducible across reloads and machines.
 */

/** FNV-1a style string hash. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Integer hash mixer (splitmix32 finaliser). */
export function mix32(x: number): number {
  let z = x >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  z = z ^ (z >>> 15);
  return z >>> 0;
}

/** Mulberry32 PRNG — small, fast, deterministic. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(items: readonly T[]): T;
  bool(probability?: number): boolean;
  /** Approximately normal distribution via sum of uniforms. */
  gauss(mean?: number, stdDev?: number): number;
}

export function createRng(seed: number | string): Rng {
  const s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  const next = mulberry32(s);
  const range = (min: number, max: number) => min + next() * (max - min);
  return {
    next,
    range,
    int: (min, maxInclusive) => Math.floor(range(min, maxInclusive + 1)),
    pick: (items) => items[Math.floor(next() * items.length) % items.length],
    bool: (probability = 0.5) => next() < probability,
    gauss: (mean = 0, stdDev = 1) => {
      const u = (next() + next() + next() + next() + next() + next() - 3) / 3;
      return mean + u * stdDev;
    },
  };
}

const NOISE_COMPONENTS = 5;

/**
 * Smooth, deterministic 1-D noise in [-1, 1].
 *
 * Built from a small bank of incommensurable sines whose phases and
 * frequencies are derived from the seed. Because it is a pure function of
 * `t`, replaying the same timeline always yields the same values.
 */
export function noise1D(seed: number | string, t: number): number {
  const base = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < NOISE_COMPONENTS; i++) {
    const h = mix32(base + i * 0x9e3779b9);
    const freq = (0.07 + (h % 1000) / 1000) * (1 + i * 1.7);
    const phase = ((h >>> 10) % 100000) / 100000 * Math.PI * 2;
    const w = 1 / (1 + i * 0.85);
    sum += Math.sin(t * freq + phase) * w;
    weight += w;
  }
  return sum / weight;
}

/** Fractal sum of `noise1D`, useful for richer signals. */
export function fbm1D(seed: number | string, t: number, octaves = 3): number {
  let value = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += noise1D(typeof seed === "string" ? `${seed}:${i}` : seed + i * 7919, t * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return value / norm;
}
