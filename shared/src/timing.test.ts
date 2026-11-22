import { describe, it, expect } from "vitest";
import { TIMING } from "./timing";

describe("TIMING", () => {
  it("has the expected keys and values", () => {
    expect(TIMING.daysPerRun).toBe(4);
    expect(TIMING.morningSec).toBe(10);
    expect(TIMING.workSec).toBe(90);
    expect(TIMING.eveningSec).toBe(20);
    expect(TIMING.sleepSec).toBe(5);
    expect(TIMING.perkChoiceSec).toBe(10);
    expect(TIMING.accidentWarningMs).toBe(1500);
    expect(TIMING.phoneAnswerMs).toBe(3000);
  });

  it("work phase is longer than morning and evening combined", () => {
    expect(TIMING.workSec).toBeGreaterThan(TIMING.morningSec + TIMING.eveningSec);
  });
});
