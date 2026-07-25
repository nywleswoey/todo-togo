import "server-only";
import type { Queryable } from "./db";
import type { Todo } from "./types";

/**
 * Data access for the `todos` table. Every read casts date/timestamp columns to
 * text so both drivers (Neon, PGlite) hand back stable `YYYY-MM-DD` / ISO-ish
 * strings instead of driver-specific Date objects.
 */

const COLS = `
  id,
  title,
  status,
  due_date::text          AS due_date,
  source_transcript,
  created_at::text        AS created_at,
  updated_at::text        AS updated_at
`;

interface Row {
  id: string;
  title: string;
  status: Todo["status"];
  due_date: string | null;
  source_transcript: string | null;
  created_at: string;
  updated_at: string;
}

function toTodo(row: Row): Todo {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    dueDate: row.due_date,
    sourceTranscript: row.source_transcript,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Open todos for the main screen: soonest-due first, undated last. */
export async function listOpen(db: Queryable): Promise<Todo[]> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLS} FROM todos
     WHERE status = 'open'
     ORDER BY due_date ASC NULLS LAST, created_at DESC`,
  );
  return rows.map(toTodo);
}

export async function getTodo(db: Queryable, id: string): Promise<Todo | null> {
  const { rows } = await db.query<Row>(
    `SELECT ${COLS} FROM todos WHERE id = $1`,
    [id],
  );
  return rows[0] ? toTodo(rows[0]) : null;
}

export interface CreateTodoInput {
  /** Optional client-minted uuid (optimistic inserts). Defaults server-side. */
  id?: string;
  title: string;
  dueDate?: string | null;
  sourceTranscript?: string | null;
}

export async function createTodo(
  db: Queryable,
  input: CreateTodoInput,
): Promise<Todo> {
  const { rows } = await db.query<Row>(
    `INSERT INTO todos (id, title, due_date, source_transcript)
     VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4)
     RETURNING ${COLS}`,
    [
      input.id ?? null,
      input.title,
      input.dueDate ?? null,
      input.sourceTranscript ?? null,
    ],
  );
  return toTodo(rows[0]);
}

export interface UpdateTodoInput {
  title?: string;
  dueDate?: string | null;
}

/** Patch title and/or due date. Only provided fields change. */
export async function updateTodo(
  db: Queryable,
  id: string,
  input: UpdateTodoInput,
): Promise<Todo | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.title !== undefined) {
    params.push(input.title);
    sets.push(`title = $${params.length}`);
  }
  if (input.dueDate !== undefined) {
    params.push(input.dueDate);
    sets.push(`due_date = $${params.length}`);
  }
  if (sets.length === 0) return getTodo(db, id);
  params.push(id);
  const { rows } = await db.query<Row>(
    `UPDATE todos SET ${sets.join(", ")}, updated_at = now()
     WHERE id = $${params.length}
     RETURNING ${COLS}`,
    params,
  );
  return rows[0] ? toTodo(rows[0]) : null;
}

/** Move a todo to a new status (open → done via voice/tap; tap can archive). */
export async function setStatus(
  db: Queryable,
  id: string,
  status: Todo["status"],
): Promise<Todo | null> {
  const { rows } = await db.query<Row>(
    `UPDATE todos SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING ${COLS}`,
    [status, id],
  );
  return rows[0] ? toTodo(rows[0]) : null;
}

export async function deleteTodo(db: Queryable, id: string): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `DELETE FROM todos WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows.length > 0;
}
