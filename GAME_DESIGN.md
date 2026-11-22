# Game Design — Working title: "Paws & Paychecks"

> Status: first draft. Everything marked **(tunable)** is expected to change after play-testing.

## 1. Concept

The player has just adopted a pet. Over a short run of in-game days they must earn money, take care of the pet, keep their own stress under control, and maintain the relationship with their girlfriend. Each run has a different pet with hidden traits and different random events, so the player has to **observe, infer and adapt** rather than follow a fixed recipe.

Built with Three.js in the browser, with a small backend that owns hidden state and scoring.

## 2. Design goals

The assignment: humans should understand and enjoy the game, while an AI agent should struggle to win or get a high score.

| Goal | How the design achieves it |
|---|---|
| Easy to understand | One room, a daily routine everyone knows (work, rest, pet, partner), on-screen instructions under 30 s to read |
| Fun for humans | Juggling competing needs, readable body-language cues, perks that make each run feel different, getting visibly better across runs |
| Hard for screenshot agents (e.g. browser-use) | Time keeps running in every phase; real-time work mini-games; state shown as visual cues in 3D, not numbers; short reaction windows (warned, but tight) |
| Hard for code agents (e.g. Claude Code) | Hidden state, randomness, perk effects and scoring live on the server; client only receives cue descriptions; work results are checked for plausibility; no state exposed on `window` |
| Skill beats luck | Random events are things to react to, with warnings; their odds depend on how well the player has been managing; perks let players build toward handling them |
| Learnable over runs | Hidden pet traits have consistent tells; a detailed score breakdown at the end teaches what went wrong |

## 3. Run structure

- A run = **4 in-game days** **(tunable, 3–5)**. Target length: under ~10 minutes.
- Each day follows the same loop:

| Phase | What the player does | Real time **(tunable)** |
|---|---|---|
| Morning: schedule | Pick work tasks for the day | ~10 s |
| Work | Play short 3D work tasks (8 in-game hours) | 60–120 s |
| Accidents | React to interruptions (can happen in any phase) | — |
| Evening | Spend a limited number of time blocks | ~20 s |
| Sleep | Day summary; sleep debt is applied | ~5 s |

- Perk choices appear at milestones (e.g. after day 1 and day 3, or on reaching a savings goal).
- The run ends with the final score and a breakdown.

**Time never stops**, including during choices. If a timed choice runs out, a default is applied (e.g. the first or a random option).

## 4. Player-visible information

Shown directly:
- Money (exact)
- Day and in-game clock

Shown only as **vague levels or visual cues**, never exact numbers:
- **Character stress** — posture, breathing animation, screen edge blur/vignette, slight camera sway at high levels; optional coarse label (Calm / Tense / Overwhelmed)
- **Fatigue / sleep debt** — yawning, desaturated colors, heavier controls
- **Pet state** (hunger, mood, health) — ears, tail, pacing, hiding, lying down, sounds
- **Relationship** — reply speed and tone of her texts, emoji use, whether she initiates contact

Hidden entirely (server only):
- Exact values of all stats
- Pet traits
- Event probabilities and schedules
- Perk effect sizes
- The scoring formula

## 5. The pet

Each run generates a pet with randomized **hidden traits**, 2–3 per pet **(tunable)**, for example:

| Trait | Effect | Tell (must be consistent) |
|---|---|---|
| Energetic | Needs play; causes trouble if bored | Bounces, runs laps when idle |
| Anxious | Stressed by being alone or loud noises | Hides when the doorbell or phone rings |
| Picky eater | Cheap food lowers mood | Sniffs and walks away from the bowl |
| Fragile | Gets sick more easily | Sneezes, moves slowly in the morning |
| Clingy | Mood drops on long work days | Waits at the door, follows the player |
| Easygoing | Few demands | Naps a lot, calm idle animation |

Traits must always show their tells so observant players can learn them.

## 6. Daily loop in detail

### 6.1 Morning: schedule selection
- 3–4 task cards are offered; the player picks 2–3 for the day.
- Descriptions are vague: "pays well, stressful", "easy, low pay", "long hours".
- The home scene stays visible: the pet's behavior that morning is a clue (e.g. restless pet → a long shift is risky).
- Timed (~10 s). The best choice depends on the current hidden state.

### 6.2 Work
- The day is split into **segments**, one per chosen task.
- Each task type is a short 3D mini-game. Plan 2–3 types for the first version, for example:
  - **Package sorting** — route boxes to the correct chute by color/shape
  - **Coffee timing** — stop the pour inside a moving target zone
  - **Catch deliveries** — move to catch falling items, avoid fragile ones
- Performance sets pay.
- **Stress affects controls:** small input delay, camera sway, narrower view. **Fatigue** builds within a shift (controls get heavier towards "5 pm").
- 2–3 **interruptions** per shift: girlfriend texts, pet-cam alerts, small accidents.

