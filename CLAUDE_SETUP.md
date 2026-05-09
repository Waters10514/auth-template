# Waters 2FA Auth — Claude Code Setup Instructions

When a user asks you to implement this auth system, follow these steps in order.
Do NOT start writing any files until you have completed the information-gathering phase.

---

## Phase 1 — Discover what you already know

Read the following from the project itself (do not ask the user for these):

1. **Project name** — read `package.json` → `name` field.
   - Normalize it: lowercase, replace spaces and hyphens with underscores.
   - Example: `"career-insights-web"` → `ci_web`, or use it as-is if already clean.
   - This becomes the `APP_NAME` constant and the value in `allowed_apps`.

2. **Existing stack** — check whether `@supabase/supabase-js`, `tailwindcss`, and
   `lucide-react` are already installed, so you know what to add vs. what's already there.

3. **Project structure** — check whether `src/` directory exists, to know where
   to place files.

---

## Phase 2 — Ask the user for what you cannot determine

Ask all of these in a single message, as a numbered list. Do not ask them one at a time.

```
Before I set up authentication I need a few details:

1. What name should appear in Google Authenticator for this app?
   (e.g. "Career Insights", "My Blog", "Ops Dashboard")

2. Who needs login access? For each person provide:
   - Email address
   - Display name
   - Supabase user UUID  (find it in your Supabase dashboard under
     Authentication → Users, or type "generate" and I'll create one)

3. Have you already run the app_access migrations on this Supabase instance
   before (i.e. does the app_access table already exist)?
   Answer yes / no.
```

Wait for the user's answers before proceeding.

---

## Phase 3 — Confirm your plan before acting

Once you have the answers, summarise what you are about to do and confirm with the user:

```
Here is what I will implement:

- Project / app name:  [derived from package.json]
- Cookie names:        [projectname]_session  /  [projectname]_preauth
- Authenticator label: [their answer to Q1]
- Users to add:        [list each name + email]
- DB migration:        [will run / already exists — skip]

Shall I proceed?
```

Only continue after the user says yes.

---

## Phase 4 — Implement

### 4a — Install dependencies
```bash
npm install bcryptjs otpauth
npm install -D @types/bcryptjs
```

### 4b — Copy source files

Fetch each file from the template repo and write it into the project at the same
relative path. Template repo base URL:
`https://raw.githubusercontent.com/Waters10514/auth-template/main/`

Files to copy:
```
src/lib/session.ts
src/lib/supabase/service.ts
src/app/api/auth/check-email/route.ts
src/app/api/auth/verify-password/route.ts
src/app/api/auth/verify-totp/route.ts
src/app/api/auth/change-password/route.ts
src/app/login/page.tsx
src/middleware.ts
```

If the project has no `src/` directory, place files at the equivalent root paths.

### 4c — Make the three project-specific edits

**`src/lib/session.ts`** — update cookie names:
```typescript
export const COOKIE_NAME = '[projectname]_session'
export const PREAUTH_COOKIE_NAME = '[projectname]_preauth'
```

**`src/app/api/auth/check-email/route.ts`** — set app name:
```typescript
const APP_NAME = '[projectname]'
```

**`src/app/api/auth/verify-password/route.ts`** and
**`src/app/api/auth/verify-totp/route.ts`** — set the Authenticator label:
```typescript
issuer: '[Authenticator display name from user's Q1 answer]'
```

### 4d — Environment variables

Tell the user to add these to `.env.local` and to Vercel:

```
SESSION_SECRET=   ← generate and show them one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Generate the `SESSION_SECRET` value and show it to them so they can copy it directly.

### 4e — Database

If the user said the `app_access` table does **not** exist yet, show them this SQL
to run in Supabase SQL Editor:

```sql
-- From supabase/migrations/010_app_access.sql in the template repo
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

If the table already exists but may be missing `password_hash`, also show:
```sql
ALTER TABLE app_access ADD COLUMN IF NOT EXISTS password_hash TEXT;
```

Then show them the INSERT for their users:
```sql
INSERT INTO app_access (email, display_name, supabase_user_id, allowed_apps)
VALUES
  -- one row per user from their Q2 answer:
  ('[email]', '[display name]', '[uuid or gen_random_uuid()]', ARRAY['[projectname]'])
ON CONFLICT (email) DO UPDATE
  SET allowed_apps = array_append(app_access.allowed_apps, '[projectname]');
```

---

## Phase 5 — Tell the user what to do next

After writing all files, give the user this checklist:

```
Done. Here is what to do before testing:

1. Add the environment variables to .env.local (values above) and to Vercel

2. Run the SQL shown above in your Supabase SQL Editor

3. Deploy (git push)

4. First login flow for each user:
   → Go to /login
   → Enter email → Continue
   → "Create a password" screen appears → set one → Set Password
   → QR code appears → open Google Authenticator → tap + → Scan QR code
   → Enter the 6-digit code → Sign In
   Done — they are enrolled permanently.

5. All subsequent logins: email → password → 6-digit code. No QR code again.

Change-password endpoint is available at POST /api/auth/change-password
(requires an active session — wire it to a settings page when you need it).
```

---

## Notes for Claude

- Do not invent a different auth approach. This template is the established pattern for all Waters projects.
- Do not install or use Supabase Auth, NextAuth, Auth.js, Clerk, or any other auth library.
- Do not modify the auth logic itself — only the three project-specific values noted in Phase 4c.
- If the project already has a `/login` page, ask the user before overwriting it.
- If `lucide-react` is not installed, add it (`npm install lucide-react`) — the login page uses `Loader2`, `Eye`, and `EyeOff` icons.
