import * as THREE from "three";
import type { Minigame, MiniGameResult } from "../types";
import type { SegmentSpecResponse, ItemSpec, ItemResult } from "shared";

const LANE_X = [-3, 0, 3] as const;
const CART_Y = -3.2;
const FALL_SPEED = 3.5;
const CART_SPEED = 6;
const CATCH_RADIUS = 0.9;

export class CatchDeliveryGame implements Minigame {
  private spec!: SegmentSpecResponse;
  private objects: THREE.Object3D[] = [];

  private cart!: THREE.Mesh;
  private cartX = 0;
  private fallingBoxes: Array<{ mesh: THREE.Mesh; item: ItemSpec }> = [];

  private elapsed = 0;
  private itemResults: ItemResult[] = [];
  private sorted = 0;
  private missed = 0;
  private spawnedIds = new Set<string>();

  private keys = { left: false, right: false };
  private keyDown: ((e: KeyboardEvent) => void) | null = null;
  private keyUp:   ((e: KeyboardEvent) => void) | null = null;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {}

  start(spec: SegmentSpecResponse): void {
    this.spec = spec;
    this.elapsed = 0;
    this.cartX = 0;
    this.fallingBoxes = [];
    this.itemResults = [];
    this.sorted = 0;
    this.missed = 0;
    this.spawnedIds = new Set();
    this.keys = { left: false, right: false };

    this.buildScene();
    this.showHud();

    this.keyDown = (e) => {
      if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") this.keys.left  = true;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") this.keys.right = true;
    };
    this.keyUp = (e) => {
      if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") this.keys.left  = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") this.keys.right = false;
    };
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup",   this.keyUp);
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Move cart
    if (this.keys.left)  this.cartX = Math.max(-4.5, this.cartX - CART_SPEED * dt);
    if (this.keys.right) this.cartX = Math.min(4.5,  this.cartX + CART_SPEED * dt);
    this.cart.position.x = this.cartX;

    // Spawn new items
    for (const item of this.spec.items) {
      if (!this.spawnedIds.has(item.id) && this.elapsed >= item.spawnAt) {
        this.spawnItem(item);
        this.spawnedIds.add(item.id);
      }
    }

    // Update falling boxes
    const toRemove: typeof this.fallingBoxes[0][] = [];
    for (const fb of this.fallingBoxes) {
      fb.mesh.position.y -= FALL_SPEED * dt;
      fb.mesh.rotation.z += dt * 0.5;

      if (fb.mesh.position.y <= CART_Y) {
        const caught = Math.abs(fb.mesh.position.x - this.cartX) < CATCH_RADIUS;
        this.recordResult(fb.item, caught);
        this.scene.remove(fb.mesh);
        toRemove.push(fb);
      }
    }
    this.fallingBoxes = this.fallingBoxes.filter((fb) => !toRemove.includes(fb));
  }

  getResults(): MiniGameResult {
    // Any remaining falling boxes when segment ends → missed
    for (const fb of this.fallingBoxes) {
      if (!this.itemResults.find((r) => r.itemId === fb.item.id)) {
        this.recordResult(fb.item, false);
      }
      this.scene.remove(fb.mesh);
    }
    return {
      segmentId: this.spec.segmentId,
      items: this.itemResults,
      sorted: this.sorted,
      missed: this.missed,
      total: this.sorted + this.missed,
    };
  }

  dispose(): void {
    if (this.keyDown) { window.removeEventListener("keydown", this.keyDown); this.keyDown = null; }
    if (this.keyUp)   { window.removeEventListener("keyup",   this.keyUp);   this.keyUp   = null; }
    for (const obj of this.objects) this.scene.remove(obj);
    for (const fb of this.fallingBoxes) this.scene.remove(fb.mesh);
    this.objects = [];
    this.fallingBoxes = [];
    this.hideHud();
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  private spawnItem(item: ItemSpec): void {
    const laneIndex = item.lane ?? Math.floor(Math.random() * 3);
    const x = LANE_X[laneIndex as 0 | 1 | 2];
    const fragile = item.fragile ?? false;

    const color = fragile ? 0x88ccff : 0xe07b4f;
    const geo = fragile
      ? new THREE.BoxGeometry(0.6, 0.6, 0.6)
      : new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const mat = new THREE.MeshLambertMaterial({ color, transparent: fragile, opacity: fragile ? 0.7 : 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 5, 0);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.fallingBoxes.push({ mesh, item });
  }

  private recordResult(item: ItemSpec, caught: boolean): void {
    // Skip duplicate entries (can happen when getResults is called early)
    if (this.itemResults.find((r) => r.itemId === item.id)) return;

    const action: string = caught ? "caught" : "missed";
    this.itemResults.push({ itemId: item.id, action, reactionMs: 0 });

    if (item.fragile) {
      if (caught) this.missed++;  // caught fragile = bad
      // missed fragile = neutral
    } else {
      if (caught) this.sorted++;
      else this.missed++;
    }
  }

  private buildScene(): void {
    this.camera.position.set(0, 2, 10);
    this.camera.lookAt(0, 0, 0);

    // Background
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 14),
      new THREE.MeshLambertMaterial({ color: 0x1a1a2e }),
    );
    bg.position.z = -1;
    this.scene.add(bg);
    this.objects.push(bg);

    // Lane dividers
    const divMat = new THREE.MeshLambertMaterial({ color: 0x444466 });
    for (const x of [-1.5, 1.5]) {
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.08, 10, 0.1), divMat);
      div.position.set(x, 0, 0);
      this.scene.add(div);
      this.objects.push(div);
    }

    // Floor line
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x444444 }),
    );
    floor.position.y = CART_Y - 0.3;
    this.scene.add(floor);
    this.objects.push(floor);

    // Cart
    this.cart = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.4, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x5588e0 }),
    );
    this.cart.position.set(0, CART_Y, 0);
    this.scene.add(this.cart);
    this.objects.push(this.cart);
  }

  private showHud(): void {
    const el = document.getElementById("work-hud");
    if (el) el.style.display = "flex";
    const hint = document.getElementById("work-sort-hint");
    if (hint) hint.textContent = "← → move cart   catch orange  dodge blue";
    const lbl = document.getElementById("work-box-label");
    if (lbl) { lbl.textContent = ""; }
  }

  private hideHud(): void {
    const el = document.getElementById("work-hud");
    if (el) el.style.display = "none";
  }
}
