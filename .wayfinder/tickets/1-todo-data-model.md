---
id: 1
title: Todo data model & states
type: wayfinder:grilling
state: closed
assignee: this-session
blocked_by: []
---

## Question

What is the shape of a todo and its lifecycle? Decide the persisted fields and
states so the Neon Postgres schema is fixed.

To resolve (via `/domain-modeling` + `/grilling`):
- Fields: id, title, done/status, due date (nullable), created_at, updated_at —
  and anything else (notes? priority? source-transcript?).
- States: is "done" a boolean, or a status enum (open / done / maybe archived)?
- Due dates: date-only or datetime? How is a spoken "tomorrow" stored — resolved
  to an absolute date at capture time, on which timezone?
- Ordering/sorting the list surfaces (e.g. due-today first).

Answer records the final field list, types, and state model — the schema the
build session writes migrations against. Blocks ticket #2 (the completion-match
needs to know what identifies a todo).

## Resolution

**Single `todos` table:**

| column | type | notes |
|---|---|---|
| `id` | `uuid` PK (default `gen_random_uuid()`) | uuid so the client can mint ids for optimistic inserts |
| `title` | `text NOT NULL` | the clean todo text |
| `status` | `text NOT NULL DEFAULT 'open'` | **enum via CHECK**: `open` \| `done` \| `archived`. Voice drives `open`→`done`; tap UI can `archive`. (CHECK constraint over a native pg enum — simpler migrations.) |
| `due_date` | `date NULL` | **date-only**, no time-of-day. Spoken relative phrases ("tomorrow") resolved to an **absolute date at capture time** in the app's configured timezone. |
| `source_transcript` | `text NULL` | the raw utterance this todo was parsed from; NULL for tap-created todos. Debugging handle for mis-parses. |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | bump on any change (e.g. status → done) |

**Decisions locked:**
- State model = **status enum** (`open`/`done`/`archived`), not a bare boolean.
- Due dates = **date-only**, resolved to absolute date at capture time using a
  **server-configured timezone** (single-user; hardcode, don't detect per-request).
- **No priority** field (add a `starred` boolean later if ever missed).
- Keep **`source_transcript`**.
- **Default list sort**: `ORDER BY due_date ASC NULLS LAST, created_at DESC`.
  Main view filters `status = 'open'`; done/archived live behind separate views.
