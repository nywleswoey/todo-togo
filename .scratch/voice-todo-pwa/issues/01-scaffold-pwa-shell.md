# 01 — Scaffold + PWA shell

**What to build:** A deployable Next.js app on Vercel that I can add to my iPhone home screen and launch full-screen like a native app. Nothing functional yet — this is the installable, deployable shell every later slice builds on. It connects to my own Neon Postgres database and reads today's server-configured timezone so later date resolution is grounded.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Next.js app builds and deploys to Vercel from `main`.
- [ ] Neon Postgres provisioned; `DATABASE_URL` (pooled connection string) wired; a startup DB reachability check passes on the deployed app.
- [ ] Env vars documented in `.env.example` (the authoritative list) and read from config; placeholders acceptable for the non-DB ones at this stage.
- [ ] Server timezone is a single hardcoded/config value (single-user), available to server code.
- [ ] Web app manifest + Apple touch/meta tags present so iOS "Add to Home Screen" installs it and it launches **standalone** full-screen (no browser chrome).
- [ ] Verified on an actual iPhone: add-to-home-screen → launches full-screen.
