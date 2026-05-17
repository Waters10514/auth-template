# Revised Standards — Strengthen & Port Plan

_How to bring the fleet into line with `CLAUDE_PLAYBOOK.md`, ordered by
risk. The governing principle is **incremental, low-risk change over
rewrites**: nothing here requires a large migration to be "compliant."_

This is a **written plan only**. No repository code is changed by this
document.

## Two tiers, explicitly separated

### Tier 1 — Low-risk, additive, recommended now

No rewrites, no new runtime dependencies, each item independently
shippable and individually revertible:

- **(a) `session.ts` as single source of truth.** Document
  `auth-template/src/lib/session.ts` as canonical. Convention only:
  when auth logic changes, **re-copy** the file rather than hand-patch
  per repo; only `COOKIE_NAME` / `PREAUTH_COOKIE_NAME` stay local. No
  code change to ship this — it is a rule.
- **(b) `.env.example` + canonical names.** Commit a `.env.example`
  with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`
  (placeholders only).
- **(c) CI.** Drop in the `ci.yml` derived from the proven
  `investor_autopilot` workflow (`npm ci` + `npm run build`, plus
  `lint` / `tsc --noEmit`).
- **(d) Version pinning.** Pin Next.js / Supabase / `lucide-react` to
  exact versions (no `^`).
- **(e) Env assert.** Add the ~15-line `src/lib/env.ts` boot assert
  (no new dependency).
- **(f) Supabase cost contract.** Ratify the existing shared-project
  model (prefix + RLS + shared `app_access`) and add a **project → app
  registry** (template below). This just writes down what already
  happens.

### Tier 2 — Structural, high-risk, OPTIONAL / DEFERRED

Target state, **not required for conformance, gates nothing**. Do these
**only when the repo is already being actively worked on** for other
reasons. Each carries a rollback note.

- **race-days-and-ipas: NextAuth v4 → Waters 2FA.**
  _Rollback:_ keep the NextAuth routes and `[...nextauth]` handler in
  place behind the existing paths until the Waters flow is verified in
  production; revert = restore the prior `package.json` +
  `next-auth` config, delete the copied `session.ts`/auth routes.
- **vacation-rentals: Drizzle + Neon → Supabase.**
  _Rollback:_ keep the Drizzle schema + Neon connection string until
  data is migrated and read/write paths verified; revert = restore the
  `drizzle/` dir + `DATABASE_URL`. High effort (data migration).
- **vacation-rentals: jose → Waters 2FA.** Pairs with the above;
  same rollback shape as race-days.
- **Root `app/` → `src/` relocation** (race-days, vacation-rentals).
  Mechanical but touches every import; do it in its own PR.
- **Fleet shadcn/ui adoption** — only where a component library is
  actually wanted; never a forced migration.

## Per-repo port plan (ordered low → high effort / risk)

| # | Repo | Gap | Target | Steps | Effort | Risk | Tier |
|---|---|---|---|---|---|---|---|
| 1 | investor_autopilot | env validation; pin versions | already has CI | add `env.ts` assert; pin Next/Supabase | XS | Low | T1 |
| 2 | sport_picker | no CI; no env assert; version skew | conform | add `ci.yml`; `.env` names; `env.ts`; pin | S | Low | T1 |
| 3 | my_ai_assistant | as #2 + wrong env filename; old lucide | conform | rename `.env.local.example`→`.env.example`; add CI/env assert; bump+pin `lucide-react`; pin Next | S | Low | T1 |
| 4 | career_insights_web | no CI; version skew | conform (already ssr + shadcn) | add `ci.yml`; pin versions; add `env.ts` | S | Low | T1 |
| 5 | cardvault-web | no CI; bare ssr; Radix-direct | conform | add `ci.yml`; pin; add `env.ts`. **Note:** role-aware middleware is an accepted superset — fold reusable bits back into auth-template when convenient (small T2) | S–M | Low–Med | T1 (+T2 note) |
| 6 | auth-template | scaffold lacks env assert + CI; session.ts not declared canonical | central source of truth | add `env.ts` + `ci.yml` to scaffold; document `session.ts` as single source of truth in `CLAUDE_SETUP.md` | S | Low | T1 (central) |
| 7 | race-days-and-ipas | NextAuth; root layout; no middleware guard | Waters 2FA; `src/` | T1 items first; then **(T2)** migrate NextAuth→Waters 2FA per `CLAUDE_SETUP.md`; layout relocation optional | L | High | T1 then T2 |
| 8 | vacation-rentals | Drizzle+Neon; jose; root layout | Supabase + Waters 2FA | T1 items first; then **(T2)** Drizzle+Neon→Supabase, jose→Waters 2FA, layout relocation | XL | Highest | T1 then T2 |

_Every one of the 8 repos appears exactly once. Rows 1–6 are pure
Tier 1 (safe now). Rows 7–8 get their Tier 1 wins now; their Tier 2
rewrites stay deferred and optional._

## Project → app registry (maintain this table)

Fill and keep current as the source of truth for the shared-Supabase
cost model. Example shape:

| Supabase project | Apps (table prefix) | Notes |
|---|---|---|
| core | sport_picker (`sp_`), my_ai_assistant (`ai_`), race-days-and-ipas (`rdi_` — **verify**) | shared `app_access` lives here |
| _(tbd)_ | career_insights_web, cardvault-web, investor_autopilot | confirm actual project + prefixes |
| _(none)_ | vacation-rentals | **on Neon — migrate onto a shared project (Tier 2)** |

> Action: confirm the real project assignments and prefixes, and verify
> `race-days-and-ipas` uses a distinct prefix so it cannot collide with
> a sibling app in the same project.

## Sequencing recommendation

1. Land **Tier 1 across rows 1–6** first — each is a few-line, additive,
   independently revertible PR.
2. Do **row 6 (auth-template)** early too: declaring `session.ts`
   canonical and shipping the `env.ts` + `ci.yml` scaffold makes rows
   1–5 copy-paste cheap.
3. Treat **rows 7–8 Tier 2** as opportunistic: only when those repos
   are open for feature work anyway. They are not blockers and do not
   gate any "fleet conformance" status.
