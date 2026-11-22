# Technical Spec — "Paws & Paychecks"

Companion to `GAME_DESIGN.md`. Describes how the game is built.

## 1. Guiding principle

**The frontend draws and handles input. The backend owns everything hidden and everything that decides the score.**

Assume testers will read the client bundle, open the console and watch network traffic. Nothing they find there should reveal hidden state, future events or the scoring formula, and no request should let them set their own outcome.

## 2. Stack

| Area | Choice |
|---|---|
| Language | TypeScript everywhere |
| Client build | Vite (production: minified, `build.sourcemap: false`) |
| 3D | Three.js (+ `GLTFLoader`, `EffectComposer` for blur/vignette/color effects) |
| Assets | Low-poly CC0 packs (Kenney, Quaternius) or simple primitives |
| Tweens | GSAP or `@tweenjs/tween.js` |
| UI | Plain HTML/CSS overlay over the canvas (no framework) |
| Audio | Howler.js |
| Phase flow | Small hand-written state machine |
| Physics | None or simple custom collision |
| API runtime | Cloudflare Workers |
| Router | Hono |
| Run state | Durable Objects (one per run) |
| Database | Cloudflare D1 (finished runs, leaderboard) |
| Validation | Zod |
| RNG | Seeded, server-side (e.g. `mulberry32`) |
| Session token | HMAC-signed via Web Crypto |
| Hosting | Cloudflare Pages (client) + Workers (API), deployed with Wrangler |
| Tests | Vitest (rules, scoring, balance), Playwright (end-to-end) |
| Dev-only tuning | `lil-gui`, excluded from production builds |

## 3. Repository layout

```
/client               Three.js app
  /src
    main.ts
    /scenes           room, work area, phone UI
    /minigames        one folder per task type
    /phases           morning, work, evening, sleep, end
    /cues             map cue descriptors -> animations/effects
    /ui               HTML overlay: menus, perk cards, HUD
    api.ts            all server calls
    state-machine.ts
/server               Cloudflare Worker
  /src
    index.ts          Hono routes
    run-object.ts     Durable Object: one run's state + phase logic
    /rules            SERVER ONLY: traits, events, perks, scoring, cue mapping
    validate.ts       plausibility checks for work results
    rng.ts
/shared               SAFE TO EXPOSE ONLY
  timing.ts           TIMING config
  phases.ts           phase names
  api-types.ts        request/response types (Zod schemas)
```

Nothing in `/server/src/rules` may be imported by `/client`.

## 4. Responsibilities

**Client**
- Render the scene, animations, camera, UI
- Read input; run mini-games in real time
- Turn cue descriptors into visuals
- Run phase timers locally for display
- Send player actions and mini-game result logs

**Server**
- Create runs (ID, token, seed)
- Hold all hidden state: stat values, pet traits, sleep debt, illness risk
- Roll events and accidents; build work segment specs
- Offer perks and apply their effects
- Apply outcomes of schedule, evening and overtime choices
- Validate work results
- Compute the final score and breakdown; store results; serve the leaderboard
- Enforce phase order and timing using **its own clock**

## 5. Run state (Durable Object)

```ts
type RunState = {
  runId: string;
  seed: number;
  phase: Phase;            // e.g. "morning" | "work" | "evening" | "sleep" | "perk" | "ended"
  day: number;
  segmentIndex: number;
  phaseStartedAt: number;  // server timestamp
  money: number;
  hidden: {
    stress: number;
    fatigue: number;
    sleepDebt: number;
    health: number;
    pet: { traits: TraitId[]; hunger: number; mood: number; health: number };
    relationship: number;
    pendingPlans: Plan[];  // things the girlfriend mentioned
  };
  perks: PerkId[];
  log: RunEvent[];         // for the end-of-run breakdown
};
```

## 6. API (phase requests)

All requests carry the run token. The server rejects any request that doesn't match the current phase, arrives too early by its own clock, or repeats a phase.

```
POST /api/run/start
  -> { runId, token, day, cues, taskOffers }

POST /api/run/:id/schedule      { taskIds }
  -> { segment }                  // first work segment spec

POST /api/run/:id/segment       { segmentId, results }
  -> { segment | null, cues, money }   // next segment, or null at end of day

POST /api/run/:id/accident      { accidentId, response, t }
  -> { cues }

POST /api/run/:id/evening       { activities }
  -> { cues, money }

POST /api/run/:id/sleep         {}
  -> { summary, cues, perkOffer?, nextDay? , taskOffers? }

POST /api/run/:id/perk          { perkId }
  -> { ok }

POST /api/run/:id/end           {}
  -> { score, grades, reasons }

GET  /api/leaderboard
  -> [{ name, score, date }]
```

### Cue descriptors

The server sends **descriptions, not numbers**:

```json
{ "pet": { "pose": "restless", "sound": "whine" },
  "self": { "stressLevel": "tense", "fatigue": "tired" },
  "phone": { "message": "...", "tone": "short" } }
```

An agent reading the network sees roughly what a human sees on screen.

## 7. Work segments and validation

- Each segment spec is generated from the seed: task type, duration, item sequence (what appears and when), and any interruptions/accidents **in that segment only**.
- Only the current segment is ever sent, so the client never knows more than ~20–40 s ahead.
- Client reports `results`: per item, hit/miss and a timestamp relative to segment start.
- Server checks:
  - items referenced exist in the spec
  - reaction times are humanly possible (reject sub-~80 ms reactions or suspiciously perfect, uniform timing) **(tunable)**
  - score ≤ the segment's maximum
  - segment duration by server clock ≥ the expected duration (minus a small tolerance)
- Failing checks → the segment scores zero and the run is flagged.

## 8. Security rules (hard requirements)

1. No game state, rules or debug hooks on `window` or any global.
2. No scoring, trait, event-probability or perk-effect code or data in the client bundle.
3. No source maps in production; minified build.
4. No debug keys, URL debug flags or god mode in production builds.
5. No `console.log` of state in production.
6. Clamp frame delta time (e.g. max 50 ms) so tab switches don't cause jumps.
7. Pausing (if any) hides or blurs the scene; server time keeps running.
8. All request bodies validated with Zod; out-of-range values rejected.
9. Do **not** block automated browsers outright — the game should be hard to win, not impossible to try.

## 9. Timing config

Single source of truth in `/shared/timing.ts`, read by both client and server:

```ts
export const TIMING = {
  daysPerRun: 4,
  morningSec: 10,
  workSec: 90,          // whole workday (8 in-game hours)
  eveningSec: 20,
  sleepSec: 5,
  perkChoiceSec: 10,
  accidentWarningMs: 1500,
  phoneAnswerMs: 3000,
};
```

A "demo mode" can use shorter values for the class exchange.

## 10. Testing

- **Vitest:** rules and scoring unit tests; balance tests that simulate fixed strategies ("always overtime", "never care for pet", "ignore girlfriend") and assert they score below a balanced strategy.
- **Playwright:** end-to-end run through one full day.
- **Self-attack before class:** point a coding agent at the deployed build and try to read hidden state from the bundle/network and submit fake results. Fix what it finds.

## 11. Deployment

- Client → Cloudflare Pages (auto-deploy from GitHub `main`).
- API → Cloudflare Workers via `wrangler deploy`, with Durable Objects and D1 bindings in `wrangler.toml`.
- Client calls the API on the same domain (`/api/*` route) to avoid CORS setup.
