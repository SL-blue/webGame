import { describe, it, expect } from "vitest";
import type { MiniGameResult } from "../../client/src/minigames/types";

describe("MiniGameResult shape", () => {
  it("has the required fields", () => {
    const result: MiniGameResult = {
      segmentId: "seg-test",
      items: [
        { itemId: "item-0", action: "left",  reactionMs: 400 },
        { itemId: "item-1", action: "right", reactionMs: 350 },
        { itemId: "item-2", action: "miss",  reactionMs: 2500 },
      ],
      sorted: 2,
      missed: 1,
      total: 3,
    };
    expect(result.segmentId).toBe("seg-test");
    expect(result.sorted + result.missed).toBe(result.total);
    expect(result.items).toHaveLength(3);
  });

  it("pay is not stored client-side (server decides)", () => {
    const result: MiniGameResult = {
      segmentId: "seg-x",
      items: [],
      sorted: 0,
      missed: 0,
      total: 0,
    };
    expect("pay" in result).toBe(false);
  });
});
