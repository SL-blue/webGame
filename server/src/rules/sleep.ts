import type { HiddenState } from "./cues";

export type SleepResult = {
  hidden: HiddenState;
  feedback: string[];
};

export function applySleep(hidden: HiddenState, perks: string[]): SleepResult {
  const sleepMult    = perks.includes("deep-sleeper") ? 1.5 : 1;
  const debtMult     = perks.includes("night-owl")    ? 1.3 : 1;

  const next: HiddenState = { ...hidden, pet: { ...hidden.pet } };

  // Overnight recovery
  next.stress  = Math.max(0, hidden.stress  - 20 * sleepMult);
  next.fatigue = Math.max(0, hidden.fatigue - 30 * sleepMult);

  // Sleep debt: builds when residual fatigue stays high
  const residual = next.fatigue;
  if (residual > 30) {
    next.sleepDebt = Math.min(100, hidden.sleepDebt + (residual - 30) * 0.15 * debtMult);
  } else {
    next.sleepDebt = Math.max(0, hidden.sleepDebt - 10);
  }

  // High sleep debt suppresses recovery further
  if (next.sleepDebt > 60) {
    next.fatigue = Math.min(100, next.fatigue + 15);
    next.health  = Math.max(0, hidden.health - 5);
  }

  // Pet hunger drops overnight
  next.pet.hunger = Math.max(0, hidden.pet.hunger - 5);

  // ─── Feedback strings ────────────────────────────────────────────────────

  const feedback: string[] = [];

  if (next.sleepDebt > 60)      feedback.push("You slept badly.");
  else if (next.sleepDebt > 30) feedback.push("You slept lightly.");
  else                          feedback.push("You slept well.");

  if (hidden.pet.mood < 25)       feedback.push("Your pet seemed lonely today.");
  else if (hidden.pet.mood > 70)  feedback.push("Your pet was in good spirits.");

  if (hidden.relationship < 25)   feedback.push("She's been quiet lately…");
  else if (hidden.relationship < 45) feedback.push("She texted you today.");
  else if (hidden.relationship > 70) feedback.push("She left a warm message ❤");

  if (next.sleepDebt > 60 && next.health < 80)
    feedback.push("You're starting to feel run-down.");

  return { hidden: next, feedback };
}
