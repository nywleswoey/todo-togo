import { PGlite } from "@electric-sql/pglite";
import { __setDb } from "@/lib/db";
import { applySchema } from "@/lib/schema";

/**
 * Spin up an in-process Postgres, apply the schema, and register it as the app's
 * database. Tests assert real SQL behavior (sort, CHECK, casts) without Neon.
 */
export async function makeTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await applySchema(db);
  __setDb(db);
  return db;
}

export function resetDb(): void {
  __setDb(null);
}
