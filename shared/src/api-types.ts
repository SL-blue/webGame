import { z } from "zod";

// ─── Cue descriptors ────────────────────────────────────────────────────────

export const PetCue = z.object({
  pose: z.enum(["calm", "restless", "hiding", "bouncy", "sleepy"]).optional(),
  sound: z.enum(["none", "purr", "whine"]).optional(),
});
export const SelfCue = z.object({
  stressLevel: z.enum(["calm", "tense", "overwhelmed"]).optional(),
  fatigue: z.enum(["alert", "tired", "exhausted"]).optional(),
});
export const PhoneCue = z.object({
  message: z.string().optional(),
  tone: z.enum(["warm", "neutral", "short", "none"]).optional(),
});
export const CueBundle = z.object({
  pet: PetCue.optional(),
  self: SelfCue.optional(),
  phone: PhoneCue.optional(),
});
export type CueBundle = z.infer<typeof CueBundle>;

// ─── Task offers ────────────────────────────────────────────────────────────

export const TaskOffer = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});
export type TaskOffer = z.infer<typeof TaskOffer>;

// ─── Perks ──────────────────────────────────────────────────────────────────

export const PerkDef = z.object({
  id: z.string(),
  name: z.string(),
  upside: z.string(),
  downside: z.string(),
  icon: z.string(),
});
export type PerkDef = z.infer<typeof PerkDef>;

// ─── Accidents ──────────────────────────────────────────────────────────────

export const AccidentSpec = z.object({
  id: z.string(),
  type: z.enum(["spill", "pet-cam", "phone-call"]),
  warningAt: z.number(),
  windowMs: z.number(),
  responseKey: z.string(),
});
export type AccidentSpec = z.infer<typeof AccidentSpec>;

// ─── Work segment items ──────────────────────────────────────────────────────

export const ItemSpec = z.object({
  id: z.string(),
  spawnAt: z.number(),
  color: z.string().optional(),
  targetCenter: z.number().optional(),
  targetWidth: z.number().optional(),
  needleSpeed: z.number().optional(),
  lane: z.number().int().optional(),
  fragile: z.boolean().optional(),
});
export type ItemSpec = z.infer<typeof ItemSpec>;

export const SegmentSpecResponse = z.object({
  segmentId: z.string(),
  taskType: z.enum(["package-sort", "coffee-timing", "catch-delivery"]),
  durationSec: z.number(),
  colorLeft: z.string().optional(),
  colorRight: z.string().optional(),
  items: z.array(ItemSpec),
  accidents: z.array(AccidentSpec),
});
export type SegmentSpecResponse = z.infer<typeof SegmentSpecResponse>;

// ─── Work segment results ────────────────────────────────────────────────────

export const ItemResult = z.object({
  itemId: z.string(),
  action: z.string(),
  reactionMs: z.number(),
  accuracy: z.number().optional(),
});
export type ItemResult = z.infer<typeof ItemResult>;

export const SegmentResultPayload = z.object({
  segmentId: z.string(),
  items: z.array(ItemResult),
});
export type SegmentResultPayload = z.infer<typeof SegmentResultPayload>;

// ─── Accident response ───────────────────────────────────────────────────────

export const AccidentRequest = z.object({
  accidentId: z.string(),
  response: z.enum(["answered", "ignored"]),
  t: z.number(),
});
export type AccidentRequest = z.infer<typeof AccidentRequest>;

export const AccidentResponse = z.object({
  cues: CueBundle,
  money: z.number(),
});
export type AccidentResponse = z.infer<typeof AccidentResponse>;

// ─── Perk request/response ───────────────────────────────────────────────────

export const PerkRequest = z.object({ perkId: z.string() });
export const PerkResponse = z.object({ ok: z.boolean() });
export type PerkResponse = z.infer<typeof PerkResponse>;

// ─── End run / scoring ───────────────────────────────────────────────────────

export const GradeReport = z.object({
  finances:     z.string(),
  pet:          z.string(),
  self:         z.string(),
  relationship: z.string(),
});
export type GradeReport = z.infer<typeof GradeReport>;

export const EndResponse = z.object({
  score:   z.number(),
  grades:  GradeReport,
  reasons: z.array(z.string()),
});
export type EndResponse = z.infer<typeof EndResponse>;

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export const LeaderboardEntry = z.object({
  rank:       z.number(),
  score:      z.number(),
  created_at: z.string(),
});
export type LeaderboardEntry = z.infer<typeof LeaderboardEntry>;

export const LeaderboardResponse = z.array(LeaderboardEntry);
export type LeaderboardResponse = z.infer<typeof LeaderboardResponse>;

// ─── API request / response shapes ──────────────────────────────────────────

export const StartRunResponse = z.object({
  runId: z.string(),
  token: z.string(),
  day: z.number(),
  demo: z.boolean(),
  cues: CueBundle,
  taskOffers: z.array(TaskOffer),
});
export type StartRunResponse = z.infer<typeof StartRunResponse>;

export const ScheduleRequest = z.object({ taskId: z.string() });
export const ScheduleResponse = z.object({ segment: SegmentSpecResponse });
export type ScheduleResponse = z.infer<typeof ScheduleResponse>;

export const SegmentResponse = z.object({
  cues: CueBundle,
  money: z.number(),
  nextSegment: SegmentSpecResponse.nullable(),
  sorted: z.number(),
  missed: z.number(),
});
export type SegmentResponse = z.infer<typeof SegmentResponse>;

export const EveningRequest = z.object({ activities: z.array(z.string()) });
export const EveningResponse = z.object({ cues: CueBundle, money: z.number() });
export type EveningResponse = z.infer<typeof EveningResponse>;

export const SleepResponse = z.object({
  summary: z.object({
    day: z.number(),
    earned: z.number(),
    sorted: z.number(),
    missed: z.number(),
    feedback: z.array(z.string()),
  }),
  cues: CueBundle,
  nextDay: z.number().nullable(),
  perkOffer: z.array(PerkDef).optional(),
});
export type SleepResponse = z.infer<typeof SleepResponse>;
