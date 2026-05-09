# Waters 2FA Auth — Claude Code Migration Instructions

Use this when migrating an **existing project** that already has some form of
authentication to the Waters 2FA scheme. Follow the phases in order.
Do NOT modify any files until Phase 4.

---

## Phase 1 — Audit the existing auth

Read the project and answer these questions for yourself before doing anything:

1. **What auth system is currently in place?**
   Look for: Supabase Auth (`supabase.auth.*`), NextAuth/Auth.js, Clerk, a custom
   session cookie, or something else. Check `package.json`, middleware, login page,
   and any API routes under `/api/auth/`.

2. **Where is the session read?**
   Search for any file that calls `getSession()`, `getServerSession()`,
   `auth()`, `currentUser()`, `supabase.auth.getUser()`, or reads a session
   cookie directly. List every file — these will need updating after the swap.

3. **What does the session object currently provide?**
   Note the field names used: `user.id`, `session.userId`, `session.user.email`,
   etc. The new session provides `{ userId, email }` — find any mismatches.

4. **Does a login page already exist?**
   Note the path (`/login`, `/sign-in`, etc.) and whether it redirects anywhere
   specific after login.

5. **Does middleware already exist?**
   Check for `src/middleware.ts` or `middleware.ts`. Note what it currently does.

6. **Is `app_access` already set up for this project?**
   Check if `app_access` is referenced anywhere in the codebase and whether this
   project's name appears in the `allowed_apps` column. If unsure, you will ask
   the user.

---

## Phase 2 — Ask the user for what you cannot determine

Ask all of these in a single message. Do not ask one at a time.

```
I've reviewed the existing auth setup. Before I migrate it I need a few details:

1. What name should appear in Google Authenticator for this app?
   (e.g. "Career Insights", "My Blog", "Ops Dashboard")

2. Who needs login access? For each person provide:
   - Email address
   - Display name
   - Supabase user UUID  (find it under Authentication → Users in your Supabase
     dashboard, or type "generate" and I'll create one)

3. Is the app_access table already set up in your Supabase instance?
   (It is shared — if you have already done this for another Waters project,
   answer yes.)

4. I found the following files that read the current session:
   [list the files you found in Phase 1]
   Are there any others I should know about?

5. After login, where should users be redirected?
   (Currently: [what you found]. Press Enter to keep the same, or tell me a
   different path.)
```

Wait for the user's answers before proceeding.

---

## Phase 3 — Confirm your migration plan

Summarise exactly what will change and get a yes before touching anything:

```
Here is my migration plan:

REPLACING:
- Current auth: [what you found — e.g. Supabase Auth, NextAuth, custom cookie]
- Current login page: [path]
- Current middleware: [exists / does not exist]

INSTALLING:
- bcryptjs, otpauth (new dependencies)
- src/lib/session.ts  (replaces existing session logic)
- src/lib/supabase/service.ts  [skip if already present]
- src/app/api/auth/check-email/route.ts   (new)
- src/app/api/auth/verify-password/route.ts  (new)
- src/app/api/auth/verify-totp/route.ts  (new)
- src/app/api/auth/change-password/route.ts  (new)
- src/app/login/page.tsx  (replaces existing login page)
- src/middleware.ts  (replaces / creates middleware)

UPDATING (session call sites):
- [list each file from Phase 1 that reads the session]

PROJECT-SPECIFIC VALUES:
- App name / cookie prefix: [derived from package.json]
- Authenticator label: [from user's Q1]
- Users to add to app_access: [list]
- DB migration: [will run / table exists, will add users only]

Shall I proceed?
```

Only continue after the user confirms.

---

## Phase 4 — Execute the migration

### 4a — Install dependencies
```bash
npm install bcryptjs otpauth
npm install -D @types/bcryptjs
```

Also install `lucide-react` if not already present (the login page needs it):
```bash
npm install lucide-react
```

### 4b — Remove or archive old auth files

- If there are existing files under `/api/auth/` that conflict (e.g. `/api/auth/[...nextauth]`,
  `/api/auth/callback`, `/api/auth/signin`), delete them.
- If there is a Supabase browser client being used for auth (`createBrowserClient`,
  `supabase.auth.signIn`, etc.), remove those calls. The service client
  (`src/lib/supabase/service.ts`) is the only Supabase client needed going forward.

### 4c — Copy the new auth files

Fetch each file from the template repo and write it into the project:
Base URL: `https://raw.githubusercontent.com/Waters10514/auth-template/main/`

```
src/lib/session.ts
src/lib/supabase/service.ts        ← skip if already identical
src/app/api/auth/check-email/route.ts
src/app/api/auth/verify-password/route.ts
src/app/api/auth/verify-totp/route.ts
src/app/api/auth/change-password/route.ts
src/app/login/page.tsx
src/middleware.ts
```

