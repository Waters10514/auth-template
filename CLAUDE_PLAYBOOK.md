# Waters Fleet Full-Stack Standard — Claude Code Playbook

When a user asks you to **start a new project for this fleet, or audit /
bring an existing one into line**, follow these phases in order. Do NOT
start writing any files until the confirmation gate in Phase 3.

This standard documents the **already-dominant fleet stack**. It is a
written convention, not new tooling. The guiding rule for every decision
below: **prefer the simplest change that fits what the repo already does.
Do not introduce a new framework, abstraction, or dependency unless it is
strictly necessary.**

---

## Phase 1 — Discover what you already know

Read the following from the project itself (do not ask the user):

1. **Project name** — `package.json` → `name`. Normalize: lowercase,
   spaces/hyphens → underscores. This is the `APP_NAME`, the
   `allowed_apps` slug, and the table prefix root.
2. **Framework & version** — Next.js version, App Router vs Pages,
   TypeScript `strict`, Tailwind major version.
3. **Project structure** — `src/` vs root `app/`+`lib/`; path alias in
   `tsconfig.json`.
4. **Data access** — `@supabase/supabase-js`, `@supabase/ssr`, or an ORM
   (Drizzle/Prisma) + a non-Supabase datastore.
5. **Auth** — is `session.ts` + `app_access` present (Waters 2FA), or
   NextAuth / jose / Supabase Auth / other.
6. **Env files** — `.env.example`, `.env.local.example`, or none.
7. **CI** — `.github/workflows/*`.

---

## Phase 2 — Ask the user for what you cannot determine

Ask all of these in a single numbered message:

```
Before I apply the fleet standard I need a few details:

1. Is this a NEW project or an AUDIT of an existing one?

2. Does it need authentication? (If yes, the Waters 2FA scheme is
   mandatory — see Phase 4d.)

3. Does it need scheduled jobs (cron)?

4. Does it have, or need, a Python backend?

5. Which shared Supabase project should it use, and what table prefix?
   (e.g. project "core", prefix "sp_")
```

Wait for the answers before proceeding.

---

## Phase 3 — Confirm your plan before acting

Summarise and get a single yes:

```
Here is what I will apply (smallest change that fits this repo):

- App name / slug:      [from package.json]
- Pinned Next.js:       [target pinned version]
- Layout:               [keep existing / note src/ as target]
- Data access:          Supabase SDK via @supabase/ssr
- Supabase project:     [name] / table prefix [prefix_]
- Auth:                 [Waters 2FA per CLAUDE_SETUP.md / none]
- Env:                  .env.example + canonical names + boot assert
- CI:                   .github/workflows/ci.yml (copied template)
- Tests:                [keep existing runner / none added]
- Tier 2 rewrites:      [listed, DEFERRED — not done now]

Shall I proceed?
```

Only continue after the user says yes.

---

## Phase 4 — Implement the canonical stack

Apply only what is missing. Never rewrite something that already
conforms. Never migrate a working auth/data stack as part of this phase
(that is Tier 2 — see `REVISED_STANDARDS.md`).

### 4a — Framework

- Next.js **App Router**, version **pinned** (exact, no `^`) to the
  fleet target. React `strict`.
- New projects: `src/` layout with `@/*` → `src/*` in `tsconfig.json`.
- Existing root-`app/` repos: **leave the layout as-is** — relocation
  is an optional Tier 2 item, not part of conformance.

### 4b — Language

- TypeScript `strict: true`. Shared `tsconfig` baseline. Do not loosen
  an already-strict config.

### 4c — Data access + Supabase project / cost model

- Supabase via **`@supabase/ssr`** browser + server client factories.
  A server-only **service-role** client (`src/lib/supabase/service.ts`)
  for `app_access`.
- **No ORM.** Drizzle / Prisma and non-Supabase datastores (Neon) are
  disallowed for new work.
- **Shared-project cost contract** (codifying existing practice):
  - A small fixed set of shared Supabase projects.
  - **Mandatory per-app table prefix**; **RLS on every app table**.
  - The shared `app_access` table for auth/SSO (service-role only).
  - **No cross-app foreign keys**; per-app migration directory under
    `supabase/migrations/`.
  - Maintain a **project → app registry** (see `REVISED_STANDARDS.md`).
  - **Graduate to a dedicated project** only when an app handles
    sensitive/regulated data or needs independent backup/scaling.

