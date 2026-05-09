import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'

/**
 * Middleware — protects every route except login and auth API endpoints.
 * Place this file at the root of your src/ directory (or project root if no src/).
 *
 * Any unauthenticated request is redirected to /login before reaching your pages.
 */

const PUBLIC_PATHS = [
  '/login',
  '/api/auth', // all /api/auth/* routes are public (they're the login flow itself)
]

export function middleware(request: NextRequest) {
  const isPublic = PUBLIC_PATHS.some(p => request.nextUrl.pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  const session = getSessionFromRequest(request)
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Match everything except Next.js internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
