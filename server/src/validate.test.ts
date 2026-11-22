import { describe, it, expect } from "vitest";
import { validateSegmentResults, scoreSegment } from "./validate";
import type { SegmentSpecResponse, SegmentResultPayload } from "shared";

const ELAPSED_OK = 90_000;

// ─── Package sort ────────────────────────────────────────────────────────────

const SORT_SPEC: SegmentSpecResponse = {
  segmentId: "seg-sort",
  taskType: "package-sort",
  durationSec: 90,
  colorLeft: "red",
  colorRight: "blue",
  items: [
    { id: "item-0", color: "red",  spawnAt: 0 },
    { id: "item-1", color: "blue", spawnAt: 3 },
    { id: "item-2", color: "red",  spawnAt: 6 },
  ],
  accidents: [],
};

describe("validateSegmentResults — package sort", () => {
  it("accepts valid submission", () => {
    const p: SegmentResultPayload = {
      segmentId: "seg-sort",
      items: [
        { itemId: "item-0", action: "left",  reactionMs: 500 },
        { itemId: "item-1", action: "right", reactionMs: 400 },
      ],
    };
    expect(validateSegmentResults(SORT_SPEC, p, ELAPSED_OK)).toEqual({ ok: true });
  });

  it("rejects unknown item id", () => {
    const p: SegmentResultPayload = { segmentId: "s", items: [{ itemId: "nope", action: "left", reactionMs: 300 }] };
    expect(validateSegmentResults(SORT_SPEC, p, ELAPSED_OK).ok).toBe(false);
  });

  it("rejects sub-80ms reaction", () => {
    const p: SegmentResultPayload = { segmentId: "s", items: [{ itemId: "item-0", action: "left", reactionMs: 50 }] };
    expect(validateSegmentResults(SORT_SPEC, p, ELAPSED_OK).ok).toBe(false);
  });

  it("rejects early submission", () => {
    const p: SegmentResultPayload = { segmentId: "s", items: [] };
    expect(validateSegmentResults(SORT_SPEC, p, 10_000).ok).toBe(false);
  });
});

describe("scoreSegment — package sort", () => {
  it("counts correctly sorted boxes", () => {
    const p: SegmentResultPayload = {
      segmentId: "s",
      items: [
        { itemId: "item-0", action: "left",  reactionMs: 300 }, // red → left ✓
        { itemId: "item-1", action: "right", reactionMs: 300 }, // blue → right ✓
        { itemId: "item-2", action: "right", reactionMs: 300 }, // red → left ✗
      ],
    };
    const { sorted, missed } = scoreSegment(SORT_SPEC, p, 10);
    expect(sorted).toBe(2);
    expect(missed).toBe(1);
  });
});

// ─── Coffee timing ───────────────────────────────────────────────────────────

const COFFEE_SPEC: SegmentSpecResponse = {
  segmentId: "seg-coffee",
  taskType: "coffee-timing",
  durationSec: 90,
  items: [
    { id: "pour-0", spawnAt: 0,  targetCenter: 0.5, targetWidth: 0.2, needleSpeed: 1 },
    { id: "pour-1", spawnAt: 5,  targetCenter: 0.6, targetWidth: 0.18, needleSpeed: 1.1 },
  ],
  accidents: [],
};

describe("scoreSegment — coffee timing", () => {
  it("gives full pay for a centered hit", () => {
    const p: SegmentResultPayload = {
      segmentId: "s",
      items: [{ itemId: "pour-0", action: "hit", reactionMs: 1200, accuracy: 1.0 }],
    };
    const { sorted, pay } = scoreSegment(COFFEE_SPEC, p, 15);
    expect(sorted).toBe(1);
    expect(pay).toBeGreaterThan(0);
  });

  it("gives reduced pay for an edge hit", () => {
    const pEdge: SegmentResultPayload = {
      segmentId: "s",
      items: [{ itemId: "pour-0", action: "hit", reactionMs: 1200, accuracy: 0.1 }],
    };
    const pCenter: SegmentResultPayload = {
      segmentId: "s",
      items: [{ itemId: "pour-0", action: "hit", reactionMs: 1200, accuracy: 1.0 }],
    };
    expect(scoreSegment(COFFEE_SPEC, pEdge, 15).pay)
      .toBeLessThan(scoreSegment(COFFEE_SPEC, pCenter, 15).pay);
  });
});

