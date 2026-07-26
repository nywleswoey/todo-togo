/**
 * Client-side API wrapper for the todo endpoints. Client-safe (no server-only).
 */
import type { Todo } from "./types";
import type { CaptureResponse } from "./capture-result";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchTodos(): Promise<Todo[]> {
  const { todos } = await json<{ todos: Todo[] }>(await fetch("/api/todos"));
  return todos;
}

export async function createTodoApi(input: {
  title: string;
  dueDate?: string | null;
  id?: string;
}): Promise<Todo> {
  const { todo } = await json<{ todo: Todo }>(
    await fetch("/api/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return todo;
}

export async function patchTodoApi(
  id: string,
  patch: { title?: string; dueDate?: string | null; status?: Todo["status"] },
): Promise<Todo> {
  const { todo } = await json<{ todo: Todo }>(
    await fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
  return todo;
}

export async function deleteTodoApi(id: string): Promise<void> {
  await json<{ ok: true }>(
    await fetch(`/api/todos/${id}`, { method: "DELETE" }),
  );
}

/** Upload a recorded clip to the capture endpoint and get the applied result. */
export async function uploadCapture(blob: Blob): Promise<CaptureResponse> {
  const fd = new FormData();
  fd.append("audio", blob, "clip");
  const res = await fetch("/api/capture", { method: "POST", body: fd });
  if (!res.ok) {
    // Transcription/interpretation failure — caller shows a Retry toast. Surface
    // the server's `message` (the real Gemini error) so the exception captured
    // in PostHog is diagnostic rather than a bare "capture_failed".
    const body = await res.json().catch(() => ({}));
    throw new Error(
      `capture_failed (${res.status}): ${body.message ?? body.error ?? "unknown"}`,
    );
  }
  return res.json() as Promise<CaptureResponse>;
}
