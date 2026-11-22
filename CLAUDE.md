# CLAUDE.md

Instructions for coding agents working on this repo.

## What this project is

A small Three.js browser game for a class assignment: a pet-adoption life sim where the player balances money, pet care, their own stress and their relationship over a few in-game days. It must be enjoyable for humans but hard for AI agents to win or score highly on. Classmates will attack it with AI agents (screenshot-based browser agents and code-reading agents).

Read before working:
- `GAME_DESIGN.md` — what the game is and why
- `TECH_SPEC.md` — architecture, API, security rules
- `PLAN.md` — milestones (create it in the planning step if missing)
- `DECISIONS.md` — log of decisions (append to it)

## Commands

- Install: `npm install`
- Client dev server: `npm run dev -w client`  → http://localhost:5173
- Worker dev: `npm run dev -w server`          → http://localhost:8787
- Tests: `npm test --workspaces=false`         (runs vitest from repo root)
- Build: `npm run build -w client`
- Deploy: `npm run deploy -w server`

## Hard rules

1. **Hidden stuff stays on the server.** Scoring, pet traits, event probabilities, perk effect values and the stat→cue mapping live only in `/server/src/rules`. Never import them into `/client`.
2. **The server sends cues, not numbers.** Clients receive descriptors like `{ pose: "restless" }`, never `{ hunger: 72 }`.
3. **No globals.** No game state, debug hooks or helpers on `window`.
4. **Production builds:** minified, no source maps, no debug keys/flags, no `console.log` of state. Dev tools (`lil-gui` etc.) must be stripped from production.
5. **Time never stops.** Choices are timed; if time runs out, apply a default. Any pause hides the scene.
6. **Timing lives in `/shared/timing.ts`.** Never hard-code durations elsewhere.
7. **Only the current work segment is sent to the client.** Never send future accidents or events.
8. **Validate every request** with Zod and enforce phase order with the server clock.
9. **Don't block bots outright.** No CAPTCHAs or automation detection that prevents loading.
10. **Keep dependencies minimal.** Each new dependency needs a one-line reason in `DECISIONS.md`.

## Conventions

- TypeScript, strict mode.
- One folder per mini-game under `/client/src/minigames`, each exporting a common interface (`start(spec)`, `update(dt)`, `getResults()`, `dispose()`).
- Clamp frame delta time (max ~50 ms).
- Keep functions small and readable — the owner must be able to explain the code in class.

## Workflow

- Work **one milestone at a time** from `PLAN.md`. At the end of each milestone: make sure it runs, run tests, summarize what changed and how to try it, then **stop and wait** for review.
- Every milestone should end in something playable.
- Append a line to `DECISIONS.md` for each important choice: `- <decision> — <why>`.
- If the design docs are ambiguous or conflict, ask instead of guessing on anything that affects game rules or security. For purely visual or UX details, decide and log it.

## Where you have creative freedom

You may decide, within the constraints above and in `GAME_DESIGN.md`:
- Visual style, color palette, lighting, camera angles (low-poly, readable at a glance)
- UI layout and look of menus, perk cards, HUD, end screen
- Animations and visual effects for cues (pet body language, stress/fatigue effects)
- Sound choices
- First draft of accident content and the girlfriend's text messages
- Details of mini-game mechanics, as long as they're learnable in seconds and real-time

Before building the visual style, propose **2–3 short visual directions** and let the owner pick.

Constraints on that freedom:
- Cues must be readable by an attentive human; never show exact hidden values.
- Accidents must be warned ~1–2 s ahead and allow a response.
- No copyrighted characters, logos or assets; use CC0 or self-made assets.
- No rapid flashing effects (accessibility).
