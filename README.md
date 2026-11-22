# Paws & Paychecks

A short browser life-sim built with Three.js and Cloudflare Workers. You just adopted a pet. Over a few in-game days, keep life in balance: earn money, look after your pet, stay calm, and don't neglect your girlfriend.

## Objective

Play through 4 days (2 in demo mode). At the end you get a score out of 10,000 — computed from four equally-weighted areas that multiply together, so neglecting any one drags the total down.

| Area | What drives it |
|---|---|
| Finances | Total money earned across work mini-games |
| Pet | Pet mood, hunger, and health at the end |
| Self | Stress, fatigue, and sleep debt |
| Relationship | Whether you answered her calls and spent time together |

## Controls

| Phase | Action | Key |
|---|---|---|
| Morning | Select a task | Click |
| Work — Package sort | Route box left / right | A / ← &nbsp;&nbsp; D / → |
| Work — Coffee service | Pour when indicator is in the green zone | Space |
| Work — Catch & Sort | Move cart left / right | A / ← &nbsp;&nbsp; D / → |
| All — Accidents | Answer spill warning | E |
| All — Accidents | Check pet-cam alert | P |
| All — Accidents | Answer girlfriend's call | C |
| Evening | Spend time blocks | Click |
| Perk screen | Pick a perk | Click |

**Accident timing matters.** Each accident flashes a warning overlay with a countdown bar. Press the key before the bar runs out — missing it has a cost.

## Daily loop

1. **Morning** (10 s) — pick today's work tasks quickly; the timer auto-picks if you don't.
2. **Work** (90 s) — play the mini-game; watch for accident overlays.
3. **Evening** (20 s) — spend 3 time blocks on Exercise, Pet Care, Entertainment, or Quality Time.
4. **Sleep** (5 s) — day summary with feedback strings. After day 1 and day 3 you pick a perk.

Your pet, partner, and stress level are shown as *visual cues only* — no numbers are ever exposed to the client.

## Local dev

```bash
# 1. Install
npm install

# 2. Set up the signing secret for local dev
cp server/.dev.vars.example server/.dev.vars
# Edit server/.dev.vars if you want a different value

# 3. Start the Worker (port 8787)
npm run dev -w server

# 4. Start the Vite client (port 5173) — in a separate terminal
npm run dev -w client

# 5. Open http://localhost:5173
```

The client proxies `/api/*` to `localhost:8787`. The leaderboard returns `[]` until D1 is configured; everything else works without it.

## Deploy to Cloudflare

Run all commands from the **`/server` directory** unless noted.

```bash
# 1. Log in
npx wrangler login

# 2. Create the D1 database and paste the returned id into wrangler.toml
npx wrangler d1 create paws-db

# 3. Run the schema migration
npx wrangler d1 execute paws-db --remote --file=migrations/0001_init.sql

# 4. Add the signing secret (use a long random value)
npx wrangler secret put SIGNING_SECRET
# Generate one with: openssl rand -base64 32

# 5. Build the client and deploy everything (from the repo root)
cd ..
npm run deploy
```

After deploy, open the printed `*.workers.dev` URL, play one full run, and confirm your score appears on the leaderboard — that verifies D1 is connected.

## Demo mode (class exchange)

In `server/wrangler.toml`, set `DEMO_MODE = "true"` and redeploy (`npm run deploy` from the repo root). Demo mode uses shorter timers — 2 days, 22 s work phases — so a full run takes about 2 minutes instead of 10.

## Tests

```bash
npm test               # Vitest unit tests (server rules, scoring, validation)
npx playwright test    # E2E smoke tests (requires both dev servers running)
```