### 4d — Make the three project-specific edits

**`src/lib/session.ts`**:
```typescript
export const COOKIE_NAME = '[projectname]_session'
export const PREAUTH_COOKIE_NAME = '[projectname]_preauth'
```

**`src/app/api/auth/check-email/route.ts`**:
```typescript
const APP_NAME = '[projectname]'
```

**`src/app/api/auth/verify-password/route.ts`** and **`verify-totp/route.ts`**:
```typescript
issuer: '[Authenticator display name]'
```

### 4e — Update session call sites

For every file identified in Phase 1 that reads the old session, update it to
use the new helpers:

**In Server Components and layouts:**
```typescript
// remove old import (getServerSession, auth, currentUser, etc.)
import { getSession } from '@/lib/session'

const session = await getSession()
if (!session) redirect('/login')
// use session.userId and session.email
```

**In Route Handlers (API routes):**
```typescript
// remove old import
import { getSessionFromRequest } from '@/lib/session'

const session = getSessionFromRequest(request)
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
// use session.userId and session.email
```

**Common field name mismatches to fix:**

| Old field | New field |
|---|---|
| `session.user.id` | `session.userId` |
| `session.user.email` | `session.email` |
| `user.id` | `session.userId` |
| `session.supabaseId` | `session.userId` |

Search the codebase for these patterns and update them.

### 4f — Remove old auth packages (if no longer needed)

Check `package.json` for packages that are now unused:
- `next-auth` / `@auth/core`
- `@supabase/ssr` (only if it was used exclusively for auth — keep it if used for other things)
- Any JWT libraries that were powering the old session

Remove them with `npm uninstall [package-name]`.

### 4g — Environment variables

Tell the user to add to `.env.local` and Vercel (removing old auth env vars if applicable):

```
SESSION_SECRET=   ← generate one now and show it:
                  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SUPABASE_URL=     (likely already set)
SUPABASE_SERVICE_ROLE_KEY=  (likely already set)
```

Old vars that can be removed (if present):
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (only if used purely for auth)

### 4h — Database

Show the user exactly what SQL to run, based on their answers in Phase 2:

**If `app_access` table does not exist:**
```sql
CREATE TABLE IF NOT EXISTS app_access (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        UNIQUE NOT NULL,
  display_name     TEXT,
  supabase_user_id UUID,
  totp_secret      TEXT,
  totp_enabled     BOOLEAN     NOT NULL DEFAULT false,
  password_hash    TEXT,
  allowed_apps     TEXT[]      NOT NULL DEFAULT '{}',
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE app_access DISABLE ROW LEVEL SECURITY;
```

**If table exists but may be missing `password_hash`:**
```sql
ALTER TABLE app_access ADD COLUMN IF NOT EXISTS password_hash TEXT;
```

**Add the users for this project:**
```sql
INSERT INTO app_access (email, display_name, supabase_user_id, allowed_apps)
VALUES
  ('[email]', '[name]', '[uuid]', ARRAY['[projectname]'])
ON CONFLICT (email) DO UPDATE
  SET allowed_apps = array_append(
    app_access.allowed_apps, '[projectname]'
  )
  WHERE NOT ('[projectname]' = ANY(app_access.allowed_apps));
```

---

## Phase 5 — Verify and hand off

Run a TypeScript check:
```bash
npx tsc --noEmit
```

Fix any type errors before committing. Common ones:
- Old session type used somewhere (`Session`, `User` from next-auth, etc.) — replace with `SessionData` from `@/lib/session`
- `session.user.id` → `session.userId`

Then give the user this handoff message:

```
Migration complete. Before testing:

1. Add SESSION_SECRET to .env.local and Vercel (value shown above)
2. Remove old auth env vars from Vercel if applicable
3. Run the SQL shown above in Supabase SQL Editor
4. Deploy (git push)

First login for each user:
→ /login → enter email → create password → scan QR code → enter code → done
Subsequent logins: email → password → 6-digit code from Authenticator.

If anything breaks, the most likely cause is a session field name mismatch
(session.userId vs session.user.id). Search for `.user.id` and `.user.email`
in the codebase if you see unexpected 'Unauthorized' errors.
```

---

## Notes for Claude

- Do not invent a different auth approach. This is the established pattern for all Waters projects.
- Do not use Supabase Auth, NextAuth, Auth.js, Clerk, or any other auth library.
- If you are unsure whether a file uses the old session, read it — do not guess.
- If removing an old auth package would break something else in the project, flag it to the user before proceeding.
- The middleware replaces any existing auth middleware entirely. If the existing middleware does things beyond auth (e.g. i18n, redirects), merge those into the new `middleware.ts` rather than discarding them.
