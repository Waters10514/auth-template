import { NextRequest, NextResponse } from 'next/server'
import * as OTPAuth from 'otpauth'
import { createServiceClient } from '@/lib/supabase/service'
import {
  verifyPreauthToken,
  PREAUTH_COOKIE_NAME,
  createSessionToken,
  COOKIE_NAME,
} from '@/lib/session'

export async function POST(request: NextRequest) {
  const { code } = await request.json()
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code required' }, { status: 400 })
  }

  // Validate the pre-auth cookie (set after password step passes)
  const preauthToken = request.cookies.get(PREAUTH_COOKIE_NAME)?.value
  if (!preauthToken) {
    return NextResponse.json(
      { error: 'Session expired — please sign in again' },
      { status: 401 }
    )
  }
  const email = verifyPreauthToken(preauthToken)
  if (!email) {
    return NextResponse.json(
      { error: 'Session expired — please sign in again' },
      { status: 401 }
    )
  }

  // Fetch this user's TOTP secret
  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('app_access')
    .select('supabase_user_id, email, totp_secret')
    .eq('email', email)
    .eq('is_active', true)
    .single()

  if (!user?.totp_secret) {
    return NextResponse.json({ error: 'TOTP not configured for this account' }, { status: 400 })
  }

  // Validate the 6-digit code — window:1 allows ±30 seconds of clock drift
  const totp = new OTPAuth.TOTP({
    issuer: 'Your App Name',  // ← match what you set in verify-password/route.ts
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.totp_secret),
  })

  const delta = totp.validate({ token: code.replace(/\s/g, ''), window: 1 })
  if (delta === null) {
    await new Promise(r => setTimeout(r, 500))
    return NextResponse.json(
      { error: 'Invalid code — check your Authenticator app' },
      { status: 401 }
    )
  }

  // Record the login timestamp
  await supabase
    .from('app_access')
    .update({ last_login_at: new Date().toISOString() })
    .eq('email', email)

  // Issue the full 30-day session cookie and clear the pre-auth cookie
  const sessionToken = createSessionToken({
    userId: user.supabase_user_id ?? email,
    email: user.email,
  })

  const response = NextResponse.json({ success: true })

  response.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    path: '/',
  })

  // Clear the pre-auth cookie
  response.cookies.set(PREAUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })

  return response
}
