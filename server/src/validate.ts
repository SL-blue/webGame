import type { SegmentSpecResponse, SegmentResultPayload } from "shared";

const MIN_REACTION_MS = 80;
const DURATION_TOLERANCE_MS = 3000;
const UNIFORM_VARIANCE_THRESHOLD = 30; // ms² — reactions this tight are suspicious

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateSegmentResults(
  spec: SegmentSpecResponse,
  payload: SegmentResultPayload,
  serverElapsedMs: number,
): ValidationResult {
  const specItemIds = new Set(spec.items.map((i) => i.id));

  // catch-delivery uses position-based catches (reactionMs: 0 is valid); only
  // keystroke-based games need reaction-time and uniformity checks.
  const keystrokeBased = spec.taskType !== "catch-delivery";

  for (const r of payload.items) {
    if (r.action !== "miss" && r.action !== "missed" && !specItemIds.has(r.itemId)) {
      return { ok: false, reason: `Unknown item id: ${r.itemId}` };
    }
    if (keystrokeBased && r.action !== "miss" && r.action !== "missed" && r.reactionMs < MIN_REACTION_MS) {
      return { ok: false, reason: `Reaction too fast: ${r.reactionMs}ms` };
    }
    if (r.accuracy !== undefined && (r.accuracy < 0 || r.accuracy > 1)) {
      return { ok: false, reason: `Accuracy out of range: ${r.accuracy}` };
    }
  }

  const nonMiss = payload.items.filter((r) => r.action !== "miss" && r.action !== "missed");
  if (nonMiss.length > spec.items.length) {
    return { ok: false, reason: "More results than items in spec" };
  }

  if (serverElapsedMs < spec.durationSec * 1000 - DURATION_TOLERANCE_MS) {
    return { ok: false, reason: "Segment submitted too early by server clock" };
  }

  // Uniformity check only for keystroke-based games
  if (keystrokeBased) {
    const times = payload.items
      .filter((r) => r.action !== "miss" && r.action !== "missed")
      .map((r) => r.reactionMs);
    if (times.length >= 3 && hasUniformTiming(times)) {
      return { ok: false, reason: "Suspiciously uniform reaction timing" };
    }
  }

  return { ok: true };
}

function hasUniformTiming(times: number[]): boolean {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((acc, t) => acc + (t - avg) ** 2, 0) / times.length;
  return variance < UNIFORM_VARIANCE_THRESHOLD;
}

export function scoreSegment(
  spec: SegmentSpecResponse,
  payload: SegmentResultPayload,
  payPerBox: number,
): { sorted: number; missed: number; pay: number } {
  switch (spec.taskType) {
    case "package-sort":    return scorePackageSort(spec, payload, payPerBox);
    case "coffee-timing":   return scoreCoffeeTiming(spec, payload, payPerBox);
    case "catch-delivery":  return scoreCatchDelivery(spec, payload, payPerBox);
  }
}

function scorePackageSort(
  spec: SegmentSpecResponse,
  payload: SegmentResultPayload,
  payPerBox: number,
): { sorted: number; missed: number; pay: number } {
  let sorted = 0, missed = 0;
  for (const item of spec.items) {
    const r = payload.items.find((x) => x.itemId === item.id);
    if (!r || r.action === "miss") { missed++; continue; }
    const correct = item.color === spec.colorLeft ? "left" : "right";
    if (r.action === correct) sorted++; else missed++;
  }
  return { sorted, missed, pay: Math.max(0, sorted * payPerBox - missed * 2) };
}

function scoreCoffeeTiming(
  spec: SegmentSpecResponse,
  payload: SegmentResultPayload,
  payPerBox: number,
): { sorted: number; missed: number; pay: number } {
  let sorted = 0, missed = 0, pay = 0;
  for (const item of spec.items) {
    const r = payload.items.find((x) => x.itemId === item.id);
    if (!r || r.action === "miss") { missed++; continue; }
    const acc = r.accuracy ?? 0;
    if (r.action === "hit" && acc >= 0) {
      sorted++;
      pay += Math.floor(payPerBox * (0.5 + acc * 0.5));
    } else {
      missed++;
    }
  }
  return { sorted, missed, pay: Math.max(0, pay - missed * 2) };
}

function scoreCatchDelivery(
  spec: SegmentSpecResponse,
  payload: SegmentResultPayload,
  payPerBox: number,
): { sorted: number; missed: number; pay: number } {
  let sorted = 0, missed = 0, pay = 0;
  for (const item of spec.items) {
    const r = payload.items.find((x) => x.itemId === item.id);
    const caught = r?.action === "caught";
    if (item.fragile) {
      if (caught) { missed++; pay -= payPerBox; }
    } else {
      if (caught) { sorted++; pay += payPerBox; }
      else { missed++; pay -= 2; }
    }
  }
  return { sorted, missed, pay: Math.max(0, pay) };
}
