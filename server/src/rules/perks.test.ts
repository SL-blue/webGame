import { describe, it, expect } from "vitest";
import { addPerk, offerPerks, ALL_PERKS } from "./perks";
import { mulberry32 } from "./rng";

describe("addPerk", () => {
  it("adds a valid perk", () => {
    const owned: string[] = [];
    expect(addPerk(owned, "workaholic")).toBe(true);
    expect(owned).toContain("workaholic");
  });

  it("rejects duplicate perks", () => {
    const owned = ["workaholic"];
    expect(addPerk(owned, "workaholic")).toBe(false);
    expect(owned).toHaveLength(1);
  });

  it("caps at 2 perks per run", () => {
    const owned: string[] = [];
    addPerk(owned, "workaholic");
    addPerk(owned, "gym-rat");
    const result = addPerk(owned, "calm-mind");
    expect(result).toBe(false);
    expect(owned).toHaveLength(2);
  });

  it("rejects unknown perk ids", () => {
    const owned: string[] = [];
    expect(addPerk(owned, "made-up-perk")).toBe(false);
    expect(owned).toHaveLength(0);
  });
});

describe("offerPerks", () => {
  it("returns 3 perks", () => {
    const rng = mulberry32(42);
    expect(offerPerks(rng, [])).toHaveLength(3);
  });

  it("never offers already-owned perks", () => {
    const rng = mulberry32(42);
    const owned = ["workaholic", "gym-rat"];
    const offered = offerPerks(rng, owned);
    for (const p of offered) {
      expect(owned).not.toContain(p.id);
    }
  });

  it("covers all 10 perk definitions", () => {
    expect(ALL_PERKS).toHaveLength(10);
    const ids = new Set(ALL_PERKS.map((p) => p.id));
    expect(ids.size).toBe(10);
  });
});
