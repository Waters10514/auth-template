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
