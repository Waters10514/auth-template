import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// ── CHANGE THIS to match your project's name in app_access.allowed_apps ──────
const APP_NAME = 'my_project'
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { email } = await request.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('app_access')
    .select('email, password_hash, totp_secret, is_active')
    .eq('email', email.toLowerCase().trim())
    .contains('allowed_apps', [APP_NAME])  // only users allowed into THIS app
    .single()

  if (!data || !data.is_active) {
    await new Promise(r => setTimeout(r, 400)) // timing defense — don't reveal existence
    return NextResponse.json({ error: 'Email not recognized' }, { status: 404 })
  }

  return NextResponse.json({
    hasPassword: !!data.password_hash,
    hasTotp: !!(data.totp_secret?.trim()),
  })
}
