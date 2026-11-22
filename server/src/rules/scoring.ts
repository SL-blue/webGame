import type { HiddenState } from "./cues";

export type AreaScores = {
  finances:     number; // 0–100
  pet:          number;
  self:         number;
  relationship: number;
};

export type RunSnapshot = {
  money:  number;
  hidden: HiddenState;
};

/** Map each area of the run to a 0–100 score. */
export function computeAreaScores(snap: RunSnapshot): AreaScores {
  const { hidden, money } = snap;

  // Finances: $1500 = full marks (4 days × 30 boxes × $12.5 average)
  const finances = Math.min(100, Math.round((money / 1500) * 100));

  // Pet: average of mood, hunger, health (all 0–100)
  const pet = Math.round((hidden.pet.mood + hidden.pet.hunger + hidden.pet.health) / 3);

  // Self: good health + low stress / fatigue / debt
  const self = Math.max(
    0,
    Math.round(
      hidden.health * 0.4
      - hidden.stress    * 0.25
      - hidden.fatigue   * 0.20
      - hidden.sleepDebt * 0.15,
    ),
  );

  // Relationship: direct
  const relationship = Math.min(100, Math.max(0, hidden.relationship));

  return { finances, pet, self, relationship };
}

/** Combine area scores multiplicatively so neglecting any one area tanks the total. */
export function computeFinalScore(areas: AreaScores): number {
  const { finances, pet, self, relationship } = areas;
  return Math.round(
    (finances / 100) * (pet / 100) * (self / 100) * (relationship / 100) * 10000,
  );
}

/** Letter grade for a single area score. */
export function gradeArea(score: number): string {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  if (score >= 25) return "D";
  return "F";
}

/** Generate 2–4 human-readable reasons based on area scores and hidden state. */
export function generateReasons(areas: AreaScores, hidden: HiddenState): string[] {
  const bad: string[]  = [];
  const good: string[] = [];

  // Negatives first
  if (areas.finances < 40) bad.push("You barely scraped by financially.");
  if (areas.pet < 40) {
    bad.push(
      hidden.pet.mood < 25
        ? "Your pet was lonely and neglected."
        : "Your pet needed more care.",
    );
  }
  if (areas.self < 40) {
    bad.push(
      hidden.sleepDebt > 50
        ? "Sleep debt took a heavy toll."
        : "You burned yourself out.",
    );
  }
  if (areas.relationship < 40) bad.push("She felt ignored — missed calls added up.");

  // Positives
  if (areas.finances >= 70)  good.push("You kept the finances healthy.");
  if (areas.pet >= 70)       good.push("Your pet thrived — well cared for.");
  if (areas.relationship >= 70) good.push("The relationship stayed strong.");
  if (areas.self >= 70)      good.push("You stayed calm and rested.");

  // Return up to 4: show bad things first, then good things
  return [...bad, ...good].slice(0, 4);
}
