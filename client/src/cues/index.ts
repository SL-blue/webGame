import type { CueBundle } from "shared";
import type { RoomScene } from "../scenes/room";

/**
 * Applies a CueBundle from the server to visual and audio effects.
 * Never reveals exact numbers — only adjusts CSS/Three.js aesthetics.
 */
export function applyCues(cues: CueBundle, scene: RoomScene): void {
  if (cues.self) {
    applyStress(cues.self.stressLevel ?? "calm");
    applyFatigue(cues.self.fatigue ?? "alert");
  }
  if (cues.pet) {
    scene.setPetPose(cues.pet.pose ?? "calm");
  }
}

function applyStress(level: "calm" | "tense" | "overwhelmed"): void {
  const vignette = document.getElementById("vignette") as HTMLElement | null;
  if (!vignette) return;

  const opacity = level === "calm" ? 0 : level === "tense" ? 0.35 : 0.72;
  vignette.style.opacity = String(opacity);

  // Coarse label shown in HUD stress indicator
  const indicator = document.getElementById("stress-indicator");
  if (indicator) {
    indicator.textContent = level === "calm" ? "" : level === "tense" ? "Tense" : "Overwhelmed";
    indicator.style.color = level === "overwhelmed" ? "#e05555" : "#ddcc44";
  }
}

function applyFatigue(level: "alert" | "tired" | "exhausted"): void {
  const canvas = document.getElementById("canvas-container") as HTMLElement | null;
  if (!canvas) return;

  const saturation = level === "alert" ? 1 : level === "tired" ? 0.55 : 0.2;
  canvas.style.filter = saturation < 1 ? `saturate(${saturation})` : "";
}
