export type AccidentOutcome = "not-active" | "answered" | "cost";

/**
 * Decide an accident's outcome using the server clock only.
 * The client's self-reported `t` is ignored for security; it stays in the
 * request schema only for forward-compatibility logging.
 *
 * @param phaseStartedAt  Timestamp (ms) when the work phase began.
 * @param warningAt       Seconds from phase start when the overlay appears.
 * @param windowMs        How long the player has to respond after it appears.
 * @param response        What the client claims ("answered" | "ignored").
 * @param now             Current server timestamp (ms).
 */
export function checkAccidentTiming(
  phaseStartedAt: number,
  warningAt: number,
  windowMs: number,
  response: string,
  now: number,
): AccidentOutcome {
  const shownAt = phaseStartedAt + warningAt * 1000;
  const serverT = now - shownAt;

  if (serverT < 0) return "not-active";
  if (response === "ignored" || serverT > windowMs + 500) return "cost";
  return "answered";
}
