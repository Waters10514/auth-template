# Waters 2FA Auth — Claude Code Patch Instructions

Use this when applying upstream fixes to a project that **already has** the
Waters 2FA auth scheme installed. Each section is self-contained and idempotent
— if a project already has the patch applied, the section is a no-op.

Read every section in order. For each one, check whether the project already
has the change. If yes, skip. If no, apply it.

---

## Patch 001 — Redirect-loop fix (Edge/Node HMAC mismatch)

**Symptom**: After the user enters the TOTP code, `/api/auth/verify-totp`
returns 200, but the next navigation redirects them straight back to `/login`.

**Root cause**: Next.js compiles middleware for the Edge runtime by default.
On Edge, `node:crypto`'s HMAC produces signatures that don't byte-for-byte
match what the Node-runtime route handlers produced when signing the cookie.
Middleware then rejects valid cookies and bounces the user back to `/login`.

**Fix**: Pin middleware to the Node runtime, add a diagnostic redirect log,
and add a `/api/auth/me` endpoint for triage.

### 001a — Update `src/middleware.ts`

Open `src/middleware.ts`. **Preserve any project-specific public paths the
file already has** (e.g. `/api/cron`, `/api/webhooks`, `/api/healthz`) and
merge them into `PUBLIC_PATHS` below. Then ensure the file contains:

- `export const runtime = 'nodejs'` near the top (this is the actual fix)
- `COOKIE_NAME` added to the `@/lib/session` import
- The diagnostic `console.log` inside the redirect branch
- The expanded `matcher` that also excludes common image extensions

End state:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, COOKIE_NAME } from '@/lib/session'

export const runtime = 'nodejs'   // critical: prevents Edge/Node HMAC mismatch

const PUBLIC_PATHS = [
  '/login',
  '/api/auth',
  // ── keep any project-specific public paths that were already here ──
  // e.g. '/api/cron', '/api/webhooks', '/api/healthz'
]

export function middleware(request: NextRequest) {
  const isPublic = PUBLIC_PATHS.some(p => request.nextUrl.pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  const session = getSessionFromRequest(request)
  if (!session) {
    const hasCookie = !!request.cookies.get(COOKIE_NAME)?.value
    const secretSet = !!process.env.SESSION_SECRET
    console.log(
      `[middleware] redirect → /login path=${request.nextUrl.pathname} ` +
        `cookie=${hasCookie ? 'present' : 'missing'} ` +
        `secret=${secretSet ? 'set' : 'unset'}`,
    )
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### 001b — Add `src/app/api/auth/me/route.ts`

If this file does not exist, create it:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, COOKIE_NAME } from '@/lib/session'

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(COOKIE_NAME)?.value
  const secretSet = !!process.env.SESSION_SECRET
  if (!raw) {
    return NextResponse.json(
      { ok: false, reason: 'no_cookie', cookie_name: COOKIE_NAME, secret_set: secretSet },
      { status: 401 },
    )
  }
  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.json(
      { ok: false, reason: 'invalid_or_expired', secret_set: secretSet, token_prefix: raw.slice(0, 12) + '…' },
      { status: 401 },
    )
  }
  return NextResponse.json({ ok: true, userId: session.userId, email: session.email, secret_set: secretSet })
}
```

This route lives under `/api/auth/*`, so the middleware's existing PUBLIC_PATHS
already lets it through unauthenticated.

### 001c — Verify

1. `npx tsc --noEmit` — should pass.
2. After deploy, hit `/api/auth/me` in a logged-in browser — expect
   `{ ok: true, userId, email, secret_set: true }`.
3. Hit `/api/auth/me` with no session cookie — expect
   `{ ok: false, reason: 'no_cookie', ... }`.
4. If the redirect-loop symptom returns, the diagnostic `[middleware]` log
   line in Vercel Logs identifies the failure mode.

### Operational triage table

| `/api/auth/me` response | Diagnosis | Fix |
|---|---|---|
| `ok: true` | Session is valid — bug is page-level | Look for a `redirect("/login")` in a server component or layout that's mis-firing |
| `reason: 'no_cookie'` | Browser never kept the cookie | Check the Set-Cookie response from `/api/auth/verify-totp`, the Secure/SameSite flags, and that the host matches |
| `reason: 'invalid_or_expired'` + `secret_set: true` | HMAC verify failed | `SESSION_SECRET` differs between sign and verify — re-set the env var with no whitespace/quotes, redeploy, clear the session cookie, log in fresh |
| `secret_set: false` | Env var not visible to the function | Add `SESSION_SECRET` to Vercel → **Redeploy** (env vars apply at deploy time, not retroactively) |

---

## Notes for Claude

- Each patch is idempotent. If a project already has the change, skip it
  silently — do not re-apply.
- When updating `middleware.ts`, preserve project-specific `PUBLIC_PATHS`.
  If you see entries beyond `/login` and `/api/auth`, keep them.
- Do not change `session.ts`, the auth route handlers, or the login page in
  this patch — only `middleware.ts` and the new `/api/auth/me` route.
- Run `npx tsc --noEmit` after applying. Do not commit if types fail.
- After applying, summarise what changed (or "already up to date") and remind
  the user to deploy.
