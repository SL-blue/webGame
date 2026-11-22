import { timing } from "../config";

export type DaySummary = {
  day: number;
  earned: number;
  sorted: number;
  missed: number;
  feedback: string[];
};

export class SleepPhase {
  private elapsed = 0;
  private done = false;
  private onComplete: (() => void) | null = null;

  show(summary: DaySummary, onComplete: () => void): void {
    this.elapsed = 0;
    this.done = false;
    this.onComplete = onComplete;

    const title = document.getElementById("sleep-title");
    if (title) title.textContent = `Day ${summary.day} Complete`;

    const body = document.getElementById("sleep-summary");
    if (body) {
      const lines = [
        `Earned: <strong>$${summary.earned}</strong>`,
        `Boxes: <strong>${summary.sorted}</strong> sorted / ${summary.missed} missed`,
        ...summary.feedback.map((f) => `<em>${f}</em>`),
      ];
      body.innerHTML = lines.join("<br>");
    }

    document.getElementById("sleep-screen")!.style.display = "flex";
  }

  hide(): void {
    document.getElementById("sleep-screen")!.style.display = "none";
  }

  update(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;
    const bar = document.getElementById("sleep-timer-bar");
    if (bar) bar.style.width = `${(1 - this.elapsed / timing().sleepSec) * 100}%`;
    if (this.elapsed >= timing().sleepSec) {
      this.done = true;
      this.hide();
      this.onComplete?.();
    }
  }
}
