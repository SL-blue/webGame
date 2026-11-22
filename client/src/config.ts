import { TIMING, TIMING_DEMO, type GameTiming } from "shared";

let _demo = false;

/** Called once after /api/run/start returns, to sync timing with server mode. */
export function setDemoMode(demo: boolean): void {
  _demo = demo;
}

/** Returns the active timing config — TIMING_DEMO if demo mode is on, TIMING otherwise. */
export function timing(): GameTiming {
  return _demo ? TIMING_DEMO : TIMING;
}
