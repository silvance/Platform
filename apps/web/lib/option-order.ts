// Per-user display order for multiple-choice options.
//
// Seed content tends to list the correct option first (and often
// longest), so showing everyone the stored order leaks answers. The
// order here is deterministic for a given user + question — reloads
// and retries never reshuffle — and differs between users. Grading
// is by option id, so the order is purely presentational.

// FNV-1a: small, stable 32-bit string hash for the seed.
function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: tiny seeded PRNG returning floats in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function orderOptionsForUser<T>(
  options: readonly T[],
  userId: string,
  questionId: string,
): T[] {
  const out = [...options];
  const rand = mulberry32(hash32(`${userId}:${questionId}`));
  // Fisher–Yates.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
