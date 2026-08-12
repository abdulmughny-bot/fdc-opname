# FDC Stock Opname — Project Briefing for Claude Code

You are setting up a production-grade rewrite of an internal stock-audit tool for
FDC Dental Clinic. A working prototype already exists as a single `index.html`
(vanilla JS + Supabase) plus validated SQL. Your job is to restructure it into a
proper **Vite + React + TypeScript** project with dev/staging/prod environments,
Git, and documentation — WITHOUT changing the business logic or the database
contract that already works.

## Golden rules
1. **Do not invent new business logic.** The behavior is already decided (below).
   Port it faithfully from the reference `index.html` and the SQL files.
2. **The SQL is authoritative and already validated.** `schema_v4.sql` +
   `admin_patch.sql` define the database. Do not redesign the schema. Generate
   the TypeScript types FROM this schema.
3. **Work in small commits.** Scaffold, then port feature-by-feature (auth →
   dashboard → wizard → admin), committing after each so progress is reviewable.
4. **Ask me before any destructive or irreversible action** (force pushes,
   deleting files you didn't create, running migrations against a real DB).

## Target stack (already decided — don't re-litigate)
- **Vite + React 18 + TypeScript** (SPA; Supabase is the backend, no SSR).
- **Supabase** (Postgres + Auth + Edge Functions) — ONE project, with `dev`,
  `staging`, `prod` **Postgres schemas** for environment separation.
  - KNOWN LIMITATION to document, not fix: Supabase Auth (`auth` schema) is
    shared across all three; only the data schemas are separated. A per-env
    `VITE_DB_SCHEMA` selects which schema the client reads/writes.
- **Resend** for report email (via a Supabase Edge Function that holds the key).
- **Vercel** for hosting, one project with a Preview (staging) and Production env.
- **Tailwind** for styling (port the existing design tokens — see below).

## Repository layout to create
```
fdc-opname/
  README.md                      # top-level: what this is, quickstart
  CLAUDE.md                      # this file (keep it)
  package.json
  tsconfig.json
  vite.config.ts
  tailwind.config.js
  postcss.config.js
  .env.example                   # documents every env var; NO real values
  .gitignore                     # must ignore .env*, node_modules, dist
  index.html                     # Vite entry (tiny; not the old monolith)
  src/
    main.tsx
    App.tsx
    lib/
      supabase.ts                # createClient using env vars + schema selection
      api.ts                     # typed wrappers around the RPC functions
      period.ts                  # GMT+8 month/quarter helpers (mirror SQL)
    types/
      database.ts                # generated from schema_v4.sql
    features/
      auth/                      # login flow (port the robust version)
      dashboard/                 # sessions list + filters + ketersesuaian
      wizard/                    # audit-type → clinic → sistem upload → hub → log → report
      admin/                     # people/access, recipients, email template
    styles/
      tokens.css                 # the design tokens below
  supabase/
    migrations/
      0001_schema.sql            # = schema_v4.sql content
      0002_admin.sql             # = admin_patch.sql content
    functions/
      send-report/index.ts       # port existing edge function
  docs/
    ARCHITECTURE.md
    ENVIRONMENTS.md              # dev/staging/prod, schema separation, the Auth caveat
    DEPLOYMENT.md                # step-by-step deploy per environment
    RUNBOOK.md                   # common ops: add user, new clinic, rotate keys
  .github/workflows/
    ci.yml                       # typecheck + build on push/PR
    deploy.yml                   # deploy staging on main, prod on tag/release
```

## Environment model (document precisely in docs/ENVIRONMENTS.md)
- Three Postgres schemas in ONE Supabase project: `dev`, `staging`, `prod`.
- Env vars per environment:
  - `VITE_SUPABASE_URL` (same for all three — one project)
  - `VITE_SUPABASE_ANON_KEY` (same for all three)
  - `VITE_DB_SCHEMA` = `dev` | `staging` | `prod` (THE differentiator)
- The Supabase JS client is created with `{ db: { schema: import.meta.env.VITE_DB_SCHEMA } }`.
- Migrations are applied to each schema in turn (a script in `scripts/` should
  take a schema name and run the migration SQL against it). Document that the
  same SQL must be run per-schema.
- Local dev → `dev` schema; Vercel Preview → `staging`; Vercel Production → `prod`.
- CALL OUT the shared-Auth limitation and its mitigation (schema scoping means a
  staging login still can't read prod rows because the client only ever queries
  its configured schema).

## Business logic to preserve EXACTLY (from the current build)
- **Auth:** Google OAuth, domain hint `fdcdentalclinic.co.id`. An `allowed_users`
  allow-list gates who gets a profile; deactivated users lose access. Login must
  use `onAuthStateChange` as the single source of truth (NOT an eager
  getSession) — this fixed an intermittent stuck-login bug; keep that design.
  Distinguish "not provisioned" (sign out) from a transient error (retry 3x, then
  show a Try-Again button). Three visible states: loading / error+retry / success.
- **Roles & scope:** roles `Lead` / `Team`. Visibility is a separate per-user
  clinic scope (`user_clinic_access`), with an `all_clinics` flag (Leads). Delete
  rights follow the same scope. Admin area is Lead-only.
- **Audit flow (wizard):** choose audit type (Offline = audit fills Kartu+Fisik on
  site; Self = clinic fills a template, audit uploads it) → choose clinic → pick
  station(s) (one upload = one station; GBK-style file is a station export) →
  upload Qty Sistem (parses `Kode Barang`/`Nama Item`/`Satuan Besar`; leading
  number = qty, rest = unit; normalize unit spellings; flag fractionals; reject
  duplicate SKUs) → station hub (clinic progress X/Y dentals; per-dental fill %)
  → line log → finish → report.
- **Two-column merge upload:** a Sistem upload writes ONLY `qty_sistem`; a clinic
  template upload writes ONLY `qty_kartu`/`qty_fisik`. Neither wipes the other.
  Upload always wins on its own columns; show a general diff-confirm popup.
  Mid-log re-upload allowed with the same confirm.
- **Scoring / Ketersesuaian:** a line counts ONLY when BOTH `qty_sistem` and
  `qty_fisik` are present. Green when `qty_fisik == qty_sistem` exactly, red on
  selisih. `qty_kartu` is recorded but does NOT affect color or score. NEVER
  autofill or zero-fill blanks. Only SKUs present in an upload get prefilled.
- **Submit gate:** a station needs >= 80% of its rows to have BOTH sistem and
  fisik present before it can submit. Re-checked server-side (in the RPC).
- **Editable after submit:** reopening a submitted station is allowed, sets an
  `amended` flag, is logged, and recomputes Ketersesuaian on resubmit.
- **Soft delete:** sessions AND stations soft-delete (hidden + uncounted, but the
  deletion is logged and reversible). Stations can be restored/added mid-session.
- **Decimals:** all qty fields accept decimals.
- **Periods:** derived from timestamps in GMT+8 (Asia/Singapore). Month =
  calendar month; Quarter = Q1 Jan–Mar … Q4 Oct–Dec. No periods table.
- **Filters (dashboard AND home session list):** period/date, clinic (multi),
  status (Active/Finished/In Progress), audit type, agent. Home list defaults to
  the CURRENT period on load. Soft-deleted hidden by default.
- **Reports:** PDF generated client-side (jsPDF). Email sent via the
  `send-report` Edge Function (holds the Resend key). Recipients default from
  `clinic_recipients` (multiple, editable), still editable at send time.
- **Admin area (Lead-only), three tabs:** People & Access (add/edit person, role,
  clinic scope with an "All clinics" toggle that greys out the per-clinic grid;
  deactivate/reactivate; anti-lockout: can't deactivate self or drop own Lead
  role), Clinic Recipients, Email Template (with live preview; placeholders
  `{clinic}` `{audit_type}` `{period}` `{ketersesuaian}`). All admin ops go
  through the `admin_*` RPCs which enforce Lead-only server-side.

## Design tokens (port into styles/tokens.css and Tailwind theme)
```
--bg:#F6F6F3; --paper:#FFFFFF; --ink:#1B231F; --ink-soft:#5B655F; --line:#DDDFD8;
--teal:#1F6F64; --teal-deep:#134D45; --teal-wash:#E4F0EC;
--rust:#B3401F; --rust-wash:#FBE9E2; --amber:#B8862E; --amber-wash:#FBF1DE;
```
Fonts: Space Grotesk (display), IBM Plex Sans (body), IBM Plex Mono (mono/numbers).
Match the existing look: soft off-white bg, teal primary, rounded cards with a
subtle shadow, mono for SKU codes and quantities.

## How to proceed (do these in order, committing after each)
1. Scaffold the Vite+React+TS project, Tailwind, the folder layout, `.env.example`,
   `.gitignore`. Commit: "chore: scaffold project".
2. Copy the two SQL files into `supabase/migrations/` and the edge function.
   Generate `src/types/database.ts` from `schema_v4.sql`. Commit.
3. Build `lib/supabase.ts` (schema-aware client) + `lib/api.ts` (typed RPC
   wrappers) + `lib/period.ts`. Commit.
4. Port the robust auth flow into `features/auth/`. Commit.
5. Port dashboard (+ filters), then wizard, then admin — a commit each.
6. Write the docs (ARCHITECTURE, ENVIRONMENTS, DEPLOYMENT, RUNBOOK) and the CI
   workflows. Commit.
7. STOP and give me: the exact local run commands, and the exact steps to create
   the GitHub repo and the Vercel project with the three env configurations.
   Do NOT create remote repos or deploy without me — just give me the commands.

The reference `index.html` (the working prototype to port from) and the two SQL
files are included alongside this briefing. Treat the SQL as the source of truth
for data shape; treat the HTML as the source of truth for behavior and design.
