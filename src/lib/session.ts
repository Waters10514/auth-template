import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

// ── Change these two names to be unique for your project ──────────────────────
export const COOKIE_NAME = 'app_session'        // e.g. 'ci_session', 'blog_session'
export const PREAUTH_COOKIE_NAME = 'app_preauth' // e.g. 'ci_preauth', 'blog_preauth'
// ─────────────────────────────────────────────────────────────────────────────

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const PREAUTH_DURATION_MS = 5 * 60 * 1000            // 5 minutes

// Set SESSION_SECRET in your Vercel env vars — generate with:
// node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const SESSION_SECRET = process.env.SESSION_SECRET ?? 'change-this-insecure-default-before-deploying'

export interface SessionData {
  userId: string
  email: string
}

function sign(data: string): string {
  return createHmac('sha256', SESSION_SECRET).update(data).digest('hex')
}

// ── Full session token (30 days) ──────────────────────────────────────────────

export function createSessionToken(data: SessionData): string {
  const payload = JSON.stringify({ ...data, exp: Date.now() + SESSION_DURATION_MS })
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = sign(encoded)
  return `${encoded}.${sig}`
}

export function verifySessionToken(token: string): SessionData | null {
  try {
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) return null
    const encoded = token.slice(0, dotIndex)
    const sig = token.slice(dotIndex + 1)
    const expectedSig = sign(encoded)
    if (sig.length !== expectedSig.length) return null
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (Date.now() > payload.exp) return null
    return { userId: payload.userId, email: payload.email }
  } catch {
    return null
  }
}

// ── Pre-auth token (5 min — bridges password step to TOTP step) ───────────────

export function createPreauthToken(email: string): string {
  const payload = JSON.stringify({ email, preAuth: true, exp: Date.now() + PREAUTH_DURATION_MS })
  const encoded = Buffer.from(payload).toString('base64url')
  const sig = sign(encoded)
  return `${encoded}.${sig}`
}

export function verifyPreauthToken(token: string): string | null {
  try {
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) return null
    const encoded = token.slice(0, dotIndex)
    const sig = token.slice(dotIndex + 1)
    const expectedSig = sign(encoded)
    if (sig.length !== expectedSig.length) return null
    if (!timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (Date.now() > payload.exp) return null
    if (!payload.preAuth) return null
    return payload.email as string
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** For Server Components — reads session from next/headers cookies */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/** For Route Handlers — reads session from the incoming NextRequest */
export function getSessionFromRequest(request: NextRequest): SessionData | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifySessionToken(token)
}
