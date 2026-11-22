import { timing, setDemoMode } from "./config";
import type { TaskOffer, CueBundle, AccidentSpec, PerkDef } from "shared";
import { MorningPhase } from "./phases/morning";
import { EveningPhase } from "./phases/evening";
import { SleepPhase } from "./phases/sleep";
import { PerkPhase } from "./phases/perk";
import { PackageSortGame } from "./minigames/package-sort/index";
import { CoffeeTimingGame } from "./minigames/coffee-timing/index";
import { CatchDeliveryGame } from "./minigames/catch-delivery/index";
import type { Minigame } from "./minigames/types";
import { applyCues } from "./cues/index";
import * as api from "./api";
import type { RoomScene } from "./scenes/room";

type Phase = "idle" | "morning" | "work" | "evening" | "sleep" | "perk" | "ended";

const ACCIDENT_ICONS: Record<string, string> = {
  spill: "⚠️", "pet-cam": "📱", "phone-call": "📞",
};
const ACCIDENT_MSGS: Record<string, string> = {
  spill: "Boxes falling!", "pet-cam": "Pet-cam alert!", "phone-call": "Girlfriend calling!",
};

export class StateMachine {
  private phase: Phase = "idle";
  private pending = false;
  private day = 1;
  private money = 0;
  private workElapsed = 0;
  private taskOffers: TaskOffer[] = [];
  private lastSorted = 0;
  private lastMissed = 0;
  private lastEarned = 0;
  private lastFeedback: string[] = [];

  private morning = new MorningPhase();
  private evening = new EveningPhase();
  private sleep   = new SleepPhase();
  private perkPhase = new PerkPhase();
  private minigame: Minigame | null = null;

