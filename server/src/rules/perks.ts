import type { PerkDef } from "shared";

export const ALL_PERKS: PerkDef[] = [
  { id: "deep-sleeper",  name: "Deep Sleeper",  icon: "😴", upside: "Rest recovers more",             downside: "Shorter morning timer"          },
  { id: "workaholic",    name: "Workaholic",    icon: "💼", upside: "Work pays more",                 downside: "Stress rises faster"            },
  { id: "pet-whisperer", name: "Pet Whisperer", icon: "🐾", upside: "Pet mood recovers faster",       downside: "Work tasks slightly harder"     },
  { id: "smooth-talker", name: "Smooth Talker", icon: "💬", upside: "Relationship more forgiving",    downside: "Entertainment helps less"       },
  { id: "gym-rat",       name: "Gym Rat",       icon: "🏃", upside: "Exercise works better",          downside: "Exercise costs more fatigue"    },
  { id: "frugal",        name: "Frugal",        icon: "💰", upside: "Accident costs less money",      downside: "Pet dislikes cheap food more"   },
  { id: "night-owl",     name: "Night Owl",     icon: "🦉", upside: "Overtime pays better",           downside: "Sleep debt builds faster"       },
  { id: "calm-mind",     name: "Calm Mind",     icon: "🧘", upside: "Stress affects controls less",   downside: "Accident windows shorter"       },
  { id: "remote-work",   name: "Remote Work",   icon: "🏠", upside: "Can check pet-cam freely",       downside: "Lower pay that segment"         },
  { id: "big-spender",   name: "Big Spender",   icon: "🎁", upside: "Dates boost relationship more",  downside: "Dates cost more money"          },
];

const PERK_IDS = new Set(ALL_PERKS.map((p) => p.id));

export function offerPerks(rng: () => number, owned: string[]): PerkDef[] {
  const available = ALL_PERKS.filter((p) => !owned.includes(p.id));
  // Shuffle and pick 3
  const shuffled = [...available].sort(() => rng() - 0.5);
  return shuffled.slice(0, 3);
}

/** Add perk to owned list, return false if already owned or cap reached. */
export function addPerk(owned: string[], perkId: string): boolean {
  if (!PERK_IDS.has(perkId)) return false;
  if (owned.includes(perkId)) return false;
  if (owned.length >= 2) return false; // 2 perk choices per run
  owned.push(perkId);
  return true;
}

export function has(owned: string[], perkId: string): boolean {
  return owned.includes(perkId);
}
