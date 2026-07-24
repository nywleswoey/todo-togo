---
id: 4
title: Capture UX flow — push-to-talk screen + confirm-before-save
type: wayfinder:prototype
state: closed
assignee: this-session
blocked_by: [2, 5]
---

## Question

What does the capture interaction look and feel like on the phone, end to end?

To resolve (via `/prototype` — a clickable rough of the capture screen):
- The push-to-talk affordance: tap-and-hold vs tap-to-start/auto-stop-on-silence.
  Live feedback while recording (waveform? transcript-as-you-speak?).
- After Gemini returns: **confirm-before-save or auto-save?** Show "You said X →
  2 todos" for a nod, or file silently with an undo? Behavior differs for capture
  vs command (completing the wrong todo is costlier).
- Error/fallback surface — what the user sees when transcription fails or Gemini
  returns no clear intent (informed by tickets #2 and #3).
- Where the list itself sits relative to capture (same screen? sheet?).

Answer records the interaction model + the confirm/auto-save decision. Links the
prototype.

## Resolution

**Verdict: Variant C — "Pending review" (composer + self-confirming draft).** Chosen
by the user after reacting to three structurally-different variants in a clickable
prototype (A confirm-sheet / B auto-save+undo / C pending-review). The confirm-vs-
auto-save tension resolves to a **third path**: capture lands immediately as a
visible *draft*, so it's fast like auto-save but never invisible.

Prototype (all three variants, throwaway): `.wayfinder/prototypes/4-capture-ux/index.html`
(self-contained; `?variant=A|B|C`; Simulate tray fires every intent branch).

**Interaction model locked:**

- **Screen shape** — single screen: the todo list with a persistent **composer bar**
  pinned to the bottom (chat-style). List and capture co-exist; no separate capture
  route or modal. Title "Today".
- **Push-to-talk affordance** — **tap-to-start / auto-stop-on-silence** (confirmed;
  not tap-and-hold), triggered from the mic in the composer bar. Matches the frame
  already in Notes.
- **Live feedback while recording** — full-screen listening overlay: pulsing mic +
  **animated waveform** + **transcript revealed as-you-speak**, then a brief
  "Thinking…" state while the Gemini call returns.
- **Capture behavior (the decision)** — Gemini's `captures[]` land instantly as
  **pending drafts** at the top of the list, styled distinct (dashed border, amber
  "Draft" note). Each draft **self-confirms after a short delay** if untouched, or the
  user can **Keep** (confirm now), **Edit**, or **Discard**. Multi-todo utterances
  produce one draft per capture. No blocking confirm sheet for capture; nothing is
  ever invisible.
- **Command completion — unchanged from ticket #2, and identical across all three
  variants** (completing the wrong todo is the one costly error, so it is *never*
  auto-applied):
  - `1` candidate `high` → **confirm sheet** ("Complete *X*?" ✓/✗).
  - `>1` candidates **or any** `low` → **tap-list** of candidates.
  - `candidates: []` → warning toast "Couldn't find that todo" (+ transcript).
  - Every completion shows an **Undo** toast after it applies.
- **Failure / fallback surface** — `unknown` intent or transcription failure →
  warning toast showing what was heard (or "Didn't catch that") with a **Retry**
  action. Non-blocking; the raw transcript is still surfaced (stored as
  `source_transcript`, per #1).

**Left as build-tune parameters (not design decisions — no ticket):**
- Exact draft self-confirm delay (prototype uses ~4s; tune during build).
- Whether an un-confirmed draft survives an app-close before its delay elapses
  (spec should note: persist drafts as `open` on backgrounding — safest for a
  capture tool). Folded into final spec assembly.
