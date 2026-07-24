---
label: wayfinder:map
title: Voice-driven todo PWA — build-ready spec
---

# Voice-driven todo PWA — build-ready spec

## Destination

A build-ready spec for a personal PWA that lets me capture and complete todo
items from my phone by voice. "Done" = every decision below is locked and a
single later agent session can build the app from the spec without further
design calls.

## Notes

- **Domain**: personal single-user voice todo app. Push-to-talk, not always-listening.
- **Frame decided during charting** (not tickets — the fixed scope every session orients to):
  - Surface: **PWA**, Next.js on Vercel.
  - Transcription: **server-side** (`getUserMedia`+`MediaRecorder` upload). ⚠️ On-device Web Speech API ruled out — dead in standalone iOS PWAs (see Decisions). Exact server path is an open decision → *Transcription path (Web Speech is out)*.
  - Transcription + interpretation: **single combined Gemini Flash call** — audio in, transcript + *capture*/*command* intent out (one round-trip; see Decisions).
  - Storage: **Neon Postgres** (own DB, survives device/browser clears).
  - Voice scope: **capture + complete** by voice; edit/delete via tap UI.
  - Auth: **single PIN**, stored server-side, session remembered on phone.
  - Interaction: **push-to-talk** — tap mic, speak, auto-stop on silence. No ambient-noise handling.
  - Reminders: **passive list with due dates** — no push.
- **Skills to consult per session**: `/grilling`, `/domain-modeling`, `/prototype`, `/research`.
- **Tracker**: local-markdown (`.wayfinder/`). Repo not git-initialized — research findings land in `.wayfinder/research/`, not branches.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [Web Speech API iOS Safari viability](tickets/3-web-speech-ios-viability.md) — Web Speech is **non-functional in standalone iOS PWAs** (WebKit bug 225298, fails silently); transcription must be server-side. Findings: `.wayfinder/research/web-speech-ios.md`.
- [Todo data model & states](tickets/1-todo-data-model.md) — single `todos` table; **status enum** (open/done/archived), **date-only** `due_date` resolved at capture time in server timezone, keep `source_transcript`, no priority; sort `due_date ASC NULLS LAST, created_at DESC`.
- [Transcription path (Web Speech is out)](tickets/5-transcription-path.md) — **audio straight to Gemini Flash** (one combined transcribe+parse call, free tier); `MediaRecorder` upload as multipart → inline base64, ~30s cap. Transcription+interpretation now one call → re-scoped #2.
- [Gemini intent contract — capture-vs-command + completion-matching](tickets/2-gemini-intent-contract.md) — one JSON: `intent` (capture/command/unknown, **single-intent per tap**) + `transcript` + `captures[]` + `command.candidates[]`. **Matching is LLM-side**: open-todo `{id,title}` list injected into prompt, Gemini returns matched ids (top 3, `[]` if none). **Failure = B→C**: 1 high → confirm sheet, else tap-list, **never auto-apply**. Prompt carries today+tz for absolute due dates.

## Not yet specified

<!-- in-scope fog; graduates to tickets as the frontier advances -->

- Neon provisioning + environment variable setup (surfaces once the data model is fixed).
- Final spec assembly — collating all resolved decisions into the single hand-off document (terminal step).

## Out of scope

<!-- ruled beyond the destination; never graduates -->

- Always-listening / wake-word activation — much larger build; iOS Safari can't reliably hold a background mic.
- Push notifications for due reminders — iOS PWA Web Push is finicky; revisit as a future effort.
- Full voice CRUD (edit / delete / reschedule by voice) — disambiguation cost outweighs value; tap UI handles these.
- Multi-user / real auth accounts — single-user tool.
