import { timing } from "../config";
import type { TaskOffer } from "shared";

export class MorningPhase {
  private elapsed = 0;
  private selected: string | null = null;
  private done = false;
  private onComplete: ((taskId: string) => void) | null = null;
  private offers: TaskOffer[] = [];

  show(day: number, offers: TaskOffer[], onComplete: (taskId: string) => void): void {
    this.elapsed = 0;
    this.selected = null;
    this.done = false;
    this.onComplete = onComplete;
    this.offers = offers;

    this.render(day);
    document.getElementById("morning-screen")!.style.display = "flex";
  }

  hide(): void {
    document.getElementById("morning-screen")!.style.display = "none";
  }

  update(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;

    const bar = document.getElementById("morning-timer-bar");
    if (bar) bar.style.width = `${(1 - this.elapsed / timing().morningSec) * 100}%`;

    if (this.elapsed >= timing().morningSec) this.finish();
  }

  private render(day: number): void {
    const title = document.getElementById("morning-title");
    if (title) title.textContent = `Day ${day} — Pick Your Tasks`;

    const container = document.getElementById("task-cards")!;
    container.innerHTML = "";

    for (const offer of this.offers) {
      const card = document.createElement("button");
      card.className = "task-card";
      card.dataset.id = offer.id;
      card.innerHTML = `<strong>${offer.label}</strong><span>${offer.description}</span>`;
      card.addEventListener("click", () => this.selectTask(offer.id));
      container.appendChild(card);
    }
  }

  private selectTask(id: string): void {
    if (this.done) return;
    this.selected = id;
    document.querySelectorAll(".task-card").forEach((card) => {
      (card as HTMLElement).classList.toggle(
        "selected",
        (card as HTMLElement).dataset.id === id,
      );
    });
    setTimeout(() => this.finish(), 400);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    const id = this.selected ?? this.offers[0]?.id ?? "easy";
    this.hide();
    this.onComplete?.(id);
  }
}
