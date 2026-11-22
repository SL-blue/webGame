-- Run once: wrangler d1 execute paws-db --file=server/migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS runs (
  id         TEXT PRIMARY KEY,
  score      INTEGER NOT NULL,
  created_at TEXT    NOT NULL
);
