# 05 — Recording composer bar + listening overlay

**What to build:** The way I actually speak to the app. A composer bar is pinned to the bottom of my list (chat-style, one screen — no separate capture route). I tap the mic and it starts recording; when I go quiet it stops on its own, and there's a hard cap so a forgotten tap doesn't record forever. While I speak I see a full-screen listening overlay — a pulsing mic, an animated waveform, and my words appearing as I say them — then a brief "Thinking…" state while the server call returns. The clip uploads to the capture endpoint. If transcription fails or it can't tell what I meant, I get a non-blocking toast showing what was heard (or "Didn't catch that") with a Retry — my list is never corrupted by a bad capture.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Persistent bottom composer bar on the list screen with a mic control; no separate capture route or modal.
- [ ] Tap-to-start / auto-stop-on-silence (not tap-and-hold).
- [ ] Hard ~30s recording cap in addition to silence auto-stop.
- [ ] `MediaRecorder` format feature-detected via `isTypeSupported`: iOS Safari → `audio/mp4` (AAC), Chrome/Android → `audio/webm;codecs=opus`; send what the device produces.
- [ ] Full-screen listening overlay: pulsing mic + animated waveform + transcript revealed as-you-speak, then a "Thinking…" state until the call returns.
- [ ] Clip uploads to the capture endpoint (04) and the returned result drives the UI.
- [ ] `unknown` intent or transcription failure → non-blocking warning toast showing what was heard (or "Didn't catch that") with Retry; nothing written to the list.
