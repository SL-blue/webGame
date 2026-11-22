import { describe, it, expect } from "vitest";
import {
  computeAreaScores,
  computeFinalScore,
  gradeArea,
  generateReasons,
  type RunSnapshot,
} from "./scoring";
import type { HiddenState } from "./cues";

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE_HIDDEN: HiddenState = {
  stress: 20, fatigue: 20, sleepDebt: 10, health: 90,
  pet: { traits: [], hunger: 65, mood: 65, health: 100 },
  relationship: 65,
  pendingPlans: [],
};

function snap(overrides: Partial<HiddenState> & { money?: number }): RunSnapshot {
  const { money = 1200, ...hiddenOverrides } = overrides;
  return { money, hidden: { ...BASE_HIDDEN, ...hiddenOverrides } };
}

function score(overrides: Partial<HiddenState> & { money?: number }): number {
  return computeFinalScore(computeAreaScores(snap(overrides)));
}

// ─── Area score calculation ──────────────────────────────────────────────────

describe("computeAreaScores", () => {
  it("finances scale with money", () => {
    const low  = computeAreaScores(snap({ money: 300  }));
    const high = computeAreaScores(snap({ money: 1500 }));
    expect(high.finances).toBeGreaterThan(low.finances);
  });

  it("$1500 gives 100 finances", () => {
    const { finances } = computeAreaScores(snap({ money: 1500 }));
    expect(finances).toBe(100);
  });

  it("high stress/fatigue lowers self score", () => {
    const { self: low  } = computeAreaScores(snap({ stress: 90, fatigue: 80 }));
    const { self: high } = computeAreaScores(snap({ stress: 10, fatigue: 10 }));
    expect(high).toBeGreaterThan(low);
  });

  it("self score cannot go below 0", () => {
    const { self } = computeAreaScores(snap({ stress: 100, fatigue: 100, sleepDebt: 100 }));
    expect(self).toBeGreaterThanOrEqual(0);
  });
});

// ─── Multiplicative scoring ─────────────────────────────────────────────────

describe("computeFinalScore", () => {
  it("balanced run scores higher than any neglected run", () => {
    const balanced = score({});
    const noPet    = score({ pet: { traits: [], mood: 5, hunger: 5, health: 60 } });
    const noRel    = score({ relationship: 5 });
    const noSelf   = score({ stress: 95, fatigue: 90, sleepDebt: 90 });
    const noMoney  = score({ money: 50 });

    expect(balanced).toBeGreaterThan(noPet);
    expect(balanced).toBeGreaterThan(noRel);
    expect(balanced).toBeGreaterThan(noSelf);
    expect(balanced).toBeGreaterThan(noMoney);
  });

  it("neglecting pet collapses score multiplicatively (at least 60% reduction)", () => {
    const balanced = score({});
    const noPet    = score({ pet: { traits: [], mood: 5, hunger: 5, health: 60 } });
    expect(noPet).toBeLessThan(balanced * 0.4);
  });

  it("neglecting girlfriend collapses score multiplicatively", () => {
    const balanced = score({});
    const noRel    = score({ relationship: 5 });
    expect(noRel).toBeLessThan(balanced * 0.4);
  });

  it("high sleep debt (always overtime) scores lower than rested run", () => {
    const rested = score({ sleepDebt: 5,  fatigue: 15 });
    const tired  = score({ sleepDebt: 75, fatigue: 60 });
    expect(tired).toBeLessThan(rested);
  });

  it("low money (never working hard) scores lower than earning well", () => {
    const earns  = score({ money: 1400 });
    const broke  = score({ money: 100  });
    expect(broke).toBeLessThan(earns);
  });

  it("all zeros gives score of 0", () => {
    const all0 = computeFinalScore({ finances: 0, pet: 0, self: 0, relationship: 0 });
    expect(all0).toBe(0);
  });

  it("all 100s gives max score", () => {
    const max = computeFinalScore({ finances: 100, pet: 100, self: 100, relationship: 100 });
    expect(max).toBe(10000);
  });
});

// ─── Grade letters ───────────────────────────────────────────────────────────

describe("gradeArea", () => {
  it("maps ranges to expected grades", () => {
    expect(gradeArea(90)).toBe("S");
    expect(gradeArea(72)).toBe("A");
    expect(gradeArea(57)).toBe("B");
    expect(gradeArea(42)).toBe("C");
    expect(gradeArea(27)).toBe("D");
    expect(gradeArea(15)).toBe("F");
  });
});

// ─── Reason generation ───────────────────────────────────────────────────────

describe("generateReasons", () => {
  it("produces 1–4 strings", () => {
    const areas = computeAreaScores(snap({}));
    const reasons = generateReasons(areas, BASE_HIDDEN);
    expect(reasons.length).toBeGreaterThanOrEqual(1);
    expect(reasons.length).toBeLessThanOrEqual(4);
  });

  it("mentions lonely pet when pet score is low", () => {
    const areas = computeAreaScores(snap({ pet: { traits: [], mood: 5, hunger: 5, health: 60 } }));
    const reasons = generateReasons(areas, { ...BASE_HIDDEN, pet: { traits: [], mood: 5, hunger: 5, health: 60 } });
    expect(reasons.some((r) => r.toLowerCase().includes("pet"))).toBe(true);
  });

  it("mentions relationship when low", () => {
    const hidden = { ...BASE_HIDDEN, relationship: 5 };
    const areas  = computeAreaScores({ money: 1200, hidden });
    const reasons = generateReasons(areas, hidden);
    expect(reasons.some((r) => r.toLowerCase().includes("ignored") || r.toLowerCase().includes("relationship"))).toBe(true);
  });
});
