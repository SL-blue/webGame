export const TRAIT_IDS = [
  "energetic",
  "anxious",
  "picky",
  "fragile",
  "clingy",
  "easygoing",
] as const;

export type TraitId = (typeof TRAIT_IDS)[number];

export function assignTraits(rng: () => number): TraitId[] {
  const count = rng() < 0.5 ? 2 : 3;
  const pool = [...TRAIT_IDS];
  // Fisher-Yates partial shuffle to pick `count` traits
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count) as TraitId[];
}
