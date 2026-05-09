import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import * as OTPAuth from 'otpauth'
import { createServiceClient } from '@/lib/supabase/service'
import { createPreauthToken, PREAUTH_COOKIE_NAME } from '@/lib/session'

export async function POST(request: NextRequest) {
  const { email, password, isNew, confirmPassword } = await request.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('app_access')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('is_active', true)
    .single()

  if (!user) {
    await new Promise(r => setTimeout(r, 500))
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  let newTotpQrUri: string | null = null

  if (isNew || !user.password_hash) {
    // First-time setup: validate and store new password
    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 12)

    // Generate a new TOTP secret only if the user doesn't already have one
    let totpSecret = user.totp_secret?.trim() ?? ''
    if (!totpSecret) {
      const secret = new OTPAuth.Secret()
      totpSecret = secret.base32
      const totp = new OTPAuth.TOTP({
        issuer: 'Your App Name',  // ← change to your app's display name
        label: email.toLowerCase().trim(),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret,
      })
      newTotpQrUri = totp.toString() // otpauth:// URI — shown as QR code in the UI

      await supabase
        .from('app_access')
        .update({ password_hash: hash, totp_secret: totpSecret })
        .eq('email', email.toLowerCase().trim())
    } else {
      // User has an existing TOTP secret (e.g. migrated from old system)
      await supabase
        .from('app_access')
        .update({ password_hash: hash })
        .eq('email', email.toLowerCase().trim())
    }
  } else {
    // Returning user: verify their existing password
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      await new Promise(r => setTimeout(r, 500))
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }
  }

  // Issue short-lived pre-auth cookie (5 min) — proves password step passed
  const preauthToken = createPreauthToken(email.toLowerCase().trim())
  const response = NextResponse.json({
    success: true,
    qrUri: newTotpQrUri, // null when user already has TOTP configured
  })
  response.cookies.set(PREAUTH_COOKIE_NAME, preauthToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 5 * 60,
    path: '/',
  })
  return response
}
