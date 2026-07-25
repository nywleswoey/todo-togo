/**
 * The audio→intent contract Gemini returns in a single call, plus a defensive
 * parser that normalizes whatever the model hands back into a known shape.
 * Client-safe (no server-only) — the UI renders from these types too.
 */

export type Intent = "capture" | "command" | "unknown";
export type Confidence = "high" | "low";

export interface Capture {
  title: string;
  /** Date-only, absolute `YYYY-MM-DD`, or null. Resolved by the model. */
  due_date: string | null;
}

export interface Candidate {
  id: string;
  title: string;
  confidence: Confidence;
}

export interface Command {
  action: "complete";
  target_phrase: string;
  /** Ranked best-first, capped at 3, [] when nothing matched. */
  candidates: Candidate[];
}

export interface IntentResult {
  intent: Intent;
  /** Raw utterance, always present (even on unknown). */
  transcript: string;
  captures: Capture[];
  command: Command | null;
}

const MAX_CANDIDATES = 3;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normDueDate(v: unknown): string | null {
  return typeof v === "string" && DATE_RE.test(v) ? v : null;
}

function normCaptures(v: unknown): Capture[] {
  if (!Array.isArray(v)) return [];
  const out: Capture[] = [];
  for (const item of v) {
    const title = asString((item as Capture)?.title).trim();
    if (!title) continue;
    out.push({ title, due_date: normDueDate((item as Capture)?.due_date) });
  }
  return out;
}

function normCandidates(v: unknown): Candidate[] {
  if (!Array.isArray(v)) return [];
  const out: Candidate[] = [];
  for (const item of v) {
    const id = asString((item as Candidate)?.id).trim();
    const title = asString((item as Candidate)?.title).trim();
    if (!id) continue;
    const confidence: Confidence =
      (item as Candidate)?.confidence === "high" ? "high" : "low";
    out.push({ id, title, confidence });
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

/**
 * Coerce raw model output (parsed JSON or a JSON string) into an IntentResult.
 * Anything malformed degrades to `unknown` while preserving the transcript.
 */
export function parseIntent(raw: unknown): IntentResult {
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { intent: "unknown", transcript: "", captures: [], command: null };
    }
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  const transcript = asString(o.transcript);
  const intentRaw = o.intent;
  const intent: Intent =
    intentRaw === "capture" || intentRaw === "command" ? intentRaw : "unknown";

  if (intent === "capture") {
    const captures = normCaptures(o.captures);
    // No usable captures → treat as unknown so nothing empty is written.
    if (captures.length === 0) {
      return { intent: "unknown", transcript, captures: [], command: null };
    }
    return { intent: "capture", transcript, captures, command: null };
  }

  if (intent === "command") {
    const cmd = (o.command ?? {}) as Record<string, unknown>;
    return {
      intent: "command",
      transcript,
      captures: [],
      command: {
        action: "complete",
        target_phrase: asString(cmd.target_phrase),
        candidates: normCandidates(cmd.candidates),
      },
    };
  }

  return { intent: "unknown", transcript, captures: [], command: null };
}
