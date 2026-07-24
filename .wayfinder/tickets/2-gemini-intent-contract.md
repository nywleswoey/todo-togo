---
id: 2
title: Gemini intent contract — capture-vs-command + completion-matching
type: wayfinder:prototype
state: closed
assignee: this-session
blocked_by: []
---

## Question

Define the structured contract for the **combined audio→intent Gemini Flash call**
(transcription folded in — see closed ticket #5), and how a "command" resolves to a
specific todo.

To resolve (prototype a real Gemini call — audio in, structured JSON out):
- Gemini takes **audio** and returns the transcript **plus** the parsed intent in one
  response. Decide whether the raw transcript is surfaced (it is — stored as
  `source_transcript`, per ticket #1).
- The JSON schema Gemini returns: intent = `capture` | `command`, plus payload.
  For `capture`: one or many todos (split "buy milk and call dentist"), each with
  title + optional due date. For `command`: which action (complete) + a target
  reference.
- **The hard part — which todo?** "mark the milk one done" must map to an existing
  open todo. Decide the matching strategy: does the endpoint pass the current open
  list into the prompt and let Gemini return the matched todo id? Fuzzy string
  match server-side? What happens on ambiguity or no match (reject? pick best?
  ask via UI)?
- Prompt shape + how due-date phrases ("tomorrow") get resolved to absolute dates
  (per ticket #1's storage decision).

Answer records the intent JSON schema, the completion-matching approach, and the
ambiguity/failure behavior. Links the prototype. Blocks ticket #4 (capture UX
depends on what Gemini returns and how confirmation works).

## Resolution

**Combined audio→intent contract** (Gemini Flash returns this JSON in one call):

```jsonc
{
  "intent": "capture" | "command" | "unknown",
  "transcript": "raw utterance verbatim",   // always returned → source_transcript, even on unknown
  "captures": [                             // when intent=capture; split multi-todo utterances
    { "title": "buy milk", "due_date": "2026-07-25" | null }  // date-only, absolute (ticket #1)
  ],
  "command": {                              // when intent=command
    "action": "complete",                   // only voice action in scope (voice scope = capture+complete)
    "target_phrase": "the milk one",        // what the user referred to (debugging handle)
    "candidates": [                         // ranked best-first, MAX 3, [] if nothing matched
      { "id": "<uuid>", "title": "Buy milk", "confidence": "high" | "low" }
    ]
  }
}
```

**Decisions locked:**

- **Completion-matching = LLM-side, not server-side.** The endpoint injects the
  current open-todo list as `{id, title}` pairs into the prompt; Gemini returns the
  matched todo `id`(s) in `candidates`. No server-side fuzzy string matching.
- **Candidates: ranked best-first, capped at top 3.** Enough to disambiguate
  ("the dentist one" vs "call dentist") without a wall of choices.
- **Zero-match is explicit** — Gemini returns `candidates: []` rather than forcing a
  weak best-guess.
- **Ambiguity / failure behavior (B→C, auto-apply never):**
  - `1` candidate, `high` → **confirm sheet** ("Complete *Buy milk*?" ✓/✗) — path B.
  - `>1` candidates, **or any** `low` → **tap-list** of candidates — path C.
  - `candidates: []` → "couldn't find that" (toast / fall back to full open list).
  - Auto-applying a completion is **never** done — completing the wrong todo is the
    one expensive error, always gated behind a tap.
- **One intent per tap (single-intent strict).** `intent` is a single enum; Gemini
  picks the dominant intent for a mixed utterance ("buy milk and mark dentist done"),
  the other half is dropped — user taps again. No compound capture+command confirm UX.
- **`unknown` intent** covers garbled audio / no clear intent; still carries the
  `transcript` so the user sees what was heard and the raw utterance is stored.
- **Prompt shape:** system prompt carries **today's date + server timezone** (resolves
  "tomorrow" → absolute `due_date`, per ticket #1) plus the injected open-todo list for
  matching. Multi-todo capture utterances split into multiple `captures[]` entries.

Contract was resolved as a strawman-and-react prototype (design contract, not runnable
code); no separate prototype asset — the schema above is the artifact. A build-time
smoke test of a real Gemini Flash call against this schema is a build-session concern,
not a blocker for this decision.
