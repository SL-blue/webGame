import { TIMING, TIMING_DEMO } from "shared";
import type { SegmentSpecResponse, SegmentResultPayload, AccidentSpec } from "shared";
import { mulberry32 } from "./rules/rng";
import { assignTraits } from "./rules/traits";
import { buildCues, type HiddenState } from "./rules/cues";
import { generateSegmentSpec, payForTask, taskOffers } from "./rules/segments";
import { validateSegmentResults, scoreSegment } from "./validate";
import { applySleep } from "./rules/sleep";
import { addPerk, offerPerks, has } from "./rules/perks";
import { computeAreaScores, computeFinalScore, gradeArea, generateReasons } from "./rules/scoring";

type PendingAccident = { spec: AccidentSpec; responded: boolean };

const PERK_DAYS = new Set([1, 3]);

function t(state: RunState) {
  return state.demo ? TIMING_DEMO : TIMING;
}

export type RunState = {
  runId: string;
  seed: number;
  demo: boolean;
  rngCounter: number;
  phase: string;
  day: number;
  segmentIndex: number;
  phaseStartedAt: number;
  money: number;
  daySorted: number;
  dayMissed: number;
  dayEarned: number;
  currentSegmentSpec: SegmentSpecResponse | null;
  currentPayPerBox: number;
  pendingAccidents: PendingAccident[];
  hidden: HiddenState;
  perks: string[];
  log: string[];
};

export class RunObject implements DurableObject {
  private state: RunState | null = null;

  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body: unknown = await request.json().catch(() => ({}));