  private segmentAccidents: AccidentSpec[] = [];
  private seenAccidentIds = new Set<string>();
  private activeAccident: AccidentSpec | null = null;
  private accidentElapsed = 0;
  private accidentKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private scene: RoomScene) {}

  start(): void {
    this.phase = "idle";
    this.pending = false;
    this.day = 1;
    this.money = 0;
    this.startAsync().catch((e) => this.showError(String(e)));
  }

  update(dt: number): void {
    if (this.pending) return;
    switch (this.phase) {
      case "morning": this.morning.update(dt); break;
      case "work":    this.updateWork(dt);     break;
      case "evening": this.evening.update(dt); break;
      case "sleep":   this.sleep.update(dt);   break;
      case "perk":    this.perkPhase.update(dt); break;
    }
  }

  // ─── startup ────────────────────────────────────────────────────────────────

  private async startAsync(): Promise<void> {
    this.pending = true;
    const res = await api.startRun();
    api.setSession(res.runId, res.token);
    setDemoMode(res.demo);
    this.taskOffers = res.taskOffers;
    this.day = res.day;
    this.money = 0;
    this.applyCues(res.cues);
    this.pending = false;
    this.enterMorning();
  }

  // ─── phases ─────────────────────────────────────────────────────────────────

  private enterMorning(): void {
    this.phase = "morning";
    this.scene.exitWorkMode();
    this.updateHudLabel(`Day ${this.day} — Morning`);
    this.morning.show(this.day, this.taskOffers, (taskId) => {
      this.scheduleTask(taskId).catch((e) => this.showError(String(e)));
    });
  }

  private async scheduleTask(taskId: string): Promise<void> {
    this.pending = true;
    const res = await api.scheduleTask(taskId);
    this.pending = false;

    this.minigame?.dispose();
    this.minigame = this.createMinigame(res.segment.taskType);
    this.segmentAccidents = res.segment.accidents ?? [];
    this.seenAccidentIds.clear();
    this.workElapsed = 0;
    this.phase = "work";
    this.scene.enterWorkMode();
    this.updateHudLabel(`Day ${this.day} — Work`);
    this.minigame.start(res.segment);
    this.registerAccidentKey();
  }

  private updateWork(dt: number): void {
    this.workElapsed += dt;
    this.minigame!.update(dt);
    this.updateTimerBar(1 - this.workElapsed / timing().workSec);
    this.updateMoneyLabel();
    this.checkAccidents();
    this.updateActiveAccident(dt);
    if (this.workElapsed >= timing().workSec) {
      this.endWork().catch((e) => this.showError(String(e)));
    }
  }

  private async endWork(): Promise<void> {
    if (this.phase !== "work") return;
    this.phase = "idle";
    this.dismissActiveAccident("ignored");
    this.unregisterAccidentKey();

    const result = this.minigame!.getResults();
    this.minigame!.dispose();
    this.minigame = null;

    this.pending = true;
    const res = await api.submitSegment(result);
    this.pending = false;

    this.lastEarned = res.money - this.money;
    this.money = res.money;
    this.lastSorted = res.sorted;
    this.lastMissed = res.missed;
    this.applyCues(res.cues);
    this.updateMoneyLabel();
    this.enterEvening();
  }

  private enterEvening(): void {
    this.phase = "evening";
    this.scene.exitWorkMode();
    this.updateHudLabel(`Day ${this.day} — Evening`);
    this.evening.show(this.day, (activities) => {
      this.submitEvening(activities).catch((e) => this.showError(String(e)));
    });
  }

  private async submitEvening(activities: string[]): Promise<void> {
    this.pending = true;
    const res = await api.submitEvening(activities);
    this.pending = false;
    this.money = res.money;
    this.applyCues(res.cues);
    this.updateMoneyLabel();
    this.enterSleep();
  }

  private enterSleep(): void {
    this.phase = "sleep";
    this.updateHudLabel(`Day ${this.day} — Sleep`);
    this.sleep.show(
      {
        day: this.day,
        earned: this.lastEarned,
        sorted: this.lastSorted,
        missed: this.lastMissed,
        feedback: this.lastFeedback,
      },
      () => this.submitSleep().catch((e) => this.showError(String(e))),
    );
  }

  private async submitSleep(): Promise<void> {
    this.pending = true;
    const res = await api.submitSleep();
    this.pending = false;

    this.lastFeedback = res.summary.feedback;
    this.applyCues(res.cues);
    this.updateRelationshipIndicator(res.cues);

    if (res.nextDay === null) {
      this.endRun();
      return;
    }

    this.day = res.nextDay;
    this.lastSorted = this.lastMissed = this.lastEarned = 0;

    if (res.perkOffer && res.perkOffer.length > 0) {
      this.enterPerkPhase(res.perkOffer);
    } else {
      this.enterMorning();
    }
  }

  private enterPerkPhase(perks: PerkDef[]): void {
    this.phase = "perk";
    this.updateHudLabel("Choose a Perk");
    this.perkPhase.show(perks, (perkId) => {
      this.submitPerk(perkId).catch((e) => this.showError(String(e)));
    });
  }

  private async submitPerk(perkId: string): Promise<void> {
    this.pending = true;
    await api.choosePerk(perkId);
    this.pending = false;
    this.enterMorning();
  }

  private endRun(): void {
    this.phase = "ended";
    this.endRunAsync().catch((e) => this.showError(String(e)));
  }

  private async endRunAsync(): Promise<void> {
    this.pending = true;
    const res = await api.endRun();
    this.pending = false;

    document.getElementById("hud")!.style.display = "none";

    // Score
    const scoreEl = document.getElementById("end-score");
    if (scoreEl) scoreEl.textContent = res.score.toLocaleString();

    // Grade tiles
    const gradesEl = document.getElementById("end-grades");
    if (gradesEl) {
      const areas = [
        { label: "Finances",     grade: res.grades.finances     },
        { label: "Pet",          grade: res.grades.pet          },
        { label: "Self",         grade: res.grades.self         },
        { label: "Relationship", grade: res.grades.relationship },
      ];
      gradesEl.innerHTML = areas
        .map((a) => `<div class="grade-tile grade-${a.grade.toLowerCase()}">${a.label}<span>${a.grade}</span></div>`)
        .join("");
    }

    // Reasons
    const reasonsEl = document.getElementById("end-reasons");
    if (reasonsEl) {
      reasonsEl.innerHTML = res.reasons.map((r) => `<p>${r}</p>`).join("");
    }

    document.getElementById("end-screen")!.style.display = "flex";
  }

  // ─── accident system ─────────────────────────────────────────────────────────

  private registerAccidentKey(): void {
    this.accidentKeyHandler = (e) => {
      if (!this.activeAccident) return;
      if (e.key === this.activeAccident.responseKey) this.answerAccident();
    };
    window.addEventListener("keydown", this.accidentKeyHandler);
  }

  private unregisterAccidentKey(): void {
    if (this.accidentKeyHandler) {
      window.removeEventListener("keydown", this.accidentKeyHandler);
      this.accidentKeyHandler = null;
    }
  }

  private checkAccidents(): void {
    for (const acc of this.segmentAccidents) {
      if (!this.seenAccidentIds.has(acc.id) && this.workElapsed >= acc.warningAt) {
        this.seenAccidentIds.add(acc.id);
        this.showAccidentOverlay(acc);
      }
    }
  }

  private showAccidentOverlay(acc: AccidentSpec): void {
    this.activeAccident = acc;
    this.accidentElapsed = 0;
    document.getElementById("accident-icon")!.textContent    = ACCIDENT_ICONS[acc.type] ?? "⚠️";
    document.getElementById("accident-message")!.textContent = ACCIDENT_MSGS[acc.type] ?? "Emergency!";
    document.getElementById("accident-key-hint")!.textContent = `Press  ${acc.responseKey.toUpperCase()}  to respond`;
    document.getElementById("accident-overlay")!.style.display = "block";
  }

  private updateActiveAccident(dt: number): void {
    if (!this.activeAccident) return;
    this.accidentElapsed += dt;
    const frac = 1 - (this.accidentElapsed * 1000) / this.activeAccident.windowMs;
    const bar = document.getElementById("accident-timer-bar");
    if (bar) bar.style.width = `${Math.max(0, frac) * 100}%`;
    if (this.accidentElapsed * 1000 >= this.activeAccident.windowMs) {
      this.dismissActiveAccident("ignored");
    }
  }

  private answerAccident(): void {
    if (!this.activeAccident) return;
    const acc = this.activeAccident;
    const t = this.accidentElapsed * 1000;
    this.activeAccident = null;
    this.hideAccidentOverlay();
    api.reportAccident(acc.id, "answered", t)
      .then((res) => { this.applyCues(res.cues); this.money = res.money; this.updateMoneyLabel(); })
      .catch((e) => this.showError(String(e)));
  }

  private dismissActiveAccident(response: "answered" | "ignored"): void {
    if (!this.activeAccident) return;
    const acc = this.activeAccident;
    const t = this.accidentElapsed * 1000;
    this.activeAccident = null;
    this.hideAccidentOverlay();
    if (response === "ignored") {
      api.reportAccident(acc.id, "ignored", t).catch(() => { /* best effort */ });
    }
  }

  private hideAccidentOverlay(): void {
    const el = document.getElementById("accident-overlay");
    if (el) el.style.display = "none";
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private createMinigame(taskType: string): Minigame {
    switch (taskType) {
      case "coffee-timing":  return new CoffeeTimingGame(this.scene.threeScene, this.scene.camera);
      case "catch-delivery": return new CatchDeliveryGame(this.scene.threeScene, this.scene.camera);
      default:               return new PackageSortGame(this.scene.threeScene, this.scene.camera);
    }
  }

  private applyCues(cues: CueBundle): void {
    applyCues(cues, this.scene);
    this.scene.setSwayAmount(cues.self?.stressLevel === "overwhelmed" ? 0.12 : 0);
  }

  private updateRelationshipIndicator(cues: CueBundle): void {
    const el = document.getElementById("phone-indicator");
    if (!el) return;
    const tone = cues.phone?.tone ?? "none";
    el.textContent = tone === "warm" ? "💚" : tone === "short" ? "💛" : tone === "none" ? "🩶" : "🤍";
    el.title = `Relationship: ${tone}`;
  }

  private updateHudLabel(text: string): void {
    const el = document.getElementById("phase-label");
    if (el) el.textContent = text;
  }

  private updateMoneyLabel(): void {
    const el = document.getElementById("money-label");
    if (el) el.textContent = `$${this.money}`;
  }

  private updateTimerBar(fraction: number): void {
    const bar = document.getElementById("timer-bar");
    if (bar) bar.style.width = `${Math.max(0, fraction) * 100}%`;
  }

  private showError(msg: string): void {
    console.error("[StateMachine]", msg);
    const el = document.getElementById("phase-label");
    if (el) el.textContent = `Error: ${msg}`;
  }
}
