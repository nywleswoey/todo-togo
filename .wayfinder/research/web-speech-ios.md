# Web Speech API on iOS Safari — Standalone PWA Viability

**Question:** Can the browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) be the PRIMARY transcription path for a voice todo app running as an added-to-home-screen standalone PWA on iOS? What triggers a server-side Whisper fallback?

**Date:** 2026-07-24 · Current shipping OS: iOS 26.5 / Safari 26.5 (iOS 26 shipped Sept 2025; Apple moved to year-based versioning).

---

## Verdict (one line)

**No — do not make Web Speech API the primary path for a standalone PWA.** The API is exposed (feature detection passes) but **WebKit deliberately does not make it functional in home-screen web apps.** This is a confirmed, still-open WebKit limitation, not a config bug you can work around.

---

## 1. Support status

- `webkitSpeechRecognition` has been present in mobile Safari **since iOS 14.5 (April 2021)** and macOS Safari 14.1. caniuse classes it as **"partial support" from iOS 14.5 through the current 26.5** — it has never graduated to full/Baseline support. MDN flags the API **"Limited availability … not Baseline."**
- It **does work in a normal Safari browser tab** on iOS.
- **It does NOT work in standalone (home-screen) display mode.** This is the decisive fact for todo-togo, whose primary surface is an installed PWA.

### The blocking source

WebKit bug **225298 ("Speech recognition service is not available")** — a WebKit maintainer states directly:

> "SpeechRecognition API is not available in SafariViewController and web apps added to Home Screen for now."

The bug is marked RESOLVED LATER (i.e. deferred, not fixed). Users pinged for a timeline repeatedly from 2022 through 2025 with **no resolution date given**. Safari 26.0 release notes touch SpeechRecognition only to add a secure-context requirement — **no standalone-PWA fix in 26.0 or 26.5.** So the gap is still open as of mid-2026.

This is corroborated by independent reports:
- react-speech-recognition issue **#104**: in an installed PWA, `start()` silently does nothing and **never prompts for mic permission** — yet `navigator.mediaDevices.getUserMedia({audio:true})` in the same PWA **does** prompt and record. So the failure is specific to SpeechRecognition, not to mic access generally.
- Apple Developer Forums thread **748048**: identical report (Vue PWA) — works in Safari, dead once added to Home Screen. No Apple response.
- Multiple dev writeups reach the same conclusion ("Safari on Mobile won't allow Speech Recognition API once installed as PWA"; WebView errors immediately without a mic prompt).

---

## 2. Known failure modes (even in-browser)

Beyond the standalone blocker, the API is quirky on iOS wherever it runs:

- **Server round-trip required.** Safari routes audio to Apple's **server-based** recognition by default → needs network, adds latency, and privacy exposure. MDN confirms server recognition is the default; audio is sent to a web service. A newer on-device path exists in the spec (`SpeechRecognition.available()/install()` + `processLocally:true`, requires downloaded language packs) but it is desktop-oriented, not a reliable iOS-PWA answer, and doesn't rescue the standalone case.
- **System dependency.** Recognition requires **Dictation/Siri enabled** in iOS Settings; if off, it fails.
- **Truncated event model on iOS.** In practice only `start` and `audioend` fire reliably — the full Chromium-style event sequence does not. Timing signals are unreliable.
- **No reliable end-of-speech / silence auto-stop.** iOS won't auto-detect that the user stopped talking; you must run your own silence timeout (a common workaround: `interimResults=true` + ~750 ms no-update timer).
- **`continuous` mode is effectively unusable on iOS** (ever-growing/duplicated results); treat everything as single-shot with re-tap.
- **Requires a user gesture** to start, and mic permission handling is fragile.
- **WKWebView / SafariViewController** (native app webviews) fail immediately — same class of restriction as standalone PWA.

---

## 3. Recommendation

### Flip to server-side audio recording + Whisper as PRIMARY.

Rationale: todo-togo's target surface is an **installed standalone PWA**, which is exactly the context where Web Speech API is non-functional by WebKit's own statement. There is no runtime fix — feature detection even *passes*, so you can't detect the failure cleanly ahead of time; it just silently does nothing. Betting the core "voice → todo" flow on it would ship a broken primary path to your main audience.

