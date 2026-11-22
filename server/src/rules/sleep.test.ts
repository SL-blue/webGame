import { describe, it, expect } from "vitest";
import { applySleep } from "./sleep";
import type { HiddenState } from "./cues";

const BASE: HiddenState = {
  stress: 50,
  fatigue: 60,
  sleepDebt: 0,
  health: 100,
  pet: { traits: [], hunger: 50, mood: 50, health: 100 },
  relationship: 50,
  pendingPlans: [],
};

describe("applySleep", () => {
  it("reduces stress and fatigue", () => {
    const { hidden } = applySleep(BASE, []);
    expect(hidden.stress).toBeLessThan(BASE.stress);
    expect(hidden.fatigue).toBeLessThan(BASE.fatigue);
  });

  it("builds sleep debt when residual fatigue stays high", () => {
    const high: HiddenState = { ...BASE, fatigue: 90 };
    const { hidden } = applySleep(high, []);
    expect(hidden.sleepDebt).toBeGreaterThan(0);
  });

  it("sleep debt decays after a good night", () => {
    const rested: HiddenState = { ...BASE, fatigue: 10, sleepDebt: 20 };
    const { hidden } = applySleep(rested, []);
    expect(hidden.sleepDebt).toBeLessThan(20);
  });

  it("Deep Sleeper perk improves recovery", () => {
    const { hidden: withPerk }    = applySleep(BASE, ["deep-sleeper"]);
    const { hidden: withoutPerk } = applySleep(BASE, []);
    expect(withPerk.fatigue).toBeLessThanOrEqual(withoutPerk.fatigue);
    expect(withPerk.stress).toBeLessThanOrEqual(withoutPerk.stress);
  });

  it("Night Owl perk makes sleep debt build faster", () => {
    const high: HiddenState = { ...BASE, fatigue: 80 };
    const { hidden: owlResult }     = applySleep(high, ["night-owl"]);
    const { hidden: normalResult }  = applySleep(high, []);
    expect(owlResult.sleepDebt).toBeGreaterThan(normalResult.sleepDebt);
  });

  it("produces at least one feedback string", () => {
    const { feedback } = applySleep(BASE, []);
    expect(feedback.length).toBeGreaterThan(0);
  });

  it("feedback mentions lonely pet when mood is low", () => {
    const sadPet: HiddenState = { ...BASE, pet: { ...BASE.pet, mood: 10 } };
    const { feedback } = applySleep(sadPet, []);
    expect(feedback.some((f) => f.toLowerCase().includes("lonely"))).toBe(true);
  });
});
