# Fleet Consistency Report

_Audit of the personal web-project fleet under `Waters10514`. Generated as
a point-in-time snapshot to anchor the fleet standard (`CLAUDE_PLAYBOOK.md`)
and the port plan (`REVISED_STANDARDS.md`)._

## Scope

This report covers the **8 repositories** reachable for analysis:

`sport_picker` · `race-days-and-ipas` · `my_ai_assistant` ·
`career_insights_web` · `vacation-rentals` · `investor_autopilot` ·
`cardvault-web` · `auth-template`

> **Scope note (8 vs 10):** the fleet is sometimes referred to as ~10
> projects. Only these 8 were in scope for this pass. If two more repos
> exist (e.g. archived or private-outside-scope), they were **not**
> audited and are not represented in the matrix below. Re-run the audit
> with the full list to close that gap.

## How to read the matrix

Rows are the critical design elements. Columns are the proposed
**STANDARD** followed by the 8 repos. Cell legend:

- **🔴 = RED / EXCEPTION** — deviates from the STANDARD or from
  best practice. (GitHub Markdown strips inline `color:red`, so the
  agreed convention is the 🔴 marker = "red text".)
- `✓` = matches the STANDARD.
- `—` = not applicable.

Repo codes: **AT** auth-template · **CIW** career_insights_web ·
**CV** cardvault-web · **SP** sport_picker · **RDI** race-days-and-ipas ·
**MAA** my_ai_assistant · **VR** vacation-rentals ·
**IA** investor_autopilot.

## Design-element × repo matrix

| Design element | STANDARD (gold / lowest-cost) | AT | CIW | CV | SP | RDI | MAA | VR | IA |
|---|---|---|---|---|---|---|---|---|---|
| Next.js version | Pin one (16.2.4) | —tmpl | ✓ | 🔴16.2.2 | ✓ | 🔴16.1.6 | 🔴16.0.0 | 🔴16.1.6 | 🔴16.2.3 |
| Router | App Router | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| TS strict | strict on | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Layout / alias | `src/` + `@→src` | ✓ | ✓ | ✓ | ✓ | 🔴root | ✓ | 🔴root | ✓mono |
| Data access | Supabase SDK, no ORM | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 🔴Drizzle+Neon | ✓ |
| Supabase project model | Shared projects OK + prefix+RLS | ✓ | ✓ | ✓ | ✓sp_ | 🔴prefix unclear | ✓ai_ | 🔴Neon (not Supabase) | ✓ |
| `@supabase/ssr` | Required | —svc | ✓ | ✓ | 🔴bare | 🔴bare | 🔴bare | 🔴n/a | 🔴bare |
| Auth scheme | Waters 2FA (auth-template) | ref | ✓ | ✓+roles | ✓ | 🔴NextAuth | ✓ | 🔴jose | 🔴mixed |
| `session.ts` | Single synced source | canon | 🔴copy | 🔴copy | 🔴copy | 🔴none | 🔴copy | 🔴jose | 🔴custom |
| Middleware | Present | ✓ | ✓ | ✓+roles | ✓ | 🔴 | ✓ | ✓ | ✓ |
| Tailwind v4 | v4 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Component lib | shadcn/ui (when one is used) | — | ✓ | 🔴Radix | 🔴none | 🔴none | 🔴none | 🔴none | 🔴none |
| lucide-react | Pinned latest | — | ✓ | ✓~ | ✓ | — | 🔴v0.460 | — | — |
| Env file | `.env.example` committed | doc | 🔴none | 🔴none | ✓ | 🔴none | 🔴.local.ex | 🔴none | 🔴fe none |
| Env validation | assert-on-boot, fail-fast | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Env var naming | Canonical (`SUPABASE_URL`…) | ✓ | ✓ | ✓ | 🔴NEXT_PUBLIC | 🔴? | 🔴NEXT_PUBLIC | 🔴? | 🔴SUPABASE_KEY |
| Deployment | Vercel (Docker for py be) | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CI workflow | `ci.yml` (install/build) | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | ✓ |
| Tests | Keep existing runner | 🔴none | 🔴none | 🔴none | 🔴none | ✓Vitest | 🔴none | ✓Jest | 🔴none |
| Lint / format | ESLint 9 (Prettier optional) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

> **Note on `Tests` and `Lint`:** the STANDARD is _keep what each repo
> already has_ — these rows mark absence of any runner as 🔴 only as a
> visibility flag, not as a forced migration. ESLint 9 is universal, so
> the lint row is all `✓`; Prettier is explicitly **optional** and its
> absence is **not** an exception.

## Universal gaps (every repo 🔴)

Three gaps appear in nearly every repo and are the cheapest,
highest-leverage wins:

