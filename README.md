# FDC Stock Opname

Internal stock-audit tool for FDC Dental Clinic. Vite + React + TypeScript SPA
backed by Supabase (Postgres + Auth + Edge Functions).

See [CLAUDE.md](./CLAUDE.md) for the full project briefing, business logic,
and repository layout. Docs (architecture, environments, deployment, runbook)
live under `docs/` once written.

## Quickstart

```bash
npm install
cp .env.example .env
npm run dev
```

`VITE_DB_SCHEMA` in `.env` selects which Postgres schema (`dev` / `staging` /
`prod`) the app reads and writes — see `docs/ENVIRONMENTS.md`.
