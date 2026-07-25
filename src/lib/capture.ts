import "server-only";
import type { Queryable } from "./db";
import type { Candidate, IntentResult } from "./intent";
import type { CaptureResponse } from "./capture-result";
import { createTodo, listOpen } from "./todos";

/**
 * Apply an interpreted intent to the database and produce the client payload.
 *
 * - capture:  insert each captured todo (raw transcript rides along), return rows.
 * - command:  resolve the model's candidate ids against the *current* open todos
 *             (drop anything hallucinated), using canonical DB titles. Never
 *             completes anything — completion is always a later, gated tap.
 * - unknown:  write nothing; echo the transcript back.
 */
export async function processCapture(
  db: Queryable,
  intent: IntentResult,
): Promise<CaptureResponse> {
  if (intent.intent === "capture") {
    const created = [];
    for (const c of intent.captures) {
      created.push(
        await createTodo(db, {
          title: c.title,
          dueDate: c.due_date,
          sourceTranscript: intent.transcript,
        }),
      );
    }
    return {
      intent: "capture",
      transcript: intent.transcript,
      created,
      command: null,
    };
  }

  if (intent.intent === "command" && intent.command) {
    const open = await listOpen(db);
    const byId = new Map(open.map((t) => [t.id, t]));
    const candidates: Candidate[] = [];
    for (const cand of intent.command.candidates) {
      const match = byId.get(cand.id);
      if (match) {
        candidates.push({
          id: match.id,
          title: match.title,
          confidence: cand.confidence,
        });
      }
    }
    return {
      intent: "command",
      transcript: intent.transcript,
      created: [],
      command: {
        action: "complete",
        targetPhrase: intent.command.target_phrase,
        candidates,
      },
    };
  }

  return {
    intent: "unknown",
    transcript: intent.transcript,
    created: [],
    command: null,
  };
}
