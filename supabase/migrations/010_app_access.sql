-- ============================================================
-- Migration 010: app_access table
-- Run once per Supabase instance. Shared across all projects.
-- ============================================================

CREATE TABLE IF NOT EXISTS app_access (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT        UNIQUE NOT NULL,
  display_name     TEXT,
  supabase_user_id UUID,                          -- links to auth.users (can be NULL for new projects)
  totp_secret      TEXT,                          -- Google Authenticator secret (base32)
  totp_enabled     BOOLEAN     NOT NULL DEFAULT false,
  password_hash    TEXT,                          -- bcrypt hash (set on first login)
  allowed_apps     TEXT[]      NOT NULL DEFAULT '{}',
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  last_login_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service role bypasses RLS — no policies needed
ALTER TABLE app_access DISABLE ROW LEVEL SECURITY;

-- ── Seed your users here ──────────────────────────────────────────────────────
-- Replace with real emails, names, UUIDs, and app names before running.
-- password_hash and totp_secret are left NULL — users set them on first login.
-- ─────────────────────────────────────────────────────────────────────────────

-- Example:
-- INSERT INTO app_access (email, display_name, supabase_user_id, allowed_apps) VALUES
--   ('user@example.com', 'User Name', 'supabase-uuid-here', ARRAY['my_project'])
-- ON CONFLICT (email) DO NOTHING;