Critically, **`getUserMedia` + `MediaRecorder` DO work in standalone iOS PWAs** (confirmed in react-speech-recognition #104; the old standalone-getUserMedia bug 185448 was fixed years ago). So capturing audio and sending it to a server Whisper endpoint is the reliable path *in the exact context where Web Speech fails.*

### Recommended architecture

- **PRIMARY:** `getUserMedia` → `MediaRecorder` → upload blob → server-side Whisper transcription. Works in standalone PWA, browser tab, and Android.
- **OPTIONAL fast/free path (progressive enhancement only):** use Web Speech API **only when it is genuinely usable** — i.e. running in a real Safari tab, not standalone — and always keep Whisper as the safety net.

### Precise detect-and-fallback condition

Use Web Speech ONLY if all of these hold; otherwise go straight to Whisper:

```js
const hasAPI = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

const isStandalone =
  window.navigator.standalone === true ||                     // iOS-specific flag
  window.matchMedia('(display-mode: standalone)').matches;    // installed PWA

const isIOS = /iP(hone|ad|od)/.test(navigator.platform) ||
  (navigator.userAgent.includes('Mac') && 'ontouchend' in document);

// Web Speech is only worth attempting on iOS when NOT standalone.
const tryWebSpeech = hasAPI && !(isIOS && isStandalone);
```

**Runtime failure signals that must trigger the Whisper fallback** (because standalone fails silently and other paths fail late):

1. `onerror` fires with `not-allowed`, `service-not-allowed`, `service-not-available`, `language-not-supported`, or `network`.
2. **Silent no-op guard:** after `.start()`, if no `result` (or `speechstart`/`audiostart`) event within ~1.5–2 s, abort and fall back. This is the key catch for the standalone silent-failure case.
3. `audioend`/`end` fires with zero recognized text.
4. `onerror` = `no-speech` after a real utterance (unreliable capture).

**Implementation tip:** since `MediaRecorder` capture is needed for Whisper anyway, **record audio in parallel whenever you attempt Web Speech.** If any fallback signal fires, you already have the audio buffer to POST to Whisper — no second tap, no lost utterance.

---

## Sources

Primary (WebKit / Apple / spec / MDN / caniuse):
- WebKit Bugzilla #225298 — "Speech recognition service is not available" (maintainer: not available in SafariViewController / Home Screen web apps): https://bugs.webkit.org/show_bug.cgi?id=225298
- WebKit Bugzilla #185448 — getUserMedia in standalone home-screen apps (since-fixed): https://bugs.webkit.org/show_bug.cgi?id=185448
- WebKit blog — Features in Safari 26.0 (SpeechRecognition secure-context fix only; no standalone fix): https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Apple Developer Forums #748048 — webkitSpeechRecognition dead in installed PWA: https://developer.apple.com/forums/thread/748048
- Apple Developer Forums #775699 — interimResults behavior on iOS: https://developer.apple.com/forums/thread/775699
- MDN — SpeechRecognition (limited availability; server-based by default): https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- MDN — `SpeechRecognition.available()` / `install()` / `processLocally` (on-device path): https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static
- WebAudio/web-speech-api — on-device speech recognition explainer: https://github.com/WebAudio/web-speech-api/blob/main/explainers/on-device-speech-recognition.md
- caniuse — Speech Recognition API (iOS 14.5+ partial through 26.5): https://caniuse.com/speech-recognition

Reputable dev reports:
- react-speech-recognition issue #104 — standalone PWA: no mic prompt, but getUserMedia works: https://github.com/JamesBrill/react-speech-recognition/issues/104
- webreflection, "Taming the Web Speech API" — iOS event model, no silence auto-stop, continuous unusable, PWA/WebView breakage: https://webreflection.medium.com/taming-the-web-speech-api-ef64f5a245e1
- firt.dev — iOS PWA compatibility notes: https://firt.dev/notes/pwa-ios/
