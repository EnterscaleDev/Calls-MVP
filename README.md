# Calls MVP

A telephone-interview research-operations platform — a vertical slice covering three roles:

- **Admin** — create campaigns, import contacts, send SMS invitations, assign agents, monitor calls and interview scheduling.
- **Agent** — daily call queue, masked click-to-call, live notes, and call disposition.
- **Participant** — token-based consent and self-service booking, no account required.

This is a **mock-data prototype**: all app state lives in a React Context backed by `localStorage` (see [`lib/store.tsx`](lib/store.tsx) and [`lib/mock-data.ts`](lib/mock-data.ts)). There is no real backend, database, or telephony/SMS provider wired up yet — those are isolated behind adapter modules so a real backend can be dropped in later without touching UI code.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app seeds its own mock data on first load — no setup required.

- Admin: `/admin/login` (any password works in the prototype)
- Agent: `/agent/login` (any password works; signing in as an invited agent activates their account)
- Participant: `/participate/[token]` — tokens are generated per-participant in the seed data (see `db.participants` in `localStorage` under the `calls-ops-mock-db-v1` key)

## Structure

- `app/admin/(dashboard)/**` — Admin console: campaigns, people, org-wide call activity, settings, and per-campaign tabs (Overview, Audience, Invitations, Scheduling, Agents, Call Script, Call Activity, Settings)
- `app/agent/**` — Agent daily queue, call workspace, and call history
- `app/participate/[token]/**` — Public participant flow: landing/consent → schedule → confirmation, with decline/reconsider handling
- `lib/store.tsx`, `lib/mock-data.ts`, `lib/selectors.ts` — Mock database, actions, and derived-state selectors standing in for a real backend
- `lib/adapters/**` — Mocked SMS/telephony provider boundaries used by the app today
- `lib/server/**` — Draft **real** telephony provider clients (SendChamp, Africa's Talking) kept isolated behind `server-only` and not wired into the app — see the comments in each file for status. Real credentials are never committed; copy `.env.example` to `.env.local` and fill in your own.

## Privacy & security notes

- Agents never see a participant's raw phone number — calling is masked end-to-end, and the participant's number never travels through a URL.
- Any real provider credentials go in `.env.local` (gitignored) only, never in code or committed files.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · React Context + localStorage mock persistence
