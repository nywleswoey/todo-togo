# 06 — Capture drafts lifecycle

**What to build:** Voice capture should feel instant and forgiving. The moment I finish speaking a task, it appears as a draft at the top of my list — styled distinct (dashed, a "Draft" note) so nothing is ever invisible. If I do nothing, the draft confirms itself after a short delay (the common case — it got it right — needs zero taps). If it's off, I can Keep it immediately, Edit its title or date to fix a small mis-parse, or Discard it so a wrong capture never becomes a real todo. One draft per capture. If I background the app before a draft self-confirms, it survives — a phone lock never loses a capture. And the raw transcript stays on the todo so I can see what I actually said if a parse looks wrong.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Each `captures[]` entry lands immediately as a pending draft at the top of the list, styled distinct (dashed + "Draft").
- [ ] A draft self-confirms after a short delay if untouched.
- [ ] Keep → confirm immediately; Edit → change title/date; Discard → draft never becomes a real todo.
- [ ] One draft per capture.
- [ ] Un-confirmed drafts survive backgrounding: persisted as `status = 'open'` when the app backgrounds so a phone lock doesn't lose them.
- [ ] Raw `source_transcript` is retained and viewable on a captured todo.
- [ ] Build-tune: the self-confirm delay (~4s in the prototype) is a tunable parameter.
