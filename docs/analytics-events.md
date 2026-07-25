# Analytics event reference

Authoritative list of the PostHog events Togo sends. Event names and property
keys are a contract with PostHog dashboards and insights: renaming one here
silently breaks every chart built on it, because nothing fails at build time.
Change a name or a property only together with the dashboards that read it, and
update this file in the same change.

Configuration lives in `.env.example` (`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`,
`NEXT_PUBLIC_POSTHOG_HOST`). With no token set, both the client and the server
no-op.

Togo is single-user, so every event — client and server — is attributed to the
distinct id `togo_user`.

## Client events

Sent from the browser with `posthog-js`, initialized in `src/app/providers.tsx`.
Pageviews and `$exception` are captured automatically (`defaults: "2026-01-30"`,
`capture_exceptions: true`); `posthog.captureException` is also called
explicitly on the fetch/recorder failure paths in `src/components/TodoScreen.tsx`
and `src/app/login/page.tsx`, and in `src/app/global-error.tsx` for errors that
escape the root layout (which `capture_exceptions` can't reach).

| Event | Properties | Fired when |
| --- | --- | --- |
| `login_failed` | `reason` — server error string, else `"Incorrect PIN"` | PIN submitted and rejected |
| `draft_kept` | — | A pending capture draft is kept (explicitly or by self-confirm) |
| `draft_discarded` | — | A pending capture draft is discarded |
| `todo_edited` | `has_due_date` (bool) | A todo's title/due date is saved from the tap UI |
| `voice_recording_started` | — | Mic tapped, recording begins |
| `voice_capture_succeeded` | `intent: "capture"`, `todos_created` (number) | Voice capture created todos |
| `voice_capture_succeeded` | `intent: "command"`, `match_kind: "confirm" \| "list"` | Voice command matched an open todo (see `src/lib/completion.ts`) |
| `voice_capture_failed` | `reason: "upload_error" \| "recorder_error" \| "mic_unavailable" \| "no_match" \| "no_intent"` | Any voice path that ends without a todo change |

`posthog.identify("togo_user")` is called on successful login.

## Server events

Sent from route handlers via `captureServerEvent` in `src/lib/posthog-server.ts`,
which defers the send until after the response (see the doc comment there).

| Event | Properties | Route |
| --- | --- | --- |
| `user_logged_in` | — | `POST /api/auth` (correct PIN) |
| `todo_created` | `method: "text"`, `has_due_date` (bool) | `POST /api/todos` |
| `todo_status_changed` | `status` (`open` \| `done` \| `archived`), `has_due_date` (bool) | `PATCH /api/todos/:id` |
| `todo_deleted` | — | `DELETE /api/todos/:id` |
| `voice_capture_processed` | `intent` (`capture` \| `command` \| `unknown`), `todos_created` (number) | `POST /api/capture` |

### Server error tracking

Uncaught server errors (route handlers, Server Components) are reported to
PostHog error tracking as `$exception` via Next.js's `onRequestError` hook in
`src/instrumentation.ts`, which calls `captureServerException`
(`src/lib/posthog-server.ts`). Properties: `path`, `method`, `router_kind`,
`route_type`. Handled operational failures — e.g. a Gemini transcription error
turned into a 502 by `POST /api/capture` — are deliberately *not* reported;
error tracking is for what escapes, not for expected outcomes.

---

`voice_capture_processed` is the server's view of every capture request;
`voice_capture_succeeded` / `voice_capture_failed` are the client's view of what
the user actually saw. They are deliberately separate — they diverge when the
response never reaches the browser.

`src/app/api/analytics.test.ts` asserts the server payloads against a fake
ingestion endpoint, so it is the regression test for that half of this table.
