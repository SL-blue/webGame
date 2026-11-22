import * as THREE from "three";

const ROOM_CAM_POS  = new THREE.Vector3(0, 3.5, 7);
const ROOM_CAM_LOOK = new THREE.Vector3(0, 0.5, 0);
const WORK_CAM_POS  = new THREE.Vector3(0, 10, 0.01);
const WORK_CAM_LOOK = new THREE.Vector3(0, 0,   0);

type PetPose = "calm" | "restless" | "hiding" | "bouncy" | "sleepy";

export class RoomScene {
  public readonly threeScene: THREE.Scene;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly camera: THREE.PerspectiveCamera;

  private pet: THREE.Mesh;
  private roomObjects: THREE.Object3D[] = [];
  private inWorkMode = false;

  private petPose: PetPose = "calm";
  private swayTime = 0;
  private swayAmount = 0; // set by cue system for "overwhelmed"

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(0x1a1a2e);
    this.threeScene.fog = new THREE.Fog(0x1a1a2e, 12, 30);

    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 100);
    this.camera.position.copy(ROOM_CAM_POS);
    this.camera.lookAt(ROOM_CAM_LOOK);

    this.buildLights();
    this.pet = this.buildRoom();

    window.addEventListener("resize", this.onResize.bind(this));
  }

  // ─── Camera modes ────────────────────────────────────────────────────────

  enterWorkMode(): void {
    this.inWorkMode = true;
    for (const obj of this.roomObjects) obj.visible = false;
    this.camera.position.copy(WORK_CAM_POS);
    this.camera.lookAt(WORK_CAM_LOOK);
  }

  exitWorkMode(): void {
    this.inWorkMode = false;
    for (const obj of this.roomObjects) obj.visible = true;
    this.camera.position.copy(ROOM_CAM_POS);
    this.camera.lookAt(ROOM_CAM_LOOK);
  }

  // ─── Cue-driven pet animation ────────────────────────────────────────────

  setPetPose(pose: PetPose): void {
    this.petPose = pose;
  }

  setSwayAmount(amount: number): void {
    this.swayAmount = amount;
  }

  // ─── Render loop ─────────────────────────────────────────────────────────

  update(dt: number): void {
    if (!this.inWorkMode) {
      this.animatePet(dt);
      this.animateCamera(dt);
    }
    this.renderer.render(this.threeScene, this.camera);
  }

  private animatePet(dt: number): void {
    switch (this.petPose) {
      case "calm":
        this.pet.rotation.y += 0.006;
        this.pet.position.y = 0.25;
        this.pet.scale.setScalar(1);
        break;
      case "restless":
        this.pet.rotation.y += 0.03;
        this.pet.position.y = 0.25 + Math.abs(Math.sin(Date.now() * 0.004)) * 0.08;
        this.pet.scale.setScalar(1);
        break;
      case "bouncy":
        this.pet.rotation.y += 0.015;
        this.pet.position.y = 0.25 + Math.abs(Math.sin(Date.now() * 0.006)) * 0.2;
        this.pet.scale.setScalar(1 + Math.sin(Date.now() * 0.008) * 0.05);
        break;
      case "hiding":
        this.pet.rotation.y += 0.002;
        this.pet.position.y = 0.25;
        this.pet.scale.setScalar(0.4);
        break;
      case "sleepy":
        this.pet.rotation.y += 0.002;
        this.pet.position.y = 0.1 + Math.sin(Date.now() * 0.001) * 0.03;
        this.pet.scale.setScalar(0.9);
        break;
    }
    void dt;
  }

  private animateCamera(dt: number): void {
    if (this.swayAmount <= 0) return;
    this.swayTime += dt;
    this.camera.position.x =
      ROOM_CAM_POS.x + Math.sin(this.swayTime * 1.5) * this.swayAmount;
  }

  // ─── Scene construction ──────────────────────────────────────────────────

  private buildLights(): void {
    this.threeScene.add(new THREE.AmbientLight(0xfff4e0, 0.5));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.threeScene.add(sun);
    const fill = new THREE.DirectionalLight(0xaad4ff, 0.3);
    fill.position.set(-4, 2, -2);
    this.threeScene.add(fill);
  }

  private buildRoom(): THREE.Mesh {
    const add = (obj: THREE.Object3D): THREE.Object3D => {
      this.threeScene.add(obj);
      this.roomObjects.push(obj);
      return obj;
    };

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshLambertMaterial({ color: 0xd4a96a }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    add(floor);

    const wallMat = new THREE.MeshLambertMaterial({ color: 0xf0e6d3 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallMat);
    backWall.position.set(0, 3, -5);
    add(backWall);
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-5, 3, 0);
    add(leftWall);
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(5, 3, 0);
    add(rightWall);

    const couch = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.6, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x5c7c9b }),
    );
    couch.position.set(-1.5, 0.3, -3.5);
    couch.castShadow = true;
    couch.receiveShadow = true;
    add(couch);

    const pet = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.5, 0.9),
      new THREE.MeshLambertMaterial({ color: 0xe07b4f }),
    );
    pet.position.set(0.5, 0.25, 0.5);
    pet.castShadow = true;
    add(pet);

    return pet;
  }

  private onResize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