### 6.3 Accidents (first draft)
- Always telegraphed 1–2 s ahead (sound + visual cue), then require a quick response.
- Ignored or failed accidents have a cost.
- Odds depend on hidden state (neglected pet → more home accidents; tired → more work mistakes).

| Accident | Where | Warning | Response | Cost if missed |
|---|---|---|---|---|
| Spill / dropped box | Work | Wobble + sound | Quick catch or click | Pay penalty, stress up |
| Pet chewing furniture | Home (pet cam) | Pet-cam alert | Open cam and "call" the pet | Money for repairs, pet mood |
| Girlfriend calls | Anytime | Phone buzz, 3 s window | Answer | Relationship drops |
| Pet seems unwell | Morning/evening | Slow movement, sneezes | Vet visit (money, time) | Health drops, may get worse |
| Forgotten plan | Evening | She mentioned it in a text days ago | Choose the right evening activity | Big relationship drop |
| Boss asks for overtime | End of work | Pop-up, timed | Accept / decline | Trade-off either way |

### 6.4 Evening
- A fixed budget of **3 time blocks** **(tunable)**, spent on:
  - **Exercise** — lowers stress over time, slight fatigue now
  - **Entertainment** — lowers stress now
  - **Relationship** — an *active* interaction: read her mood from cues and pick the right response, or pick a date place based on something she texted earlier
  - **Pet care** — play, walk, grooming (value depends on traits)
  - **Overtime** — more money, more stress, less sleep; the overtime task is a harder version of a work mini-game, so pay falls when tired (diminishing returns)

### 6.5 Sleep and illness
- Sleep hours = what's left after the evening.
- Hidden **sleep debt** builds over short nights.
- Illness chance rises after several short nights. Warning signs appear beforehand (yawning, faded colors, heavy controls).
- Illness: lose a day's income or play with worse controls for a day. Recovery is always possible — no death spirals.
- The day summary shows coarse feedback (e.g. "You slept badly", "Your pet seemed lonely").

## 7. Perks

- At each milestone, offer **3 perks**; the player picks 1. Timed (~8–10 s), with icons and short phrases.
- Each perk has an **upside and a downside**, worded vaguely.
- A perk's value depends on hidden state (especially pet traits). Some downsides show up only later.
- Stacking is capped so no combination breaks the game.

First set (8–12 planned):

| Perk | Upside | Downside |
|---|---|---|
| Deep Sleeper | Rest recovers more | Slower to wake: shorter morning choice timer |
| Workaholic | Work pays more | Stress rises faster |
| Pet Whisperer | Pet mood recovers faster | Work tasks slightly harder |
| Smooth Talker | Relationship interactions more forgiving | Entertainment relieves less stress |
| Gym Rat | Exercise works better | Exercise costs more fatigue |
| Frugal | Things cost less | Pet dislikes cheap food more |
| Night Owl | Overtime pays better | Sleep debt builds faster |
| Calm Mind | Stress affects controls less | Warnings for accidents are shorter |
| Remote Work | One work segment can check the pet cam freely | Lower pay for that segment |
| Big Spender | Dates count for more | Dates cost more |

## 8. Scoring

- Computed **on the server only** at the end of the run.
- Combines four areas: **finances, pet wellbeing, character wellbeing (stress/health), relationship**.
- Combined **multiplicatively** (or with a strong penalty for the weakest area) so neglecting one area drags down the whole score.
- The formula is not shown. The direction is obvious (happy pet, calm character, good relationship, money in the bank = good).
- End screen shows a **breakdown**: a grade per area plus 2–4 concrete reasons ("You missed 3 calls", "Your pet was bored most afternoons", "4 short nights in a row").

### Balance checks (must all be *bad* strategies)
- Always work overtime → illness and relationship suffer
- Never work hard → not enough money for pet care
- Ignore the girlfriend or the pet → multiplicative score collapses
- Always pick the same perk type → capped stacking limits it

## 9. Player instructions (draft for the start screen)

> **You just adopted a pet!** Over the next few days, keep your life in balance: earn money, look after your pet, keep your stress down, and don't neglect your girlfriend.
>
> - **Morning:** pick your work tasks — quickly, the clock is running.
> - **Work:** play each task. Watch for interruptions.
> - **Evening:** choose how to spend your free time. Overtime pays, but you'll sleep less.
> - Your pet, your partner and you yourself show how you're doing — **watch for the signs**.
> - Every pet is different. Learn yours.
>
> Your score is revealed at the end. Try again — you'll get better.

Controls are documented per mini-game (keyboard + mouse; final bindings decided during implementation).

## 10. Out of scope (v1)

- Multiplayer, accounts or login
- More than one room / location
- Detailed character models (low-poly shapes are fine; the girlfriend appears mainly through the phone)
- Saving a run mid-way
- Mobile controls

## 11. Open questions

- Exact number of days per run and work segment length
- Final list of task types and accidents
- Whether the girlfriend appears in the scene in the evening or only on the phone
- Leaderboard: public, or class-only
