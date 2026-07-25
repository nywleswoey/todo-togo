import { afterEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { __setDb, getDb } from "./db";

afterEach(() => __setDb(null));

test("injected PGlite satisfies the Queryable seam", async () => {
  __setDb(new PGlite());
  const { rows } = await getDb().query<{ ok: number }>("SELECT 1 AS ok");
  expect(rows[0]?.ok).toBe(1);
});

test("gen_random_uuid() is available (no extension needed)", async () => {
  __setDb(new PGlite());
  const { rows } = await getDb().query<{ id: string }>(
    "SELECT gen_random_uuid() AS id",
  );
  expect(rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
});
