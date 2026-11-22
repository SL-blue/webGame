import * as THREE from "three";
import type { Minigame, MiniGameResult } from "../types";
import type { SegmentSpecResponse, ItemSpec, ItemResult } from "shared";

const ITEM_TIMEOUT_SEC = 4.5;
const FEEDBACK_SEC = 0.4;

export class CoffeeTimingGame implements Minigame {
  private spec!: SegmentSpecResponse;
  private objects: THREE.Object3D[] = [];

  private gauge!: THREE.Mesh;
  private zone!: THREE.Mesh;
  private indicator!: THREE.Mesh;
  private cup!: THREE.Mesh;

  private elapsed = 0;
  private itemIndex = 0;
  private currentItem: ItemSpec | null = null;
  private needlePos = 0;   // 0–1 along gauge
  private needleDir = 1;
  private itemElapsed = 0;
  private state: "idle" | "active" | "feedback" = "idle";
  private feedbackTimer = 0;
  private lastHit = false;

  private itemResults: ItemResult[] = [];
  private sorted = 0;
  private missed = 0;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {}

  start(spec: SegmentSpecResponse): void {
    this.spec = spec;
    this.elapsed = 0;
    this.itemIndex = 0;
    this.currentItem = null;
    this.needlePos = 0;
    this.needleDir = 1;
    this.itemElapsed = 0;
    this.state = "idle";
    this.itemResults = [];
    this.sorted = 0;
    this.missed = 0;

    this.buildScene();
    this.showHud();

    this.keyHandler = (e) => {
      if (e.key === " " || e.key === "Enter") this.pour();
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Spawn next item
    if (this.state === "idle") {
      const next = this.spec.items[this.itemIndex];
      if (next && this.elapsed >= next.spawnAt) {
        this.activateItem(next);
      }
    }

    if (this.state === "active" && this.currentItem) {
      this.itemElapsed += dt;
      const speed = (this.currentItem.needleSpeed ?? 1) * 0.35;
      this.needlePos += this.needleDir * speed * dt;
      if (this.needlePos >= 1) { this.needlePos = 1; this.needleDir = -1; }
      if (this.needlePos <= 0) { this.needlePos = 0; this.needleDir = 1; }

      // Auto-miss on timeout
      if (this.itemElapsed >= ITEM_TIMEOUT_SEC) this.recordMiss();

      this.updateIndicator();
    }

    if (this.state === "feedback") {
      this.feedbackTimer += dt;
      // Pulse cup color
      const t = this.feedbackTimer / FEEDBACK_SEC;
      const col = this.lastHit
        ? new THREE.Color().lerpColors(new THREE.Color(0x55bb66), new THREE.Color(0xe07b4f), t)
        : new THREE.Color().lerpColors(new THREE.Color(0xe05555), new THREE.Color(0xe07b4f), t);
      (this.cup.material as THREE.MeshLambertMaterial).color.copy(col);

      if (this.feedbackTimer >= FEEDBACK_SEC) {
        this.state = "idle";
        this.currentItem = null;
        this.itemIndex++;
      }
    }

    this.updateBoxTimerPip();
  }

  getResults(): MiniGameResult {
    return {
      segmentId: this.spec.segmentId,
      items: this.itemResults,
      sorted: this.sorted,
      missed: this.missed,
      total: this.sorted + this.missed,
    };
  }

  dispose(): void {
    if (this.keyHandler) { window.removeEventListener("keydown", this.keyHandler); this.keyHandler = null; }
    for (const obj of this.objects) this.scene.remove(obj);
    if (this.indicator) this.scene.remove(this.indicator);
    this.objects = [];
    this.hideHud();
  }

  // ─── input ─────────────────────────────────────────────────────────────────

  private pour(): void {
    if (this.state !== "active" || !this.currentItem) return;

    const center = this.currentItem.targetCenter ?? 0.5;
    const half   = (this.currentItem.targetWidth ?? 0.2) / 2;
    const inZone = this.needlePos >= center - half && this.needlePos <= center + half;

    const accuracy = inZone
      ? 1 - Math.abs(this.needlePos - center) / half
      : 0;

    this.itemResults.push({
      itemId: this.currentItem.id,
      action: inZone ? "hit" : "miss",
      reactionMs: this.itemElapsed * 1000,
      accuracy,
    });

    if (inZone) this.sorted++; else this.missed++;
    this.lastHit = inZone;
    this.state = "feedback";
    this.feedbackTimer = 0;
    this.updateHudLabel(inZone ? "✓ Perfect" : "✗ Missed");
  }

  private recordMiss(): void {
    if (!this.currentItem) return;
    this.itemResults.push({ itemId: this.currentItem.id, action: "miss", reactionMs: ITEM_TIMEOUT_SEC * 1000 });
    this.missed++;
    this.lastHit = false;
    this.state = "feedback";
    this.feedbackTimer = 0;
    this.updateHudLabel("✗ Too slow");
  }

  private activateItem(item: ItemSpec): void {
    this.currentItem = item;
    this.state = "active";
    this.itemElapsed = 0;
    this.needlePos = 0;
    this.needleDir = 1;

    // Update zone mesh
    const center = item.targetCenter ?? 0.5;
    const width  = item.targetWidth ?? 0.2;
    const gaugeW = 6;
    this.zone.position.x = (center - 0.5) * gaugeW;
    this.zone.scale.x    = width;

    this.updateHudLabel("SPACE to pour");
  }

  // ─── scene ─────────────────────────────────────────────────────────────────

  private buildScene(): void {
    this.camera.position.set(0, 1.5, 7);
    this.camera.lookAt(0, 0, 0);

    // Dark background
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 10),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    bg.position.z = -1;
    this.scene.add(bg);
    this.objects.push(bg);

    // Counter surface
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.2, 2),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a }),
    );
    counter.position.y = -1.4;
    this.scene.add(counter);
    this.objects.push(counter);

    // Gauge track
    this.gauge = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.3, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x444444 }),
    );
    this.gauge.position.set(0, 0.3, 0);
    this.scene.add(this.gauge);
    this.objects.push(this.gauge);

    // Target zone (starts hidden, resized per item)
    this.zone = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.32, 0.42),
      new THREE.MeshLambertMaterial({ color: 0x55bb66, transparent: true, opacity: 0.7 }),
    );
    this.zone.position.set(0, 0.3, 0);
    this.zone.scale.x = 0.2;
    this.scene.add(this.zone);
    this.objects.push(this.zone);

    // Indicator sphere
    this.indicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 8),
      new THREE.MeshLambertMaterial({ color: 0xf5c27a }),
    );
    this.indicator.position.set(-3, 0.3, 0.3);
    this.scene.add(this.indicator);

    // Coffee cup
    this.cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.4, 0.8, 16),
      new THREE.MeshLambertMaterial({ color: 0xe07b4f }),
    );
    this.cup.position.set(0, -0.95, 0);
    this.scene.add(this.cup);
    this.objects.push(this.cup);
  }

  private updateIndicator(): void {
    this.indicator.position.x = this.needlePos * 6 - 3;
    const center  = this.currentItem?.targetCenter ?? 0.5;
    const half    = (this.currentItem?.targetWidth ?? 0.2) / 2;
    const inZone  = this.needlePos >= center - half && this.needlePos <= center + half;
    (this.indicator.material as THREE.MeshLambertMaterial).color.setHex(inZone ? 0x55ff88 : 0xf5c27a);
  }

  private showHud(): void {
    const el = document.getElementById("work-hud");
    if (el) el.style.display = "flex";
    const hint = document.getElementById("work-sort-hint");
    if (hint) hint.textContent = "SPACE — pour when indicator is in the green zone";
    this.updateHudLabel("Get ready…");
  }

  private hideHud(): void {
    const el = document.getElementById("work-hud");
    if (el) el.style.display = "none";
  }

  private updateHudLabel(text: string): void {
    const el = document.getElementById("work-box-label");
    if (el) { el.textContent = text; (el as HTMLElement).style.color = "#fff"; }
  }

  private updateBoxTimerPip(): void {
    const bar = document.getElementById("box-timer-bar");
    if (!bar) return;
    bar.style.width = this.state === "active"
      ? `${(1 - this.itemElapsed / ITEM_TIMEOUT_SEC) * 100}%`
      : "100%";
  }
}
