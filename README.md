# Togo

A single-user, voice-driven todo PWA: capture todos by speaking, and close them
out by voice too. Built with Next.js (App Router), Neon Postgres, and Gemini.

## Development

Copy `.env.example` to `.env.local` and fill it in — it is the authoritative
list of the environment variables the app reads, with notes on each. Then apply
the database schema with `npm run migrate` and start the dev server.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint over the repo |
| `npm run typecheck` | `tsc --noEmit` — types only, no emit |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run migrate` | Apply the schema to the `DATABASE_URL` Postgres (idempotent) |

`npm run lint` runs the ESLint CLI against the flat config in
`eslint.config.mjs`, which extends `next/core-web-vitals` and `next/typescript`.
That config replaced `next lint`, which Next 16 removes and which could not run
non-interactively in CI.

## Analytics

`docs/analytics-events.md` is the authoritative reference for the PostHog events
and error-tracking payloads this app sends, including the client, Node server,
and Edge middleware paths. Event and property names are a contract with PostHog
dashboards — change them there and here together.
