import * as THREE from "three";
import type { Minigame, MiniGameResult } from "../types";
import type { SegmentSpecResponse, ItemSpec, ItemResult } from "shared";

type BoxState = "incoming" | "sorting" | "done" | "none";

const BOX_TIMEOUT_SEC = 2.5;
const NEXT_BOX_DELAY = 0.5;
const SORT_ANIM_SEC = 0.35;

const COLOR_HEX: Record<string, number> = {
  red: 0xe05555,
  blue: 0x5588e0,
  green: 0x55bb66,
  yellow: 0xddcc44,
};

export class PackageSortGame implements Minigame {
  private spec!: SegmentSpecResponse;
  private objects: THREE.Object3D[] = [];
  private currentBox: THREE.Mesh | null = null;
  private currentItem: ItemSpec | null = null;
  private itemIndex = 0;

  private state: BoxState = "none";
  private elapsed = 0;          // seconds since segment start
  private boxTimer = 0;          // seconds since current box became "incoming"
  private nextBoxTimer = 0;
  private sortDir = 0;           // -1 left, +1 right
  private sortStart = new THREE.Vector3();

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
    this.state = "none";
    this.boxTimer = 0;
    this.nextBoxTimer = 0;
    this.itemResults = [];
    this.sorted = 0;
    this.missed = 0;

    this.buildScene();
    this.showWorkHud();

    this.keyHandler = (e) => this.handleKey(e.key);
    window.addEventListener("keydown", this.keyHandler);
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Spawn next item if its spawnAt time has arrived
    if (this.state === "none" || this.state === "done") {
      this.nextBoxTimer += dt;

      const next = this.spec.items[this.itemIndex];
      if (next && this.elapsed >= next.spawnAt) {
        // Small delay between boxes for visual clarity
        if (this.state === "done" && this.nextBoxTimer < NEXT_BOX_DELAY) return;
        this.spawnBox(next);
        return;
      }
    }

    if (this.state === "incoming") {
      this.boxTimer += dt;

      // Pulse to signal urgency
      if (this.currentBox) {
        const scale = 1 + 0.04 * Math.sin(this.elapsed * 8);
        this.currentBox.scale.setScalar(scale);
      }

      if (this.boxTimer >= BOX_TIMEOUT_SEC) {
        this.recordMiss();
      }
    }

    if (this.state === "sorting" && this.currentBox) {
      const t = Math.min(this.boxTimer / SORT_ANIM_SEC, 1);
      this.currentBox.position.lerpVectors(
        this.sortStart,
        new THREE.Vector3(this.sortDir * 4.5, 0.4, 0),
        t,
      );
      this.currentBox.scale.setScalar(1 - t * 0.8);
      if (t >= 1) {
        this.scene.remove(this.currentBox);
        this.currentBox = null;
        this.state = "done";
        this.boxTimer = 0;
        this.nextBoxTimer = 0;
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
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = null;
    }
    for (const obj of this.objects) this.scene.remove(obj);
    if (this.currentBox) this.scene.remove(this.currentBox);
    this.objects = [];
    this.currentBox = null;
    this.hideWorkHud();
  }

  // ─── input ─────────────────────────────────────────────────────────────────

  private handleKey(key: string): void {
    if (this.state !== "incoming" || !this.currentItem) return;
    const isLeft  = key === "ArrowLeft"  || key === "a" || key === "A";
    const isRight = key === "ArrowRight" || key === "d" || key === "D";
    if (!isLeft && !isRight) return;

    const action: "left" | "right" = isLeft ? "left" : "right";
    const reactionMs = this.boxTimer * 1000;

    this.itemResults.push({
      itemId: this.currentItem.id,
      action,
      reactionMs,
    });

    const correctSide = this.currentItem.color === (this.spec.colorLeft ?? "red") ? "left" : "right";
    if (action === correctSide) this.sorted++;
    else this.missed++;

    this.sortDir = isLeft ? -1 : 1;
    this.sortStart.copy(this.currentBox!.position);
    this.state = "sorting";
    this.boxTimer = 0;
    this.itemIndex++;
  }

  private recordMiss(): void {
    if (!this.currentItem) return;
    this.itemResults.push({
      itemId: this.currentItem.id,
      action: "miss",
      reactionMs: this.boxTimer * 1000,
    });
    this.missed++;
    this.scene.remove(this.currentBox!);
    this.currentBox = null;
    this.state = "done";
    this.boxTimer = 0;
    this.nextBoxTimer = 0;
    this.itemIndex++;
  }

  // ─── scene helpers ──────────────────────────────────────────────────────────

  private spawnBox(item: ItemSpec): void {
    const hex = COLOR_HEX[item.color ?? "red"] ?? 0xffffff;
    const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const mat = new THREE.MeshLambertMaterial({ color: hex });
    this.currentBox = new THREE.Mesh(geo, mat);
    this.currentBox.position.set(0, 0.45, 0);
    this.currentBox.castShadow = true;
    this.scene.add(this.currentBox);

    this.currentItem = item;
    this.state = "incoming";
    this.boxTimer = 0;
    this.updateBoxLabel(item.color ?? "red");
  }

  private buildScene(): void {
    this.camera.position.set(0, 10, 0.01);
    this.camera.lookAt(0, 0, 0);

    // Dark work floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshLambertMaterial({ color: 0x444444 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.06;
    this.scene.add(floor);
    this.objects.push(floor);

    // Conveyor belt
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.1, 6),
      new THREE.MeshLambertMaterial({ color: 0x888888 }),
    );
    belt.receiveShadow = true;
    this.scene.add(belt);
    this.objects.push(belt);

    // Colored bins
    this.makeBin(-3.5, COLOR_HEX[this.spec.colorLeft  ?? "red"]  ?? 0xff0000);
    this.makeBin(3.5,  COLOR_HEX[this.spec.colorRight ?? "blue"] ?? 0x0000ff);
  }

  private makeBin(x: number, color: number): void {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.12, 1.8),
      new THREE.MeshLambertMaterial({ color }),
    );
    pad.position.set(x, 0.06, 0);
    this.scene.add(pad);
    this.objects.push(pad);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 0.4, 2)),
      new THREE.LineBasicMaterial({ color }),
    );
    edges.position.set(x, 0.2, 0);
    this.scene.add(edges);
    this.objects.push(edges);
  }

  private showWorkHud(): void {
    const el = document.getElementById("work-hud");
    if (el) el.style.display = "flex";
    const hint = document.getElementById("work-sort-hint");
    if (hint) {
      hint.textContent = `← ${(this.spec.colorLeft ?? "red").toUpperCase()}   ${(this.spec.colorRight ?? "blue").toUpperCase()} →`;
    }
  }

  private hideWorkHud(): void {
    const el = document.getElementById("work-hud");
    if (el) el.style.display = "none";
  }

  private updateBoxLabel(color: string): void {
    const el = document.getElementById("work-box-label");
    if (!el) return;
    el.textContent = color.toUpperCase();
    (el as HTMLElement).style.color =
      color === "red" ? "#e05555" : color === "blue" ? "#5588e0" : "#fff";
  }

  private updateBoxTimerPip(): void {
    const bar = document.getElementById("box-timer-bar");
    if (!bar) return;
    bar.style.width =
      this.state === "incoming"
        ? `${(1 - this.boxTimer / BOX_TIMEOUT_SEC) * 100}%`
        : "100%";
  }
}
