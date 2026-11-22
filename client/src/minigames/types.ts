import type { SegmentSpecResponse, ItemResult } from "shared";

// Re-export so callers can use a single import
export type { SegmentSpecResponse as SegmentSpec, ItemResult };

export type MiniGameResult = {
  segmentId: string;
  items: ItemResult[];
  sorted: number;
  missed: number;
  total: number;
};

export interface Minigame {
  start(spec: SegmentSpecResponse): void;
  update(dt: number): void;
  getResults(): MiniGameResult;
  dispose(): void;
}
