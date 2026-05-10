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
