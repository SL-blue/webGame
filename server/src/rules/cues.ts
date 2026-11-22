import type { CueBundle } from "shared";

export type HiddenState = {
  stress: number;
  fatigue: number;
  sleepDebt: number;
  health: number;
  pet: { traits: string[]; hunger: number; mood: number; health: number };
  relationship: number;
  pendingPlans: string[];
};

export function buildCues(hidden: HiddenState): CueBundle {
  // Self stress → 3 coarse levels
  const stressLevel: "calm" | "tense" | "overwhelmed" =
    hidden.stress < 34 ? "calm" : hidden.stress < 67 ? "tense" : "overwhelmed";

  // Self fatigue → 3 coarse levels (sleep debt makes exhaustion linger)
  const effectiveFatigue = hidden.fatigue + hidden.sleepDebt * 0.3;
  const fatigue: "alert" | "tired" | "exhausted" =
    effectiveFatigue < 34 ? "alert" : effectiveFatigue < 67 ? "tired" : "exhausted";

  // Pet pose depends on mood, traits, and player fatigue
  let pose: "calm" | "restless" | "hiding" | "bouncy" | "sleepy";
  const { traits, mood } = hidden.pet;
  if (mood < 20) {
    pose = traits.includes("anxious") ? "hiding" : "restless";
  } else if (mood > 70 && traits.includes("energetic")) {
    pose = "bouncy";
  } else if (hidden.fatigue > 50) {
    pose = "sleepy";
  } else {
    pose = "calm";
  }

  const sound: "none" | "purr" | "whine" =
    hidden.pet.mood < 30 ? "whine" : hidden.pet.mood > 70 ? "purr" : "none";

  // Phone tone reflects relationship level
  let tone: "warm" | "neutral" | "short" | "none";
  if (hidden.relationship > 65)      tone = "warm";
  else if (hidden.relationship > 40) tone = "neutral";
  else if (hidden.relationship > 20) tone = "short";
  else                               tone = "none";

  return {
    pet:   { pose, sound },
    self:  { stressLevel, fatigue },
    phone: { tone },
  };
}
