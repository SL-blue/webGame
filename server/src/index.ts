import { Hono } from "hono";
import {
  ScheduleRequest,
  SegmentResultPayload,
  EveningRequest,
  AccidentRequest,
  PerkRequest,
} from "shared";
import { RunObject } from "./run-object";
import { initDb, saveRun, getTopScores } from "./db";

export { RunObject };

type Bindings = {
  RUN: DurableObjectNamespace;
  DB: D1Database;
  SIGNING_SECRET: string;
  DEMO_MODE: string; // "true" | "false"
};

const app = new Hono<{ Bindings: Bindings }>();

// ─── Auth helpers ───────────────────────────────────────────────────────────

async function signToken(secret: string, runId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(runId),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyToken(
  secret: string,
  runId: string,
  token: string,
): Promise<boolean> {
  const expected = await signToken(secret, runId);
  return expected === token;
}

// ─── Middleware: verify token for all /api/run/:id/* routes ─────────────────

app.use("/api/run/:id/*", async (c, next) => {
  const runId = c.req.param("id");
  // /api/run/start is the creation endpoint; it doesn't carry a token
  if (runId === "start") return next();

  // Clone body so we can read it once here and once in the handler
  const raw = await c.req.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw); } catch { /* empty body OK */ }

  const token = (body["token"] as string | undefined) ?? "";
  if (!token) return c.json({ error: "Missing token" }, { status: 401 });

  const valid = await verifyToken(c.env.SIGNING_SECRET, runId, token);
  if (!valid) return c.json({ error: "Invalid token" }, { status: 401 });

  // Stash parsed body so handlers don't need to re-parse
  c.set("parsedBody" as never, body);
  return next();
});

// ─── Helper: route a request to the run's Durable Object ────────────────────

async function callDO(
  env: Bindings,
  runId: string,
  path: string,
  body: unknown,
): Promise<Response> {
  const id = env.RUN.idFromName(runId);
  const stub = env.RUN.get(id);
  return stub.fetch(
    new Request(`https://internal${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/run/start", async (c) => {
  const runId = crypto.randomUUID();
  const demo  = c.env.DEMO_MODE === "true";
  const doRes = await callDO(c.env, runId, "/init", { runId, demo });
  if (!doRes.ok) return doRes;

  const data  = (await doRes.json()) as Record<string, unknown>;
  const token = await signToken(c.env.SIGNING_SECRET, runId);

  return c.json({ ...data, runId, token, demo });
});

app.post("/api/run/:id/schedule", async (c) => {
  const body = c.get("parsedBody" as never) as Record<string, unknown>;
  const parsed = ScheduleRequest.safeParse(body);
  if (!parsed.success) return c.json({ error: "Bad request" }, { status: 400 });

  return callDO(c.env, c.req.param("id"), "/schedule", parsed.data);
});

app.post("/api/run/:id/segment", async (c) => {
  const body = c.get("parsedBody" as never) as Record<string, unknown>;
  const parsed = SegmentResultPayload.safeParse(body);
  if (!parsed.success) return c.json({ error: "Bad request" }, { status: 400 });

  return callDO(c.env, c.req.param("id"), "/segment", parsed.data);
});

app.post("/api/run/:id/accident", async (c) => {
  const body = c.get("parsedBody" as never) as Record<string, unknown>;
  const parsed = AccidentRequest.safeParse(body);
  if (!parsed.success) return c.json({ error: "Bad request" }, { status: 400 });

  return callDO(c.env, c.req.param("id"), "/accident", parsed.data);
});

app.post("/api/run/:id/evening", async (c) => {
  const body = c.get("parsedBody" as never) as Record<string, unknown>;
  const parsed = EveningRequest.safeParse(body);
  if (!parsed.success) return c.json({ error: "Bad request" }, { status: 400 });

  return callDO(c.env, c.req.param("id"), "/evening", parsed.data);
});

app.post("/api/run/:id/sleep", async (c) => {
  return callDO(c.env, c.req.param("id"), "/sleep", {});
});

app.post("/api/run/:id/perk", async (c) => {
  const body = c.get("parsedBody" as never) as Record<string, unknown>;
  const parsed = PerkRequest.safeParse(body);
  if (!parsed.success) return c.json({ error: "Bad request" }, { status: 400 });
  return callDO(c.env, c.req.param("id"), "/perk", parsed.data);
});

app.post("/api/run/:id/end", async (c) => {
  const runId = c.req.param("id");
  const doRes = await callDO(c.env, runId, "/end", {});
  if (!doRes.ok) return doRes;

  const data = (await doRes.json()) as { score: number; grades: unknown; reasons: unknown[] };

  // Save to D1 — best-effort, don't fail if DB not configured
  try {
    await initDb(c.env.DB);
    await saveRun(c.env.DB, runId, data.score);
  } catch { /* D1 not set up in dev — ignore */ }

  return c.json(data);
});

app.get("/api/leaderboard", async (c) => {
  try {
    await initDb(c.env.DB);
    const rows = await getTopScores(c.env.DB);
    const entries = rows.map((r, i) => ({ rank: i + 1, score: r.score, created_at: r.created_at }));
    return c.json(entries);
  } catch {
    return c.json([]); // D1 not set up — return empty leaderboard
  }
});

export default app;
