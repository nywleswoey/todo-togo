import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createTodo, listOpen } from "@/lib/todos";
import { captureServerEvent } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/todos — open todos for the main screen, sorted. */
export async function GET() {
  const todos = await listOpen(getDb());
  return NextResponse.json({ todos });
}

/** POST /api/todos — tap-create a todo. Body: { title, dueDate?, id? }. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const dueDate =
    typeof body?.dueDate === "string" && body.dueDate ? body.dueDate : null;
  const id = typeof body?.id === "string" ? body.id : undefined;
  const todo = await createTodo(getDb(), { id, title, dueDate });

  captureServerEvent("todo_created", { method: "text", has_due_date: !!dueDate });

  return NextResponse.json({ todo }, { status: 201 });
}
