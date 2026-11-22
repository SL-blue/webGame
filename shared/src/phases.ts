export const PHASES = ["morning", "work", "evening", "sleep", "perk", "ended"] as const;
export type Phase = (typeof PHASES)[number];
