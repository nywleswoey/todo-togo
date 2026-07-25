# 02 — Todos table + tap-managed list

**What to build:** My main screen: the list of what's left to do. Open todos appear sorted with the soonest-due at the top and undated last, each showing its due date. I can complete a todo by tapping its checkbox (it leaves the view), edit a todo's title or date by tap, delete one by tap, and add a simple one by tap so the list is usable without voice. Done and archived todos stay out of this view.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `todos` table migration: `id` uuid PK (default `gen_random_uuid()`), `title` text NOT NULL, `status` text NOT NULL DEFAULT `'open'` with a CHECK constraint over `open | done | archived`, `due_date` date NULL (date-only, no time-of-day), `source_transcript` text NULL, `created_at`/`updated_at` timestamptz NOT NULL DEFAULT `now()`.
- [ ] `updated_at` bumps on any change.
- [ ] Main screen lists only `status = 'open'`, ordered `due_date ASC NULLS LAST, created_at DESC`.
- [ ] Each row shows its due date.
- [ ] Tap a checkbox → todo becomes `done` and leaves the main view.
- [ ] Tap a todo → edit its title and/or due date.
- [ ] Tap → delete a todo.
- [ ] Tap → add a simple todo (title, optional date); `source_transcript` is NULL for tap-created todos.
- [ ] Done and archived todos do not appear in the main view.
