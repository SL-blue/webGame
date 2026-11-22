import { timing } from "../config";

const MAX_BLOCKS = 3;

type Activity = {
  id: string;
  label: string;
  emoji: string;
};

const ACTIVITIES: Activity[] = [
  { id: "exercise",      label: "Exercise",      emoji: "🏃" },
  { id: "pet-care",      label: "Pet Care",       emoji: "🐾" },
  { id: "entertainment", label: "Entertainment",  emoji: "🎮" },
  { id: "relationship",  label: "Quality Time",   emoji: "💬" },
];

export class EveningPhase {
  private elapsed = 0;
  private blocks: string[] = [];
  private done = false;
  private onComplete: ((activities: string[]) => void) | null = null;

  show(day: number, onComplete: (activities: string[]) => void): void {
    this.elapsed = 0;
    this.blocks = [];
    this.done = false;
    this.onComplete = onComplete;

    this.render(day);
    document.getElementById("evening-screen")!.style.display = "flex";
  }

  hide(): void {
    document.getElementById("evening-screen")!.style.display = "none";
  }

  update(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;

    const bar = document.getElementById("evening-timer-bar");
    if (bar) {
      bar.style.width = `${(1 - this.elapsed / timing().eveningSec) * 100}%`;
    }

    if (this.elapsed >= timing().eveningSec) {
      this.finish();
    }
  }

  private render(day: number): void {
    const title = document.getElementById("evening-title");
    if (title) title.textContent = `Day ${day} — Evening`;

    const container = document.getElementById("activity-buttons")!;
    container.innerHTML = "";

    for (const act of ACTIVITIES) {
      const btn = document.createElement("button");
      btn.className = "activity-btn";
      btn.dataset.id = act.id;
      btn.innerHTML = `<span>${act.emoji}</span> ${act.label}`;
      btn.addEventListener("click", () => this.pickActivity(act.id, btn));
      container.appendChild(btn);
    }

    this.renderBlocks();
  }

  private pickActivity(id: string, btn: HTMLElement): void {
    if (this.done || this.blocks.length >= MAX_BLOCKS) return;
    this.blocks.push(id);
    btn.classList.add("used");
    this.renderBlocks();

    if (this.blocks.length >= MAX_BLOCKS) {
      setTimeout(() => this.finish(), 300);
    }
  }

  private renderBlocks(): void {
    const el = document.getElementById("time-blocks");
    if (!el) return;
    const filled = this.blocks.length;
    el.innerHTML = Array.from({ length: MAX_BLOCKS })
      .map((_, i) => `<span class="block ${i < filled ? "used" : ""}">●</span>`)
      .join("");
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.hide();
    this.onComplete?.(this.blocks);
  }
}
