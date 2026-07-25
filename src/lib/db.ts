/**
 * Database access seam.
 *
 * The whole app talks to Postgres through a single tiny `Queryable` interface —
 * `query(text, params) -> { rows }`. In production that's a Neon serverless pool;
 * in tests it's an in-process PGlite instance. Both expose the same shape, so
 * nothing downstream (data access, the capture route) knows or cares which it is.
 */

import "server-only";

export interface Queryable {
  query<Row = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Row[] }>;
}

let override: Queryable | null = null;
let pool: Queryable | null = null;

/** Inject a Queryable (used by tests to swap in PGlite). */
export function __setDb(db: Queryable | null): void {
  override = db;
}

export function getDb(): Queryable {
  if (override) return override;
  if (!pool) {
    // Lazy import so tests that inject a db never touch the Neon driver / env.
    // require (not dynamic import) keeps getDb synchronous for its many callers.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Pool } = require("@neondatabase/serverless") as typeof import("@neondatabase/serverless");
    const { config } = require("./config") as typeof import("./config");
    /* eslint-enable @typescript-eslint/no-require-imports */
    const p = new Pool({ connectionString: config.databaseUrl });
    pool = {
      query: (text, params) => p.query(text, params as never) as never,
    };
  }
  return pool;
}
