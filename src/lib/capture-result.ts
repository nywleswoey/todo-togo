/**
 * The applied result the capture endpoint returns to the client. Client-safe —
 * the recording UI, draft list, and completion flow all render from this shape.
 */
import type { Candidate, Intent } from "./intent";
import type { Todo } from "./types";

export interface CaptureResponse {
  intent: Intent;
  /** Raw utterance, always present. */
  transcript: string;
  /** capture: the todos that were inserted (shown as drafts on the client). */
  created: Todo[];
  /** command: the gated completion candidates, resolved against open todos. */
  command: {
    action: "complete";
    targetPhrase: string;
    candidates: Candidate[];
  } | null;
}
