# 04 — Capture API route (the core seam)

**What to build:** The whole server path that turns a spoken clip into an applied result. A client POSTs an audio blob plus the current open-todo list; the server assembles a prompt (today's date + server timezone + the open todos as `{id, title}` pairs), makes a **single** Gemini Flash call that both transcribes and interprets, parses the returned intent JSON, and applies it: `capture` inserts one or more todos, `command` resolves completion candidates (LLM-side matching — the server does no fuzzy string matching), `unknown` stores nothing but returns the transcript. It returns the result the client renders. This is the highest seam in the app and the pattern the rest of the codebase follows — establish it with an endpoint-level integration test that stubs the model and asserts at the HTTP boundary.

**Blocked by:** 02

**Status:** ready-for-agent

Intent contract Gemini returns (one call):

```jsonc
{
  "intent": "capture" | "command" | "unknown",
  "transcript": "raw utterance verbatim",   // always returned → source_transcript, even on unknown
  "captures": [                             // when intent=capture; split multi-todo utterances
    { "title": "buy milk", "due_date": "2026-07-25" | null }  // date-only, absolute
  ],
  "command": {                              // when intent=command
    "action": "complete",                   // only voice action in scope
    "target_phrase": "the milk one",        // debugging handle
    "candidates": [                         // ranked best-first, MAX 3, [] if nothing matched
      { "id": "<uuid>", "title": "Buy milk", "confidence": "high" | "low" }
    ]
  }
}
```

- [ ] `multipart/form-data` POST accepts the audio blob; endpoint forwards it to Gemini as inline base64 audio (no File API).
- [ ] Prompt injects today's date + server timezone and the current open todos as `{id, title}` pairs; relative dates ("tomorrow", "Friday") come back as absolute date-only `due_date`.
- [ ] `capture`: every entry in `captures[]` is inserted as a todo (multi-todo utterances split into separate rows); `source_transcript` set to the raw transcript.
- [ ] `command`: matching is done by Gemini (ids returned in `candidates`, ranked best-first, capped at 3, `[]` when nothing matches); the endpoint does **no** server-side fuzzy matching and does **not** auto-apply a completion.
- [ ] `unknown`: no rows written; `transcript` still returned so the client can show what was heard.
- [ ] `transcript` is always returned and persisted on captured todos.
- [ ] Single-intent-per-tap: the response carries exactly one of capture/command/unknown.
- [ ] Endpoint integration test with **Gemini stubbed**, feeding canned responses covering every branch — multi-capture, single-capture, command high/single, command ambiguous/low, `candidates: []`, `unknown` — asserting DB state and the response the client renders.
- [ ] Build-time verify (not a blocker): confirm Gemini accepts the iOS `audio/mp4`/AAC container directly; if not, transcode at the endpoint or constrain the record format.
