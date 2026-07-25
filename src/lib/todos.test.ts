import { afterEach, beforeEach, expect, test } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { makeTestDb, resetDb } from "../../test/db";
import {
  createTodo,
  deleteTodo,
  listOpen,
  setStatus,
  updateTodo,
} from "./todos";

let db: PGlite;
beforeEach(async () => {
  db = await makeTestDb();
});
afterEach(() => resetDb());

test("listOpen sorts by due date asc, undated last, newest-created first", async () => {
  await createTodo(db, { title: "undated A" });
  await createTodo(db, { title: "undated B" });
  await createTodo(db, { title: "far", dueDate: "2026-08-10" });
  await createTodo(db, { title: "soon", dueDate: "2026-07-26" });

  const titles = (await listOpen(db)).map((t) => t.title);
  // soonest due first, then later due, then undated (newest created first).
  expect(titles).toEqual(["soon", "far", "undated B", "undated A"]);
});

test("only open todos appear in the list", async () => {
  const open = await createTodo(db, { title: "keep" });
  const toDone = await createTodo(db, { title: "finish me" });
  const toArchive = await createTodo(db, { title: "archive me" });

  await setStatus(db, toDone.id, "done");
  await setStatus(db, toArchive.id, "archived");

  const titles = (await listOpen(db)).map((t) => t.title);
  expect(titles).toEqual(["keep"]);
  expect(titles).not.toContain("finish me");
  expect(open.status).toBe("open");
});

test("due_date is returned as a plain YYYY-MM-DD string", async () => {
  const t = await createTodo(db, { title: "dated", dueDate: "2026-07-30" });
  expect(t.dueDate).toBe("2026-07-30");
  const undated = await createTodo(db, { title: "no date" });
  expect(undated.dueDate).toBeNull();
});

test("createTodo keeps source_transcript (null for tap-created)", async () => {
  const tap = await createTodo(db, { title: "tapped" });
  expect(tap.sourceTranscript).toBeNull();
  const voice = await createTodo(db, {
    title: "spoken",
    sourceTranscript: "add spoken",
  });
  expect(voice.sourceTranscript).toBe("add spoken");
});

test("updateTodo edits title/date and bumps updated_at", async () => {
  const t = await createTodo(db, { title: "old", dueDate: "2026-07-26" });
  const updated = await updateTodo(db, t.id, {
    title: "new",
    dueDate: "2026-07-28",
  });
  expect(updated?.title).toBe("new");
  expect(updated?.dueDate).toBe("2026-07-28");
  expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
    new Date(t.updatedAt).getTime(),
  );
});

test("updateTodo can clear a due date", async () => {
  const t = await createTodo(db, { title: "x", dueDate: "2026-07-26" });
  const updated = await updateTodo(db, t.id, { dueDate: null });
  expect(updated?.dueDate).toBeNull();
});

test("deleteTodo removes the row", async () => {
  const t = await createTodo(db, { title: "gone" });
  expect(await deleteTodo(db, t.id)).toBe(true);
  expect((await listOpen(db)).length).toBe(0);
  expect(await deleteTodo(db, t.id)).toBe(false);
});

test("status CHECK constraint rejects unknown status", async () => {
  const t = await createTodo(db, { title: "x" });
  await expect(
    db.query(`UPDATE todos SET status = 'bogus' WHERE id = $1`, [t.id]),
  ).rejects.toThrow();
});
