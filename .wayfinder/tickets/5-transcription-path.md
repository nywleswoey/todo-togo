---
id: 5
title: Transcription path (Web Speech is out)
type: wayfinder:grilling
state: closed
assignee: this-session
blocked_by: []
---

## Question

Web Speech API is dead in standalone iOS PWAs (see closed ticket #3), so
transcription must be **server-side**: `getUserMedia` + `MediaRecorder` on the
phone uploads audio to the backend. Which server-side path do we spec?

To resolve:
- **A — Audio straight to Gemini Flash.** Gemini accepts audio input and can
  transcribe *and* return structured capture/command intent in ONE call. Stays on
  the free tier we already chose; collapses transcription + interpretation into a
  single step (overlaps ticket #2). Downside: transcription quality tied to Gemini.
- **B — Whisper for transcription, then Gemini for parsing.** Two calls. Whisper
  is very accurate for speech; but adds a second provider/key and Whisper isn't
  free (OpenAI API is paid; self-hosting is heavy).
- Decide, and note the audio format/upload mechanics (MediaRecorder mime type,
  size limits) the build session needs.

Answer records the chosen path + upload mechanics. If A, it partly settles ticket
#2's contract (one combined call). Blocks ticket #4 (capture UX differs by path).

## Resolution

**Chosen: A — audio straight to Gemini Flash.** One call transcribes *and* returns
structured capture/command intent. Honors the free-tier decision, one provider/key,
one round-trip. Whisper (option B) rejected: OpenAI API is paid (breaks the free
constraint) and adds a second provider + latency for accuracy we don't need.

**Consequence:** the "transcription" and "interpretation" steps are now a **single
combined audio→intent call**. Ticket #2 (*Gemini intent contract*) is re-scoped to
define that combined call's output contract (transcript folded in), not a separate
text-parse step.

**Upload mechanics (spec defaults):**
- **Record format**: feature-detect `MediaRecorder.isTypeSupported` — iOS Safari →
  `audio/mp4` (AAC); Chrome/Android → `audio/webm;codecs=opus`. Send what the device produces.
- **Transport**: `multipart/form-data` POST of the audio blob → endpoint forwards to
  Gemini as **inline base64 audio** (clips are seconds long, under the inline limit;
  no File API).
- **Length cap**: hard-stop recording at **~30s**, plus push-to-talk silence auto-stop.

**Build-time verify (not a blocker):** confirm Gemini accepts the iOS `audio/mp4`/AAC
container directly; if not, endpoint transcodes or the record format is constrained.
