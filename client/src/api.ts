import type {
  StartRunResponse,
  ScheduleResponse,
  SegmentResponse,
  EveningResponse,
  SleepResponse,
  AccidentResponse,
  EndResponse,
  LeaderboardResponse,
} from "shared";
import type { MiniGameResult } from "./minigames/types";

let _runId = "";
let _token = "";

export function setSession(runId: string, token: string): void {
  _runId = runId;
  _token = token;
}

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(body as object), token: _token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function startRun(): Promise<StartRunResponse> {
  const res = await fetch("/api/run/start", { method: "POST" });
  if (!res.ok) throw new Error(`startRun failed: ${res.status}`);
  return res.json() as Promise<StartRunResponse>;
}

export async function scheduleTask(taskId: string): Promise<ScheduleResponse> {
  return post<ScheduleResponse>(`/api/run/${_runId}/schedule`, { taskId });
}

export async function submitSegment(result: MiniGameResult): Promise<SegmentResponse> {
  return post<SegmentResponse>(`/api/run/${_runId}/segment`, {
    segmentId: result.segmentId,
    items: result.items,
  });
}

export async function reportAccident(
  accidentId: string,
  response: "answered" | "ignored",
  t: number,
): Promise<AccidentResponse> {
  return post<AccidentResponse>(`/api/run/${_runId}/accident`, { accidentId, response, t });
}

export async function submitEvening(activities: string[]): Promise<EveningResponse> {
  return post<EveningResponse>(`/api/run/${_runId}/evening`, { activities });
}

export async function submitSleep(): Promise<SleepResponse> {
  return post<SleepResponse>(`/api/run/${_runId}/sleep`);
}

export async function choosePerk(perkId: string): Promise<void> {
  await post(`/api/run/${_runId}/perk`, { perkId });
}

export async function endRun(): Promise<EndResponse> {
  return post<EndResponse>(`/api/run/${_runId}/end`);
}

export async function getLeaderboard(): Promise<LeaderboardResponse> {
  const res = await fetch("/api/leaderboard");
  if (!res.ok) return [];
  return res.json() as Promise<LeaderboardResponse>;
}
