---
title: Voice-driven todo PWA — build-ready spec
status: ready-for-agent
source: wayfinder map "Voice-driven todo PWA — build-ready spec" (.wayfinder/map.md)
---

# Voice-driven todo PWA — build-ready spec

> Assembled from the resolved decisions on the wayfinder map. Every decision below
> is locked; this document is self-sufficient for a build session. Decision
> provenance is cited as `[ticket #N]` — open `.wayfinder/tickets/` for the full
> reasoning behind any one.

## Problem Statement

I capture todos on my phone, but typing them is friction at exactly the moments a
todo occurs to me — walking, driving, mid-task, one-handed. By the time I'd unlock,
open an app, and type, the thought is either gone or not worth the interruption. I
also want to knock items off the list by voice without hunting for the exact row.
Existing apps either don't do voice capture on iOS reliably, or bury it behind
always-listening setups I don't want.

## Solution

A personal, single-user Progressive Web App I add to my iPhone home screen. One
screen: my list, with a **push-to-talk** mic in a bottom **composer bar**. I tap
the mic, say what I need to do (or say I've finished something), and it lands. A
spoken **capture** turns into one or more todos; a spoken **command** completes an
existing todo. Capture is fast and forgiving — new todos appear immediately as a
visible **draft** that self-confirms — while completing a todo is always gated
behind a tap, because marking the wrong thing done is the one expensive mistake.
Transcription and interpretation happen server-side in a single call, so it works
inside a standalone iOS PWA where on-device speech APIs are dead.

## User Stories

**Capture by voice**

1. As a single user of my todo PWA, I want to tap a mic and speak a task, so that I can capture a todo without typing.
2. As a user, I want recording to start on a tap and stop automatically when I go quiet, so that I don't have to hold a button or hunt for a stop control one-handed.
3. As a user, I want a hard cap on recording length (~30s), so that a forgotten tap doesn't record indefinitely.
4. As a user, I want to see a live waveform and my words appearing as I speak, so that I know it's hearing me.
5. As a user, I want to say "buy milk and call the dentist tomorrow" and get **two** separate todos, so that one utterance can capture several tasks.
6. As a user, I want spoken due dates ("tomorrow", "Friday") resolved to an absolute date at the moment I speak, so that "tomorrow" doesn't drift if I look at it days later.
7. As a user, I want a captured todo to appear immediately as a draft at the top of my list, so that capture feels instant and I can see what was heard.
8. As a user, I want a draft to confirm itself if I do nothing, so that the common case (it got it right) needs zero extra taps.
9. As a user, I want to Keep a draft immediately, so that I can lock it in without waiting.
10. As a user, I want to Edit a draft's title or date, so that I can fix a small mis-parse without re-recording.
11. As a user, I want to Discard a draft, so that a wrong capture never becomes a real todo.
12. As a user, I want the raw transcript kept on a captured todo, so that if a parse looks wrong I can see what I actually said.
13. As a user, I want an un-confirmed draft to survive if I background the app before it self-confirms, so that I never lose a capture to a phone lock.

**Complete by voice**

14. As a user, I want to say "mark the milk one done" and have the app find that todo, so that I can complete items hands-light.
15. As a user, when my spoken command clearly matches one open todo, I want a single confirm ("Complete *Buy milk*?"), so that one tap finishes it and I stay in control.
16. As a user, when my command is ambiguous or a weak match, I want a short tap-list of candidates, so that I pick the right one instead of the app guessing.
17. As a user, when nothing matches what I said, I want a clear "couldn't find that" message, so that I know it didn't silently do the wrong thing.
18. As a user, I never want a completion applied automatically without a tap, so that the wrong todo is never marked done behind my back.
19. As a user, I want an Undo on any completion I just made, so that a mistaken tap is one tap to reverse.

**The list**

20. As a user, I want my open todos on the main screen sorted by due date (soonest first, undated last), so that what's urgent is at the top.
21. As a user, I want done and archived todos out of the main view, so that my list stays about what's left to do.
22. As a user, I want to tap a todo's checkbox to complete it, so that voice isn't the only way to finish an item.
23. As a user, I want to edit or delete a todo by tap, so that I can manage the list without voice for the fiddly cases.
24. As a user, I want a todo to show its due date, so that I can see when things are due at a glance.

**Access & platform**

25. As a user, I want to add the app to my home screen and launch it full-screen, so that it feels like a native app.
26. As a user, I want to unlock the app with a single PIN, so that my todos aren't wide open but I'm not managing an account.
27. As a user, I want my session remembered on my phone, so that I don't re-enter the PIN every time.
28. As a user, I want my todos stored in my own database, so that they survive clearing my browser or switching devices.
29. As a user, when transcription fails or the app can't tell what I meant, I want a non-blocking message with a Retry, so that a bad capture is easy to redo and never corrupts my list.

## Implementation Decisions

### Surface & stack

- **PWA, Next.js on Vercel.** Installable to the iOS home screen, runs standalone. [map Notes]
- **Storage: Neon Postgres** — the app's own database, survives device/browser clears. [map Notes]
- **Single-user.** No multi-user, no account system. [map Notes / Out of scope]

### Data model — single `todos` table [ticket #1]

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK (default `gen_random_uuid()`) | uuid so the client can mint ids for optimistic inserts |
| `title` | `text NOT NULL` | the clean todo text |
| `status` | `text NOT NULL DEFAULT 'open'` | **enum via CHECK**: `open` \| `done` \| `archived`. Voice drives `open`→`done`; tap UI can `archive`. |
| `due_date` | `date NULL` | **date-only**, no time-of-day. Relative phrases resolved to an absolute date at capture time in the app's configured timezone. |
| `source_transcript` | `text NULL` | raw utterance this todo was parsed from; NULL for tap-created todos. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | bump on any change |

- **State model** = status enum (`open`/`done`/`archived`), not a bare boolean. CHECK constraint over a native pg enum (simpler migrations).
- **Due dates** = date-only, resolved to an absolute date at capture time using a **server-configured timezone** (single-user — hardcode, don't detect per request).
- **No priority** field (a `starred` boolean can be added later if ever missed).
- **Default list sort**: `ORDER BY due_date ASC NULLS LAST, created_at DESC`. Main view filters `status = 'open'`; done/archived live behind separate views.

### Transcription path — audio straight to Gemini Flash [ticket #5, #3]

- **On-device Web Speech API is ruled out** — non-functional in standalone iOS PWAs (WebKit bug 225298; fails silently). Transcription **must** be server-side. [ticket #3]
- Phone records via `getUserMedia` + `MediaRecorder` and uploads audio; the server forwards it to **Gemini Flash**, which **transcribes and interprets in a single call**. One provider, one key, one round-trip, stays on the free tier.
- **Record format**: feature-detect `MediaRecorder.isTypeSupported` — iOS Safari → `audio/mp4` (AAC); Chrome/Android → `audio/webm;codecs=opus`. Send what the device produces.
- **Transport**: `multipart/form-data` POST of the audio blob → endpoint forwards to Gemini as **inline base64 audio** (clips are seconds long, under the inline limit; no File API).
- **Length cap**: hard-stop recording at **~30s**, plus push-to-talk silence auto-stop.
- **Build-time verify (not a blocker):** confirm Gemini accepts the iOS `audio/mp4`/AAC container directly; if not, the endpoint transcodes or the record format is constrained.

### Intent contract — combined audio→intent JSON [ticket #2]

Gemini returns this shape in one call. The endpoint injects the current open-todo list as `{id, title}` pairs plus today's date + server timezone into the prompt.

```jsonc
{
  "intent": "capture" | "command" | "unknown",
  "transcript": "raw utterance verbatim",   // always returned → source_transcript, even on unknown
  "captures": [                             // when intent=capture; split multi-todo utterances
    { "title": "buy milk", "due_date": "2026-07-25" | null }  // date-only, absolute
  ],
  "command": {                              // when intent=command
    "action": "complete",                   // only voice action in scope
    "target_phrase": "the milk one",        // what the user referred to (debugging handle)
    "candidates": [                         // ranked best-first, MAX 3, [] if nothing matched
      { "id": "<uuid>", "title": "Buy milk", "confidence": "high" | "low" }
    ]
  }
}
```

- **Completion-matching is LLM-side, not server-side.** Gemini returns matched todo `id`(s) in `candidates`; no server-side fuzzy string matching.
- **Candidates**: ranked best-first, capped at top 3. Zero-match is explicit (`candidates: []`), never a forced weak guess.
- **One intent per tap** (single-intent strict). For a mixed utterance Gemini picks the dominant intent; the user taps again for the other half. No compound capture+command flow.
- **`unknown` intent** covers garbled audio / no clear intent; still carries `transcript` so the user sees what was heard and it's stored.
- **Prompt** carries today's date + server timezone (resolves "tomorrow" → absolute `due_date`) plus the injected open-todo list.

### Capture UX — Variant "pending review" [ticket #4]

Chosen from a 3-variant prototype (`.wayfinder/prototypes/4-capture-ux/`).

- **One screen**: the todo list with a persistent **composer bar** pinned to the bottom (chat-style). List and capture co-exist — no separate capture route or modal.
- **Push-to-talk**: **tap-to-start / auto-stop-on-silence** (not tap-and-hold), from the mic in the composer bar.
- **Live feedback while recording**: full-screen listening overlay — pulsing mic + animated waveform + transcript revealed as-you-speak, then a brief "Thinking…" state while the call returns.
- **Capture behavior**: `captures[]` land instantly as **pending drafts** at the top of the list, styled distinct (dashed, "Draft" note). Each draft **self-confirms after a short delay** if untouched, or the user can **Keep** / **Edit** / **Discard**. One draft per capture. No blocking confirm sheet for capture; nothing is ever invisible.
- **Command completion (gated in every case — never auto-applied):**
  - `1` candidate, `high` → **confirm sheet** ("Complete *X*?" ✓/✗).
  - `>1` candidates **or any** `low` → **tap-list** of candidates.
  - `candidates: []` → warning "Couldn't find that todo".
  - Every completion shows an **Undo** afterward.
- **Failure/fallback**: `unknown` intent or transcription failure → non-blocking warning toast showing what was heard (or "Didn't catch that") with **Retry**. Raw transcript still surfaced.

### Auth

- **Single server-side PIN.** No accounts. Session remembered on the phone so the PIN isn't re-entered each launch. [map Notes]

### Build setup [folded in from map fog — mechanical, no decision]

- **Env vars**: see `.env.example` — it is the authoritative list, with what each one does.
- **Neon provisioning**: create a Neon project, copy the pooled connection string into `DATABASE_URL`, run the `todos` migration.
- **Draft persistence tune** [from ticket #4]: persist un-confirmed capture drafts as `status = 'open'` when the app backgrounds — don't lose a capture to a phone lock. Exact self-confirm delay (~4s in the prototype) is a build-tune parameter.

## Testing Decisions

**What makes a good test here**: assert external behavior at the seam, not
implementation detail. A test names an input at the boundary (an audio upload, an
intent JSON, a PIN) and asserts the observable result (rows written, HTTP status,
what the UI shows) — never internal function calls or component structure.

**Proposed seams — please confirm before build (I want to keep this to one seam if possible):**

1. **Primary seam — the capture API route** (audio blob + open-todo list in → applied result out), with **Gemini stubbed**. This is the highest seam and the ideal single one: it exercises the whole server path — upload handling, prompt assembly, intent parsing, capture insertion, and completion-matching resolution — without a live model. Feed it canned Gemini responses covering every branch of the intent contract: multi-capture, single-capture, command `high`/single, command ambiguous/`low`, `candidates: []`, and `unknown`. Assert DB state and the response the client renders from.
2. **Secondary seam (only if the draft lifecycle proves hard to reason about) — the pending-draft state machine** on the client: draft created → self-confirm on timeout → Keep / Edit / Discard → background-persist. Test as a plain reducer over events (no DOM), the way the prototype modelled it. Prefer folding this into seam #1 if the endpoint can own enough of it.

**Modules tested**: the capture endpoint (seam #1) is the must-test unit. Auth (PIN
gate) gets a thin test: correct PIN opens a session, wrong PIN is rejected.

**Prior art**: none yet — greenfield repo. Establish the endpoint-level integration
test as the pattern the rest of the app follows (stub the external model, assert at
the HTTP boundary).

## Out of Scope

- **Always-listening / wake-word activation** — much larger build; iOS Safari can't reliably hold a background mic.
- **Push notifications for due reminders** — iOS PWA Web Push is finicky; reminders are a passive list with due dates only. Revisit as a future effort.
- **Full voice CRUD** (edit / delete / reschedule *by voice*) — disambiguation cost outweighs value; tap UI handles these. Voice scope is **capture + complete** only.
- **Multi-user / real auth accounts** — single-user tool; a single PIN is the whole auth story.
- **Ambient-noise handling / continuous dictation** — push-to-talk only.

## Further Notes

- The map "Voice-driven todo PWA — build-ready spec" is **decision-complete**: this
  spec assembles ticket #1 (data model), #2 (intent contract), #3 (Web Speech
  ruling), #4 (capture UX + prototype), #5 (transcription path). Zoom any ticket in
  `.wayfinder/tickets/` for the reasoning.
- Two build-time verifications are flagged above and are **not** design blockers:
  Gemini's acceptance of the iOS AAC container [ticket #5], and the draft
  self-confirm delay [ticket #4].
- The prototype at `.wayfinder/prototypes/4-capture-ux/` is a throwaway design
  artifact (all three variants); build the capture UI fresh from the decisions here,
  don't promote prototype code.
