/**
 * Prompt assembly for the single audio→intent Gemini call. Pure and client-safe
 * so it's trivially testable. Injects today's date, the server timezone, and the
 * current open-todo list so the model can resolve relative dates and match
 * completion commands to real todo ids.
 */

export interface OpenTodoRef {
  id: string;
  title: string;
}

export interface PromptContext {
  /** Today's date, `YYYY-MM-DD`, in the server timezone. */
  today: string;
  timezone: string;
  openTodos: OpenTodoRef[];
}

export function buildPrompt(ctx: PromptContext): string {
  const todoLines =
    ctx.openTodos.length === 0
      ? "(no open todos)"
      : ctx.openTodos.map((t) => `- id=${t.id} :: ${t.title}`).join("\n");

  return `You transcribe and interpret a short voice clip for a personal todo app.
Return ONE JSON object matching the schema. Do not add commentary.

Today is ${ctx.today} (timezone ${ctx.timezone}). Resolve any spoken relative
date ("today", "tomorrow", "Friday", "next week") to an absolute date-only value
in "YYYY-MM-DD". If no date is spoken, use null.

Classify the utterance into exactly ONE intent:
- "capture": the user is stating one or more things to do. Split a multi-task
  utterance (e.g. "buy milk and call the dentist tomorrow") into separate
  entries in "captures", each a clean title plus its due_date (or null).
- "command": the user wants to complete/finish an existing todo. Match against
  the open todos below and return the matching ids in "command.candidates",
  ranked best-first, at most 3. Mark each "high" or "low" confidence. If nothing
  plausibly matches, return an empty candidates array. Never invent an id.
- "unknown": garbled audio or no clear intent.

Always return the raw transcript verbatim in "transcript", even for "unknown".
Pick the single dominant intent; do not mix capture and command.

Open todos:
${todoLines}`;
}
