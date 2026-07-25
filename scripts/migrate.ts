/**
 * Apply the database schema to the configured Neon Postgres.
 *
 * Run with: `npm run migrate` (reads DATABASE_URL from the environment; loads a
 * local .env / .env.local if present). Idempotent — safe to run repeatedly.
 */
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { applySchema } from "../src/lib/schema";

function loadEnvFile(path: string): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to .env or the environment.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  try {
    await applySchema({
      query: (text, params) => pool.query(text, params as never) as never,
    });
    console.log("Schema applied.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
