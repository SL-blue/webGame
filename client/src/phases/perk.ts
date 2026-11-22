import { timing } from "../config";
import type { PerkDef } from "shared";

export class PerkPhase {
  private elapsed = 0;
  private selected: string | null = null;
  private done = false;
  private onComplete: ((perkId: string) => void) | null = null;
  private perks: PerkDef[] = [];

  show(perks: PerkDef[], onComplete: (perkId: string) => void): void {
    this.elapsed = 0;
    this.selected = null;
    this.done = false;
    this.onComplete = onComplete;
    this.perks = perks;

    this.render();
    document.getElementById("perk-screen")!.style.display = "flex";
  }

  hide(): void {
    document.getElementById("perk-screen")!.style.display = "none";
  }

  update(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;

    const bar = document.getElementById("perk-timer-bar");
    if (bar) bar.style.width = `${(1 - this.elapsed / timing().perkChoiceSec) * 100}%`;

    if (this.elapsed >= timing().perkChoiceSec) this.finish();
  }

  private render(): void {
    const container = document.getElementById("perk-cards")!;
    container.innerHTML = "";

    for (const perk of this.perks) {
      const card = document.createElement("button");
      card.className = "perk-card";
      card.dataset.id = perk.id;
      card.innerHTML = `
        <span class="perk-icon">${perk.icon}</span>
        <strong>${perk.name}</strong>
        <span class="upside">↑ ${perk.upside}</span>
        <span class="downside">↓ ${perk.downside}</span>
      `;
      card.addEventListener("click", () => this.selectPerk(perk.id));
      container.appendChild(card);
    }
  }

  private selectPerk(id: string): void {
    if (this.done) return;
    this.selected = id;
    document.querySelectorAll(".perk-card").forEach((el) => {
      (el as HTMLElement).classList.toggle(
        "selected",
        (el as HTMLElement).dataset.id === id,
      );
    });
    setTimeout(() => this.finish(), 400);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    const id = this.selected ?? this.perks[0]?.id ?? "";
    this.hide();
    this.onComplete?.(id);
  }
}
