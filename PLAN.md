# Milestone Plan — "Paws & Paychecks"

Every milestone ends in something playable. Work one milestone at a time; at the end of each, make sure it runs, run tests, summarize what changed, then stop and wait for review.

---

## Milestone 1 — Project Scaffold + Walking Skeleton

**Ends in:** App loads, shows a 3D room, "New Game" button transitions through placeholder phase screens (morning → work → evening → sleep) with real timers, then shows "Run complete."

- Monorepo `package.json` workspaces for `client`, `server`, `shared`
- `/shared/timing.ts` — TIMING constants (single source of truth for all durations)
- `/shared/phases.ts` — phase name literals
- `/shared/api-types.ts` — Zod schemas for all request/response shapes (stubs, fill in later)
- Client: Vite + Three.js, `state-machine.ts` wiring phases, `api.ts` stub
- 3D room: floor, four walls, ambient + directional light, one placeholder box as the pet
- HTML overlay: phase label, timer bar, "New Game" button
- Server: Cloudflare Worker with Hono; `POST /api/run/start` stub → `{ runId, token }`
- Durable Object skeleton (`run-object.ts`) with `RunState` type, no logic yet
- `wrangler.toml` with D1 and DO bindings; `vitest.config.ts`; `playwright.config.ts`
- `DECISIONS.md` created (empty log)

**Tests:** Vitest confirms TIMING exports; Worker smoke test returns 200.

---

## Milestone 2 — Full Day Loop, Client-Side

**Ends in:** Play a full in-game day: timed morning schedule → package-sorting mini-game → timed evening block picker → sleep summary. All timers from TIMING. No server state yet.

- Morning: 3 hardcoded task cards, timed picker (~10 s)
- **Package sorting mini-game** (`/client/src/minigames/package-sort/`): boxes fall, keyboard-route to color-coded chutes. Interface: `start(spec)`, `update(dt)`, `getResults()`, `dispose()`
- Evening: 3 time-block buttons (Exercise / Pet Care / Entertainment / Relationship), timed (~20 s)
- Sleep: placeholder summary screen
- HUD: money, day/clock, timer bar
- Frame delta clamped to 50 ms

**Tests:** Vitest for mini-game result shape.

---

## Milestone 3 — Server-Driven Day Loop + Cue System

**Ends in:** Same day loop, but driven by real API calls. Pet and player show animated cues from server-sent descriptors. Hidden state lives on the server.

- Full `RunState` in Durable Object: seed, hidden stats, pet traits (2–3 per run), server clock enforcement
- Real `POST /api/run/start`, `/schedule`, `/segment`, `/evening`, `/sleep` endpoints
- Segment validation: item refs exist, reaction times ≥ 80 ms, duration by server clock
- `/server/src/rules/` — traits, stat→cue mapping, `mulberry32` RNG
- `/client/src/cues/` — maps cue descriptors to Three.js animations/effects
- Pet body language keyed to `{ pet: { pose, sound } }` descriptors
- Stress vignette (EffectComposer), camera sway at "overwhelmed"
- HMAC-signed session token, verified on every request

**Tests:** Vitest for segment validation; trait-to-cue mapping unit tests.

---

## Milestone 4 — All 3 Mini-games + Accidents

**Ends in:** Full work day with all three task types and reactive accidents. Missing an accident has a visible cost.

- **Coffee timing** (`/client/src/minigames/coffee-timing/`): stop a moving needle in a target zone
- **Catch deliveries** (`/client/src/minigames/catch-delivery/`): move left/right to catch items, avoid fragile ones
- Server generates segment spec for all three task types from seed; validates all three result shapes
- Accident system: server schedules accidents inside segment specs; client gets warning `accidentWarningMs` ahead
- `POST /api/run/:id/accident { accidentId, response, t }` — server checks timing, applies cost
- Three accident types: spill/dropped box, pet-cam alert, girlfriend call

**Tests:** Vitest for accident timing validation; balance smoke test: all-accidents-ignored run scores lower.

---

## Milestone 5 — 4-Day Run, Perks, Relationship + Sleep Debt

**Ends in:** Complete 4-day run with accumulating state, two perk choices, and a relationship arc.

- `/sleep` advances day, applies sleep debt, illness chance, fatigue carry-over
- Day summary: coarse feedback strings
- Illness: heavier controls for one day if sleep debt threshold crossed
- Perk system: server offers 3 perks after day 1 and day 3; all 10 perks from GAME_DESIGN §7
- Perk card UI: icons, short phrase, 10 s timer
- Relationship: girlfriend tone cue in `phone.tone`; forgotten-plan accident planted by server
- Evening relationship activity: pick response from tone cue, timed
- `POST /api/run/:id/end {}` stub → placeholder score

**Tests:** Vitest for perk stacking cap; sleep-debt accumulation; Playwright single full day E2E.

---

## Milestone 6 — Scoring, End Screen, Leaderboard

**Ends in:** Complete game loop from start to final score with grade breakdown and leaderboard.

- `/server/src/rules/scoring.ts`: multiplicative formula across finances, pet, self, relationship (server only)
- `/end` returns `{ score, grades: { finances, pet, self, relationship }, reasons: string[] }`
- End screen: four grade tiles + 2–4 reasons + "Play Again"
- D1: `CREATE TABLE runs (id, score, created_at)`
- `GET /api/leaderboard` → top 10; leaderboard screen on start and end screens
- Balance Vitest tests: "always overtime", "never care for pet", "ignore girlfriend" all score below balanced

**Tests:** All balance tests green; Playwright full run E2E reaching end screen.

---

## Milestone 7 — Polish, Security Hardening, Delivery

**Ends in:** Production-ready build that passes a self-attack pass. Demo mode works for class exchange.

- Production build: `build.sourcemap: false`, `lil-gui` stripped, no `console.log` of state
- `window` audit: no game state or debug hooks
- Network audit: cue descriptors carry no exact numbers; segment specs carry no future accidents
- Plausibility: reject sub-80 ms reactions, uniform timing, score > segment max
- Demo mode: `TIMING_DEMO` variant in `/shared/timing.ts`, activated by build flag
- Stress/fatigue polish: desaturation filter, coarse stress label (Calm / Tense / Overwhelmed)
- Accessibility: no rapid flashing, readable fonts
- Instructions screen (from GAME_DESIGN §9)
- Final Playwright E2E for a full 4-day run

**Tests:** All Vitest + Playwright green on production build.

---

## Verification checklist (every milestone)

1. `npm run dev -w client` + `npm run dev -w server` — no console errors
2. Play through the game up to the milestone's scope
3. `npm test` — all tests green
4. M6+: `npm run build`, then `grep -r "window\." dist/` to confirm no state leaks
