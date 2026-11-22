import { TIMING } from "shared";
import type { SegmentSpecResponse, AccidentSpec, ItemSpec } from "shared";
import { mulberry32 } from "./rng";

const TASK_PAY: Record<string, number> = {
  easy:   8,
  normal: 15,
  hard:   20,
};

// Which mini-game each task maps to
const TASK_TYPE: Record<string, SegmentSpecResponse["taskType"]> = {
  easy:   "package-sort",
  normal: "coffee-timing",
  hard:   "catch-delivery",
};

export function payForTask(taskId: string): number {
  return TASK_PAY[taskId] ?? 10;
}

export function taskOffers() {
  return [
    { id: "easy",   label: "Sorting Shift",   description: "Easy, low pay"        },
    { id: "normal", label: "Coffee Service",   description: "Pays well, stressful" },
    { id: "hard",   label: "Catch & Sort",     description: "Long hours, high pay" },
  ];
}

export function generateSegmentSpec(
  seed: number,
  day: number,
  segmentIndex: number,
  taskId: string,
  durationSec: number,
): SegmentSpecResponse {
  const rng = mulberry32(seed ^ (day * 1000 + segmentIndex * 7));
  const taskType = TASK_TYPE[taskId] ?? "package-sort";
  const segmentId = `seg-d${day}-s${segmentIndex}-${taskId}`;
  const accidents = generateAccidents(rng, durationSec);

  switch (taskType) {
    case "package-sort":    return buildPackageSort(rng, segmentId, durationSec, accidents);
    case "coffee-timing":   return buildCoffeeTiming(rng, segmentId, durationSec, accidents);
    case "catch-delivery":  return buildCatchDelivery(rng, segmentId, durationSec, accidents);
  }
}

// ─── Package sort ────────────────────────────────────────────────────────────

function buildPackageSort(
  rng: () => number,
  segmentId: string,
  durationSec: number,
  accidents: AccidentSpec[],
): SegmentSpecResponse {
  const colorLeft = rng() < 0.5 ? "red" : "blue";
  const colorRight = colorLeft === "red" ? "blue" : "red";

  const count = Math.floor(durationSec / 3);
  const items: ItemSpec[] = Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    color: rng() < 0.5 ? colorLeft : colorRight,
    spawnAt: i * 3 + rng() * 0.4,
  }));

  return { segmentId, taskType: "package-sort", durationSec, colorLeft, colorRight, items, accidents };
}

// ─── Coffee timing ───────────────────────────────────────────────────────────

function buildCoffeeTiming(
  rng: () => number,
  segmentId: string,
  durationSec: number,
  accidents: AccidentSpec[],
): SegmentSpecResponse {
  const count = Math.floor(durationSec / 5); // ~18 pours in 90s
  const items: ItemSpec[] = Array.from({ length: count }, (_, i) => ({
    id: `pour-${i}`,
    spawnAt: i * 5 + rng() * 0.4,
    targetCenter: 0.3 + rng() * 0.4,  // zone center in [0.3, 0.7]
    targetWidth:  0.14 + rng() * 0.1, // zone width in [0.14, 0.24]
    needleSpeed:  0.8 + rng() * 0.5,  // speed in [0.8, 1.3]
  }));

  return { segmentId, taskType: "coffee-timing", durationSec, items, accidents };
}

// ─── Catch delivery ──────────────────────────────────────────────────────────

function buildCatchDelivery(
  rng: () => number,
  segmentId: string,
  durationSec: number,
  accidents: AccidentSpec[],
): SegmentSpecResponse {
  const count = Math.floor(durationSec / 4); // ~22 items in 90s
  const items: ItemSpec[] = Array.from({ length: count }, (_, i) => ({
    id: `pkg-${i}`,
    spawnAt: i * 4 + rng() * 0.5,
    lane:    Math.floor(rng() * 3),  // 0 | 1 | 2
    fragile: rng() < 0.28,           // ~28% fragile
  }));

  return { segmentId, taskType: "catch-delivery", durationSec, items, accidents };
}

// ─── Accident generation ──────────────────────────────────────────────────────

const ACCIDENT_TYPES: AccidentSpec["type"][] = ["spill", "pet-cam", "phone-call"];
const ACCIDENT_KEYS: Record<string, string> = {
  spill: "e", "pet-cam": "p", "phone-call": "c",
};
const ACCIDENT_WINDOWS: Record<string, number> = {
  spill: TIMING.accidentWarningMs,
  "pet-cam": TIMING.accidentWarningMs,
  "phone-call": TIMING.phoneAnswerMs,
};

function generateAccidents(rng: () => number, durationSec: number): AccidentSpec[] {
  // Three possible time windows; accidents are spaced so they don't overlap
  const windows = [
    [15, Math.floor(durationSec * 0.3)],
    [Math.floor(durationSec * 0.35), Math.floor(durationSec * 0.6)],
    [Math.floor(durationSec * 0.65), Math.floor(durationSec * 0.82)],
  ];

  const accidents: AccidentSpec[] = [];
  for (let w = 0; w < windows.length; w++) {
    if (rng() > 0.72) continue; // ~72% chance of an accident in each window
    const [lo, hi] = windows[w];
    const type = ACCIDENT_TYPES[Math.floor(rng() * ACCIDENT_TYPES.length)];
    accidents.push({
      id: `acc-${w}-${type}`,
      type,
      warningAt: lo + rng() * (hi - lo),
      windowMs: ACCIDENT_WINDOWS[type] ?? 1500,
      responseKey: ACCIDENT_KEYS[type] ?? "e",
    });
  }
  return accidents;
}
