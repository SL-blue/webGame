export const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id         TEXT PRIMARY KEY,
  score      INTEGER NOT NULL,
  created_at TEXT    NOT NULL
);
`;

export async function initDb(db: D1Database): Promise<void> {
  await db.exec(SCHEMA);
}

export async function saveRun(
  db: D1Database,
  runId: string,
  score: number,
): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO runs (id, score, created_at) VALUES (?, ?, ?)")
    .bind(runId, score, new Date().toISOString())
    .run();
}

export async function getTopScores(
  db: D1Database,
  limit = 10,
): Promise<{ score: number; created_at: string }[]> {
  const result = await db
    .prepare("SELECT score, created_at FROM runs ORDER BY score DESC LIMIT ?")
    .bind(limit)
    .all<{ score: number; created_at: string }>();
  return result.results;
}
