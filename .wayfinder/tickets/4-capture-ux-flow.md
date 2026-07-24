---
id: 4
title: Capture UX flow — push-to-talk screen + confirm-before-save
type: wayfinder:prototype
state: open
assignee:
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