1. **No runtime env validation** — every repo. A missing/typo'd env var
   fails late and silently instead of at boot.
2. **No fleet CI** — only `investor_autopilot` has a workflow. Nothing
   else gets an automated build/lint gate on push.
3. **`session.ts` is copy-pasted** — every Waters-2FA repo carries its
   own copy of the auth-template `session.ts`. Only the two cookie-name
   constants are meant to differ; the signing logic silently drifts.

## Consistent across the fleet

- **Next.js App Router + React + TypeScript `strict`** everywhere.
- **Tailwind v4** (`@tailwindcss/postcss`) everywhere.
- **Supabase** as the identity/data backbone (except `vacation-rentals`,
  see below), with a **single shared `app_access` table** already the
  documented design (`auth-template/README.md`).
- **Vercel** for the frontend everywhere; **ESLint 9** everywhere.
- **Waters 2FA** (bcrypt + TOTP + HMAC-signed cookie) is the dominant
  auth scheme: auth-template, career_insights_web, cardvault-web,
  sport_picker, my_ai_assistant.

## Where architecture diverges

- **Auth fork.** `race-days-and-ipas` uses **NextAuth v4**;
  `vacation-rentals` signs JWTs with **jose**; `cardvault-web` runs an
  enhanced **role-aware middleware** (a superset, not a violation).
- **Data-access outlier.** `vacation-rentals` uses **Drizzle ORM + Neon
  Postgres** instead of the Supabase SDK — the only repo not on
  Supabase for data, which also defeats the shared-project cost model.
- **`@supabase/ssr` split.** Only `career_insights_web` and
  `cardvault-web` use `@supabase/ssr`; the rest are on bare
  `@supabase/supabase-js`, with SDK versions ranging ~2.47→2.105.
- **Version skew.** Next.js spans 16.0.0 / 16.1.6 / 16.2.2 / 16.2.3 /
  16.2.4; `lucide-react` spans 0.460 → 1.8.
- **Project layout.** Most repos use `src/` with `@/*`→`src/*`;
  `race-days-and-ipas` and `vacation-rentals` use root-level
  `app/`+`lib/` with a different path alias.
- **Env conventions.** No shared convention: `.env.example`,
  `.env.local.example`, or nothing; `SUPABASE_URL` vs
  `NEXT_PUBLIC_SUPABASE_URL` vs `SUPABASE_KEY` naming.
- **Special shapes.** `investor_autopilot` is a monorepo with a
  FastAPI/Python backend (Docker); `cardvault-web` has a Python
  `card_valuation/` directory.

## Top consistency risks (ranked)

1. **`session.ts` drift** — silent divergence of security-critical
   signing code across every Waters-2FA repo. _Highest risk, lowest
   fix cost (a documented convention, no code rewrite)._
2. **Auth-scheme fork** — NextAuth (race-days) and jose
   (vacation-rentals) are entirely separate auth stacks to reason
   about, patch, and secure.
3. **Drizzle + Neon outlier** — a second database technology and a
   second paid datastore, isolated to one repo.
4. **No runtime env validation** — fleet-wide; cheap to add.
5. **No CI/test baseline** — only investor_autopilot has CI.
6. **Next.js / SDK / icon version skew** — drift that compounds upgrade
   cost over time.

## Supabase project & cost model

The fleet already runs a **shared-Supabase-project** model deliberately:
`auth-template/README.md` states _"One shared `app_access` Supabase
table serves every project,"_ and `SESSION_SECRET` is explicitly
**unique per project** so a leaked secret in one app cannot forge
sessions in another. This is a sound, durable, low-cost design — it is
**endorsed**, not treated as a compromise.

To make it stand the test of time it should be a written contract
(formalised in `CLAUDE_PLAYBOOK.md` §4c):

- A small, fixed set of shared Supabase projects (cost-driven).
- **Mandatory per-app table prefix** (e.g. `sp_`, `ai_`).
- **RLS on every app table** (the shared `app_access` table is the
  documented exception, accessed only via the service-role client).
- The shared `app_access` table for auth/SSO across apps.
- **No cross-app foreign keys**; per-app migration directory.
- A documented **project → app registry**.
- One explicit **"graduate to a dedicated project" trigger**:
  sensitive/regulated data, or a need for independent backup/scaling.

**Two things currently defeat the consolidation:**

1. **`vacation-rentals` on Neon** — pays for a second datastore and
   sits outside the shared `app_access`/RLS model. Migrating it onto
   Supabase is what actually realises the cost saving (tracked as a
   deferred, optional Tier 2 item in `REVISED_STANDARDS.md`).
2. **`race-days-and-ipas` table-prefix discipline is unclear** — verify
   it uses a distinct prefix within its shared project so it cannot
   collide with a sibling app.
