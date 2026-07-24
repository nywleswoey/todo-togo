---
id: 2
title: Gemini intent contract — capture-vs-command + completion-matching
type: wayfinder:prototype
state: open
assignee:
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
