# 03 — PIN gate + remembered session

**What to build:** My todos aren't wide open, but I'm not managing an account either. I unlock the app with a single PIN. Once I've unlocked it, my session is remembered on my phone so I don't re-enter the PIN every launch. A wrong PIN is rejected.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] App content sits behind a PIN gate; unauthenticated access is blocked server-side.
- [ ] Correct PIN (matching `APP_PIN`) opens a session; wrong PIN is rejected with a clear message.
- [ ] PIN is checked server-side (never shipped to the client).
- [ ] Session is remembered on-device (persistent cookie) so relaunching the standalone PWA doesn't re-prompt.
- [ ] Thin auth test: correct PIN opens a session; wrong PIN is rejected.
