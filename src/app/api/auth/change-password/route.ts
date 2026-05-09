import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSessionFromRequest } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { currentPassword, newPassword, confirmPassword } = await request.json()

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('app_access')
    .select('password_hash')
    .eq('email', session.email)
    .single()

  if (!user?.password_hash) {
    return NextResponse.json({ error: 'No password set for this account' }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) {
    await new Promise(r => setTimeout(r, 500))
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
  }

  const hash = await bcrypt.hash(newPassword, 12)
  await supabase
    .from('app_access')
    .update({ password_hash: hash })
    .eq('email', session.email)

  return NextResponse.json({ success: true })
}
