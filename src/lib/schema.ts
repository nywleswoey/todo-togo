import type { Queryable } from "./db";

/**
 * The single `todos` table. Status is a text column constrained by CHECK
 * (simpler migrations than a native pg enum); due_date is date-only; the raw
 * transcript rides along on voice-captured rows.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS todos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'done', 'archived')),
  due_date          date,
  source_transcript text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS todos_open_sort
  ON todos (due_date ASC NULLS LAST, created_at DESC)
  WHERE status = 'open';
`;

/**
 * Apply the schema to any Queryable (Neon in prod, PGlite in tests).
 *
 * Runs one statement at a time — PGlite's parameterized `query` uses the
 * extended protocol, which rejects multiple commands in one call.
 */
export async function applySchema(db: Queryable): Promise<void> {
  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await db.query(stmt);
  }
}