### 4d — Auth

If the project needs auth, **defer entirely to `CLAUDE_SETUP.md` in
this repo** — Waters 2FA, the shared `app_access` table, `allowed_apps`
gating, `session.ts`, middleware. Do not invent or substitute another
scheme. **NextAuth, jose, Supabase Auth, Clerk, Auth.js are
disallowed.** `src/lib/session.ts` in this repo is the **single source
of truth**: copy it verbatim and change only `COOKIE_NAME` /
`PREAUTH_COOKIE_NAME`. Re-copy it (not hand-patch) whenever the auth
logic changes upstream.

### 4e — Styling

- **Tailwind v4** (`@tailwindcss/postcss`) — already universal; keep it.
- Component library: **shadcn/ui is the recommended choice _only when a
  project introduces a component library_.** A repo with no component
  library is **not** required to adopt one — preserve the existing
  pattern. `lucide-react` pinned when used.

### 4f — Env / secrets

- Commit a **`.env.example`** (exactly that filename) listing every
  required variable with placeholder values, no secrets.
- **Canonical names:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SESSION_SECRET` (unique per project), plus app-specific keys.
- **Runtime validation** = a tiny plain-TS assert-on-boot module
  (≈ no new dependency):

```typescript
// src/lib/env.ts — import once from server entry/layout
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET'] as const
for (const k of REQUIRED) {
  if (!process.env[k]) throw new Error(`Missing required env var: ${k}`)
}
export const env = {
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SESSION_SECRET: process.env.SESSION_SECRET!,
}
```

  Use `zod` for this **only if the repo already depends on `zod`**. Do
  not add `zod` just for env validation. This is recommended, not a
  hard gate.

### 4g — Deployment

- **Vercel** for the frontend. Crons via `vercel.json` with a
  documented **`CRON_SECRET`** guard on the cron route.
- A Python backend uses the existing **Docker** pattern
  (`investor_autopilot` style) **only when one already exists** — do
  not add a backend that is not needed.

### 4h — CI / testing

Add `.github/workflows/ci.yml`, **derived from the existing, working
`investor_autopilot` workflow** (do not invent a new one). For a
single-package Next.js repo:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
```

- `npm ci` + `npm run build` is the non-negotiable core (matches the
  proven investor_autopilot job). `lint` and `tsc --noEmit` are the
  additive improvements.
- **Keep each repo's existing test runner** (race-days = Vitest,
  vacation-rentals = Jest). Do **not** migrate runners. Add a
  `npm test` step only if a runner already exists. A single smoke test
  is recommended, not required.

---

## Phase 5 — Verify & hand off

Run and report:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Then give the user this checklist:

```
Done. Conformance applied (smallest-change basis):

- [ ] Next.js version pinned
- [ ] Supabase via @supabase/ssr (+ service client if auth)
- [ ] Auth = Waters 2FA per CLAUDE_SETUP.md (if applicable)
- [ ] .env.example committed + canonical names + boot assert
- [ ] .github/workflows/ci.yml present and green
- [ ] Existing test runner left intact
- [ ] Tier 2 rewrites listed and DEFERRED (see REVISED_STANDARDS.md)
```

---

## Notes for Claude

- Do not invent a different stack. This is the established fleet pattern.
- Prefer the **smallest change that fits the repo's existing patterns**.
  A bug-free conforming file is not to be rewritten.
- Do not add a fleet-wide dependency. `zod`, Prettier, and shadcn/ui are
  **recommended where they already fit**, never mandated.
- Never copy-paste `session.ts` without re-fetching the latest from this
  repo — it is the single source of truth; only the two cookie-name
  constants are project-local.
- Pin versions exactly (no `^`/`~`) for Next.js and Supabase.
- RLS on by default for every app table; the shared `app_access` table
  is service-role-only.
- Never put secrets in the client bundle; `SESSION_SECRET` is unique
  per project.
- Big migrations (NextAuth→Waters, Drizzle/Neon→Supabase, jose→Waters,
  layout relocation, fleet shadcn) are **Tier 2 — deferred and
  optional**. Never perform them as part of routine conformance; they
  gate nothing. See `REVISED_STANDARDS.md`.
