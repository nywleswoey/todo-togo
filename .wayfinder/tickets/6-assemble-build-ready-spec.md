---
id: 6
title: Assemble the build-ready spec (handoff)
type: wayfinder:task
state: open
assignee:
blocked_by: [1, 2, 3, 4, 5]
---

## Question

Not a decision — **the terminal step**. Every design decision on this map is now
locked; collate them into the single hand-off document the destination names: a
build-ready spec a later agent session can implement from without further design
calls.

Assemble into `.wayfinder/spec.md` (or wherever the build session expects it),
pulling the resolved decisions verbatim from their tickets:

- **Surface & stack** — PWA, Next.js on Vercel (Notes).
- **Data model** — `todos` table, status enum, date-only `due_date`, sort order,
  `source_transcript` (ticket #1).
- **Transcription path** — `MediaRecorder` → multipart upload → inline base64 →
  single combined Gemini Flash call, ~30s cap (ticket #5).
- **Intent contract** — the combined audio→JSON schema, LLM-side completion
  matching, B→C fallback, one-intent-per-tap, prompt carries today+tz (ticket #2).
- **Web Speech ruling** — server-side transcription is mandatory; Web Speech is
  dead in standalone iOS PWAs (ticket #3, research findings linked).
- **Capture UX** — Variant C: composer bar, tap-to-start/auto-stop, live
  waveform+transcript, pending-draft self-confirm, gated command completion,
  toast+Retry failure surface (ticket #4). Prototype linked.
- **Auth** — single server-side PIN, session remembered (Notes).
- **Scope** — capture + complete by voice; edit/delete via tap (Notes / Out of scope).

Also enumerate, as a **build-setup section** (folded in from fog — mechanical, no
decision left to make):

- Required env vars: `DATABASE_URL` (Neon), `GEMINI_API_KEY`, `APP_PIN`.
- Neon provisioning steps (create project, copy pooled connection string).
- Note the one build-tune param from #4: persist un-confirmed capture drafts as
  `open` on app-background (don't lose a capture).

Done when `spec.md` exists and is self-sufficient for a build session. This is the
handoff — the map is decision-complete; do not open new design questions here.
