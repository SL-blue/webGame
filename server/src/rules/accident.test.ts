import { describe, it, expect } from "vitest";
import { checkAccidentTiming } from "./accident";

const PHASE_START = 1_000_000; // arbitrary epoch ms
const WARNING_AT  = 20;        // seconds into phase
const WINDOW_MS   = 1500;

// Shorthand: build a "now" timestamp relative to phase start
function at(phaseOffsetMs: number): number {
  return PHASE_START + phaseOffsetMs;
}

describe("checkAccidentTiming", () => {
  it("returns 'not-active' when called before warningAt", () => {
    // 15 s into phase, warning fires at 20 s → not active yet
    expect(checkAccidentTiming(PHASE_START, WARNING_AT, WINDOW_MS, "answered", at(15_000))).toBe("not-active");
  });

  it("returns 'answered' when response arrives inside the window", () => {
    // 20.5 s — 500 ms after warning appeared, well within 1500 ms window
    expect(checkAccidentTiming(PHASE_START, WARNING_AT, WINDOW_MS, "answered", at(20_500))).toBe("answered");
  });

  it("returns 'cost' when server clock shows the window has expired", () => {
    // 22 s — 2000 ms after warning, beyond 1500 + 500 ms grace
    expect(checkAccidentTiming(PHASE_START, WARNING_AT, WINDOW_MS, "answered", at(22_100))).toBe("cost");
  });

  it("returns 'cost' when client explicitly says 'ignored'", () => {
    // Within window but client says ignored
    expect(checkAccidentTiming(PHASE_START, WARNING_AT, WINDOW_MS, "ignored", at(20_500))).toBe("cost");
  });

  it("window boundary: exactly at windowMs is answered", () => {
    expect(checkAccidentTiming(PHASE_START, WARNING_AT, WINDOW_MS, "answered", at(21_499))).toBe("answered");
  });

  it("window boundary + grace: at windowMs + 500 is answered", () => {
    expect(checkAccidentTiming(PHASE_START, WARNING_AT, WINDOW_MS, "answered", at(21_500))).toBe("answered");
  });

  it("window boundary + grace + 1ms: at windowMs + 501 is cost", () => {
    expect(checkAccidentTiming(PHASE_START, WARNING_AT, WINDOW_MS, "answered", at(22_001))).toBe("cost");
  });
});
