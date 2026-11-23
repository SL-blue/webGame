import { describe, it, expect } from "vitest";
import { RunObject } from "./run-object";

/** Minimal DurableObjectState mock — no real storage needed for unit tests. */
function makeDO(): RunObject {
  const ctx = {
    storage: {
      get:  async () => null,
      put:  async () => undefined,
    },
  } as unknown as DurableObjectState;
  return new RunObject(ctx);
}

function req(pathname: string, body: unknown): Request {
  return new Request(`https://internal${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("RunObject.submitSegment — phase always advances", () => {
  it("moves to 'evening' with 0 pay when validation fails (submitted too early)", async () => {
    const obj = makeDO();

    // init
    await obj.fetch(req("/init", { runId: "test-run" }));

    // schedule → enters work phase
    const schedRes  = await obj.fetch(req("/schedule", { taskId: "hard" }));
    const { segment } = (await schedRes.json()) as { segment: { segmentId: string } };

    // submit immediately — serverElapsedMs ≈ 0, so the duration check will fail
    const segRes  = await obj.fetch(req("/segment", { segmentId: segment.segmentId, items: [] }));
    const segData = (await segRes.json()) as { sorted: number; money: number; error?: string };

    // must NOT be an error response (like "Wrong phase")
    expect(segData.error).toBeUndefined();
    expect(segData.sorted).toBe(0);

    // /evening must succeed — phase was advanced despite failed validation
    const evenRes  = await obj.fetch(req("/evening", { activities: [] }));
    const evenData = (await evenRes.json()) as { money?: number; error?: string };
    expect(evenData.error).not.toBe("Wrong phase");
    expect(evenData.money).toBeDefined();
  });
});
