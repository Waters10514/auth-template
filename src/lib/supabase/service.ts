import { createClient } from '@supabase/supabase-js'

/**
 * Supabase service role client — bypasses Row Level Security.
 * Only call this server-side (Server Components, Route Handlers, Server Actions).
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createServiceClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
