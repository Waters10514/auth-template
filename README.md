# Waters Auth Template

A **self-contained 2FA authentication scheme** for Next.js App Router projects. No Supabase Auth, no OAuth, no third-party identity provider. One shared `app_access` Supabase table serves every project.

**Factor 1:** Email + password (bcrypt, stored per-user in Supabase)  
**Factor 2:** Google Authenticator TOTP code (per-user secret, also in Supabase)

Built and battle-tested in [career_insights_web](https://github.com/Waters10514/career_insights_web).

---

## Using with Claude Code

Paste this single prompt into Claude Code at the start of a new project session:

```
Implement the Waters 2FA auth system in this project.
Follow the instructions in CLAUDE_SETUP.md at:
https://raw.githubusercontent.com/Waters10514/auth-template/main/CLAUDE_SETUP.md
```

Claude Code will:
1. Read the project name from `package.json` automatically
2. Ask you for the Authenticator display name and user details
3. Confirm the plan before touching anything
4. Copy all files, make the three project-specific edits, generate your `SESSION_SECRET`, and give you the exact SQL to run

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Quick Start Checklist](#quick-start-checklist)
3. [Step 1 — Dependencies](#step-1--dependencies)
4. [Step 2 — Environment Variables](#step-2--environment-variables)
5. [Step 3 — Database Setup](#step-3--database-setup)
6. [Step 4 — Copy the Files](#step-4--copy-the-files)
7. [Step 5 — Adapt for Your Project](#step-5--adapt-for-your-project)
8. [Step 6 — Protect Your Routes](#step-6--protect-your-routes)
9. [Step 7 — Adding New Users](#step-7--adding-new-users)
10. [File Reference](#file-reference)

---

## How It Works

```
User enters email
      ↓
POST /api/auth/check-email   →  does this email exist? has a password set?
      ↓
User creates/enters password
      ↓
POST /api/auth/verify-password  →  bcrypt check, issues preauth cookie (5 min)
      ↓
User enters Google Authenticator code
      ↓
POST /api/auth/verify-totp   →  TOTP check, issues session cookie (30 days)
      ↓
All protected routes read session cookie → { userId, email }
```

Two cookies, both HMAC-SHA256 signed. No database lookup needed to validate a session on every request.

**First-time user flow:**
- No password yet → login page shows "Create a password" + confirm field
- No TOTP secret yet → login page shows a QR code to scan with Google Authenticator
- After setup, fully self-service on every subsequent login

---

## Quick Start Checklist

- [ ] `npm install bcryptjs otpauth && npm install -D @types/bcryptjs`
- [ ] Set `SESSION_SECRET` (unique per project), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` in env vars
- [ ] Run the two SQL migrations in Supabase
- [ ] Add user rows to `app_access` with your project name in `allowed_apps`
- [ ] Copy the 8 source files into your project
- [ ] Change `COOKIE_NAME` + `PREAUTH_COOKIE_NAME` in `session.ts`
- [ ] Add `allowed_apps` filter in `check-email/route.ts`
- [ ] Add session guard to your layouts or use `middleware.ts`

---

## Step 1 — Dependencies

```bash
npm install bcryptjs otpauth
npm install -D @types/bcryptjs
```

| Package | Purpose |
|---|---|
| `bcryptjs` | Password hashing (Factor 1) |
| `otpauth` | TOTP generation and validation (Factor 2) |

---

## Step 2 — Environment Variables

Add to Vercel dashboard and your local `.env.local`:

```bash
SESSION_SECRET=<64-char hex string — unique per project>
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Generate a unique `SESSION_SECRET`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> ⚠️ Never reuse `SESSION_SECRET` across projects. Each project must have its own.  
> A compromised secret in one project cannot be used to forge sessions in another.

---

## Step 3 — Database Setup

Run these two SQL files in your Supabase **SQL Editor** (once per Supabase instance — shared across all projects).

**Migration 1** — `supabase/migrations/010_app_access.sql`
Creates the `app_access` table and seeds initial users.

**Migration 2** — `supabase/migrations/011_password_hash.sql`
Adds the `password_hash` column (run after Migration 1).

The `allowed_apps` column in `app_access` is what lets one table serve multiple projects:

```sql
-- Add a new project's name to a user's access list
UPDATE app_access
SET allowed_apps = array_append(allowed_apps, 'my_new_project')
WHERE email = 'user@example.com'
  AND NOT ('my_new_project' = ANY(allowed_apps));
```

---

## Step 4 — Copy the Files

Copy these files from this repo into your Next.js project:

```
src/lib/session.ts                          ← cookie signing + pre-auth token helpers
src/lib/supabase/service.ts                 ← Supabase service role client
src/app/api/auth/check-email/route.ts
src/app/api/auth/verify-password/route.ts
src/app/api/auth/verify-totp/route.ts
src/app/api/auth/change-password/route.ts   ← optional (for a settings page)
src/app/login/page.tsx                      ← 3-step login UI
src/middleware.ts                           ← optional (protects all routes automatically)
```

---

## Step 5 — Adapt for Your Project

Only **two files** need project-specific changes after copying.

### `src/lib/session.ts` — Change the cookie names

```typescript
// Line 5-6: change these so cookies don't collide across projects in the same browser
export const COOKIE_NAME = 'myproject_session'    // default: 'app_session'
export const PREAUTH_COOKIE_NAME = 'myproject_preauth'  // default: 'app_preauth'
```

Use something unique to your project, e.g. `ci_session`, `blog_session`, `crm_session`.

### `src/app/api/auth/check-email/route.ts` — Add your app name filter

```typescript
// Add the .contains() filter so only users granted access to THIS app can log in
const { data } = await supabase
  .from('app_access')
  .select('email, password_hash, totp_secret, is_active')
  .eq('email', email.toLowerCase().trim())
  .contains('allowed_apps', ['my_new_project'])   // ← add this line
  .single()
```

Replace `'my_new_project'` with whatever string you used when inserting the user row.

**That's it.** All other files work without modification.

---

## Step 6 — Protect Your Routes

### Option A — Middleware (recommended — protects everything automatically)

Copy `src/middleware.ts` into your project root. It redirects any unauthenticated request to `/login` before it reaches your pages or API routes.

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth']

export function middleware(request: NextRequest) {
  const isPublic = PUBLIC_PATHS.some(p => request.nextUrl.pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.redirect(new URL('/login', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### Option B — Per-layout guard (more granular control)

```typescript
// In any Server Component layout or page
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')
  return <>{children}</>
}
```

### Option C — Route Handler guard

```typescript
// In any API route handler
import { getSessionFromRequest } from '@/lib/session'

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // session.userId — Supabase user UUID
  // session.email  — their email address
}
```

---

## Step 7 — Adding New Users

### First: Insert a row into Supabase

```sql
INSERT INTO app_access (email, display_name, supabase_user_id, allowed_apps)
VALUES (
  'newuser@example.com',
  'New User Name',
  'their-supabase-uuid-from-auth.users',  -- or NULL if no Supabase Auth user
  ARRAY['my_new_project']
)
ON CONFLICT (email) DO UPDATE
  SET allowed_apps = array_append(
    app_access.allowed_apps, 'my_new_project'
  );
```

To find the `supabase_user_id`, run:
```sql
SELECT id, email FROM auth.users WHERE email = 'newuser@example.com';
```

If this is a new app with no Supabase Auth users at all, `supabase_user_id` can be `NULL` — the session will use the email as the userId fallback. Or generate a UUID:
```sql
SELECT gen_random_uuid();  -- use this as the supabase_user_id
```

### Then: Tell the user their first-login flow

1. Go to `/login` on your app
2. Enter their email → Continue
3. **"Create a password"** screen appears (since `password_hash` is NULL) → set one
4. A **QR code** appears (since `totp_secret` is NULL) → open Google Authenticator → tap **+** → **Scan a QR code** → scan it
5. Enter the first 6-digit code shown → Sign In
6. Done — enrolled permanently, fully self-service from here on

No admin action needed after the initial DB row.

---

## File Reference

### `src/lib/session.ts`
- `createSessionToken(data)` — signs a 30-day session cookie payload
- `verifySessionToken(token)` — validates signature + expiry, returns `{ userId, email }`
- `createPreauthToken(email)` — signs a 5-minute pre-auth cookie (bridges password → TOTP step)
- `verifyPreauthToken(token)` — validates pre-auth cookie, returns email string
- `getSession()` — Server Component helper (reads from `next/headers`)
- `getSessionFromRequest(request)` — Route Handler helper (reads from `NextRequest`)

### `src/lib/supabase/service.ts`
Creates a Supabase client using the service role key — bypasses RLS. **Only use server-side.**

### API Routes

| Route | Method | What it does |
|---|---|---|
| `/api/auth/check-email` | POST | Looks up email in `app_access`, returns `hasPassword`, `hasTotp` |
| `/api/auth/verify-password` | POST | bcrypt validates or sets password, issues `preauth` cookie |
| `/api/auth/verify-totp` | POST | Validates TOTP code, issues full session cookie |
| `/api/auth/change-password` | POST | Changes password (requires active session) |

### `src/app/login/page.tsx`
Three-step client component:
1. **Email** — calls `check-email`, determines if first-time user
2. **Password** — shows "Create a password" (new) or "Enter your password" (returning), calls `verify-password`
3. **TOTP** — shows QR code if new secret was just generated, calls `verify-totp`, redirects to `/digest` on success

---

## Security Notes

- Passwords are hashed with **bcrypt at cost factor 12** — slow enough to resist brute force
- HMAC cookies are signed with **SHA-256** — cannot be forged without `SESSION_SECRET`
- All auth endpoints have **500ms artificial delay** on failure — slows brute force attempts
- Pre-auth cookie has a **5-minute TTL** — limits the window between steps
- TOTP validation uses **window: 1** — allows ±30 seconds of clock drift
- `timingSafeEqual` is used for all signature comparisons — prevents timing attacks
- Cookies are `httpOnly`, `secure` (production), `sameSite: lax`

---

## Customising the Login Page

The login page (`src/app/login/page.tsx`) is plain Tailwind CSS — no component library dependency. Swap in your own brand colours, logo, and copy. The only functional pieces are:

- Three `fetch()` calls to the auth API routes
- The 6-digit TOTP input with auto-submit on completion
- The QR code `<img>` (uses `api.qrserver.com` — a free, reliable public QR generator)

---

*Built by Greg Waters · [Waters10514 on GitHub](https://github.com/Waters10514)*