    switch (url.pathname) {
      case "/init":     return this.init(body as { runId: string });
      case "/schedule": return this.schedule(body as { taskId: string });
      case "/segment":  return this.submitSegment(body as SegmentResultPayload);
      case "/accident": return this.accident(body as { accidentId: string; response: string; t: number });
      case "/evening":  return this.evening(body as { activities: string[] });
      case "/sleep":    return this.sleep();
      case "/perk":     return this.perk(body as { perkId: string });
      case "/end":      return this.end();
      default:          return new Response("Not Found", { status: 404 });
    }
  }

  // ─── init ───────────────────────────────────────────────────────────────────

  private init(body: { runId: string; demo?: boolean }): Response {
    const seed = Math.floor(Math.random() * 2 ** 32);
    const rng  = mulberry32(seed);
    const traits = assignTraits(rng);

    this.state = {
      runId: body.runId,
      seed,
      demo: body.demo ?? false,
      rngCounter: 0,
      phase: "morning",
      day: 1,
      segmentIndex: 0,
      phaseStartedAt: Date.now(),
      money: 0,
      daySorted: 0,
      dayMissed: 0,
      dayEarned: 0,
      currentSegmentSpec: null,
      currentPayPerBox: 10,
      pendingAccidents: [],
      hidden: {
        stress: 10,
        fatigue: 10,
        sleepDebt: 0,
        health: 100,
        pet: { traits, hunger: 50, mood: 60, health: 100 },
        relationship: 50,
        pendingPlans: [],
      },
      perks: [],
      log: [],
    };

    return Response.json({
      runId: body.runId,
      day: 1,
      cues: buildCues(this.state.hidden),
      taskOffers: taskOffers(),
    });
  }

  // ─── schedule ───────────────────────────────────────────────────────────────

  private schedule(body: { taskId: string }): Response {
    if (!this.state) return this.err("Run not initialized");
    if (this.state.phase !== "morning") return this.err("Wrong phase");

    const basePay = payForTask(body.taskId);
    const payBonus = has(this.state.perks, "workaholic") ? 5 : 0;
    const payPerBox = basePay + payBonus;

    const spec = generateSegmentSpec(
      this.state.seed, this.state.day, this.state.segmentIndex, body.taskId, t(this.state).workSec,
    );

    this.state.phase = "work";
    this.state.phaseStartedAt = Date.now();
    this.state.currentSegmentSpec = spec;
    this.state.currentPayPerBox = payPerBox;
    this.state.daySorted = 0;
    this.state.dayMissed = 0;
    this.state.dayEarned = 0;
    this.state.pendingAccidents = spec.accidents.map((a) => ({ spec: a, responded: false }));

    if (body.taskId === "hard") {
      const extra = has(this.state.perks, "workaholic") ? 5 : 0;
      this.state.hidden.stress = Math.min(100, this.state.hidden.stress + 10 + extra);
    }

    return Response.json({ segment: spec });
  }

  // ─── segment ────────────────────────────────────────────────────────────────

  private submitSegment(payload: SegmentResultPayload): Response {
    if (!this.state) return this.err("Run not initialized");
    if (this.state.phase !== "work") return this.err("Wrong phase");
    if (!this.state.currentSegmentSpec) return this.err("No active segment");

    const spec = this.state.currentSegmentSpec;
    const serverElapsedMs = Date.now() - this.state.phaseStartedAt;
    const validation = validateSegmentResults(spec, payload, serverElapsedMs);

    if (!validation.ok) {
      this.state.log.push(`validation-fail: ${validation.reason}`);
      return Response.json({
        cues: buildCues(this.state.hidden), money: this.state.money,
        nextSegment: null, sorted: 0, missed: spec.items.length,
      });
    }

    const { sorted, missed, pay } = scoreSegment(spec, payload, this.state.currentPayPerBox);
    this.state.money += pay;
    this.state.daySorted += sorted;
    this.state.dayMissed += missed;
    this.state.dayEarned += pay;

    // Apply costs for any unresponded accidents
    for (const pa of this.state.pendingAccidents) {
      if (!pa.responded) this.applyAccidentCost(pa.spec.type);
    }

    // Work effects on hidden state
    const workStress = has(this.state.perks, "workaholic") ? 20 : 15;
    this.state.hidden.stress  = Math.min(100, this.state.hidden.stress + workStress);
    this.state.hidden.fatigue = Math.min(100, this.state.hidden.fatigue + 20);
    this.state.hidden.pet.hunger = Math.max(0, this.state.hidden.pet.hunger - 15);
    this.state.hidden.pet.mood   = Math.max(
      0, this.state.hidden.pet.mood - (this.state.hidden.pet.traits.includes("clingy") ? 20 : 10),
    );

    this.state.phase = "evening";
    this.state.phaseStartedAt = Date.now();
    this.state.currentSegmentSpec = null;

    return Response.json({
      cues: buildCues(this.state.hidden), money: this.state.money,
      nextSegment: null, sorted, missed,
    });
  }

  // ─── accident ───────────────────────────────────────────────────────────────

  private accident(body: { accidentId: string; response: string; t: number }): Response {
    if (!this.state) return this.err("Run not initialized");
    if (this.state.phase !== "work") return this.err("Wrong phase for accident");

    const pa = this.state.pendingAccidents.find((a) => a.spec.id === body.accidentId);
    if (!pa) return this.err("Unknown accident id");
    if (pa.responded) return this.err("Accident already responded");
    pa.responded = true;

    if (body.response === "ignored" || body.t > pa.spec.windowMs + 500) {
      this.applyAccidentCost(pa.spec.type);
    }
    return Response.json({ cues: buildCues(this.state.hidden), money: this.state.money });
  }

  private applyAccidentCost(type: AccidentSpec["type"]): void {
    if (!this.state) return;
    const frugal = has(this.state.perks, "frugal");
    switch (type) {
      case "spill":
        this.state.money = Math.max(0, this.state.money - (frugal ? 12 : 20));
        this.state.hidden.stress = Math.min(100, this.state.hidden.stress + 10);
        break;
      case "pet-cam":
        this.state.money = Math.max(0, this.state.money - (frugal ? 18 : 30));
        this.state.hidden.pet.mood = Math.max(0, this.state.hidden.pet.mood - 15);
        break;
      case "phone-call":
        this.state.hidden.relationship = Math.max(0, this.state.hidden.relationship - 15);
        break;
    }
  }

  // ─── evening ────────────────────────────────────────────────────────────────

  private evening(body: { activities: string[] }): Response {
    if (!this.state) return this.err("Run not initialized");
    if (this.state.phase !== "evening") return this.err("Wrong phase");

    const gymMult    = has(this.state.perks, "gym-rat")      ? 1.5 : 1;
    const smoothMult = has(this.state.perks, "smooth-talker")? 1.5 : 1;
    const entMult    = has(this.state.perks, "smooth-talker")? 0.7 : 1;
    const pwhisper   = has(this.state.perks, "pet-whisperer");
    const bigSpend   = has(this.state.perks, "big-spender");

    for (const act of body.activities) {
      switch (act) {
        case "exercise":
          this.state.hidden.stress  = Math.max(0, this.state.hidden.stress  - 10 * gymMult);
          this.state.hidden.fatigue = Math.min(100, this.state.hidden.fatigue + 5 * gymMult);
          break;
        case "pet-care":
          this.state.hidden.pet.mood   = Math.min(100, this.state.hidden.pet.mood   + (pwhisper ? 30 : 20));
          this.state.hidden.pet.hunger = Math.min(100, this.state.hidden.pet.hunger + 15);
          break;
        case "entertainment":
          this.state.hidden.stress = Math.max(0, this.state.hidden.stress - 15 * entMult);
          break;
        case "relationship":
          this.state.hidden.relationship = Math.min(
            100, this.state.hidden.relationship + (bigSpend ? 15 : 10) * smoothMult,
          );
          break;
      }
    }

    this.state.phase = "sleep";
    this.state.phaseStartedAt = Date.now();
    return Response.json({ cues: buildCues(this.state.hidden), money: this.state.money });
  }

  // ─── sleep ──────────────────────────────────────────────────────────────────

  private sleep(): Response {
    if (!this.state) return this.err("Run not initialized");
    if (this.state.phase !== "sleep") return this.err("Wrong phase");

    const completedDay = this.state.day;
    const { hidden: newHidden, feedback } = applySleep(this.state.hidden, this.state.perks);
    this.state.hidden = newHidden;

    const summary = {
      day: completedDay,
      earned: this.state.dayEarned,
      sorted: this.state.daySorted,
      missed: this.state.dayMissed,
      feedback,
    };

    this.state.day++;
    const nextDay = this.state.day <= t(this.state).daysPerRun ? this.state.day : null;

    if (nextDay !== null) {
      this.state.phase = "morning";
      this.state.segmentIndex = 0;
      this.state.phaseStartedAt = Date.now();
    } else {
      this.state.phase = "ended";
    }

    // Offer perks after milestone days (if next day exists)
    let perkOffer: ReturnType<typeof offerPerks> | undefined;
    if (nextDay !== null && PERK_DAYS.has(completedDay)) {
      const rng = mulberry32(this.state.seed ^ (completedDay * 999));
      perkOffer = offerPerks(rng, this.state.perks);
      this.state.phase = "perk"; // block morning until perk is chosen
    }

    return Response.json({
      summary,
      cues: buildCues(this.state.hidden),
      nextDay,
      ...(perkOffer ? { perkOffer } : {}),
    });
  }

  // ─── perk ───────────────────────────────────────────────────────────────────

  private perk(body: { perkId: string }): Response {
    if (!this.state) return this.err("Run not initialized");
    if (this.state.phase !== "perk") return this.err("No perk offer active");

    const added = addPerk(this.state.perks, body.perkId);
    if (!added) return this.err("Invalid or duplicate perk");

    this.state.phase = "morning";
    return Response.json({ ok: true });
  }

  // ─── end ────────────────────────────────────────────────────────────────────

  private end(): Response {
    if (!this.state) return this.err("Run not initialized");
    if (this.state.phase !== "ended") return this.err("Run not finished yet");

    const areas  = computeAreaScores({ money: this.state.money, hidden: this.state.hidden });
    const score  = computeFinalScore(areas);
    const grades = {
      finances:     gradeArea(areas.finances),
      pet:          gradeArea(areas.pet),
      self:         gradeArea(areas.self),
      relationship: gradeArea(areas.relationship),
    };
    const reasons = generateReasons(areas, this.state.hidden);

    return Response.json({ score, grades, reasons });
  }

  private err(msg: string): Response {
    return Response.json({ error: msg }, { status: 400 });
  }
}
