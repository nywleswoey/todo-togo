---
id: 3
title: Web Speech API iOS Safari viability & fallback trigger
type: wayfinder:research
state: closed
assignee: research-subagent
blocked_by: []
---

## Question

Does the browser Web Speech API (`SpeechRecognition`) work reliably enough on
iOS Safari (added-to-home-screen PWA) to be the primary transcription path, and
what exactly triggers the server-Whisper fallback?

To resolve (AFK `/research` against primary sources — WebKit docs/bugs, MDN,
caniuse, recent iOS release notes):
- Is `SpeechRecognition` / `webkitSpeechRecognition` supported in iOS Safari and
  in a standalone (home-screen) PWA context specifically? Current iOS version.
- Known failure modes: does it require a network round-trip anyway? Mic-permission
  quirks, re-tap requirements, continuous vs single-shot, silence auto-stop.
- Concrete recommendation: keep Web Speech as primary, or flip the frame decision
  to server-side recording+Whisper? If primary, what's the detect-and-fallback
  condition.

Answer records the support verdict + a clear "primary vs fallback" recommendation.
Findings file: `.wayfinder/research/web-speech-ios.md`. Blocks ticket #4 (capture
UX differs if we record-and-upload vs on-device transcribe).

## Resolution

**Verdict: Web Speech API cannot be the transcription path.** It's exposed on iOS
since 14.5 and works in a Safari *tab*, but WebKit deliberately makes it
non-functional in **standalone home-screen PWAs** (our install target) — WebKit
bug 225298, unfixed through Safari 26.5 (mid-2026). It fails *silently*: feature
detection passes, but `start()` never prompts or returns a result.

**Recommendation**: flip to **server-side transcription** — `getUserMedia` +
`MediaRecorder` works fine in standalone PWAs; upload the audio and transcribe
server-side. This **invalidates the frame's "Browser Web Speech API on-device"
transcription decision**. The replacement path (Whisper vs sending audio directly
to Gemini) is now a fresh, sharp decision → opened as **Transcription path (Web
Speech is out)**.

Findings + exact fallback-detection code: `.wayfinder/research/web-speech-ios.md`.
