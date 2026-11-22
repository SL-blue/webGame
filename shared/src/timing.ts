export const TIMING = {
  daysPerRun:        4,
  morningSec:        10,
  workSec:           90,
  eveningSec:        20,
  sleepSec:          5,
  perkChoiceSec:     10,
  accidentWarningMs: 1500,
  phoneAnswerMs:     3000,
} as const;

/** Shorter timings for the class-exchange demo — activated server-side via DEMO_MODE=true. */
export const TIMING_DEMO = {
  daysPerRun:        2,
  morningSec:        6,
  workSec:           22,
  eveningSec:        8,
  sleepSec:          2,
  perkChoiceSec:     7,
  accidentWarningMs: 1500,
  phoneAnswerMs:     3000,
} as const;

export type GameTiming = {
  daysPerRun:        number;
  morningSec:        number;
  workSec:           number;
  eveningSec:        number;
  sleepSec:          number;
  perkChoiceSec:     number;
  accidentWarningMs: number;
  phoneAnswerMs:     number;
};