// ─── Catch delivery ──────────────────────────────────────────────────────────

const CATCH_SPEC: SegmentSpecResponse = {
  segmentId: "seg-catch",
  taskType: "catch-delivery",
  durationSec: 90,
  items: [
    { id: "pkg-0", spawnAt: 0, lane: 0, fragile: false },
    { id: "pkg-1", spawnAt: 4, lane: 1, fragile: true  },
    { id: "pkg-2", spawnAt: 8, lane: 2, fragile: false },
  ],
  accidents: [],
};

describe("scoreSegment — catch delivery", () => {
  it("pays for caught regular items", () => {
    const p: SegmentResultPayload = {
      segmentId: "s",
      items: [
        { itemId: "pkg-0", action: "caught", reactionMs: 0 },
        { itemId: "pkg-2", action: "caught", reactionMs: 0 },
      ],
    };
    const { sorted, pay } = scoreSegment(CATCH_SPEC, p, 15);
    expect(sorted).toBe(2);
    expect(pay).toBeGreaterThan(0);
  });

  it("penalises catching a fragile item", () => {
    const p: SegmentResultPayload = {
      segmentId: "s",
      items: [{ itemId: "pkg-1", action: "caught", reactionMs: 0 }],
    };
    const { missed } = scoreSegment(CATCH_SPEC, p, 15);
    expect(missed).toBeGreaterThan(0);
  });

  it("pay is never negative", () => {
    const p: SegmentResultPayload = { segmentId: "s", items: [] };
    expect(scoreSegment(CATCH_SPEC, p, 15).pay).toBeGreaterThanOrEqual(0);
  });
});

// ─── Uniform timing check ────────────────────────────────────────────────────

describe("validateSegmentResults — uniform timing (anti-bot)", () => {
  it("rejects suspiciously uniform reaction times", () => {
    const p: SegmentResultPayload = {
      segmentId: "seg-sort",
      items: SORT_SPEC.items.map((item) => ({
        itemId: item.id,
        action: "left",
        reactionMs: 500, // exactly the same every time
      })),
    };
    expect(validateSegmentResults(SORT_SPEC, p, ELAPSED_OK).ok).toBe(false);
  });

  it("accepts human-like timing with variance", () => {
    const p: SegmentResultPayload = {
      segmentId: "seg-sort",
      items: [
        { itemId: "item-0", action: "left",  reactionMs: 420 },
        { itemId: "item-1", action: "right", reactionMs: 850 },
        { itemId: "item-2", action: "left",  reactionMs: 310 },
      ],
    };
    expect(validateSegmentResults(SORT_SPEC, p, ELAPSED_OK)).toEqual({ ok: true });
  });
});

// ─── Balance smoke test ───────────────────────────────────────────────────────

describe("balance — all accidents ignored vs responded", () => {
  it("ignored accidents result in higher cost (money penalty) than answered ones", () => {
    // This is encoded in the server run-object, but we can verify at the scoring level
    // that missing items produces worse scores than getting them right
    const allMissed: SegmentResultPayload = { segmentId: "s", items: [] };
    const allHit: SegmentResultPayload = {
      segmentId: "s",
      items: SORT_SPEC.items.map((i) => ({
        itemId: i.id,
        action: i.color === "red" ? "left" : "right",
        reactionMs: 300,
      })),
    };
    expect(scoreSegment(SORT_SPEC, allMissed, 10).pay)
      .toBeLessThan(scoreSegment(SORT_SPEC, allHit, 10).pay);
  });
});
