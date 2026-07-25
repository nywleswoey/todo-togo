# 07 — Voice completion flow

**What to build:** Finishing a todo by voice, always in my control. I say "mark the milk one done" and the app finds the matching todo. Because marking the wrong thing done is the one expensive mistake, completion is **always gated behind a tap** — never applied automatically. When one open todo clearly matches, I get a single confirm ("Complete *Buy milk*?") and one tap finishes it. When it's ambiguous or a weak match, I get a short tap-list of candidates so I pick the right one instead of the app guessing. When nothing matches, I get a clear "couldn't find that todo" message. And every completion shows an Undo, so a mistaken tap is one tap to reverse.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `command` intent with 1 candidate at `high` → confirm sheet ("Complete *X*?" ✓/✗); one tap completes.
- [ ] `>1` candidates **or any** `low` confidence → tap-list of the candidates (max 3) to pick from.
- [ ] `candidates: []` → non-blocking warning "Couldn't find that todo".
- [ ] A completion is **never** applied automatically without a tap.
- [ ] Every completion shows an Undo that reverses it in one tap.
