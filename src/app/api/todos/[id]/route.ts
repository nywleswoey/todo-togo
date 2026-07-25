import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteTodo, getTodo, setStatus, updateTodo } from "@/lib/todos";
import type { TodoStatus } from "@/lib/types";
import { getPostHogClient, POSTHOG_DISTINCT_ID } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES: TodoStatus[] = ["open", "done", "archived"];

/**
 * PATCH /api/todos/:id — edit title/date and/or move status.
 * Body: { title?, dueDate?, status? }.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const db = getDb();

  if (body.title !== undefined || body.dueDate !== undefined) {
    const patch: { title?: string; dueDate?: string | null } = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (body.dueDate === null || typeof body.dueDate === "string") {
      patch.dueDate = body.dueDate || null;
    }
    const updated = await updateTodo(db, id, patch);
    if (!updated) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  let todo = null;
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    todo = await setStatus(db, id, body.status);
    if (todo) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: POSTHOG_DISTINCT_ID,
        event: "todo_status_changed",
        properties: { status: body.status },
      });
      await posthog.shutdown();
    }
  } else {
    todo = await getTodo(db, id);
  }

  if (!todo) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ todo });
}

/** DELETE /api/todos/:id — remove a todo. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteTodo(getDb(), id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: POSTHOG_DISTINCT_ID,
    event: "todo_deleted",
  });
  await posthog.shutdown();

  return NextResponse.json({ ok: true });
}
